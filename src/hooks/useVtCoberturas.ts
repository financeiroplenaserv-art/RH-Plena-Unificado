import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { TipoCoberturaVT, VtCobertura } from '@/types/vt'

// Coberturas de férias do VT (migration 158 — decisão da gestora, 21/10/2026):
// o ferista cobre FÉRIAS e o Flit não mostra o destino, então é registro
// manual; a carga mensal usa o posto da cobertura com prioridade sobre a
// escala. Migration 160 (22/10/2026): tipo 'treinamento' — dias de treinamento
// (ferista antes de cobrir, ou admitido em posto novo) também geram VT e são
// registrados aqui; treinamento NÃO é destino de férias. Sem embed no listar:
// os nomes (ferista/posto) são resolvidos na tela a partir das listas já
// carregadas — o tipo Database não declara os relacionamentos de
// vt_coberturas. Toda escrita termina em .select('id') e confere as linhas
// afetadas (anti-falso-sucesso, AGENTS.md §12).

export interface NovaCoberturaVT {
  /** O ferista (quem cobre/treina). NULL = declaração "sem cobertura" (migration 159). */
  colaborador_id: string | null
  /** De quem são as férias cobertas. NULL/ausente = cobertura/treinamento avulso. */
  ferias_colaborador_id?: string | null
  /** 'ferias' (padrão) ou 'treinamento' (migration 160). */
  tipo?: TipoCoberturaVT
  departamento_id: string
  data_inicio: string // 'AAAA-MM-DD'
  data_fim: string // 'AAAA-MM-DD'
  observacao?: string | null
}

export function useVtCoberturas() {
  const [coberturas, setCoberturas] = useState<VtCobertura[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vt_coberturas')
      .select('*')
      .order('data_inicio', { ascending: false })
    setLoading(false)
    if (error) {
      console.error('Erro ao listar coberturas do VT:', error.message)
      toast.error('Erro ao carregar as coberturas de férias')
      return false
    }
    setCoberturas((data as VtCobertura[]) ?? [])
    return true
  }, [])

  // Núcleo do INSERT, sem toast — quem chama decide a mensagem (registrar e
  // registrarComTreinamento precisam de textos diferentes para o mesmo erro).
  // 'duplicada' = unique (ferias_colaborador_id, data_inicio, tipo) — migration 160.
  const gravar = useCallback(
    async (
      dados: NovaCoberturaVT & { tipo: TipoCoberturaVT },
      usuarioId: string
    ): Promise<'ok' | 'duplicada' | 'erro' | 'vazio'> => {
      const { data, error } = await supabase
        .from('vt_coberturas')
        .insert({
          ...dados,
          colaborador_id: dados.colaborador_id || null,
          ferias_colaborador_id: dados.ferias_colaborador_id || null,
          observacao: dados.observacao ?? null,
          registrado_por: usuarioId,
        })
        .select('id')
      if (error) {
        if (error.code === '23505') return 'duplicada'
        console.error('Erro ao registrar cobertura do VT:', error.message)
        return 'erro'
      }
      if (!data || data.length === 0) return 'vazio'
      return 'ok'
    },
    []
  )

  const registrar = useCallback(
    async (dados: NovaCoberturaVT, usuarioId: string): Promise<boolean> => {
      if (dados.data_fim < dados.data_inicio) {
        toast.error('A data final não pode ser antes da inicial')
        return false
      }
      if (!dados.colaborador_id && !dados.ferias_colaborador_id) {
        toast.error('Informe o ferista ou as férias cobertas')
        return false
      }
      const tipo = dados.tipo ?? 'ferias'
      const resultado = await gravar({ ...dados, tipo }, usuarioId)
      if (resultado === 'duplicada') {
        toast.error(
          'Já existe um registro dessas férias começando nesse dia — exclua o anterior se quiser substituir'
        )
        return false
      }
      if (resultado === 'erro') {
        toast.error(tipo === 'treinamento' ? 'Erro ao registrar o treinamento' : 'Erro ao registrar a cobertura')
        return false
      }
      if (resultado === 'vazio') {
        toast.error('Não foi possível registrar: não gravado (permissão)')
        return false
      }
      toast.success(
        tipo === 'treinamento'
          ? 'Treinamento registrado'
          : dados.colaborador_id
            ? 'Cobertura de férias registrada'
            : '"Sem cobertura" registrado'
      )
      return true
    },
    [gravar]
  )

  /**
   * Grava a cobertura de férias e, quando informado, a linha de TREINAMENTO
   * do mesmo ferista no mesmo posto (migration 160). A cobertura é gravada
   * primeiro; se o treinamento falhar, a cobertura NÃO é desfeita — o erro
   * vem no toast e o retorno é false para a tela recarregar mesmo assim.
   * Duplicidade do treinamento NÃO pede para "registrar de novo" — o caminho
   * é excluir o registro anterior.
   */
  const registrarComTreinamento = useCallback(
    async (
      cobertura: NovaCoberturaVT,
      treinamento: NovaCoberturaVT | null,
      usuarioId: string
    ): Promise<boolean> => {
      const okCobertura = await registrar({ ...cobertura, tipo: 'ferias' }, usuarioId)
      if (!okCobertura) return false
      if (!treinamento) return true
      const resultado = await gravar({ ...treinamento, tipo: 'treinamento' }, usuarioId)
      if (resultado === 'ok') {
        toast.success('Treinamento registrado')
        return true
      }
      if (resultado === 'duplicada') {
        toast.error(
          'A cobertura foi gravada, mas já existe um treinamento dessas férias começando nesse dia — exclua o anterior se quiser substituir'
        )
        return false
      }
      if (resultado === 'vazio') {
        toast.error('A cobertura foi gravada, mas o treinamento não foi gravado (permissão)')
        return false
      }
      toast.error('A cobertura foi gravada, mas o treinamento falhou — registre o treinamento de novo')
      return false
    },
    [registrar, gravar]
  )

  const remover = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('vt_coberturas').delete().eq('id', id).select('id')
    if (error) {
      console.error('Erro ao remover cobertura do VT:', error.message)
      toast.error('Erro ao remover a cobertura')
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Não foi possível remover: cobertura não excluída (permissão)')
      return false
    }
    toast.success('Cobertura removida')
    return true
  }, [])

  return { coberturas, loading, listar, registrar, registrarComTreinamento, remover }
}
