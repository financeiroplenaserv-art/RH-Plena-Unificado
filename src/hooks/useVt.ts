import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import type { DepartamentoFuzzy } from '@/lib/departamentos'
import type {
  EscopoTrajetoVT,
  PrecisaoOrigemVT,
  TipoCartaoVT,
  VtBilhete,
  VtTrajeto,
} from '@/types/vt'

// Hook do módulo VT (Vale-Transporte) — Fase 1 (migration 155; rename da 156,
// docs/PLANO_MODULO_VT.md). Escopo: cadastro de optantes/tipo de bilhete,
// trajetos casa → posto e bilhetes de VT com valor diário fechado (ida+volta)
// e vigência — modelo aprovado pela gestora em 21/10/2026 (§2d do plano): o
// trajeto usa bilhete 1 (obrigatório) + bilhete 2 (opcional) e o custo do dia
// é a soma (calculado na página pelas funções puras de src/lib/vt). Toda
// escrita termina em .select('id') e confere as linhas afetadas — escrita
// bloqueada por RLS devolve 0 linhas SEM erro (AGENTS.md §12).

export interface VtColaborador {
  id: string
  nome_completo: string
  departamento: string | null
  departamento_id: string | null
  cidade: string | null
  endereco: string | null
  cep?: string | null
  vt_optante: boolean | null
  vt_tipo_cartao: TipoCartaoVT | null
  /** Situação do BU no site da Riocard (migration 167; null = ainda não consultado). */
  vt_bu_ativado?: boolean | null
  /** Texto cru do site da Riocard ("Ativado", "Suspenso Setrans"...). */
  vt_bu_situacao?: string | null
  /** Cargo do cadastro — resolve a função ao adicionar à carteira de feristas pela tela do VT. */
  cargo?: string | null
}

/** Departamento para resolução (nome_curto fuzzy) + endereço do posto (link do Maps). */
export interface VtDepartamento extends DepartamentoFuzzy {
  endereco: string | null
  cidade: string | null
  cep?: string | null
}

export interface VtTrajetoComDetalhes extends VtTrajeto {
  colaborador?: {
    id: string
    nome_completo: string
    cidade: string | null
    endereco: string | null
    cep?: string | null
    /** Cartão que a pessoa TEM (cadastro) — exibido na aba Trajetos; o valor pago vem do bilhete do trajeto (decisão da gestora, 24/10/2026). */
    vt_tipo_cartao?: TipoCartaoVT | null
    /** Situação do BU na Riocard (migration 167; ausente/null = não consultado). */
    vt_bu_ativado?: boolean | null
    vt_bu_situacao?: string | null
  } | null
  departamento?: {
    id: string
    nome: string
    nome_curto: string | null
    endereco: string | null
    cidade: string | null
    cep?: string | null
  } | null
}

export interface NovoBilheteVT {
  nome: string
  valor_diario_centavos: number
  vigente_desde: string
  /** Cartão que a pessoa precisa ter para o valor cobrir o trajeto (migration 165; null = não classificado). */
  cartao_necessario: TipoCartaoVT | null
  /** Migration 165: o bilhete depende de integração (2+ conduções numa tarifa só). */
  usa_integracao: boolean
}

export interface NovoTrajetoVT {
  colaborador_id: string
  departamento_id: string
  /** Bilhete 1 (obrigatório). */
  bilhete_id: string
  /** Bilhete 2 (opcional; null = nenhum — nunca igual ao 1º, CHECK do banco). */
  bilhete_2_id: string | null
  /** Classificação informacional das cidades casa × posto (não precifica). */
  escopo: EscopoTrajetoVT
  precisao_origem: PrecisaoOrigemVT
  /** Valor extra manual por dia em centavos (migration 166; 0/ausente = sem extra). */
  valor_extra_centavos?: number
  observacao?: string | null
}

const COLUNAS_COLABORADOR_VT =
  'id, nome_completo, departamento, departamento_id, cidade, endereco, cep, vt_optante, vt_tipo_cartao, vt_bu_ativado, vt_bu_situacao, cargo'
const COLUNAS_DEPARTAMENTO_VT = 'id, nome, nome_curto, empresa_id, status, endereco, cidade, cep'
// Sem embed: o tipo Database não declara os relacionamentos de vt_trajetos e a
// página já tem colaboradores/departamentos carregados para resolver o join.
const COLUNAS_TRAJETO = '*'

/** Nome/status de colaborador de trajeto que NÃO está na lista de ativos (afastado/inativo). */
export type InfoColaboradorTrajeto = { nome_completo: string; status: string }

