import type { MatContrato, MatKitItem, MatPedido, MatPedidoItem } from '@/types/materiais'
import { competenciaDe } from './datas'
import { consumoDePedidosAprovados, mediasReferencia, unirConsumo, type ConsumoMes } from './media'
import { arredondar, compararComLimite, limiteContrato, limiteEfetivo, precoVigente, type PrecoHistorico } from './precos'
import { ehLinhaKit, qtdEfetiva, temExcecao } from './filas'
import { aplicarSubstituicoes, aplicarSubstituicoesLinhas, type VinculoSubstituicao } from './substituicao'
import { aprovadoOuDepois } from './pedidos'
import { compararOrcamentoCeu, resumirOrcamentoCeu, type CustoCracha, type LinhaCeuOrcamento } from './orcamento'

// Painel do gestor (docs/PLANO_MATERIAIS_FASE1.md §5.1): por contrato, valor
// pedido no mês × limite (Kit × preço vigente) × média dos últimos 6 meses
// fechados (12 meses como referência). Reaproveita precos.ts e media.ts.

export interface LinhaPainel {
  contratoId: string
  nome: string
  /** Pedidos de produtos do mês (mensal + extras), sem cancelados. */
  pedidoIds: string[]
  /** Pedido mensal (para "ajustar item a item"). */
  pedidoMensalId: string | null
  /** Status de produtos dos pedidos do mês. */
  status: MatPedido['status_produtos'][]
  valorPedido: number
  /** Parte do valor que é Kit Mensal confirmado (migration 135). */
  valorKit: number
  /** Parte do valor que é pedido extra (além do kit). */
  valorExtras: number
  /** Linhas de pedido extra ainda não aprovadas (com o inspetor ou aguardando o gestor). */
  extrasPendentes: number
  /**
   * Migration 151: valor dos pedidos de IMPLANTAÇÃO de contrato do mês — mostrado à
   * parte; NÃO entra em valorPedido (comparação com o limite) nem na média.
   */
  valorImplantacao: number
  /** Pedidos de implantação do mês (também estão em pedidoIds, para aprovar). */
  pedidoImplantacaoIds: string[]
  /** Limite que vale: o manual do gestor (migration 138) ou, sem ele, o calculado pelo kit. */
  limite: number
  /** O limite que vale foi definido pelo gestor. */
  limiteManual: boolean
  /** Cálculo pelo kit (referência ao lado do manual). */
  limiteCalculado: number
  media6: number
  media12: number
  excedeu: boolean
  diferenca: number
  percentual: number | null
  preenchidoPeloEscritorio: boolean
  /** Linhas com exceção ainda no mês (informativo). */
  excecoes: number
  /** Algum pedido do mês está pronto para aprovação. */
  aprovavel: boolean
  /** Itens sem preço (ficam fora do valor/limite). */
  semPreco: number
  /**
   * Segundo orçamento (migration 153): uniforme, EPI e crachá do mês × limite_mensal_ceu.
   * Só aviso — `excedeu` nunca bloqueia nada.
   */
  ceu: OrcamentoCeuPainel
}

export interface OrcamentoCeuPainel {
  /** Há linha de uniforme/EPI/crachá no mês (pedido enviado). */
  temLinhas: boolean
  valor: number
  /** Pedidos de implantação: valor à parte, fora do limite. */
  valorImplantacao: number
  /** NULL = sem limite definido (mostra só o valor, discreto). */
  limite: number | null
  excedeu: boolean
  diferenca: number
  percentual: number | null
  semPreco: number
  crachasSemCusto: number
}

