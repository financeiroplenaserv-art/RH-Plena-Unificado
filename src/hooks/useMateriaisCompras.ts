import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { competenciaDe } from '@/lib/materiais/datas'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import { normalizarPrevia, type PayloadLinhaCompra, type PreviaCompra } from '@/lib/materiais/compra'
import { buscarPorIds } from './useMateriaisPedidos'
import type { MatCompra, MatCompraItem, MatPedidoItem } from '@/types/materiais'

// Compra ao fornecedor (Fase 2 — migrations 146/147). Leitura direta das
// tabelas (RLS: pode_ver_compras_materiais) e TODA escrita por RPC SECURITY
// DEFINER que reconfere perfil e estado e devolve o que mudou (anti-falso-
// sucesso: erro do banco vira toast; sem erro = o banco gravou). Nada é gerado
// automaticamente — o comprador clica.

export const COLUNAS_COMPRA =
  'id, competencia, fornecedor_id, numero, tipo, status, antes_da_janela, data_corte, entrega_prevista, enviada_em, enviada_por, cancelada_em, cancelada_motivo, observacao, criado_por, created_at'
export const COLUNAS_COMPRA_ITEM =
  'id, compra_id, item_id, variacao_id, contrato_id, item_nome, variacao_rotulo, unidade, categoria, contrato_nome, rota, quantidade, preco_unitario, qtd_recebida, motivo_recebimento, recebido_em, entrega_local'
/** Colunas da Fase 2 em mat_pedido_itens (lidas à parte — a tela funciona antes da migration). */
export const COLUNAS_ITEM_PEDIDO_FASE2 =
  'id, atendimento, qtd_estoque, qtd_compra, compra_item_id, motivo_nao_atendido, qtd_entregue_estoque, qtd_recebida_fornecedor, motivo_entrega, entregue_em, qtd_entregue'

type Erro = { code?: string; message?: string } | null

const numerarCelula = (c: MatCompraItem): MatCompraItem => ({
  ...c,
  quantidade: Number(c.quantidade),
  preco_unitario: c.preco_unitario == null ? null : Number(c.preco_unitario),
  qtd_recebida: c.qtd_recebida == null ? null : Number(c.qtd_recebida),
  rota: c.rota == null ? null : (Number(c.rota) as MatCompraItem['rota']),
})

const n = (v: unknown) => (v == null ? null : Number(v))

/**
 * Campos de destino/entrega das linhas de pedido (migration 147), por id do
 * pedido. Sem a migration devolve vazio (estrutura ausente não é erro aqui).
 */
export async function carregarCamposFase2(pedidoIds: string[]): Promise<Map<string, Partial<MatPedidoItem>>> {
  const mapa = new Map<string, Partial<MatPedidoItem>>()
  if (pedidoIds.length === 0) return mapa
  const r = await buscarPorIds<Record<string, unknown>>(pedidoIds, (lote, de, ate) =>
    supabase.from('mat_pedido_itens').select(COLUNAS_ITEM_PEDIDO_FASE2).in('pedido_id', lote).order('id').range(de, ate)
  )
  if (r.error) {
    if (!estruturaAusente(r.error, true)) console.warn('Campos da compra indisponíveis:', r.error.message)
    return mapa
  }
  for (const x of r.data) {
    mapa.set(String(x.id), {
      atendimento: (x.atendimento as MatPedidoItem['atendimento']) ?? null,
      qtd_estoque: n(x.qtd_estoque),
      qtd_compra: n(x.qtd_compra),
      compra_item_id: (x.compra_item_id as string | null) ?? null,
      motivo_nao_atendido: (x.motivo_nao_atendido as string | null) ?? null,
      qtd_entregue_estoque: n(x.qtd_entregue_estoque),
      qtd_recebida_fornecedor: n(x.qtd_recebida_fornecedor),
      motivo_entrega: (x.motivo_entrega as string | null) ?? null,
      entregue_em: (x.entregue_em as string | null) ?? null,
      qtd_entregue: n(x.qtd_entregue),
    })
  }
  return mapa
}

/** Compras ligadas a células (para mostrar "fornecedor — Antolimp, COMP-…" no pedido). */
export async function carregarComprasDasCelulas(
  celulaIds: string[]
): Promise<Map<string, { compraId: string; numero: string; fornecedorId: string; status: MatCompra['status'] }>> {
  const mapa = new Map<string, { compraId: string; numero: string; fornecedorId: string; status: MatCompra['status'] }>()
  if (celulaIds.length === 0) return mapa
  const rc = await buscarPorIds<{ id: string; compra_id: string }>(celulaIds, (lote, de, ate) =>
    supabase.from('mat_compra_itens').select('id, compra_id').in('id', lote).order('id').range(de, ate)
  )
  if (rc.error) return mapa
  const compraIds = [...new Set(rc.data.map((c) => c.compra_id))]
  const rp = await buscarPorIds<Pick<MatCompra, 'id' | 'numero' | 'fornecedor_id' | 'status'>>(compraIds, (lote, de, ate) =>
    supabase.from('mat_compras').select('id, numero, fornecedor_id, status').in('id', lote).order('id').range(de, ate)
  )
  const porId = new Map(rp.data.map((c) => [c.id, c]))
  for (const c of rc.data) {
    const comp = porId.get(c.compra_id)
    if (comp) mapa.set(c.id, { compraId: comp.id, numero: comp.numero, fornecedorId: comp.fornecedor_id, status: comp.status })
  }
  return mapa
}

