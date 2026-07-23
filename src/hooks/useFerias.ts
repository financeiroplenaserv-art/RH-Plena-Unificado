import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Colaborador, FeriasPeriodo, FeriasNotificacao, DestinatarioNotificacaoFerias } from '@/types/database'
import type { NovoPeriodoFerias } from '@/lib/ferias/importarFeriasFlit'

const COLUNAS_RESUMIDO = 'id, matricula, nome_completo, status, cargo, departamento, departamento_id, empresa_id, cpf, data_admissao'

const COLUNAS_PERIODO = `
  id, colaborador_id, data_inicio, data_fim, tipo, descricao, origem, created_at,
  colaborador:colaboradores(id, nome_completo, matricula, departamento, data_admissao, status)
`

const COLUNAS_NOTIFICACAO = `
  id, colaborador_id, ferias_periodo_id, destinatario, data_notificacao, observacao, usuario_id, created_at,
  colaborador:colaboradores(id, nome_completo, matricula, departamento)
`

export interface ResultadoImportacao {
  inseridos: number
  colaboradoresAtualizados: number
  /** Previsões manuais baixadas automaticamente por cobrirem o mesmo período importado */
  previsoesAlinhadas: number
}

export interface NovaPrevisao {
  colaborador_id: string
  data_inicio: string
  data_fim: string
  descricao?: string | null
}

export interface NovaNotificacao {
  colaborador_id: string
  ferias_periodo_id?: string | null
  destinatario: DestinatarioNotificacaoFerias
  data_notificacao: string
  observacao?: string | null
}

