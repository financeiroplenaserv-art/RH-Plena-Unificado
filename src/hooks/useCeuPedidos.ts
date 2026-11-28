import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import type { PayloadAtendimento } from '@/lib/materiais/filas'
import {
  conferirResultadoAtender,
  lerResultadoAtender,
  mensagemAtendimento,
  type AtualizacaoCa,
} from '@/lib/ceu/atenderPedido'
import type { DepartamentoFuzzy } from '@/lib/departamentos'
import { chavePeca, separarTamanhoDoNome } from '@/lib/materiais/pecasCeu'
import type { EntregaBruta } from '@/lib/materiais/entregasPeca'
import type { CeuTamanhos } from '@/types/database'
import type { CeuPedidoItem, MatContrato, MatPedido, MatPedidoEnvio } from '@/types/materiais'
import { buscarPorIds, COLUNAS_CEU_PEDIDO, COLUNAS_ENVIO } from './useMateriaisPedidos'

// Aba CEU → Pedidos (docs/PLANO_MATERIAIS_FASE1.md §4.3 e §5.1): linhas de
// uniforme/EPI/crachá dos pedidos. Inspetoria identifica o nome digitado e
// confere; a Beth (dp2) atende. Tudo por RPC (122/124/177). Desde a 177 o
// atendimento lança a entrega no CEU na mesma transação (sem recibo).

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
  /** Migration 141: compra na loja com autorização (sem tamanho, sem alerta de tamanho). */
  compra_na_loja?: boolean
  /** Migration 142: troca frequente (luva látex) — sem o selo "antes do prazo". */
  sem_alerta_prazo?: boolean
  /** CA do cadastro (o snapshot da entrega copia este valor — migration 177). */
  ca?: string | null
  /** 'A' ativo, 'I' inativo. */
  situacao?: string | null
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
    selecionarTudo<ItemCeuApoio>((de, ate) =>
      supabase.from('itens').select('id, nome, tipo, estoque, prazo_uso_dias, compra_na_loja, sem_alerta_prazo, ca, situacao').order('nome').order('id').range(de, ate)
    ),
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
      compra_na_loja: i.compra_na_loja === true,
      sem_alerta_prazo: i.sem_alerta_prazo === true,
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
  /**
   * colaborador|peça → entregas da PEÇA (qualquer tamanho), cruas. A tela agrupa
   * por data e escolhe última/penúltima (src/lib/materiais/entregasPeca.ts).
   * Pediu a bota 39, recebeu a 38: vale a 38.
   */
  const [ultimasEntregas, setUltimasEntregas] = useState<Map<string, EntregaBruta[]>>(new Map())
  /** item → chave da peça (agrupamento por nome base — src/lib/materiais/pecasCeu.ts). */
  const [pecaDoItem, setPecaDoItem] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (filtro: FiltroLinhasCeu) => {
    setLoading(true)
    // Abertas: pagina tudo (a fila é pequena, mas não pode truncar nunca).
    // Concluídas: as 1.000 MAIS RECENTES (desc) — são histórico de conferência;
    // com asc + corte do PostgREST em 1.000, as recentes sumiam da tela da Beth.
    const q =
      filtro === 'abertas'
        ? selecionarTudo<CeuPedidoItem>((de, ate) =>
            supabase
              .from('ceu_pedido_itens')
              .select(COLUNAS_CEU_PEDIDO)
              .not('status', 'in', '(atendido,cancelado)')
              .order('created_at')
              .order('id')
              .range(de, ate)
          )
        : supabase
            .from('ceu_pedido_itens')
            .select(COLUNAS_CEU_PEDIDO)
            .in('status', ['atendido', 'cancelado'])
            .order('created_at', { ascending: false })
            .limit(1000)
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
    // Peça de cada item do CEU: a última entrega considera todos os tamanhos.
    const pecaPorItem = new Map<string, string>()
    for (const i of apoio.itens) {
      if (i.tipo !== 'Uniforme' && i.tipo !== 'EPI') continue
      pecaPorItem.set(i.id, chavePeca(separarTamanhoDoNome(i.nome).base, i.tipo === 'EPI' ? 'epi' : 'uniforme'))
    }
    const pecasPedidas = new Set(lista.map((l) => (l.item_id ? pecaPorItem.get(l.item_id) : undefined)).filter(Boolean))
    const itemIds = [
      ...new Set([
        ...lista.map((l) => l.item_id).filter((x): x is string => !!x),
        ...[...pecaPorItem.entries()].filter(([, p]) => pecasPedidas.has(p)).map(([id]) => id),
      ]),
    ]

    // Identificados que não estão mais ativos (o nome precisa aparecer).
    const ativos = new Set(apoio.colaboradores.map((c) => c.id))
    const faltantes = [...new Set(lista.map((l) => l.colaborador_id).filter((x): x is string => !!x && !ativos.has(x)))]

    const [rp, re, ren, rcol] = await Promise.all([
      buscarPorIds<MatPedido>(pedidoIds, (lote, de, ate) =>
        supabase
          .from('mat_pedidos')
          .select('id, contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio, status_ceu, responsavel_nome, enviado_em')
          .in('id', lote)
          .order('id')
          .range(de, ate)
      ),
      buscarPorIds<MatPedidoEnvio>(pedidoIds, (lote, de, ate) =>
        supabase.from('mat_pedido_envios').select(COLUNAS_ENVIO).in('pedido_id', lote).order('id').range(de, ate)
      ),
      filtro === 'abertas'
        ? buscarPorIds<{ colaborador_id: string; item_id: string; data_entrega: string; quantidade: number | null }>(itemIds, (lote, de, ate) =>
            // Um item pode ter mais de 1.000 entregas (ex.: luvas): buscarPorIds pagina dentro do lote
            supabase.from('entregas').select('colaborador_id, item_id, data_entrega, quantidade').in('item_id', lote).order('id').range(de, ate)
          )
        : Promise.resolve({ data: [], error: null }),
      buscarPorIds<ColaboradorApoio>(faltantes, (lote, de, ate) =>
        supabase
          .from('colaboradores')
          .select('id, nome_completo, departamento_id, departamento, empresa_id, status')
          .in('id', lote)
          .order('id')
          .range(de, ate)
      ),
    ])
    const erro = rp.error ?? re.error ?? ren.error ?? rcol.error
    if (erro) toast.error(mensagemErroMateriais(erro, 'carregar os dados dos pedidos'))

    const ultimas = new Map<string, EntregaBruta[]>()
    for (const e of ren.data) {
      const k = `${e.colaborador_id}|${pecaPorItem.get(e.item_id) ?? e.item_id}`
      const lista = ultimas.get(k)
      const bruta = { item_id: e.item_id, data_entrega: e.data_entrega, quantidade: e.quantidade == null ? null : Number(e.quantidade) }
      if (lista) lista.push(bruta)
      else ultimas.set(k, [bruta])
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
    setPecaDoItem(pecaPorItem)
    setLoading(false)
  }, [])

  /** Grava o colaborador de cada linha (e os snapshots de tamanho/equipe). */
  const identificar = useCallback(
    async (
      payload: {
        id: string
        colaborador_id: string
        tamanho_cadastro: string | null
        alerta_tamanho: boolean
        fora_da_equipe: boolean
        /** Última entrega da PEÇA (migration 129; a RPC antiga ignora). */
        ultima_entrega_em?: string | null
        ultima_entrega_item_id?: string | null
      }[]
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

  /**
   * Grava o CA digitado na janela no cadastro do item (vale dali em diante) —
   * ANTES de lançar, para o snapshot da entrega sair com o CA novo.
   * Escrita com .select('id') e conferência (RLS bloqueada = 0 linhas, sem erro).
   */
  const atualizarCaItens = useCallback(async (lista: AtualizacaoCa[]) => {
    for (const a of lista) {
      const { data, error } = await supabase.from('itens').update({ ca: a.ca }).eq('id', a.item_id).select('id')
      if (error || !data || data.length !== 1) {
        toast.error(error ? mensagemErroMateriais(error, 'gravar o CA do item') : 'O CA do item não foi gravado (sem permissão?) — nada foi lançado')
        return false
      }
    }
    return true
  }, [])

  /**
   * Atende E lança as entregas no CEU numa transação só (RPC da migration 177).
   * Sem recibo. Retorna o resultado conferido ou null.
   */
  const atenderELancar = useCallback(async (payload: PayloadAtendimento[], data: string) => {
    if (payload.length === 0) {
      toast.error('Selecione ao menos uma linha')
      return null
    }
    const r = await supabase.rpc('atender_e_lancar_linhas_pedido_ceu', {
      p_linhas: payload as unknown as Record<string, unknown>[],
      p_data: data,
    })
    if (r.error) {
      toast.error(
        estruturaAusente(r.error)
          ? 'Lançar a entrega pelo atendimento depende de uma atualização do banco (migration 177). Nada foi atendido.'
          : mensagemErroMateriais(r.error, 'atender e lançar as entregas')
      )
      return null
    }
    const res = lerResultadoAtender(r.data)
    if (!conferirResultadoAtender(res, payload.map((p) => p.id))) {
      toast.error('Nem todas as linhas voltaram como atendidas — recarregue a página e confira')
      return null
    }
    toast.success(mensagemAtendimento(res!))
    return res
  }, [])

  /** Move a linha para o pedido do mesmo mês do contrato certo (RPC da 177). */
  const trocarContrato = useCallback(async (linhaId: string, contratoId: string, motivo: string, foraDaEquipe: boolean | null) => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo da troca de contrato')
      return false
    }
    const { data, error } = await supabase.rpc('trocar_contrato_linha_pedido_ceu', {
      p_linha: linhaId,
      p_contrato: contratoId,
      p_motivo: motivo.trim(),
      p_fora_da_equipe: foraDaEquipe,
    })
    if (error) {
      toast.error(
        estruturaAusente(error)
          ? 'Trocar o contrato depende de uma atualização do banco (migration 177).'
          : mensagemErroMateriais(error, 'trocar o contrato da linha')
      )
      return false
    }
    const pedidoId = (data as { pedido_id?: string } | null)?.pedido_id
    if (!pedidoId) {
      toast.error('A troca não foi confirmada pelo banco — recarregue a página')
      return false
    }
    toast.success((data as { pedido_criado?: boolean }).pedido_criado ? 'Linha movida (pedido do mês criado no contrato novo)' : 'Linha movida para o contrato certo')
    return true
  }, [])

  return {
    atualizarCaItens,
    atenderELancar,
    trocarContrato,
    linhas,
    pedidos,
    envios,
    contratos,
    departamentos,
    colaboradores,
    itens,
    tamanhos,
    ultimasEntregas,
    pecaDoItem,
    loading,
    estruturaPendente,
    carregar,
    identificar,
    conferir,
    atender,
  }
}