function rpcOk(error: Erro, acao: string): boolean {
  if (!error) return true
  toast.error(mensagemErroMateriais(error, acao))
  return false
}

export interface ResultadoGerarCompras {
  linhas: number
  compras: { id: string; numero: string; fornecedor_id: string; antes_da_janela: boolean; celulas: number }[]
}

export function useMateriaisCompras() {
  const [previa, setPrevia] = useState<PreviaCompra | null>(null)
  const [compras, setCompras] = useState<MatCompra[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  /** Prévia do mês (só quem compra ou consulta) + compras da competência. */
  const carregar = useCallback(async (competencia: string, comPrevia: boolean) => {
    setLoading(true)
    const comp = competenciaDe(competencia)
    const [rp, rc] = await Promise.all([
      comPrevia ? supabase.rpc('mat_previa_compra', { p_competencia: comp }) : Promise.resolve({ data: null, error: null }),
      supabase.from('mat_compras').select(COLUNAS_COMPRA).eq('competencia', comp).order('numero').limit(1000),
    ])
    const erro = (rp.error ?? rc.error) as Erro
    if (erro) {
      if (estruturaAusente(erro)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(erro, 'carregar a compra'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    setPrevia(comPrevia ? normalizarPrevia(rp.data) : null)
    setCompras((rc.data as MatCompra[]) ?? [])
    setLoading(false)
  }, [])

  const gerar = useCallback(
    async (competencia: string, tipo: 'mensal' | 'avulsa', linhas: PayloadLinhaCompra[], observacao: string | null) => {
      const { data, error } = await supabase.rpc('mat_gerar_compras', {
        p_competencia: competenciaDe(competencia),
        p_tipo: tipo,
        p_linhas: linhas as unknown as Record<string, unknown>[],
        p_observacao: observacao,
      })
      if (!rpcOk(error, 'gerar os pedidos aos fornecedores')) return null
      const r = (data ?? { linhas: 0, compras: [] }) as unknown as ResultadoGerarCompras
      if (!r.linhas) {
        toast.error('Nenhuma linha foi gravada — confira e tente de novo.')
        return null
      }
      toast.success(
        r.compras.length
          ? `${r.linhas} linha(s) com destino · ${r.compras.length} pedido(s) a fornecedor em rascunho`
          : `${r.linhas} linha(s) com destino (sem pedido a fornecedor)`
      )
      return r
    },
    []
  )

  return { previa, compras, loading, estruturaPendente, carregar, gerar }
}

export function useCompraMaterial() {
  const [compra, setCompra] = useState<MatCompra | null>(null)
  const [itens, setItens] = useState<MatCompraItem[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (id: string) => {
    setLoading(true)
    const rc = await supabase.from('mat_compras').select(COLUNAS_COMPRA).eq('id', id).maybeSingle()
    if (rc.error) {
      if (estruturaAusente(rc.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(rc.error, 'carregar a compra'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    setCompra((rc.data as MatCompra | null) ?? null)
    const ri = await selecionarTudo<MatCompraItem>((de, ate) =>
      supabase.from('mat_compra_itens').select(COLUNAS_COMPRA_ITEM).eq('compra_id', id).order('id').range(de, ate)
    )
    if (ri.error) toast.error(mensagemErroMateriais(ri.error, 'carregar os itens da compra'))
    setItens((ri.data ?? []).map(numerarCelula))
    setLoading(false)
  }, [])

  const enviar = useCallback(async (id: string, entregaPrevista: string | null) => {
    const { data, error } = await supabase.rpc('mat_enviar_compra', { p_compra: id, p_entrega_prevista: entregaPrevista })
    if (!rpcOk(error, 'marcar a compra como enviada')) return false
    const r = (data ?? {}) as { numero?: string; pedidos?: number }
    toast.success(`Compra ${r.numero ?? ''} enviada — ${r.pedidos ?? 0} pedido(s) em compra`)
    return true
  }, [])

  const cancelar = useCallback(async (id: string, motivo: string) => {
    const { data, error } = await supabase.rpc('mat_cancelar_compra', { p_compra: id, p_motivo: motivo })
    if (!rpcOk(error, 'cancelar a compra')) return false
    const r = (data ?? {}) as { linhas_liberadas?: number }
    toast.success(`Compra cancelada — ${r.linhas_liberadas ?? 0} linha(s) voltaram para "sem destino"`)
    return true
  }, [])

  return { compra, itens, loading, estruturaPendente, carregar, enviar, cancelar }
}
