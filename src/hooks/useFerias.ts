import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { hojeBrasil } from '@/lib/utils'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import type { Colaborador, FeriasPeriodo, FeriasNotificacao, DestinatarioNotificacaoFerias } from '@/types/database'
import type { FeriasAlocacaoComSolicitacao, FeriasFerista, FeriasFuncao, FeriasRegra, FeriasSolicitacao, OrigemAlocacaoFerias, StatusSolicitacaoFerias } from '@/types/ferias'
import type { NovoPeriodoFerias } from '@/lib/ferias/importarFeriasFlit'
import { avaliarTetoSimultaneo, type AvaliacaoTeto } from '@/lib/ferias/tetoSimultaneo'

const COLUNAS_RESUMIDO = 'id, matricula, nome_completo, status, cargo, departamento, departamento_id, empresa_id, cpf, data_admissao'

const COLUNAS_SOLICITACAO = `
  id, colaborador_id, departamento_id, funcao_id, data_inicio, data_fim, tipo, status,
  dias_abono, adiantamento_13, parcelada, origem, observacao, ferista_alocado_id,
  origem_alocacao, registrado_por, aprovado_por, data_aprovacao, created_at, updated_at,
  colaborador:colaboradores!colaborador_id(id, nome_completo, matricula, departamento, departamento_id, data_admissao, status, cargo),
  ferista:colaboradores!ferista_alocado_id(id, nome_completo, matricula)
`

const COLUNAS_CONFLITO_TETO = `
  id, colaborador_id, departamento_id, funcao_id, data_inicio, data_fim, tipo, status,
  dias_abono, adiantamento_13, parcelada, origem, observacao, ferista_alocado_id,
  origem_alocacao, registrado_por, aprovado_por, data_aprovacao,
  colaborador:colaboradores!colaborador_id(id, nome_completo, matricula)
`

const COLUNAS_ALOCACAO = `
  id, solicitacao_id, ferista_id, departamento_id, funcao_id, data_inicio, data_fim,
  status, origem, score, motivo, usuario_id, created_at, updated_at,
  solicitacao:ferias_solicitacoes(id, departamento_id, data_inicio, data_fim, tipo, status,
    colaborador:colaboradores!colaborador_id(id, nome_completo, matricula))
`

const COLUNAS_FERISTA = `
  id, colaborador_id, funcao_id, max_dias_consecutivos, max_coberturas_mes, ativo, observacao, created_at, updated_at,
  colaborador:colaboradores(id, nome_completo, matricula, cargo, status, departamento_id),
  funcao:ferias_funcoes(id, nome, nivel)
`

const COLUNAS_NOTIFICACAO = `
  id, colaborador_id, ferias_periodo_id, solicitacao_id, destinatario, data_notificacao, observacao, usuario_id, created_at,
  colaborador:colaboradores(id, nome_completo, matricula, departamento, departamento_id, empresa_id)
`

const TAMANHO_PAGINA = 1000

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
  /** true = período pedido pelo próprio colaborador (prioridade na aprovação) */
  pedido_colaborador?: boolean
}

export interface NovaNotificacao {
  colaborador_id: string
  /** Solicitação de férias vinculada (ferias_solicitacoes.id) */
  solicitacao_id?: string | null
  destinatario: DestinatarioNotificacaoFerias
  data_notificacao: string
  observacao?: string | null
}

/** Programação de férias: converte um previsto em agendado ou cria o agendamento direto. */
export interface ProgramarFeriasInput {
  /** Solicitação existente (previsto → agendado) */
  solicitacaoId?: string
  /** Dados para criar a solicitação já agendada */
  nova?: NovaPrevisao
  dataInicio: string
  dataFim: string
  diasAbono: number
  adiantamento13: boolean
  parcelada: boolean
}

/** Cadastro de ferista na carteira (RN-02). */
export interface NovoFerista {
  colaborador_id: string
  funcao_id: string | null
  max_dias_consecutivos: number
  max_coberturas_mes: number
  observacao?: string | null
}

export type EdicaoFerista = Partial<Omit<NovoFerista, 'colaborador_id'>> & { ativo?: boolean }

/** Cadastro de função operacional no catálogo. */
export interface NovaFuncao {
  nome: string
  nivel: number
  aliases: string[]
  /** Matriz de cobertura explícita (RN-02.3): ids das funções que esta cobre */
  cobre_funcoes?: string[]
}