export interface EntradaPainel {
  contratos: (Pick<MatContrato, 'id' | 'nome' | 'ativo'> & Partial<Pick<MatContrato, 'limite_mensal' | 'limite_mensal_ceu'>>)[]
  pedidosDoMes: (Pick<MatPedido, 'id' | 'contrato_id' | 'tipo' | 'status_produtos' | 'preenchido_pelo_escritorio'> &
    Partial<Pick<MatPedido, 'implantacao' | 'status_ceu'>>)[]
  /** Linhas de uniforme/EPI/crachá dos pedidos do mês (ceu_pedido_itens). */
  linhasCeu?: LinhaCeuOrcamento[]
  /** item_id do CEU -> preço vigente em centavos (ceu_itens_precos_vigentes). */
  precosCeu?: Map<string, number>
  /** Custo do crachá em R$ (materiais_config, sem e com cordinha); null = não definido. */
  custoCracha?: CustoCracha
  itensDoMes: (Pick<
    MatPedidoItem,
    'pedido_id' | 'item_id' | 'variacao_id' | 'qtd_pedida' | 'qtd_validada' | 'qtd_aprovada' | 'preco_unitario'
    | 'excecao_acima_kit' | 'excecao_validade' | 'excecao_fora_kit'
  > & Partial<Pick<MatPedidoItem, 'parte'>>)[]
  kits: Pick<MatKitItem, 'contrato_id' | 'item_id' | 'variacao_id' | 'quantidade'>[]
  precos: PrecoHistorico[]
  /** Histórico das planilhas, por contrato. */
  historico: (ConsumoMes & { contrato_id: string })[]
  /** Pedidos aprovados dos 12 meses anteriores e suas linhas (média CORH). */
  pedidosAnteriores: { id: string; contrato_id: string; competencia: string; status_produtos: string; implantacao?: boolean | null }[]
  itensAnteriores: { pedido_id: string; item_id: string | null; variacao_id: string | null; qtd_aprovada: number | null }[]
  hoje: string
  /**
   * Vínculos de substituição (migration 128): o consumo de um item substituído
   * conta na média do substituto (cadeia X→Y→W). Sem vínculos, nada muda.
   */
  substituicoes?: VinculoSubstituicao[]
}

const SEM_PRODUTOS = new Set(['cancelado', 'nao_se_aplica', 'rascunho'])
/** Pedidos cujo CEU não conta no orçamento de uniforme/EPI/crachá. */
const SEM_CEU = new Set(['cancelado', 'nao_se_aplica', 'rascunho'])

