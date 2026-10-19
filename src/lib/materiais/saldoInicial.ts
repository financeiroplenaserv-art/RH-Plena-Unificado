import { normalizarTexto } from './normalizar'

// Carga do SALDO INICIAL do estoque central de materiais (lista do estoque atual
// do escritório que a gestora vai mandar antes do dia 20/10/2026).
// Usada por scripts/materiais/carregar-saldo-inicial.ts.
//
// Regra do projeto — "importação nunca grava palpite": só casamento EXATO é
// automático: nome do item igual ao do catálogo (ou ao nome para o líder, ou a um
// nome antigo de mat_aliases com fator 1), ignorando só maiúsculas, acentos,
// pontuação e espaços; variação igual ao rótulo cadastrado; quantidade numérica
// limpa. Qualquer outra coisa vira PENDÊNCIA (o script não grava e lista o motivo).

export interface ItemCatalogoSaldo {
  id: string
  nome: string
  nome_lider: string | null
  ativo: boolean
  preparo_escritorio: boolean
}
export interface VariacaoCatalogoSaldo {
  id: string
  item_id: string
  rotulo: string
  ativo: boolean
}
export interface AliasSaldo {
  nome_legado: string
  item_id: string
  variacao_id: string | null
  fator: number
}

export interface LinhaEntradaSaldo {
  /** Número da linha na planilha (para a lista de pendências). */
  linha: number
  item: string
  variacao: string
  quantidade: string
}

export interface LinhaCasada {
  linha: number
  itemId: string
  variacaoId: string | null
  itemNome: string
  variacaoRotulo: string | null
  quantidade: number
  /** Como casou: nome do cadastro, nome para o líder ou nome antigo (alias). */
  via: 'nome' | 'nome_lider' | 'alias'
}

export interface PendenciaSaldo {
  linha: number
  item: string
  variacao: string
  quantidade: string
  motivo: string
}

/** Quantidade numérica limpa (aceita vírgula decimal); "", "2 cx", "-1" não passam. */
export function lerQuantidadeLimpa(v: string): number | null {
  const t = (v ?? '').trim().replace(/\s/g, '')
  if (!/^\d+([.,]\d+)?$/.test(t)) return null
  return Number(t.replace(',', '.'))
}

/** Cabeçalho tolerante: item / variação (ou opção, cor, tamanho) / quantidade (ou qtd, saldo). */
export function indicesCabecalho(cab: string[]): { item: number; variacao: number; quantidade: number } | null {
  const n = cab.map((c) => normalizarTexto(c))
  const item = n.findIndex((c) => c === 'item' || c === 'produto' || c === 'material' || c === 'descricao')
  const variacao = n.findIndex((c) => ['variacao', 'opcao', 'cor', 'tamanho', 'marca'].includes(c))
  const quantidade = n.findIndex((c) => ['quantidade', 'qtd', 'qtde', 'saldo', 'estoque'].includes(c))
  if (item < 0 || quantidade < 0) return null
  return { item, variacao, quantidade }
}

export function casarSaldoInicial(
  entrada: LinhaEntradaSaldo[],
  itens: ItemCatalogoSaldo[],
  variacoes: VariacaoCatalogoSaldo[],
  aliases: AliasSaldo[]
): { casadas: LinhaCasada[]; pendencias: PendenciaSaldo[] } {
  const ativos = itens.filter((i) => i.ativo)
  const porNome = new Map<string, { item: ItemCatalogoSaldo; via: LinhaCasada['via']; variacaoId: string | null }[]>()
  const add = (chave: string, item: ItemCatalogoSaldo, via: LinhaCasada['via'], variacaoId: string | null = null) => {
    const k = normalizarTexto(chave)
    if (!k) return
    const lista = porNome.get(k) ?? []
    if (!lista.some((x) => x.item.id === item.id && x.variacaoId === variacaoId)) lista.push({ item, via, variacaoId })
    porNome.set(k, lista)
  }
  for (const i of ativos) {
    add(i.nome, i, 'nome')
    if (i.nome_lider) add(i.nome_lider, i, 'nome_lider')
  }
  const itemPorId = new Map(ativos.map((i) => [i.id, i]))
  for (const a of aliases) {
    const it = itemPorId.get(a.item_id)
    if (it && Number(a.fator) === 1) add(a.nome_legado, it, 'alias', a.variacao_id)
  }
  const varsDe = (itemId: string) => variacoes.filter((v) => v.item_id === itemId && v.ativo)

  const casadas: LinhaCasada[] = []
  const pendencias: PendenciaSaldo[] = []
  const vistos = new Map<string, number>()
  for (const e of entrada) {
    const pend = (motivo: string) => pendencias.push({ ...e, motivo })
    if (!e.item.trim() && !e.quantidade.trim()) continue // linha em branco
    const q = lerQuantidadeLimpa(e.quantidade)
    if (q == null) {
      pend('Quantidade não é um número limpo')
      continue
    }
    const candidatos = porNome.get(normalizarTexto(e.item)) ?? []
    const itensDistintos = [...new Set(candidatos.map((c) => c.item.id))]
    if (itensDistintos.length === 0) {
      pend('Item não encontrado no catálogo com esse nome exato')
      continue
    }
    if (itensDistintos.length > 1) {
      pend('Nome igual ao de mais de um item do catálogo')
      continue
    }
    const c = candidatos[0]
    if (c.item.preparo_escritorio) {
      pend('Item preparado no escritório: não tem controle de estoque')
      continue
    }
    const vars = varsDe(c.item.id)
    let variacao: VariacaoCatalogoSaldo | null = null
    const vTexto = e.variacao.trim()
    if (vars.length === 0) {
      if (vTexto) {
        pend('O item não tem variação no catálogo, mas a planilha informa uma')
        continue
      }
    } else if (vTexto) {
      const iguais = vars.filter((v) => normalizarTexto(v.rotulo) === normalizarTexto(vTexto))
      if (iguais.length !== 1) {
        pend(`Variação não encontrada com esse nome exato (opções: ${vars.map((v) => v.rotulo).join(', ')})`)
        continue
      }
      variacao = iguais[0]
    } else if (c.variacaoId && vars.some((v) => v.id === c.variacaoId)) {
      variacao = vars.find((v) => v.id === c.variacaoId) ?? null // nome antigo que já aponta a variação
    } else {
      pend(`Falta a variação (opções: ${vars.map((v) => v.rotulo).join(', ')})`)
      continue
    }
    const chave = `${c.item.id}|${variacao?.id ?? ''}`
    if (vistos.has(chave)) {
      pend(`Item/variação repetido (já na linha ${vistos.get(chave)}) — some na planilha e deixe uma linha só`)
      continue
    }
    vistos.set(chave, e.linha)
    casadas.push({
      linha: e.linha,
      itemId: c.item.id,
      variacaoId: variacao?.id ?? null,
      itemNome: c.item.nome,
      variacaoRotulo: variacao?.rotulo ?? null,
      quantidade: q,
      via: c.via,
    })
  }
  return { casadas, pendencias }
}

export const MOTIVO_SALDO_INICIAL = 'saldo inicial (contagem de outubro)'