export type EdicaoFuncao = Partial<NovaFuncao> & { ativo?: boolean }

/** Sugestão de alocação pronta para gravar (RN-10: origem + usuario_id). */
export interface SugestaoParaGravar {
  solicitacaoId: string
  /** ferias_feristas.id */
  feristaId: string
  /** colaboradores.id do ferista → ferista_alocado_id da solicitação */
  feristaColaboradorId: string
  departamentoId: string | null
  funcaoId: string | null
  dataInicio: string
  dataFim: string
  score: number | null
  motivo: string | null
  origem: OrigemAlocacaoFerias
}

/** Status derivado das datas na importação Flit (espelha o backfill da migração 112). */
function statusImportado(tipo: 'gozo' | 'agendado', inicio: string, fim: string, hoje: string): StatusSolicitacaoFerias {
  if (tipo === 'agendado') return 'aprovada'
  if (fim < hoje) return 'concluida'
  if (inicio <= hoje) return 'em_andamento'
  return 'aprovada'
}

/** Mapeia a solicitação nova para o shape legado FeriasPeriodo (páginas antigas). */
function paraPeriodoLegado(s: FeriasSolicitacao): FeriasPeriodo {
  return {
    id: s.id,
    colaborador_id: s.colaborador_id,
    data_inicio: s.data_inicio,
    data_fim: s.data_fim,
    tipo: s.tipo,
    descricao: s.observacao,
    origem: s.origem === 'econtador' ? 'manual' : s.origem,
    created_at: s.created_at,
    updated_at: s.updated_at,
    colaborador: s.colaborador ?? null,
  }
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

  /** Catálogo de funções operacionais (ferias_funcoes), do maior nível para o menor. */
  const listarFuncoes = useCallback(async (): Promise<FeriasFuncao[]> => {
    const { data, error } = await supabase
      .from('ferias_funcoes')
      .select('id, nome, nivel, cobre_funcoes, aliases, ativo, created_at, updated_at')
      .order('nivel', { ascending: false })
      .order('nome')
    if (error) {
      toast.error('Erro ao carregar funções: ' + error.message)
      return []
    }
    return (data || []) as FeriasFuncao[]
  }, [])

  /** Busca as solicitações em lotes de 1.000 (o PostgREST corta em 1.000 por padrão). */
  const buscarSolicitacoesPaginado = useCallback(async (excluirCanceladas: boolean): Promise<FeriasSolicitacao[] | null> => {
    let todos: FeriasSolicitacao[] = []
    let pagina = 0
    let continuar = true

    while (continuar) {
      let query = supabase
        .from('ferias_solicitacoes')
        .select(COLUNAS_SOLICITACAO)
        .order('data_inicio', { ascending: false })
        .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)
      if (excluirCanceladas) {
        query = query.neq('status', 'cancelada')
      }
      const { data, error } = await query
      if (error) {
        toast.error('Erro ao carregar solicitações de férias: ' + error.message)
        return null
      }
      const paginaAtual = (data as unknown as FeriasSolicitacao[]) || []
      todos = [...todos, ...paginaAtual]
      continuar = paginaAtual.length === TAMANHO_PAGINA
      pagina++
    }
    return todos
  }, [])

  /** Lista todos os períodos no shape legado FeriasPeriodo (sem canceladas) para as páginas antigas. */
  const listarPeriodos = useCallback(async (): Promise<FeriasPeriodo[]> => {
    setLoading(true)
    const solicitacoes = await buscarSolicitacoesPaginado(true)
    setLoading(false)
    if (!solicitacoes) return []
    return solicitacoes.map(paraPeriodoLegado)
  }, [buscarSolicitacoesPaginado])

  /** Lista as solicitações completas (shape novo, inclui canceladas) — API das próximas etapas. */
  const listarSolicitacoes = useCallback(async (): Promise<FeriasSolicitacao[]> => {
    setLoading(true)
    const solicitacoes = await buscarSolicitacoesPaginado(false)
    setLoading(false)
    return solicitacoes ?? []
  }, [buscarSolicitacoesPaginado])

  /**
   * Importa períodos vindos do Flit de forma idempotente: apaga as
   * solicitações com origem='flit' dos colaboradores presentes no arquivo e
   * insere as novas. Ao final, baixa as previsões manuais cobertas pelos
   * novos períodos confirmados (alinhamento automático previsão → agendado/gozo).
   */
  const importar = useCallback(async (periodos: NovoPeriodoFerias[]): Promise<ResultadoImportacao | null> => {
    if (periodos.length === 0) return { inseridos: 0, colaboradoresAtualizados: 0, previsoesAlinhadas: 0 }

    setLoading(true)
    const hoje = hojeBrasil()
    const colaboradorIds = Array.from(new Set(periodos.map((p) => p.colaborador_id)))

    // Apaga os registros Flit anteriores SEMPRE conferindo as linhas afetadas:
    // DELETE bloqueado por RLS (delete exige admin) retorna 0 linhas SEM erro
    // e a importação duplicaria todos os períodos.
    const { data: existentes, error: erroExistentes } = await supabase
      .from('ferias_solicitacoes')
      .select('id')
      .eq('origem', 'flit')
      .in('colaborador_id', colaboradorIds)

    if (erroExistentes) {
      toast.error('Erro ao verificar períodos anteriores: ' + erroExistentes.message)
      setLoading(false)
      return null
    }

    if (existentes && existentes.length > 0) {
      const { data: apagados, error: erroDelete } = await supabase
        .from('ferias_solicitacoes')
        .delete()
        .eq('origem', 'flit')
        .in('colaborador_id', colaboradorIds)
        .select('id')

      if (erroDelete) {
        toast.error('Erro ao limpar períodos anteriores: ' + erroDelete.message)
        setLoading(false)
        return null
      }
      if (!apagados || apagados.length === 0) {
        toast.error('Sem permissão para substituir os períodos anteriores (a exclusão de férias exige perfil admin). Importação cancelada para não duplicar registros.')
        setLoading(false)
        return null
      }
    }

    // Resolve departamento e função de cada colaborador (base do teto de
    // ausência simultânea, RN-01) — sem isso a reimportação perderia os
    // campos que o backfill da migração 112 preencheu.
    const [{ data: colaboradores }, funcoes] = await Promise.all([
      supabase.from('colaboradores').select('id, cargo, departamento_id').in('id', colaboradorIds),
      listarFuncoes(),
    ])
    const porId = new Map((colaboradores || []).map((c) => [c.id, c]))

    const { error: erroInsert } = await supabase
      .from('ferias_solicitacoes')
      .insert(
        periodos.map((p) => {
          const colaborador = porId.get(p.colaborador_id)
          const funcao = resolverFuncao(colaborador?.cargo, funcoes)
          return {
            colaborador_id: p.colaborador_id,
            departamento_id: colaborador?.departamento_id ?? null,
            funcao_id: funcao?.id ?? null,
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
            tipo: p.tipo,
            status: statusImportado(p.tipo, p.data_inicio, p.data_fim, hoje),
            observacao: p.descricao,
            origem: p.origem,
          }
        })
      )
      .select('id')

    if (erroInsert) {
      toast.error('Erro ao importar períodos: ' + erroInsert.message)
      setLoading(false)
      return null
    }

    // Baixa automática: previsões manuais cobertas por algum período
    // confirmado (agendado/gozo) recém-importado para o mesmo colaborador.
    let previsoesAlinhadas = 0
    const { data: previstos, error: erroPrevistos } = await supabase
      .from('ferias_solicitacoes')
      .select('id, colaborador_id, data_inicio, data_fim')
      .eq('tipo', 'previsto')
      .eq('origem', 'manual')
      .neq('status', 'cancelada')
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
        // .select('id') após o delete: conta só o que foi de fato excluído
        // para não reportar baixa fantasma no resultado da importação.
        const { data: baixados, error: erroBaixa } = await supabase
          .from('ferias_solicitacoes')
          .delete()
          .in('id', idsAlinhados)
          .select('id')
        if (erroBaixa) {
          console.error('Erro ao baixar previsões alinhadas:', erroBaixa)
        } else {
          previsoesAlinhadas = baixados?.length ?? 0
        }
      }
    }

    setLoading(false)
    return { inseridos: periodos.length, colaboradoresAtualizados: colaboradorIds.length, previsoesAlinhadas }
  }, [listarFuncoes])

  /** Registra uma previsão de férias lançada pelo RH (origem manual, status pendente). */
  const adicionarPrevisao = useCallback(async (previsao: NovaPrevisao): Promise<boolean> => {
    setLoading(true)

    // Resolve departamento e função do colaborador na gravação (RN-01)
    const [{ data: colaborador }, funcoes] = await Promise.all([
      supabase.from('colaboradores').select('id, cargo, departamento_id').eq('id', previsao.colaborador_id).maybeSingle(),
      listarFuncoes(),
    ])
    const funcao = resolverFuncao(colaborador?.cargo, funcoes)

    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .insert({
        colaborador_id: previsao.colaborador_id,
        departamento_id: colaborador?.departamento_id ?? null,
        funcao_id: funcao?.id ?? null,
        data_inicio: previsao.data_inicio,
        data_fim: previsao.data_fim,
        tipo: 'previsto',
        status: 'pendente',
        observacao: previsao.descricao ?? null,
        pedido_colaborador: previsao.pedido_colaborador ?? false,
        origem: 'manual',
      })
      .select('id')
    setLoading(false)
    if (error) {
      toast.error('Erro ao registrar previsão: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para registrar a previsão')
      return false
    }
    toast.success('Previsão de férias registrada.')
    return true
  }, [listarFuncoes])

  /**
   * Grava em lote as previsões geradas pelo plano automático
   * (planejamentoAutomatico.ts). Já chegam com departamento/função
   * resolvidos; o motivo (limite concessivo) vai para a observação.
   */
  const criarPrevisoesEmLote = useCallback(
    async (
      propostas: {
        colaborador_id: string
        departamento_id: string | null
        funcao_id: string | null
        data_inicio: string
        data_fim: string
        motivo: string
      }[]
    ): Promise<boolean> => {
      if (propostas.length === 0) return false
      setLoading(true)
      const { data, error } = await supabase
        .from('ferias_solicitacoes')
        .insert(
          propostas.map((p) => ({
            colaborador_id: p.colaborador_id,
            departamento_id: p.departamento_id,
            funcao_id: p.funcao_id,
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
            tipo: 'previsto' as const,
            status: 'pendente' as const,
            observacao: `plano automático — ${p.motivo}`,
            origem: 'manual' as const,
          }))
        )
        .select('id')
      setLoading(false)
      if (error) {
        toast.error('Erro ao criar as previsões do plano: ' + error.message)
        return false
      }
      if (!data || data.length !== propostas.length) {
        toast.error(`Só ${data?.length ?? 0} de ${propostas.length} previsões foram criadas — verifique permissões.`)
        return false
      }
      toast.success(`${data.length} previsões criadas pelo plano automático. Aprove-as na Visão geral.`)
      return true
    },
    []
  )

  /** Exclui um período manual (previsão do RH). A exclusão exige admin (RLS). */
  const excluirPeriodo = useCallback(async (id: string): Promise<boolean> => {
    // .select('id') para detectar DELETE bloqueado por RLS: sem o select, o
    // PostgREST retorna sucesso com 0 linhas e o toast fingiria sucesso.
    const { data, error } = await supabase.from('ferias_solicitacoes').delete().eq('id', id).select('id')
    if (error) {
      toast.error('Erro ao excluir período: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para excluir este período')
      return false
    }
    toast.success('Período excluído.')
    return true
  }, [])

  /**
   * Programa férias: converte um previsto em agendado (aprovado) ou cria o
   * agendamento direto, registrando abono, 13º e parcelamento.
   */
  const programarFerias = useCallback(async (entrada: ProgramarFeriasInput): Promise<boolean> => {
    const { data: authData } = await supabase.auth.getUser()
    const aprovacao = {
      aprovado_por: authData.user?.id ?? null,
      data_aprovacao: new Date().toISOString(),
    }
    setLoading(true)

    if (entrada.solicitacaoId) {
      const { data, error } = await supabase
        .from('ferias_solicitacoes')
        .update({
          tipo: 'agendado',
          status: 'aprovada',
          data_inicio: entrada.dataInicio,
          data_fim: entrada.dataFim,
          dias_abono: entrada.diasAbono,
          adiantamento_13: entrada.adiantamento13,
          parcelada: entrada.parcelada,
          ...aprovacao,
        })
        .eq('id', entrada.solicitacaoId)
        .select('id')
      setLoading(false)
      if (error) {
        toast.error('Erro ao programar férias: ' + error.message)
        return false
      }
      if (!data || data.length === 0) {
        toast.error('Sem permissão para programar estas férias')
        return false
      }
      toast.success('Férias programadas.')
      return true
    }

    if (!entrada.nova) {
      setLoading(false)
      toast.error('Informe a solicitação ou os dados do novo agendamento.')
      return false
    }

    const [{ data: colaborador }, funcoes] = await Promise.all([
      supabase.from('colaboradores').select('id, cargo, departamento_id').eq('id', entrada.nova.colaborador_id).maybeSingle(),
      listarFuncoes(),
    ])
    const funcao = resolverFuncao(colaborador?.cargo, funcoes)

    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .insert({
        colaborador_id: entrada.nova.colaborador_id,
        departamento_id: colaborador?.departamento_id ?? null,
        funcao_id: funcao?.id ?? null,
        data_inicio: entrada.dataInicio,
        data_fim: entrada.dataFim,
        tipo: 'agendado',
        status: 'aprovada',
        dias_abono: entrada.diasAbono,
        adiantamento_13: entrada.adiantamento13,
        parcelada: entrada.parcelada,
        observacao: entrada.nova.descricao ?? null,
        pedido_colaborador: entrada.nova.pedido_colaborador ?? false,
        origem: 'manual',
        ...aprovacao,
      })
      .select('id')
    setLoading(false)
    if (error) {
      toast.error('Erro ao programar férias: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para programar férias')
      return false
    }
    toast.success('Férias programadas.')
    return true
  }, [listarFuncoes])

  /** Aprova uma solicitação pendente, registrando quem aprovou e quando. */
  const aprovarSolicitacao = useCallback(async (id: string): Promise<boolean> => {
    const { data: authData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .update({
        status: 'aprovada',
        aprovado_por: authData.user?.id ?? null,
        data_aprovacao: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
    if (error) {
      toast.error('Erro ao aprovar solicitação: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para aprovar esta solicitação')
      return false
    }
    toast.success('Solicitação aprovada.')
    return true
  }, [])

  /** Cancela uma solicitação (soft delete: status='cancelada'). */
  const cancelarSolicitacao = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .update({ status: 'cancelada' })
      .eq('id', id)
      .select('id')
    if (error) {
      toast.error('Erro ao cancelar solicitação: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para cancelar esta solicitação')
      return false
    }
    toast.success('Solicitação cancelada.')
    return true
  }, [])

  /** Regras de teto de ausência simultânea (RN-01). */
  const listarRegras = useCallback(async (): Promise<FeriasRegra[]> => {
    const { data, error } = await supabase
      .from('ferias_regras')
      .select('id, departamento_id, funcao_id, max_simultaneos, created_at, updated_at')
    if (error) {
      toast.error('Erro ao carregar regras de férias: ' + error.message)
      return []
    }
    return (data || []) as FeriasRegra[]
  }, [])

  /**
   * Avalia o teto de ausência simultânea (RN-01) para um novo período:
   * busca as regras e as solicitações confirmadas sobrepostas do mesmo
   * contrato+função e delega a contagem à lógica pura (tetoSimultaneo).
   */
  const avaliarTeto = useCallback(async (params: {
    departamentoId: string | null
    funcaoId: string | null
    dataInicio: string
    dataFim: string
    ignorarId?: string
  }): Promise<AvaliacaoTeto | null> => {
    let query = supabase
      .from('ferias_solicitacoes')
      .select(COLUNAS_CONFLITO_TETO)
      .in('status', ['aprovada', 'em_andamento'])
      .lte('data_inicio', params.dataFim)
      .gte('data_fim', params.dataInicio)
    if (params.departamentoId) query = query.eq('departamento_id', params.departamentoId)
    else query = query.is('departamento_id', null)
    if (params.funcaoId) query = query.eq('funcao_id', params.funcaoId)
    else query = query.is('funcao_id', null)

    const [{ data: regras, error: erroRegras }, { data: candidatas, error: erroCandidatas }] = await Promise.all([
      supabase.from('ferias_regras').select('id, departamento_id, funcao_id, max_simultaneos'),
      query,
    ])
    if (erroRegras || erroCandidatas) {
      console.error('Erro ao avaliar teto simultâneo:', erroRegras ?? erroCandidatas)
      return null
    }
    return avaliarTetoSimultaneo({
      regras: (regras || []) as FeriasRegra[],
      solicitacoes: (candidatas || []) as unknown as FeriasSolicitacao[],
      ...params,
    })
  }, [])

  /** Registro da carteira de feristas do colaborador, se ele for ferista. */
  const buscarFerista = useCallback(async (colaboradorId: string): Promise<FeriasFerista | null> => {
    const { data, error } = await supabase
      .from('ferias_feristas')
      .select('id, colaborador_id, funcao_id, max_dias_consecutivos, max_coberturas_mes, ativo, observacao, created_at, updated_at')
      .eq('colaborador_id', colaboradorId)
      .maybeSingle()
    if (error) {
      console.error('Erro ao carregar ferista:', error)
      return null
    }
    return (data as FeriasFerista | null) ?? null
  }, [])

  /** Coberturas do ferista (onde cobriu/vai cobrir), mais recentes primeiro. */
  const listarAlocacoesFerista = useCallback(async (feristaId: string): Promise<FeriasAlocacaoComSolicitacao[]> => {
    const { data, error } = await supabase
      .from('ferias_alocacoes')
      .select(COLUNAS_ALOCACAO)
      .eq('ferista_id', feristaId)
      .order('data_inicio', { ascending: false })
    if (error) {
      toast.error('Erro ao carregar coberturas: ' + error.message)
      return []
    }
    return (data || []) as unknown as FeriasAlocacaoComSolicitacao[]
  }, [])

  /** Todas as alocações (status/fill rate da carteira), em lotes de 1.000. */
  const listarAlocacoes = useCallback(async (): Promise<FeriasAlocacaoComSolicitacao[]> => {
    let todos: FeriasAlocacaoComSolicitacao[] = []
    let pagina = 0
    let continuar = true

    while (continuar) {
      const { data, error } = await supabase
        .from('ferias_alocacoes')
        .select(COLUNAS_ALOCACAO)
        .order('data_inicio', { ascending: false })
        .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)
      if (error) {
        toast.error('Erro ao carregar alocações: ' + error.message)
        return todos
      }
      const paginaAtual = (data || []) as unknown as FeriasAlocacaoComSolicitacao[]
      todos = [...todos, ...paginaAtual]
      continuar = paginaAtual.length === TAMANHO_PAGINA
      pagina++
    }
    return todos
  }, [])

  /**
   * Grava um lote de alocações confirmadas (RN-10: origem + usuario_id) e
   * marca cada solicitação com o ferista alocado. Se qualquer gravação
   * falhar, avisa e devolve false (a página recarrega para mostrar o que
   * ficou gravado).
   */
  const confirmarAlocacoes = useCallback(async (sugestoes: SugestaoParaGravar[]): Promise<boolean> => {
    if (sugestoes.length === 0) return true
    const { data: authData } = await supabase.auth.getUser()
    const usuarioId = authData.user?.id ?? null
    setLoading(true)

    const { data: inseridas, error: erroInsert } = await supabase
      .from('ferias_alocacoes')
      .insert(
        sugestoes.map((s) => ({
          solicitacao_id: s.solicitacaoId,
          ferista_id: s.feristaId,
          departamento_id: s.departamentoId,
          funcao_id: s.funcaoId,
          data_inicio: s.dataInicio,
          data_fim: s.dataFim,
          status: 'confirmada' as const,
          origem: s.origem,
          score: s.score,
          motivo: s.motivo,
          usuario_id: usuarioId,
        }))
      )
      .select('id')

    if (erroInsert || !inseridas || inseridas.length !== sugestoes.length) {
      toast.error('Erro ao gravar alocações: ' + (erroInsert?.message ?? 'nenhuma linha gravada — verifique a permissão'))
      setLoading(false)
      return false
    }

    for (const s of sugestoes) {
      const { data, error } = await supabase
        .from('ferias_solicitacoes')
        .update({ ferista_alocado_id: s.feristaColaboradorId, origem_alocacao: s.origem })
        .eq('id', s.solicitacaoId)
        .select('id')
      if (error || !data || data.length === 0) {
        toast.error('Alocações gravadas, mas falhou ao vincular o ferista a uma solicitação: ' + (error?.message ?? 'sem permissão'))
        setLoading(false)
        return false
      }
    }

    setLoading(false)
    toast.success(`${sugestoes.length} alocação(ões) confirmada(s).`)
    return true
  }, [])

  /** Alocação manual de um ferista em uma vaga (RN-10: origem 'manual'). */
  const alocarManual = useCallback(async (vaga: FeriasSolicitacao, ferista: FeriasFerista): Promise<boolean> => {
    return confirmarAlocacoes([
      {
        solicitacaoId: vaga.id,
        feristaId: ferista.id,
        feristaColaboradorId: ferista.colaborador_id,
        departamentoId: vaga.departamento_id,
        funcaoId: vaga.funcao_id,
        dataInicio: vaga.data_inicio,
        dataFim: vaga.data_fim,
        score: null,
        motivo: 'alocação manual pelo RH',
        origem: 'manual',
      },
    ])
  }, [confirmarAlocacoes])

  /** Desfaz a cobertura de uma solicitação: cancela a alocação confirmada e limpa o ferista dela. */
  const desfazerAlocacao = useCallback(async (solicitacaoId: string): Promise<boolean> => {
    const { data: canceladas, error: erroCancela } = await supabase
      .from('ferias_alocacoes')
      .update({ status: 'cancelada' })
      .eq('solicitacao_id', solicitacaoId)
      .eq('status', 'confirmada')
      .select('id')
    if (erroCancela) {
      toast.error('Erro ao desfazer cobertura: ' + erroCancela.message)
      return false
    }

    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .update({ ferista_alocado_id: null, origem_alocacao: null })
      .eq('id', solicitacaoId)
      .select('id')
    if (error || !data || data.length === 0) {
      toast.error('Erro ao limpar o ferista da solicitação: ' + (error?.message ?? 'sem permissão'))
      return false
    }
    if (!canceladas || canceladas.length === 0) {
      toast.info('A solicitação não tinha alocação confirmada — apenas o ferista foi limpo.')
      return true
    }
    toast.success('Cobertura desfeita.')
    return true
  }, [])

  /** Carteira de feristas com colaborador e função embutidos. */
  const listarFeristas = useCallback(async (): Promise<FeriasFerista[]> => {    const { data, error } = await supabase
      .from('ferias_feristas')
      .select(COLUNAS_FERISTA)
      .order('created_at')
    if (error) {
      toast.error('Erro ao carregar feristas: ' + error.message)
      return []
    }
    return (data || []) as unknown as FeriasFerista[]
  }, [])

  /** Adiciona um colaborador à carteira de feristas. */
  const adicionarFerista = useCallback(async (ferista: NovoFerista): Promise<boolean> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ferias_feristas')
      .insert({
        colaborador_id: ferista.colaborador_id,
        funcao_id: ferista.funcao_id,
        max_dias_consecutivos: ferista.max_dias_consecutivos,
        max_coberturas_mes: ferista.max_coberturas_mes,
        observacao: ferista.observacao ?? null,
      })
      .select('id')
    setLoading(false)
    if (error) {
      toast.error('Erro ao adicionar ferista: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para adicionar ferista')
      return false
    }
    toast.success('Ferista adicionado à carteira.')
    return true
  }, [])

  /** Atualiza função, limites, observação ou ativo de um ferista. */
  const atualizarFerista = useCallback(async (id: string, campos: EdicaoFerista): Promise<boolean> => {
    const { data, error } = await supabase
      .from('ferias_feristas')
      .update(campos)
      .eq('id', id)
      .select('id')
    if (error) {
      toast.error('Erro ao atualizar ferista: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para atualizar este ferista')
      return false
    }
    toast.success('Ferista atualizado.')
    return true
  }, [])

  /**
   * Remove um ferista da carteira. Ferista com alocações registradas NÃO
   * pode ser excluído (perderia o histórico de coberturas) — deve ser
   * desativado.
   */
  const removerFerista = useCallback(async (id: string): Promise<boolean> => {
    const { data: alocacoes, error: erroAlocacoes } = await supabase
      .from('ferias_alocacoes')
      .select('id')
      .eq('ferista_id', id)
      .limit(1)
    if (erroAlocacoes) {
      toast.error('Erro ao verificar coberturas do ferista: ' + erroAlocacoes.message)
      return false
    }
    if (alocacoes && alocacoes.length > 0) {
      toast.error('Este ferista já tem coberturas registradas. Desative-o em vez de excluir, para manter o histórico.')
      return false
    }
    const { data, error } = await supabase.from('ferias_feristas').delete().eq('id', id).select('id')
    if (error) {
      toast.error('Erro ao remover ferista: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para remover este ferista (a exclusão exige perfil admin)')
      return false
    }
    toast.success('Ferista removido da carteira.')
    return true
  }, [])

  /** Cria uma função operacional no catálogo. */
  const criarFuncao = useCallback(async (funcao: NovaFuncao): Promise<boolean> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ferias_funcoes')
      .insert({ nome: funcao.nome, nivel: funcao.nivel, aliases: funcao.aliases, cobre_funcoes: funcao.cobre_funcoes ?? [] })
      .select('id')
    setLoading(false)
    if (error) {
      toast.error('Erro ao criar função: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para criar função')
      return false
    }
    toast.success('Função criada.')
    return true
  }, [])

  /** Atualiza nome, nível, aliases ou ativo de uma função do catálogo. */
  const atualizarFuncao = useCallback(async (id: string, campos: EdicaoFuncao): Promise<boolean> => {
    const { data, error } = await supabase
      .from('ferias_funcoes')
      .update(campos)
      .eq('id', id)
      .select('id')
    if (error) {
      toast.error('Erro ao atualizar função: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para atualizar esta função')
      return false
    }
    toast.success('Função atualizada.')
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
    // ferias_periodo_id (FK da tabela legada) fica NULL: os ids novos são de
    // ferias_solicitacoes e violariam a FK — o vínculo novo é solicitacao_id.
    const { error } = await supabase.from('ferias_notificacoes').insert({
      colaborador_id: notificacao.colaborador_id,
      ferias_periodo_id: null,
      solicitacao_id: notificacao.solicitacao_id ?? null,
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

  /**
   * Troca o ferista de uma vaga já coberta (RN-10: a troca vira origem manual).
   * Cancela a cobertura confirmada atual, grava a nova alocação e atualiza o
   * ferista_alocado_id da solicitação — sem toast de sucesso (a tela consolida,
   * inclusive na troca em lote).
   */
  const trocarFerista = useCallback(async (vaga: FeriasSolicitacao, novoFerista: FeriasFerista): Promise<boolean> => {
    const { error: erroCancela } = await supabase
      .from('ferias_alocacoes')
      .update({ status: 'cancelada' })
      .eq('solicitacao_id', vaga.id)
      .eq('status', 'confirmada')
      .select('id')
    if (erroCancela) {
      toast.error('Erro ao cancelar a cobertura atual: ' + erroCancela.message)
      return false
    }

    const { data: authData } = await supabase.auth.getUser()
    const { data: inserida, error: erroInsert } = await supabase
      .from('ferias_alocacoes')
      .insert({
        solicitacao_id: vaga.id,
        ferista_id: novoFerista.id,
        departamento_id: vaga.departamento_id,
        funcao_id: vaga.funcao_id,
        data_inicio: vaga.data_inicio,
        data_fim: vaga.data_fim,
        status: 'confirmada',
        origem: 'manual',
        motivo: 'troca manual pelo RH',
        usuario_id: authData.user?.id ?? null,
      })
      .select('id')
    if (erroInsert || !inserida || inserida.length === 0) {
      toast.error('Erro ao gravar a nova cobertura: ' + (erroInsert?.message ?? 'sem permissão'))
      return false
    }

    const { data, error } = await supabase
      .from('ferias_solicitacoes')
      .update({ ferista_alocado_id: novoFerista.colaborador_id, origem_alocacao: 'manual' })
      .eq('id', vaga.id)
      .select('id')
    if (error || !data || data.length === 0) {
      toast.error('Erro ao atualizar o ferista da solicitação: ' + (error?.message ?? 'sem permissão'))
      return false
    }
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
    listarSolicitacoes,
    listarFuncoes,
    programarFerias,
    aprovarSolicitacao,
    cancelarSolicitacao,
    criarPrevisoesEmLote,
    listarRegras,
    avaliarTeto,
    buscarFerista,
    listarAlocacoesFerista,
    listarAlocacoes,
    confirmarAlocacoes,
    alocarManual,
    desfazerAlocacao,
    trocarFerista,
    listarFeristas,
    adicionarFerista,
    atualizarFerista,
    removerFerista,
    criarFuncao,
    atualizarFuncao,
  }
}