export function useFerias() {
  const [loading, setLoading] = useState(false)

  /** Lista resumida de colaboradores para o casamento de nomes da importação. */
  const listarColaboradoresResumo = useCallback(async (): Promise<Colaborador[]> => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select(COLUNAS_RESUMIDO)
      .order('nome_completo')
    if (error) {
      toast.error('Erro ao carregar colaboradores: ' + error.message)
      return []
    }
    return (data || []) as Colaborador[]
  }, [])

  /** Lista todos os períodos de férias com os dados do colaborador. */
  const listarPeriodos = useCallback(async (): Promise<FeriasPeriodo[]> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ferias_periodos')
      .select(COLUNAS_PERIODO)
      .order('data_inicio', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error('Erro ao carregar períodos de férias: ' + error.message)
      return []
    }
    return (data || []) as unknown as FeriasPeriodo[]
  }, [])

  /**
   * Importa períodos vindos do Flit de forma idempotente: apaga os períodos
   * com origem='flit' dos colaboradores presentes no arquivo e insere os novos.
   * Ao final, baixa as previsões manuais cobertas pelos novos períodos
   * confirmados (alinhamento automático previsão → agendado/gozo).
   */
  const importar = useCallback(async (periodos: NovoPeriodoFerias[]): Promise<ResultadoImportacao | null> => {
    if (periodos.length === 0) return { inseridos: 0, colaboradoresAtualizados: 0, previsoesAlinhadas: 0 }

    setLoading(true)
    const colaboradorIds = Array.from(new Set(periodos.map((p) => p.colaborador_id)))

    const { error: erroDelete } = await supabase
      .from('ferias_periodos')
      .delete()
      .eq('origem', 'flit')
      .in('colaborador_id', colaboradorIds)

    if (erroDelete) {
      toast.error('Erro ao limpar períodos anteriores: ' + erroDelete.message)
      setLoading(false)
      return null
    }

    const { error: erroInsert } = await supabase
      .from('ferias_periodos')
      .insert(
        periodos.map((p) => ({
          colaborador_id: p.colaborador_id,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
          tipo: p.tipo,
          descricao: p.descricao,
          origem: p.origem,
        }))
      )

    if (erroInsert) {
      toast.error('Erro ao importar períodos: ' + erroInsert.message)
      setLoading(false)
      return null
    }

    // Baixa automática: previsões manuais cobertas por algum período
    // confirmado (agendado/gozo) recém-importado para o mesmo colaborador.
    let previsoesAlinhadas = 0
    const { data: previstos, error: erroPrevistos } = await supabase
      .from('ferias_periodos')
      .select('id, colaborador_id, data_inicio, data_fim')
      .eq('tipo', 'previsto')
      .eq('origem', 'manual')
      .in('colaborador_id', colaboradorIds)

    if (!erroPrevistos && previstos && previstos.length > 0) {
      const idsAlinhados = previstos
        .filter((previsto) =>
          periodos.some(
            (novo) =>
              novo.colaborador_id === previsto.colaborador_id &&
              novo.data_inicio <= previsto.data_fim &&
              novo.data_fim >= previsto.data_inicio
          )
        )
        .map((p) => p.id)

      if (idsAlinhados.length > 0) {
        const { error: erroBaixa } = await supabase
          .from('ferias_periodos')
          .delete()
          .in('id', idsAlinhados)
        if (erroBaixa) {
          console.error('Erro ao baixar previsões alinhadas:', erroBaixa)
        } else {
          previsoesAlinhadas = idsAlinhados.length
        }
      }
    }

    setLoading(false)
    return { inseridos: periodos.length, colaboradoresAtualizados: colaboradorIds.length, previsoesAlinhadas }
  }, [])

  /** Registra uma previsão de férias lançada pelo RH (origem manual). */
  const adicionarPrevisao = useCallback(async (previsao: NovaPrevisao): Promise<boolean> => {
    setLoading(true)
    const { error } = await supabase.from('ferias_periodos').insert({
      colaborador_id: previsao.colaborador_id,
      data_inicio: previsao.data_inicio,
      data_fim: previsao.data_fim,
      tipo: 'previsto',
      descricao: previsao.descricao ?? null,
      origem: 'manual',
    })
    setLoading(false)
    if (error) {
      toast.error('Erro ao registrar previsão: ' + error.message)
      return false
    }
    toast.success('Previsão de férias registrada.')
    return true
  }, [])

  /** Exclui um período manual (previsão do RH). Períodos do Flit exigem admin. */
  const excluirPeriodo = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('ferias_periodos').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao excluir período: ' + error.message)
      return false
    }
    toast.success('Período excluído.')
    return true
  }, [])

  /** Lista as notificações de férias registradas, mais recentes primeiro. */
  const listarNotificacoes = useCallback(async (): Promise<FeriasNotificacao[]> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ferias_notificacoes')
      .select(COLUNAS_NOTIFICACAO)
      .order('data_notificacao', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error('Erro ao carregar notificações: ' + error.message)
      return []
    }
    return (data || []) as unknown as FeriasNotificacao[]
  }, [])

  /** Registra uma notificação de férias (ao colaborador ou ao responsável pelo contrato). */
  const registrarNotificacao = useCallback(async (notificacao: NovaNotificacao): Promise<boolean> => {
    const { data: authData } = await supabase.auth.getUser()
    setLoading(true)
    const { error } = await supabase.from('ferias_notificacoes').insert({
      colaborador_id: notificacao.colaborador_id,
      ferias_periodo_id: notificacao.ferias_periodo_id ?? null,
      destinatario: notificacao.destinatario,
      data_notificacao: notificacao.data_notificacao,
      observacao: notificacao.observacao ?? null,
      usuario_id: authData.user?.id ?? null,
    })
    setLoading(false)
    if (error) {
      toast.error('Erro ao registrar notificação: ' + error.message)
      return false
    }
    toast.success('Notificação registrada.')
    return true
  }, [])

  return {
    loading,
    listarColaboradoresResumo,
    listarPeriodos,
    importar,
    adicionarPrevisao,
    excluirPeriodo,
    listarNotificacoes,
    registrarNotificacao,
  }
}
