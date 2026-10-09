import type { MatContrato, MatKitItem, MatPedido, MatPedidoItem } from '@/types/materiais'
import { competenciaDe } from './datas'
import { consumoDePedidosAprovados, mediasReferencia, unirConsumo, type ConsumoMes } from './media'
import { arredondar, compararComLimite, limiteContrato, precoVigente, type PrecoHistorico } from './precos'
import { qtdEfetiva, temExcecao } from './filas'

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
  limite: number
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
}

export interface EntradaPainel {
  contratos: Pick<MatContrato, 'id' | 'nome' | 'ativo'>[]
  pedidosDoMes: Pick<MatPedido, 'id' | 'contrato_id' | 'tipo' | 'status_produtos' | 'preenchido_pelo_escritorio'>[]
  itensDoMes: Pick<
    MatPedidoItem,
    'pedido_id' | 'item_id' | 'variacao_id' | 'qtd_pedida' | 'qtd_validada' | 'qtd_aprovada' | 'preco_unitario'
    | 'excecao_acima_kit' | 'excecao_validade' | 'excecao_fora_kit'
  >[]
  kits: Pick<MatKitItem, 'contrato_id' | 'item_id' | 'variacao_id' | 'quantidade'>[]
  precos: PrecoHistorico[]
  /** Histórico das planilhas, por contrato. */
  historico: (ConsumoMes & { contrato_id: string })[]
  /** Pedidos aprovados dos 12 meses anteriores e suas linhas (média CORH). */
  pedidosAnteriores: { id: string; contrato_id: string; competencia: string; status_produtos: string }[]
  itensAnteriores: { pedido_id: string; item_id: string | null; variacao_id: string | null; qtd_aprovada: number | null }[]
  hoje: string
}

const SEM_PRODUTOS = new Set(['cancelado', 'nao_se_aplica', 'rascunho'])

export function montarPainel(e: EntradaPainel): LinhaPainel[] {
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

  return e.contratos
    .filter((c) => c.ativo || pedidosPorContrato.has(c.id))
    .map((c) => {
      const pedidos = pedidosPorContrato.get(c.id) ?? []
      let valor = 0
      let semPreco = 0
      let excecoes = 0
      for (const p of pedidos) {
        for (const l of itensPorPedido.get(p.id) ?? []) {
          const preco =
            l.preco_unitario != null
              ? Number(l.preco_unitario)
              : l.item_id
                ? precoVigente(e.precos, l.item_id, l.variacao_id, e.hoje)
                : null
          if (preco == null) semPreco++
          else valor += qtdEfetiva(l) * preco
          if (temExcecao(l)) excecoes++
        }
      }
      const kit = e.kits.filter((k) => k.contrato_id === c.id)
      const limite = limiteContrato(kit, e.precos, e.hoje).total
      const anteriores = e.pedidosAnteriores.filter((p) => p.contrato_id === c.id)
      const idsAnteriores = new Set(anteriores.map((p) => p.id))
      const consumo = unirConsumo(
        e.historico.filter((h) => h.contrato_id === c.id),
        consumoDePedidosAprovados(anteriores, e.itensAnteriores.filter((i) => idsAnteriores.has(i.pedido_id)))
      )
      const { media6, media12 } = mediasReferencia(consumo, e.precos, e.hoje)
      const valorPedido = arredondar(valor)
      const cmp = compararComLimite(valorPedido, limite)
      const mensal = pedidos.find((p) => p.tipo === 'mensal') ?? null
      return {
        contratoId: c.id,
        nome: c.nome,
        pedidoIds: pedidos.map((p) => p.id),
        pedidoMensalId: mensal?.id ?? pedidos[0]?.id ?? null,
        status: pedidos.map((p) => p.status_produtos),
        valorPedido,
        limite,
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
      }
    })
    .sort((a, b) => Number(b.excedeu) - Number(a.excedeu) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Competência no formato do input type="month" (AAAA-MM) ↔ 1º dia do mês. */
export function competenciaDoMes(mes: string): string {
  return competenciaDe(`${mes}-01`)
}
