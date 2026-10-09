import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import type { PayloadAtendimento } from '@/lib/materiais/filas'
import type { DepartamentoFuzzy } from '@/lib/departamentos'
import type { CeuTamanhos } from '@/types/database'
import type { CeuPedidoItem, MatContrato, MatPedido, MatPedidoEnvio } from '@/types/materiais'
import { buscarPorIds, COLUNAS_CEU_PEDIDO, COLUNAS_ENVIO } from './useMateriaisPedidos'

// Aba CEU → Pedidos (docs/PLANO_MATERIAIS_FASE1.md §4.3 e §5.1): linhas de
// uniforme/EPI/crachá dos pedidos. Inspetoria identifica o nome digitado e
// confere; a Beth (dp2) atende. Tudo por RPC (122/124). Nada lança entrega
// no CEU automaticamente (Fase 3).

export interface ColaboradorApoio {
  id: string
  nome_completo: string
  departamento_id: string | null
  departamento: string | null
  empresa_id: string | null
  status?: string | null
}

export interface ItemCeuApoio {
  id: string
  nome: string
  tipo: string
  estoque: number | null
  prazo_uso_dias: number | null
}

export type FiltroLinhasCeu = 'abertas' | 'concluidas'

/** Dados de apoio comuns (aba CEU → Pedidos e pedido extra). */
export async function carregarApoioCeu() {
  const [rcol, rdep, ritens, rtam, rcon] = await Promise.all([
    selecionarTudo<ColaboradorApoio>((de, ate) =>
      supabase
        .from('colaboradores')
        .select('id, nome_completo, departamento_id, departamento, empresa_id, status')
        .eq('status', 'Ativo')
        .order('id')
        .range(de, ate)
    ),
    supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    supabase.from('itens').select('id, nome, tipo, estoque, prazo_uso_dias').order('nome'),
    selecionarTudo<CeuTamanhos>((de, ate) =>
      supabase
        .from('ceu_tamanhos')
        .select('colaborador_id, tamanho_camisa, tamanho_calca, tamanho_calcado, tamanho_luva')
        .order('colaborador_id')
        .range(de, ate)
    ),
    supabase.from('mat_contratos').select('id, departamento_id, nome, rota, recebe_limpeza, ativo, observacao').order('nome'),
  ])
  return {
    erro: rcol.error ?? rdep.error ?? ritens.error ?? rtam.error ?? rcon.error,
    colaboradores: rcol.data ?? [],
    departamentos: ((rdep.data as DepartamentoFuzzy[]) ?? []),
    itens: ((ritens.data as ItemCeuApoio[]) ?? []).map((i) => ({
      ...i,
      estoque: i.estoque == null ? null : Number(i.estoque),
      prazo_uso_dias: i.prazo_uso_dias == null ? null : Number(i.prazo_uso_dias),
    })),
    tamanhos: rtam.data ?? [],
    contratos: (rcon.data as MatContrato[]) ?? [],
  }
}

