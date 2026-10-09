import type { MatKitItem } from '@/types/materiais'
import { adicionarMeses, competenciaDe } from './datas'
import { chaveItem, type ConsumoMes } from './media'

// Kit Mensal: itens a incluir num pedido preenchido pelo kit. Item com
// periodicidade_meses = N (ex.: "2 latas a cada 2 meses") só entra se NÃO
// houve consumo nos N-1 meses anteriores. Espelha preencher_pedido_pelo_kit.

export function itensDoKitParaPedido<
  T extends Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade' | 'periodicidade_meses'>,
>(kit: T[], competencia: string, consumos: ConsumoMes[]): T[] {
  const comp = competenciaDe(competencia)
  return kit.filter((k) => {
    if (!(k.quantidade > 0)) return false
    if (k.periodicidade_meses <= 1) return true
    const inicio = adicionarMeses(comp, -(k.periodicidade_meses - 1))
    const chave = chaveItem(k.item_id, k.variacao_id)
    return !consumos.some((c) => {
      const cc = competenciaDe(c.competencia)
      return c.quantidade > 0 && chaveItem(c.item_id, c.variacao_id) === chave && cc >= inicio && cc < comp
    })
  })
}