export function montarPainel(e: EntradaPainel): LinhaPainel[] {
  const vinculos = e.substituicoes ?? []
  const historico = aplicarSubstituicoes(e.historico, vinculos)
  const itensAnteriores = aplicarSubstituicoesLinhas(e.itensAnteriores, vinculos)
  const pedidosPorContrato = new Map<string, EntradaPainel['pedidosDoMes']>()
  for (const p of e.pedidosDoMes) {
    if (SEM_PRODUTOS.has(p.status_produtos)) continue
    const lista = pedidosPorContrato.get(p.contrato_id) ?? []
    lista.push(p)
    pedidosPorContrato.set(p.contrato_id, lista)
  }
  const itensPorPedido = new Map<string, EntradaPainel['itensDoMes']>()
  for (const i of e.itensDoMes) {
    const lista = itensPorPedido.get(i.pedido_id) ?? []
    lista.push(i)
    itensPorPedido.set(i.pedido_id, lista)
  }

  // Orçamento de uniforme/EPI/crachá (migration 153): todos os pedidos do contrato no mês
  // (mensal e extra) cujo CEU não foi cancelado; implantação fica à parte.
  const pedidosCeuPorContrato = new Map<string, Set<string>>()
  const implantacaoIds = new Set<string>()
  const contratoDoPedido = new Map<string, string>()
  for (const p of e.pedidosDoMes) {
    contratoDoPedido.set(p.id, p.contrato_id)
    if (p.status_ceu && SEM_CEU.has(p.status_ceu)) continue
    if (p.implantacao) implantacaoIds.add(p.id)
    const s = pedidosCeuPorContrato.get(p.contrato_id) ?? new Set<string>()
    s.add(p.id)
    pedidosCeuPorContrato.set(p.contrato_id, s)
  }
  const linhasCeuPorContrato = new Map<string, LinhaCeuOrcamento[]>()
  for (const l of e.linhasCeu ?? []) {
    const cid = contratoDoPedido.get(l.pedido_id)
    if (!cid || !pedidosCeuPorContrato.get(cid)?.has(l.pedido_id)) continue
    const lista = linhasCeuPorContrato.get(cid) ?? []
    lista.push(l)
    linhasCeuPorContrato.set(cid, lista)
  }

  return e.contratos
    .filter((c) => c.ativo || pedidosPorContrato.has(c.id) || linhasCeuPorContrato.has(c.id))
    .map((c) => {
      const pedidos = pedidosPorContrato.get(c.id) ?? []
      let valor = 0
      let valorKit = 0
      let valorImplantacao = 0
      let semPreco = 0
      let excecoes = 0
      let extrasPendentes = 0
      for (const p of pedidos) {
        for (const l of itensPorPedido.get(p.id) ?? []) {
          if (!ehLinhaKit(l) && !aprovadoOuDepois(p.status_produtos) && Number(l.qtd_pedida) > 0) extrasPendentes++
          const preco =
            l.preco_unitario != null
              ? Number(l.preco_unitario)
              : l.item_id
                ? precoVigente(e.precos, l.item_id, l.variacao_id, e.hoje)
                : null
          if (preco == null) semPreco++
          else if (p.implantacao) valorImplantacao += qtdEfetiva(l) * preco
          else {
            valor += qtdEfetiva(l) * preco
            if (ehLinhaKit(l)) valorKit += qtdEfetiva(l) * preco
          }
          if (temExcecao(l)) excecoes++
        }
      }
      const kit = e.kits.filter((k) => k.contrato_id === c.id)
      const lim = limiteEfetivo(limiteContrato(kit, e.precos, e.hoje).total, c.limite_mensal)
      const limite = lim.valor
      const anteriores = e.pedidosAnteriores.filter((p) => p.contrato_id === c.id)
      const idsAnteriores = new Set(anteriores.map((p) => p.id))
      const consumo = unirConsumo(
        historico.filter((h) => h.contrato_id === c.id),
        consumoDePedidosAprovados(anteriores, itensAnteriores.filter((i) => idsAnteriores.has(i.pedido_id)))
      )
      const { media6, media12 } = mediasReferencia(consumo, e.precos, e.hoje)
      const valorPedido = arredondar(valor)
      const cmp = compararComLimite(valorPedido, limite)
      const mensal = pedidos.find((p) => p.tipo === 'mensal') ?? null
      const linhasCeu = linhasCeuPorContrato.get(c.id) ?? []
      const resumoCeu = resumirOrcamentoCeu({
        linhas: linhasCeu,
        precosCentavos: e.precosCeu ?? new Map(),
        custoCracha: e.custoCracha,
        implantacaoIds,
      })
      const cmpCeu = compararOrcamentoCeu(resumoCeu.valor, c.limite_mensal_ceu)
      return {
        contratoId: c.id,
        nome: c.nome,
        pedidoIds: pedidos.map((p) => p.id),
        pedidoMensalId: mensal?.id ?? pedidos[0]?.id ?? null,
        status: pedidos.map((p) => p.status_produtos),
        valorPedido,
        valorKit: arredondar(valorKit),
        valorExtras: arredondar(valorPedido - arredondar(valorKit)),
        extrasPendentes,
        valorImplantacao: arredondar(valorImplantacao),
        pedidoImplantacaoIds: pedidos.filter((p) => p.implantacao).map((p) => p.id),
        limite,
        limiteManual: lim.manual,
        limiteCalculado: lim.calculado,
        media6: media6.valorMedio,
        media12: media12.valorMedio,
        // Sem limite cadastrado não há como "passar do limite".
        excedeu: limite > 0 && cmp.excedeu,
        diferenca: cmp.diferenca,
        percentual: cmp.percentual,
        preenchidoPeloEscritorio: pedidos.some((p) => p.preenchido_pelo_escritorio),
        excecoes,
        aprovavel: pedidos.some((p) => p.status_produtos === 'validado'),
        semPreco,
        ceu: {
          temLinhas: linhasCeu.length > 0,
          valor: resumoCeu.valor,
          valorImplantacao: resumoCeu.valorImplantacao,
          limite: cmpCeu.limite,
          excedeu: cmpCeu.excedeu,
          diferenca: cmpCeu.diferenca,
          percentual: cmpCeu.percentual,
          semPreco: resumoCeu.semPreco,
          crachasSemCusto: resumoCeu.crachasSemCusto,
        },
      }
    })
    .sort((a, b) => Number(b.excedeu || b.ceu.excedeu) - Number(a.excedeu || a.ceu.excedeu) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Competência no formato do input type="month" (AAAA-MM) ↔ 1º dia do mês. */
export function competenciaDoMes(mes: string): string {
  return competenciaDe(`${mes}-01`)
}
