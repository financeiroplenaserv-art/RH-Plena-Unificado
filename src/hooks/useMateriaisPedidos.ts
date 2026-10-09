import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import { adicionarMeses, competenciaDe } from '@/lib/materiais/datas'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import { montarPainel, type LinhaPainel } from '@/lib/materiais/painel'
import type { PayloadAprovacao, PayloadValidacao } from '@/lib/materiais/filas'
import type { PrecoHistorico } from '@/lib/materiais/precos'
import type { ConsumoMes } from '@/lib/materiais/media'
import { escritaMateriaisOk } from './useMateriaisCatalogo'
import type {
  CeuPedidoItem,
  MatComentario,
  MatContrato,
  MatKitItem,
  MatPedido,
  MatPedidoEnvio,
  MatPedidoItem,
  MateriaisConfig,
} from '@/types/materiais'

// Filas internas do módulo Materiais (migrations 122/124 — docs/PLANO_MATERIAIS_FASE1.md
// §5.1 e §6). Mudanças de estado SEMPRE por RPC (o banco reconfere perfil e
// status e devolve erro explícito); INSERT direto só em pedido 'rascunho' do
// autor (pedido extra) e comentários — sempre com .select('id').

export const COLUNAS_PEDIDO =
  'id, contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio, rota_override, rota_override_motivo, rota_override_por, responsavel_nome, observacao, termos_aceitos, status_produtos, status_ceu, enviado_em, reaberto_por, reaberto_em, criado_por, created_at'
export const COLUNAS_ITEM_PEDIDO =
  'id, pedido_id, envio_id, possivel_repeticao, repete_linha_id, decisao_repeticao, item_id, variacao_id, descricao_livre, qtd_kit, qtd_pedida, qtd_validada, qtd_aprovada, qtd_entregue, preco_unitario, justificativa, excecao_acima_kit, excecao_validade, excecao_fora_kit, ultima_entrega_em, motivo_ajuste, ajustado_por, ajustado_em, created_at'
/** Sem qtd_atendida/motivo_atendimento (migration 124) — funciona antes e depois dela. */
export const COLUNAS_CEU_PEDIDO =
  'id, pedido_id, envio_id, possivel_repeticao, nome_digitado, colaborador_id, identificado_por, identificado_em, fora_da_equipe, tipo, item_id, tamanho, tamanho_cadastro, qtd_pedida, qtd_conferida, alerta_tamanho, ultima_entrega_em, cracha_nome, cracha_motivo, cracha_cordao, status, conferido_por, conferido_em, atendido_por, atendido_em, motivo_ajuste, created_at'
export const COLUNAS_ENVIO = 'id, pedido_id, sequencia, origem, seu_nome, enviado_em, ip, user_agent'

const LOTE_IDS = 150

type Erro = { code?: string; message?: string } | null

/** `.in()` em lotes (a URL do PostgREST tem limite). */
export async function buscarPorIds<T>(
  ids: string[],
  buscar: (lote: string[]) => PromiseLike<{ data: unknown[] | null; error: Erro }>
): Promise<{ data: T[]; error: Erro }> {
  const todos: T[] = []
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    const { data, error } = await buscar(ids.slice(i, i + LOTE_IDS))
    if (error) return { data: [], error }
    todos.push(...((data ?? []) as T[]))
  }
  return { data: todos, error: null }
}

export const numerarItem = (l: MatPedidoItem): MatPedidoItem => ({
  ...l,
  qtd_pedida: Number(l.qtd_pedida),
  qtd_kit: l.qtd_kit == null ? null : Number(l.qtd_kit),
  qtd_validada: l.qtd_validada == null ? null : Number(l.qtd_validada),
  qtd_aprovada: l.qtd_aprovada == null ? null : Number(l.qtd_aprovada),
  preco_unitario: l.preco_unitario == null ? null : Number(l.preco_unitario),
})

/** Erro de RPC → toast. RPC que não lança = sucesso (o banco reconfere tudo). */
function rpcOk(error: Erro, acao: string): boolean {
  if (!error) return true
  toast.error(mensagemErroMateriais(error, acao))
  return false
}

