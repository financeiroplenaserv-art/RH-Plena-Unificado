import { mesmoTexto, normalizarTexto } from './normalizar'

// Avisos de repetição entre envios do mesmo pedido. SÓ AVISO: nunca trava;
// o inspetor soma, descarta ou ignora. Espelha mat_registrar_envio (122).
//  - produtos: mesmo item e mesma variação já pedidos em outro envio;
//  - uniforme/EPI: nome digitado normalizado + mesma peça + mesmo tamanho
//    (peças iguais para pessoas diferentes NUNCA geram aviso);
//  - crachá: mesma pessoa (nome digitado normalizado) no mês.

export interface LinhaProdutoRepeticao {
  id?: string
  item_id: string | null
  variacao_id: string | null
}

export interface LinhaCeuRepeticao {
  id?: string
  tipo: 'uniforme' | 'epi' | 'cracha'
  nome_digitado: string
  item_id: string | null
  tamanho: string | null
}

export interface ResultadoRepeticao {
  possivelRepeticao: boolean
  /** id da linha existente que se repete (quando conhecido). */
  repeteId: string | null
}

const NAO = (): ResultadoRepeticao => ({ possivelRepeticao: false, repeteId: null })

/** `existentes` = linhas de OUTROS envios do mesmo pedido (a ordem define a mais antiga). */
export function repeticaoProdutos(
  novas: LinhaProdutoRepeticao[],
  existentes: LinhaProdutoRepeticao[]
): ResultadoRepeticao[] {
  return novas.map((n) => {
    if (!n.item_id) return NAO() // "outros materiais" (texto livre) não se compara
    const achada = existentes.find((e) => e.item_id === n.item_id && (e.variacao_id ?? null) === (n.variacao_id ?? null))
    return achada ? { possivelRepeticao: true, repeteId: achada.id ?? null } : NAO()
  })
}

export function repeticaoCeu(novas: LinhaCeuRepeticao[], existentes: LinhaCeuRepeticao[]): ResultadoRepeticao[] {
  return novas.map((n) => {
    const achada = existentes.find((e) => {
      if (e.tipo !== n.tipo) return false
      if (!mesmoTexto(e.nome_digitado, n.nome_digitado)) return false
      if (n.tipo === 'cracha') return true
      return e.item_id === n.item_id && normalizarTexto(e.tamanho) === normalizarTexto(n.tamanho)
    })
    return achada ? { possivelRepeticao: true, repeteId: achada.id ?? null } : NAO()
  })
}

/**
 * Efeito da decisão do inspetor sobre a quantidade validada de uma linha
 * repetida: 'descartar' zera (motivo padrão "repetição"); 'somar' ou ignorar
 * mantêm a quantidade pedida.
 */
export function aplicarDecisaoRepeticao(
  qtdPedida: number,
  decisao: 'somar' | 'descartar' | null
): { qtdValidada: number; motivoPadrao: string | null } {
  return decisao === 'descartar'
    ? { qtdValidada: 0, motivoPadrao: 'repetição' }
    : { qtdValidada: qtdPedida, motivoPadrao: null }
}
