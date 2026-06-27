import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { LocalTrabalhoDiario, MapeamentoFlitLocalTrabalho, Colaborador } from '@/types/database'
import { parseExcelFlit, agruparBatidasPorDia, encontrarColaborador } from '@/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '@/lib/escalas/inferirLocalTrabalho'

export interface FiltrosEscalasDiario {
  colaboradorId?: string
  localTrabalhoId?: string
  status?: 'todos' | 'identificados' | 'pendentes'
}

export interface Competencia {
  ano: number
  mes: number // mês base (ex: 6 para competência 20/06 a 19/07)
  inicio: string // YYYY-MM-DD
  fim: string // YYYY-MM-DD
  label: string // "Junho/2026"
}

function formatarDataLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function calcularCompetencia(ano: number, mes: number): Competencia {
  const inicio = new Date(ano, mes - 1, 20)
  const fim = new Date(ano, mes, 19)

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]

  return {
    ano,
    mes,
    inicio: formatarDataLocal(inicio),
    fim: formatarDataLocal(fim),
    label: `${meses[mes - 1]}/${ano}`,
  }
}

export function useEscalasDiario() {
  const [dias, setDias] = useState<LocalTrabalhoDiario[]>([])
  const [loading, setLoading] = useState(false)
  const [importando, setImportando] = useState(false)

  const listar = useCallback(async (
    competencia: Competencia,
    filtros: FiltrosEscalasDiario = {}
  ) => {
    setLoading(true)
    try {
      let query = supabase
        .from('locais_trabalho_diario')
        .select('*, colaborador:colaboradores(*), local_trabalho:locais_trabalho(*)')
        .gte('data', competencia.inicio)
        .lte('data', competencia.fim)
        .order('data', { ascending: true })

      if (filtros.colaboradorId) {
        query = query.eq('colaborador_id', filtros.colaboradorId)
      }
      if (filtros.localTrabalhoId) {
        query = query.eq('local_trabalho_id', filtros.localTrabalhoId)
      }
      if (filtros.status === 'identificados') {
        query = query.not('local_trabalho_id', 'is', null)
      } else if (filtros.status === 'pendentes') {
        query = query.is('local_trabalho_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      setDias((data || []) as unknown as LocalTrabalhoDiario[])
      return (data || []) as unknown as LocalTrabalhoDiario[]
    } catch (err: unknown) {
      console.error('Erro ao carregar escalas:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar escalas')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const confirmarManual = useCallback(async (
    diaId: string,
    localTrabalhoId: string,
    observacao?: string
  ) => {
    try {
      const { data: usuario } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('locais_trabalho_diario')
        .update({
          local_trabalho_id: localTrabalhoId,
          fonte: 'manual',
          usuario_confirmacao_id: usuario.user?.id,
          confirmado_em: new Date().toISOString(),
          observacao: observacao || null,
        } as Partial<LocalTrabalhoDiario>)
        .eq('id', diaId)
      if (error) throw error

      toast.success('Local confirmado')
      return true
    } catch (err: unknown) {
      console.error('Erro ao confirmar local:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar local')
      return false
    }
  }, [])

  const aplicarEmLote = useCallback(async (
    diaIds: string[],
    localTrabalhoId: string,
    observacao?: string
  ) => {
    try {
      const { data: usuario } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('locais_trabalho_diario')
        .update({
          local_trabalho_id: localTrabalhoId,
          fonte: 'manual',
          usuario_confirmacao_id: usuario.user?.id,
          confirmado_em: new Date().toISOString(),
          observacao: observacao || null,
        } as Partial<LocalTrabalhoDiario>)
        .in('id', diaIds)
      if (error) throw error

      toast.success(`${diaIds.length} dia(s) atualizado(s)`)
      return true
    } catch (err: unknown) {
      console.error('Erro ao aplicar em lote:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao aplicar em lote')
      return false
    }
  }, [])

  const importarExcelFlit = useCallback(async (
    file: File,
    colaboradores: Colaborador[],
    mapeamentos: MapeamentoFlitLocalTrabalho[],
    competencia: Competencia | null
  ) => {
    setImportando(true)
    try {
      const batidas = await parseExcelFlit(file)
      const dias = agruparBatidasPorDia(batidas)

      const registrosPorChave = new Map<string, Partial<LocalTrabalhoDiario>>()
      const naoEncontrados = new Set<string>()
      let identificados = 0
      let pendentes = 0

      for (const dia of dias) {
        // Filtra apenas dias dentro da competência (se informada)
        if (competencia && (dia.data < competencia.inicio || dia.data > competencia.fim)) {
          continue
        }

        const colaborador = encontrarColaborador(dia.nomeColaborador, dia.matricula, colaboradores)
        if (!colaborador) {
          naoEncontrados.add(dia.nomeColaborador)
          continue
        }

        const inferido = inferirLocalTrabalho(mapeamentos, {
          tipoDispositivo: dia.tipoDispositivo,
          nomeDispositivo: dia.nomeDispositivo,
          perimetro: dia.perimetro,
          departamento: dia.departamento,
          turno: dia.turno,
        })

        const chave = `${colaborador.id}|${dia.data}`
        if (registrosPorChave.has(chave)) {
          // Evita duplicatas no upsert (mesmo colaborador + mesma data)
          continue
        }

        if (inferido) {
          identificados++
        } else {
          pendentes++
        }

        registrosPorChave.set(chave, {
          colaborador_id: colaborador.id,
          data: dia.data,
          local_trabalho_id: inferido?.localTrabalhoId || null,
          fonte: inferido?.fonte || 'nao_identificado',
          observacao: null,
        })
      }

      const registros = Array.from(registrosPorChave.values())

      if (registros.length === 0) {
        toast.info(competencia ? 'Nenhum registro encontrado para a competência selecionada' : 'Nenhum registro encontrado no arquivo')
        return { sucesso: 0, identificados: 0, pendentes: 0, preservados: 0, naoEncontrados: Array.from(naoEncontrados) }
      }

      // Preserva confirmações manuais já feitas pelo usuário.
      const datas = Array.from(new Set(registros.map((r) => r.data))).sort()
      const colaboradorIds = Array.from(new Set(registros.map((r) => r.colaborador_id)))

      const { data: existentes, error: erroExistentes } = await supabase
        .from('locais_trabalho_diario')
        .select('colaborador_id, data, fonte')
        .in('colaborador_id', colaboradorIds)
        .gte('data', datas[0])
        .lte('data', datas[datas.length - 1])

      if (erroExistentes) throw erroExistentes

      const chavesManuais = new Set(
        (existentes || [])
          .filter((e) => e.fonte === 'manual')
          .map((e) => `${e.colaborador_id}|${e.data}`)
      )

      const registrosParaUpsert = registros.filter(
        (r) => !chavesManuais.has(`${r.colaborador_id}|${r.data}`)
      )
      const preservados = registros.length - registrosParaUpsert.length

      if (registrosParaUpsert.length > 0) {
        const { error } = await supabase
          .from('locais_trabalho_diario')
          .upsert(registrosParaUpsert, { onConflict: 'colaborador_id,data' })
        if (error) throw error
      }

      toast.success(
        `${registrosParaUpsert.length} dia(s) importado(s). ${identificados} identificado(s), ${pendentes} pendente(s).` +
          (preservados > 0 ? ` ${preservados} confirmação(ões) manual(is) preservada(s).` : '')
      )

      return {
        sucesso: registrosParaUpsert.length,
        identificados,
        pendentes,
        preservados,
        naoEncontrados: Array.from(naoEncontrados),
      }
    } catch (err: unknown) {
      console.error('Erro ao importar Excel do Flit:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao importar Excel do Flit')
      return { sucesso: 0, identificados: 0, pendentes: 0, preservados: 0, naoEncontrados: [] }
    } finally {
      setImportando(false)
    }
  }, [])

  const buscarHistoricoColaborador = useCallback(async (
    colaboradorId: string,
    limite: number = 10
  ): Promise<LocalTrabalhoDiario[]> => {
    try {
      const { data, error } = await supabase
        .from('locais_trabalho_diario')
        .select('*, local_trabalho:locais_trabalho(*)')
        .eq('colaborador_id', colaboradorId)
        .not('local_trabalho_id', 'is', null)
        .order('data', { ascending: false })
        .limit(limite)

      if (error) throw error
      return (data || []) as unknown as LocalTrabalhoDiario[]
    } catch (err: unknown) {
      console.error('Erro ao buscar histórico do colaborador:', err)
      return []
    }
  }, [])

  return {
    dias,
    loading,
    importando,
    listar,
    confirmarManual,
    aplicarEmLote,
    importarExcelFlit,
    buscarHistoricoColaborador,
  }
}