/** Configuração do módulo (dia limite/aviso), com padrão 15/10 quando não há. */
export async function lerMateriaisConfig(): Promise<MateriaisConfig> {
  const padrao: MateriaisConfig = { dia_limite: 15, dia_aviso: 10, aviso_recibo: '' }
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'materiais_config').maybeSingle()
  try {
    const bruto = (data as { valor?: unknown } | null)?.valor
    const v = (typeof bruto === 'string' ? JSON.parse(bruto) : bruto) as Partial<MateriaisConfig> | null
    const dl = Number(v?.dia_limite)
    const da = Number(v?.dia_aviso)
    return {
      dia_limite: Number.isInteger(dl) && dl >= 1 && dl <= 28 ? dl : padrao.dia_limite,
      dia_aviso: Number.isInteger(da) && da >= 1 && da <= 28 ? da : padrao.dia_aviso,
      aviso_recibo: typeof v?.aviso_recibo === 'string' ? v.aviso_recibo : '',
    }
  } catch {
    return padrao
  }
}

// ------------------------------------------------------------------
// Lista do mês
// ------------------------------------------------------------------

export interface ResumoPedidoLista {
  linhasProdutos: number
  excecoes: number
  repeticoes: number
  linhasCeu: number
  ceuAbertas: number
}