export function useVt() {
  const [colaboradores, setColaboradores] = useState<VtColaborador[]>([])
  const [departamentos, setDepartamentos] = useState<VtDepartamento[]>([])
  const [bilhetes, setBilhetes] = useState<VtBilhete[]>([])
  const [trajetos, setTrajetos] = useState<VtTrajetoComDetalhes[]>([])
  const [colaboradoresDeTrajetos, setColaboradoresDeTrajetos] = useState<Map<string, InfoColaboradorTrajeto>>(new Map())
  const [loading, setLoading] = useState(false)

  const listarColaboradores = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select(COLUNAS_COLABORADOR_VT)
      .eq('status', 'Ativo')
      .order('nome_completo')
    if (error) {
      console.error('Erro ao listar colaboradores do VT:', error.message)
      toast.error('Erro ao carregar os colaboradores')
      return false
    }
    setColaboradores((data as VtColaborador[]) ?? [])
    return true
  }, [])

  // Lista SEM filtro de nome_curto: serve para resolução fuzzy do posto
  // (nomeCurtoDepartamentoFuzzy) — AGENTS.md proíbe useDepartamentos.listar()
  // para isso. Também traz o endereço do posto para o link do Google Maps.
  const listarDepartamentos = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.from('departamentos').select(COLUNAS_DEPARTAMENTO_VT)
    if (error) {
      console.error('Erro ao listar departamentos do VT:', error.message)
      toast.error('Erro ao carregar os postos')
      return false
    }
    setDepartamentos((data as VtDepartamento[]) ?? [])
    return true
  }, [])

  /** Marca optante/tipo de bilhete; ao desmarcar, o tipo de bilhete é limpo. */
  const salvarVtColaborador = useCallback(
    async (id: string, dados: { vt_optante: boolean; vt_tipo_cartao: TipoCartaoVT | null }): Promise<boolean> => {
      const { data, error } = await supabase
        .from('colaboradores')
        .update({
          vt_optante: dados.vt_optante,
          vt_tipo_cartao: dados.vt_optante ? dados.vt_tipo_cartao : null,
        })
        .eq('id', id)
        .select('id')
      if (error) {
        console.error('Erro ao salvar VT do colaborador:', error.message)
        toast.error('Erro ao salvar o vale-transporte do colaborador')
        return false
      }
      if (!data || data.length === 0) {
        toast.error('Não foi possível salvar: cadastro não alterado (permissão ou registro ausente)')
        return false
      }
      setColaboradores((atual) =>
        atual.map((c) =>
          c.id === id
            ? { ...c, vt_optante: dados.vt_optante, vt_tipo_cartao: dados.vt_optante ? dados.vt_tipo_cartao : null }
            : c
        )
      )
      return true
    },
    []
  )

  const listarBilhetes = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from('vt_bilhetes')
      .select('*')
      .order('vigente_desde', { ascending: false })
    if (error) {
      console.error('Erro ao listar bilhetes do VT:', error.message)
      toast.error('Erro ao carregar os bilhetes de VT')
      return false
    }
    setBilhetes((data as VtBilhete[]) ?? [])
    return true
  }, [])

  /**
   * Nova vigência de bilhete (reajuste): o histórico NUNCA é editado — insere
   * uma linha nova. Se a vigência já vale hoje, desativa as anteriores do
   * mesmo nome; se é futura (reajuste agendado), a anterior segue ativa até lá
   * e a função bilhetesVigentes escolhe pela data.
   */
  const novaVigenciaBilhete = useCallback(async (dados: NovoBilheteVT): Promise<boolean> => {
    const { data: inseridas, error: erroInsert } = await supabase
      .from('vt_bilhetes')
      .insert({ ...dados, ativo: true })
      .select('id')
    if (erroInsert) {
      console.error('Erro ao cadastrar bilhete do VT:', erroInsert.message)
      toast.error('Erro ao cadastrar a nova vigência do bilhete')
      return false
    }
    if (!inseridas || inseridas.length === 0) {
      toast.error('Não foi possível cadastrar: bilhete não gravado (permissão)')
      return false
    }
    if (dados.vigente_desde <= hojeBrasil()) {
      const { error: erroDesativar } = await supabase
        .from('vt_bilhetes')
        .update({ ativo: false })
        .eq('nome', dados.nome)
        .eq('ativo', true)
        .neq('id', inseridas[0].id)
        .select('id')
      if (erroDesativar) {
        console.error('Erro ao desativar vigência anterior:', erroDesativar.message)
        toast.error('Bilhete gravado, mas a vigência anterior não foi desativada — confira a lista')
      }
    }
    toast.success('Nova vigência do bilhete cadastrada')
    return true
  }, [])

  const desativarBilhete = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('vt_bilhetes')
      .update({ ativo: false })
      .eq('id', id)
      .select('id')
    if (error) {
      console.error('Erro ao desativar bilhete do VT:', error.message)
      toast.error('Erro ao desativar o bilhete')
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Não foi possível desativar: bilhete não alterado (permissão)')
      return false
    }
    toast.success('Bilhete desativado')
    return true
  }, [])

  const listarTrajetos = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.from('vt_trajetos').select(COLUNAS_TRAJETO).order('created_at')
    if (error) {
      console.error('Erro ao listar trajetos do VT:', error.message)
      toast.error('Erro ao carregar os trajetos')
      return false
    }
    const lista = (data as VtTrajetoComDetalhes[]) ?? []
    setTrajetos(lista)
    // A lista principal de colaboradores é só de ATIVOS — trajeto de afastado/
    // inativo ficaria sem nome na aba Trajetos ("—"). Busca nome/status dos
    // não ativos referenciados para a tela exibir com selo (23/10/2026).
    const ids = [...new Set(lista.map((t) => t.colaborador_id))]
    if (ids.length > 0) {
      const { data: extras } = await supabase
        .from('colaboradores')
        .select('id, nome_completo, status')
        .in('id', ids)
        .neq('status', 'Ativo')
      setColaboradoresDeTrajetos(
        new Map((extras ?? []).map((c) => [c.id as string, { nome_completo: c.nome_completo, status: c.status }]))
      )
    } else {
      setColaboradoresDeTrajetos(new Map())
    }
    return true
  }, [])

  /**
   * Um trajeto por par colaborador × departamento: atualiza o par existente
   * (preservando status/confirmação) ou insere como 'sugerido'/'manual'.
   * Devolve o id do trajeto (null em caso de erro).
   * Com `desconfirmar: true` (troca de bilhete em trajeto CONFIRMADO), o
   * UPDATE também volta o status para 'sugerido' e zera a confirmação — o
   * preço muda, então a linha volta a "A confirmar" e a carga não vale sem
   * reconfirmação humana.
   */
  const salvarTrajeto = useCallback(
    async (
      dados: NovoTrajetoVT,
      opcoes?: { desconfirmar?: boolean }
    ): Promise<string | null> => {
      const campos = {
        bilhete_id: dados.bilhete_id,
        bilhete_2_id: dados.bilhete_2_id || null,
        escopo: dados.escopo,
        precisao_origem: dados.precisao_origem,
        valor_extra_centavos: dados.valor_extra_centavos ?? 0,
        observacao: dados.observacao ?? null,
        ...(opcoes?.desconfirmar
          ? { status: 'sugerido' as const, confirmado_por: null, confirmado_em: null }
          : {}),
      }
      const { data: atualizados, error: erroUpdate } = await supabase
        .from('vt_trajetos')
        .update(campos)
        .eq('colaborador_id', dados.colaborador_id)
        .eq('departamento_id', dados.departamento_id)
        .select('id')
      if (erroUpdate) {
        console.error('Erro ao salvar trajeto do VT:', erroUpdate.message)
        toast.error('Erro ao salvar o trajeto')
        return null
      }
      if (atualizados && atualizados.length > 0) {
        toast.success(
          opcoes?.desconfirmar
            ? 'Bilhete alterado — confirme o trajeto de novo para valer na carga'
            : 'Trajeto atualizado'
        )
        return atualizados[0].id
      }
      const { data: inseridos, error: erroInsert } = await supabase
        .from('vt_trajetos')
        .insert({ ...dados, ...campos })
        .select('id')
      if (erroInsert) {
        console.error('Erro ao criar trajeto do VT:', erroInsert.message)
        toast.error('Erro ao criar o trajeto')
        return null
      }
      if (!inseridos || inseridos.length === 0) {
        toast.error('Não foi possível criar: trajeto não gravado (permissão)')
        return null
      }
      toast.success('Trajeto criado — confirme após conferir a rota')
      return inseridos[0].id
    },
    []
  )

  /** Confirmação humana do trajeto (regra "importação nunca grava palpite"). */
  const confirmarTrajeto = useCallback(async (id: string, usuarioId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('vt_trajetos')
      .update({
        status: 'confirmado',
        origem: 'link_confirmado',
        confirmado_por: usuarioId,
        confirmado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
    if (error) {
      console.error('Erro ao confirmar trajeto do VT:', error.message)
      toast.error('Erro ao confirmar o trajeto')
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Não foi possível confirmar: trajeto não alterado (permissão)')
      return false
    }
    toast.success('Trajeto confirmado')
    return true
  }, [])

  const removerTrajeto = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('vt_trajetos').delete().eq('id', id).select('id')
    if (error) {
      console.error('Erro ao remover trajeto do VT:', error.message)
      toast.error('Erro ao remover o trajeto')
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Não foi possível remover: trajeto não excluído (permissão)')
      return false
    }
    toast.success('Trajeto removido')
    return true
  }, [])

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    await Promise.all([listarColaboradores(), listarDepartamentos(), listarBilhetes(), listarTrajetos()])
    setLoading(false)
  }, [listarColaboradores, listarDepartamentos, listarBilhetes, listarTrajetos])

  return {
    colaboradores,
    departamentos,
    bilhetes,
    trajetos,
    colaboradoresDeTrajetos,
    loading,
    carregarTudo,
    listarColaboradores,
    listarDepartamentos,
    listarBilhetes,
    listarTrajetos,
    salvarVtColaborador,
    novaVigenciaBilhete,
    desativarBilhete,
    salvarTrajeto,
    confirmarTrajeto,
    removerTrajeto,
  }
}