export function useCeuPedidos() {
  const [linhas, setLinhas] = useState<CeuPedidoItem[]>([])
  const [pedidos, setPedidos] = useState<MatPedido[]>([])
  const [envios, setEnvios] = useState<MatPedidoEnvio[]>([])
  const [contratos, setContratos] = useState<MatContrato[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorApoio[]>([])
  const [itens, setItens] = useState<ItemCeuApoio[]>([])
  const [tamanhos, setTamanhos] = useState<Map<string, CeuTamanhos>>(new Map())
  /** colaborador|item → última data de entrega (entregas do CEU). */
  const [ultimasEntregas, setUltimasEntregas] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (filtro: FiltroLinhasCeu) => {
    setLoading(true)
    let q = supabase.from('ceu_pedido_itens').select(COLUNAS_CEU_PEDIDO).order('created_at').limit(2000)
    q = filtro === 'abertas' ? q.not('status', 'in', '(atendido,cancelado)') : q.in('status', ['atendido', 'cancelado'])
    const [rl, apoio] = await Promise.all([q, carregarApoioCeu()])
    if (rl.error) {
      if (estruturaAusente(rl.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(rl.error, 'carregar os pedidos do CEU'))
      setLoading(false)
      return
    }
    setEstruturaPendente(false)
    if (apoio.erro) toast.error(mensagemErroMateriais(apoio.erro, 'carregar o cadastro de apoio'))
    const lista = ((rl.data as CeuPedidoItem[]) ?? []).map((l) => ({ ...l, qtd_pedida: Number(l.qtd_pedida) }))
    const pedidoIds = [...new Set(lista.map((l) => l.pedido_id))]
    const itemIds = [...new Set(lista.map((l) => l.item_id).filter((x): x is string => !!x))]

    // Identificados que não estão mais ativos (o nome precisa aparecer).
    const ativos = new Set(apoio.colaboradores.map((c) => c.id))
    const faltantes = [...new Set(lista.map((l) => l.colaborador_id).filter((x): x is string => !!x && !ativos.has(x)))]

    const [rp, re, ren, rcol] = await Promise.all([
      buscarPorIds<MatPedido>(pedidoIds, (lote) =>
        supabase.from('mat_pedidos').select('id, contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio, status_ceu, responsavel_nome, enviado_em').in('id', lote)
      ),
      buscarPorIds<MatPedidoEnvio>(pedidoIds, (lote) => supabase.from('mat_pedido_envios').select(COLUNAS_ENVIO).in('pedido_id', lote)),
      filtro === 'abertas'
        ? buscarPorIds<{ colaborador_id: string; item_id: string; data_entrega: string }>(itemIds, (lote) =>
            // PostgREST corta em 1.000 linhas: pagina dentro de cada lote de itens
            selecionarTudo<{ colaborador_id: string; item_id: string; data_entrega: string }>((de, ate) =>
              supabase.from('entregas').select('colaborador_id, item_id, data_entrega').in('item_id', lote).order('id').range(de, ate)
            )
          )
        : Promise.resolve({ data: [], error: null }),
      buscarPorIds<ColaboradorApoio>(faltantes, (lote) =>
        supabase.from('colaboradores').select('id, nome_completo, departamento_id, departamento, empresa_id, status').in('id', lote)
      ),
    ])
    const erro = rp.error ?? re.error ?? ren.error ?? rcol.error
    if (erro) toast.error(mensagemErroMateriais(erro, 'carregar os dados dos pedidos'))

    const ultimas = new Map<string, string>()
    for (const e of ren.data) {
      const k = `${e.colaborador_id}|${e.item_id}`
      const atual = ultimas.get(k)
      if (!atual || e.data_entrega > atual) ultimas.set(k, e.data_entrega)
    }

    setLinhas(lista)
    setPedidos(rp.data)
    setEnvios(re.data)
    setContratos(apoio.contratos)
    setDepartamentos(apoio.departamentos)
    setColaboradores([...apoio.colaboradores, ...rcol.data])
    setItens(apoio.itens)
    setTamanhos(new Map(apoio.tamanhos.map((t) => [t.colaborador_id, t])))
    setUltimasEntregas(ultimas)
    setLoading(false)
  }, [])

  /** Grava o colaborador de cada linha (e os snapshots de tamanho/equipe). */
  const identificar = useCallback(
    async (
      payload: { id: string; colaborador_id: string; tamanho_cadastro: string | null; alerta_tamanho: boolean; fora_da_equipe: boolean }[]
    ) => {
      if (payload.length === 0) {
        toast.error('Escolha o colaborador de ao menos uma linha')
        return false
      }
      const { data, error } = await supabase.rpc('identificar_linhas_pedido_ceu', {
        p_linhas: payload as unknown as Record<string, unknown>[],
      })
      if (error) {
        toast.error(mensagemErroMateriais(error, 'identificar os colaboradores'))
        return false
      }
      if (Number(data ?? 0) < payload.length) {
        toast.error('Nem todas as linhas foram identificadas — recarregue a página')
        return false
      }
      toast.success(payload.length === 1 ? 'Colaborador identificado' : `${payload.length} linhas identificadas`)
      return true
    },
    []
  )

  /** Conferência do inspetor: quantidade (motivo se mudar) ou cancelamento (motivo). */
  const conferir = useCallback(
    async (pedidoId: string, payload: { id: string; qtd_conferida: number | null; motivo_ajuste: string | null; cancelar: boolean }[]) => {
      if (payload.length === 0) {
        toast.error('Nenhuma linha para conferir')
        return false
      }
      const { error } = await supabase.rpc('conferir_itens_pedido_ceu', {
        p_pedido: pedidoId,
        p_linhas: payload as unknown as Record<string, unknown>[],
      })
      if (error) {
        toast.error(mensagemErroMateriais(error, 'conferir as linhas'))
        return false
      }
      toast.success('Linhas conferidas — seguem para o atendimento do CEU')
      return true
    },
    []
  )

  /**
   * Atendimento com quantidade (RPC da migration 124). Enquanto a 124 não for
   * aplicada, só é possível atender pela quantidade conferida (RPC da 122).
   */
  const atender = useCallback(async (payload: PayloadAtendimento[], conferidas: Map<string, number>) => {
    if (payload.length === 0) {
      toast.error('Selecione ao menos uma linha')
      return false
    }
    const r = await supabase.rpc('atender_linhas_pedido_ceu', { p_linhas: payload as unknown as Record<string, unknown>[] })
    let n = Number(r.data ?? 0)
    if (r.error) {
      if (!estruturaAusente(r.error)) {
        toast.error(mensagemErroMateriais(r.error, 'atender as linhas'))
        return false
      }
      if (payload.some((p) => p.qtd_atendida !== conferidas.get(p.id))) {
        toast.error('Registrar entrega menor que a conferida depende de uma atualização do banco (migration 124). Atenda pela quantidade conferida ou aguarde.')
        return false
      }
      const r2 = await supabase.rpc('atender_itens_pedido_ceu', { p_linhas: payload.map((p) => p.id) })
      if (r2.error) {
        toast.error(mensagemErroMateriais(r2.error, 'atender as linhas'))
        return false
      }
      n = Number(r2.data ?? 0)
    }
    if (n < payload.length) {
      toast.error('Nem todas as linhas foram atendidas — recarregue a página')
      return false
    }
    toast.success(n === 1 ? 'Linha atendida' : `${n} linhas atendidas`)
    return true
  }, [])

  return {
    linhas,
    pedidos,
    envios,
    contratos,
    departamentos,
    colaboradores,
    itens,
    tamanhos,
    ultimasEntregas,
    loading,
    estruturaPendente,
    carregar,
    identificar,
    conferir,
    atender,
  }
}