export function useMateriaisPedidos() {
  const [pedidos, setPedidos] = useState<MatPedido[]>([])
  const [itens, setItens] = useState<MatPedidoItem[]>([])
  const [ceuItens, setCeuItens] = useState<Pick<CeuPedidoItem, 'id' | 'pedido_id' | 'status' | 'possivel_repeticao'>[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  /** Pedidos do mês (`competencia`) ou, com `emValidacao`, todos os que aguardam o inspetor. */
  const carregar = useCallback(async (opts: { competencia?: string; emValidacao?: boolean }) => {
    setLoading(true)
    let q = supabase.from('mat_pedidos').select(COLUNAS_PEDIDO).order('created_at', { ascending: false }).limit(1000)
    if (opts.emValidacao) q = q.eq('status_produtos', 'em_validacao')
    else if (opts.competencia) q = q.eq('competencia', competenciaDe(opts.competencia))
    const rp = await q
    if (rp.error) {
      if (estruturaAusente(rp.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(rp.error, 'carregar os pedidos'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    const lista = (rp.data as MatPedido[]) ?? []
    const ids = lista.map((p) => p.id)
    const [ri, rc] = await Promise.all([
      buscarPorIds<MatPedidoItem>(ids, (lote) => supabase.from('mat_pedido_itens').select(COLUNAS_ITEM_PEDIDO).in('pedido_id', lote)),
      buscarPorIds<CeuPedidoItem>(ids, (lote) =>
        supabase.from('ceu_pedido_itens').select('id, pedido_id, status, possivel_repeticao').in('pedido_id', lote)
      ),
    ])
    if (ri.error || rc.error) toast.error(mensagemErroMateriais(ri.error ?? rc.error, 'carregar as linhas dos pedidos'))
    setPedidos(lista)
    setItens(ri.data.map(numerarItem))
    setCeuItens(rc.data)
    setLoading(false)
  }, [])

  return { pedidos, itens, ceuItens, loading, estruturaPendente, carregar }
}

// ------------------------------------------------------------------
// Detalhe do pedido (validação do inspetor, aprovação do gestor, comentários)
// ------------------------------------------------------------------

export function usePedidoMaterial() {
  const [pedido, setPedido] = useState<MatPedido | null>(null)
  const [envios, setEnvios] = useState<MatPedidoEnvio[]>([])
  const [itens, setItens] = useState<MatPedidoItem[]>([])
  const [ceuItens, setCeuItens] = useState<CeuPedidoItem[]>([])
  const [comentarios, setComentarios] = useState<MatComentario[]>([])
  const [kit, setKit] = useState<MatKitItem[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (id: string) => {
    setLoading(true)
    const rp = await supabase.from('mat_pedidos').select(COLUNAS_PEDIDO).eq('id', id).maybeSingle()
    if (rp.error) {
      if (estruturaAusente(rp.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(rp.error, 'carregar o pedido'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    const p = (rp.data as MatPedido | null) ?? null
    setPedido(p)
    if (!p) {
      setLoading(false)
      return
    }
    const [re, ri, rc, rm, rk] = await Promise.all([
      supabase.from('mat_pedido_envios').select(COLUNAS_ENVIO).eq('pedido_id', id).order('sequencia'),
      supabase.from('mat_pedido_itens').select(COLUNAS_ITEM_PEDIDO).eq('pedido_id', id).order('created_at'),
      supabase.from('ceu_pedido_itens').select(COLUNAS_CEU_PEDIDO).eq('pedido_id', id).order('created_at'),
      supabase
        .from('mat_comentarios')
        .select('id, pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto, created_at')
        .eq('pedido_id', id)
        .order('created_at'),
      supabase
        .from('mat_kit_itens')
        .select('id, contrato_id, item_id, variacao_id, quantidade, periodicidade_meses, observacao')
        .eq('contrato_id', p.contrato_id),
    ])
    const erro = re.error ?? ri.error ?? rc.error ?? rm.error ?? rk.error
    if (erro) toast.error(mensagemErroMateriais(erro, 'carregar o pedido'))
    setEnvios((re.data as MatPedidoEnvio[]) ?? [])
    setItens(((ri.data as MatPedidoItem[]) ?? []).map(numerarItem))
    setCeuItens((rc.data as CeuPedidoItem[]) ?? [])
    setComentarios((rm.data as MatComentario[]) ?? [])
    setKit(((rk.data as MatKitItem[]) ?? []).map((k) => ({ ...k, quantidade: Number(k.quantidade) })))
    setLoading(false)
  }, [])

  const validar = useCallback(async (pedidoId: string, itensPayload: PayloadValidacao[], comentario: string | null) => {
    const { error } = await supabase.rpc('validar_pedido_materiais', {
      p_pedido: pedidoId,
      p_itens: itensPayload as unknown as Record<string, unknown>[],
      p_comentario: comentario,
    })
    if (!rpcOk(error, 'validar o pedido')) return false
    toast.success('Pedido validado — segue para o gestor')
    return true
  }, [])

  const aprovar = useCallback(async (pedidoId: string, itensPayload: PayloadAprovacao[]) => {
    const { error } = await supabase.rpc('aprovar_pedido_materiais', {
      p_pedido: pedidoId,
      p_itens: itensPayload as unknown as Record<string, unknown>[],
    })
    if (!rpcOk(error, 'aprovar o pedido')) return false
    toast.success('Pedido aprovado')
    return true
  }, [])

  const comentar = useCallback(
    async (dados: { pedidoId: string; texto: string; autorNome: string | null; linhaTabela?: MatComentario['linha_tabela']; linhaId?: string | null }) => {
      const texto = dados.texto.trim()
      if (!texto) {
        toast.error('Escreva o comentário')
        return false
      }
      const resultado = await supabase
        .from('mat_comentarios')
        .insert({
          pedido_id: dados.pedidoId,
          texto,
          autor_nome: dados.autorNome,
          linha_tabela: dados.linhaTabela ?? null,
          linha_id: dados.linhaId ?? null,
        })
        .select('id')
      if (!escritaMateriaisOk(resultado, 'registrar o comentário')) return false
      toast.success('Comentário registrado')
      return true
    },
    []
  )

  return { pedido, envios, itens, ceuItens, comentarios, kit, loading, estruturaPendente, carregar, validar, aprovar, comentar }
}

// ------------------------------------------------------------------
// Painel do gestor
// ------------------------------------------------------------------

export function useMateriaisPainel() {
  const [linhas, setLinhas] = useState<LinhaPainel[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (competencia: string) => {
    setLoading(true)
    const comp = competenciaDe(competencia)
    const desde = adicionarMeses(comp, -12)
    const hoje = hojeBrasil()
    const [rc, rp, rk, rpr, rh, ra] = await Promise.all([
      supabase.from('mat_contratos').select('id, nome, ativo').order('nome'),
      supabase
        .from('mat_pedidos')
        .select('id, contrato_id, tipo, status_produtos, preenchido_pelo_escritorio')
        .eq('competencia', comp),
      selecionarTudo<Pick<MatKitItem, 'contrato_id' | 'item_id' | 'variacao_id' | 'quantidade'>>((de, ate) =>
        supabase.from('mat_kit_itens').select('contrato_id, item_id, variacao_id, quantidade').order('id').range(de, ate)
      ),
      selecionarTudo<PrecoHistorico>((de, ate) =>
        supabase.from('mat_precos').select('item_id, variacao_id, preco, vigente_desde, created_at').order('id').range(de, ate)
      ),
      selecionarTudo<ConsumoMes & { contrato_id: string }>((de, ate) =>
        supabase
          .from('mat_historico_consumo')
          .select('contrato_id, competencia, item_id, variacao_id, quantidade')
          .gte('competencia', desde)
          .order('id')
          .range(de, ate)
      ),
      supabase
        .from('mat_pedidos')
        .select('id, contrato_id, competencia, status_produtos')
        .eq('status_produtos', 'aprovado')
        .gte('competencia', desde)
        .lt('competencia', comp),
    ])
    const erro = rc.error ?? rp.error ?? rk.error ?? rpr.error ?? rh.error ?? ra.error
    if (erro) {
      if (estruturaAusente(erro)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(erro, 'carregar o painel'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    const pedidosDoMes = (rp.data ?? []) as Pick<MatPedido, 'id' | 'contrato_id' | 'tipo' | 'status_produtos' | 'preenchido_pelo_escritorio'>[]
    const anteriores = (ra.data ?? []) as { id: string; contrato_id: string; competencia: string; status_produtos: string }[]
    const [ri, rant] = await Promise.all([
      buscarPorIds<MatPedidoItem>(pedidosDoMes.map((p) => p.id), (lote) =>
        supabase.from('mat_pedido_itens').select(COLUNAS_ITEM_PEDIDO).in('pedido_id', lote)
      ),
      buscarPorIds<{ pedido_id: string; item_id: string | null; variacao_id: string | null; qtd_aprovada: number | null }>(
        anteriores.map((p) => p.id),
        (lote) => supabase.from('mat_pedido_itens').select('pedido_id, item_id, variacao_id, qtd_aprovada').in('pedido_id', lote)
      ),
    ])
    if (ri.error || rant.error) toast.error(mensagemErroMateriais(ri.error ?? rant.error, 'carregar as linhas dos pedidos'))
    setLinhas(
      montarPainel({
        contratos: (rc.data ?? []) as Pick<MatContrato, 'id' | 'nome' | 'ativo'>[],
        pedidosDoMes,
        itensDoMes: ri.data.map(numerarItem),
        kits: (rk.data ?? []).map((k) => ({ ...k, quantidade: Number(k.quantidade) })),
        precos: (rpr.data ?? []).map((p) => ({ ...p, preco: Number(p.preco) })),
        historico: (rh.data ?? []).map((h) => ({ ...h, quantidade: Number(h.quantidade) })),
        pedidosAnteriores: anteriores,
        itensAnteriores: rant.data.map((i) => ({ ...i, qtd_aprovada: i.qtd_aprovada == null ? null : Number(i.qtd_aprovada) })),
        hoje,
      })
    )
    setLoading(false)
  }, [])

  const aprovarLote = useCallback(async (competencia: string, contratos: string[]) => {
    const { data, error } = await supabase.rpc('aprovar_lote_materiais', {
      p_competencia: competenciaDe(competencia),
      p_contratos: contratos,
    })
    if (!rpcOk(error, 'aprovar os pedidos')) return false
    const n = Number(data ?? 0)
    if (n === 0) {
      toast.warning('Nenhum pedido validado foi aprovado — confira se ainda aguardam o inspetor')
      return false
    }
    toast.success(n === 1 ? '1 pedido aprovado' : `${n} pedidos aprovados`)
    return true
  }, [])

  return { linhas, loading, estruturaPendente, carregar, aprovarLote }
}

// ------------------------------------------------------------------
// Contratos que ainda não pediram
// ------------------------------------------------------------------

export interface ContratoSemPedido {
  contrato_id: string
  nome: string
  departamento_id: string
  rota: number | null
  ultimo_responsavel: string | null
  link_aberto_no_mes: boolean
  tem_link: boolean
  /** Migration 124: o líder já enviou só uniforme/EPI/crachá (o kit entra nesse pedido). */
  pedido_id?: string | null
}

export function useMateriaisSemPedido() {
  const [lista, setLista] = useState<ContratoSemPedido[]>([])
  const [config, setConfig] = useState<MateriaisConfig>({ dia_limite: 15, dia_aviso: 10, aviso_recibo: '' })
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (competencia: string) => {
    setLoading(true)
    const [r, cfg] = await Promise.all([
      supabase.rpc('mat_contratos_sem_pedido', { p_competencia: competenciaDe(competencia) }),
      lerMateriaisConfig(),
    ])
    setConfig(cfg)
    if (r.error) {
      if (estruturaAusente(r.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(r.error, 'carregar os contratos sem pedido'))
      setLista([])
    } else {
      setEstruturaPendente(false)
      setLista((r.data as ContratoSemPedido[]) ?? [])
    }
    setLoading(false)
  }, [])

  const preencherPeloKit = useCallback(async (contratoId: string, competencia: string) => {
    const { data, error } = await supabase.rpc('preencher_pedido_pelo_kit', {
      p_contrato: contratoId,
      p_competencia: competenciaDe(competencia),
    })
    if (!rpcOk(error, 'preencher pelo kit')) return null
    toast.success('Pedido preenchido pelo kit — marcado "preenchido pelo escritório"')
    return (data as string | null) ?? null
  }, [])

  const reabrir = useCallback(async (contratoId: string, competencia: string, ate: string, motivo: string) => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo da reabertura')
      return false
    }
    const { error } = await supabase.rpc('reabrir_pedido_materiais', {
      p_contrato: contratoId,
      p_competencia: competenciaDe(competencia),
      p_ate: ate,
      p_motivo: motivo.trim(),
    })
    if (!rpcOk(error, 'reabrir o link')) return false
    toast.success('Link reaberto para o líder')
    return true
  }, [])

  return { lista, config, loading, estruturaPendente, carregar, preencherPeloKit, reabrir }
}

// ------------------------------------------------------------------
// Pedido extra interno (inspetoria/mesa) — inclui faltistas em ADM PLENA
// ------------------------------------------------------------------

export interface LinhaProdutoExtra {
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string | null
  qtd_kit: number | null
  qtd_pedida: number
  preco_unitario: number | null
  justificativa: string | null
  excecao_acima_kit: boolean
  excecao_validade: boolean
  excecao_fora_kit: boolean
}

export interface LinhaCeuExtra {
  tipo: CeuPedidoItem['tipo']
  colaborador_id: string
  nome_digitado: string
  item_id: string | null
  tamanho: string | null
  tamanho_cadastro: string | null
  alerta_tamanho: boolean
  fora_da_equipe: boolean
  qtd_pedida: number
  cracha_nome: string | null
  cracha_motivo: string | null
  cracha_cordao: boolean | null
}

/**
 * Cria o pedido extra (rascunho do autor), grava as linhas e envia pela RPC
 * enviar_pedido_interno. Se algo falhar no meio, o rascunho é apagado (a RLS
 * deixa o autor apagar o próprio rascunho) para não sobrar pedido pela metade.
 */
export async function criarPedidoExtra(dados: {
  contratoId: string
  competencia: string
  observacao: string | null
  userId: string
  produtos: LinhaProdutoExtra[]
  ceu: LinhaCeuExtra[]
}): Promise<string | null> {
  if (dados.produtos.length + dados.ceu.length === 0) {
    toast.error('Inclua ao menos um item no pedido')
    return null
  }
  const rp = await supabase
    .from('mat_pedidos')
    .insert({
      contrato_id: dados.contratoId,
      competencia: competenciaDe(dados.competencia),
      tipo: 'extra',
      origem: 'operacional',
      status_produtos: 'rascunho',
      status_ceu: 'nao_se_aplica',
      observacao: dados.observacao,
      criado_por: dados.userId,
    })
    .select('id')
  if (!escritaMateriaisOk(rp, 'criar o pedido extra')) return null
  const pedidoId = (rp.data?.[0] as { id: string }).id
  const desfazer = async () => {
    await supabase.from('mat_pedidos').delete().eq('id', pedidoId).select('id')
  }

  if (dados.produtos.length > 0) {
    const ri = await supabase
      .from('mat_pedido_itens')
      .insert(dados.produtos.map((l) => ({ ...l, pedido_id: pedidoId })))
      .select('id')
    if (!escritaMateriaisOk(ri, 'gravar os produtos do pedido')) {
      await desfazer()
      return null
    }
  }
  if (dados.ceu.length > 0) {
    const agora = new Date().toISOString()
    const rc = await supabase
      .from('ceu_pedido_itens')
      .insert(
        dados.ceu.map((l) => ({
          ...l,
          pedido_id: pedidoId,
          // O escritório já escolheu o colaborador: a linha nasce identificada.
          status: 'pendente' as const,
          identificado_por: dados.userId,
          identificado_em: agora,
        }))
      )
      .select('id')
    if (!escritaMateriaisOk(rc, 'gravar os uniformes/EPI/crachás do pedido')) {
      await desfazer()
      return null
    }
  }
  const { error } = await supabase.rpc('enviar_pedido_interno', { p_pedido: pedidoId })
  if (error) {
    toast.error(mensagemErroMateriais(error, 'enviar o pedido extra'))
    await desfazer()
    return null
  }
  toast.success('Pedido extra enviado')
  return pedidoId
}
