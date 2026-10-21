import { quantidadeComUnidade } from './unidades'

// Múltiplo de compra (migration 152, decisão da gestora de 19/10/2026).
// O item do catálogo diz como o fornecedor vende ("kit", "caixa", "bombona 5L")
// e quantas unidades DO PEDIDO vêm nessa unidade (fator; padrão 1 = como antes).
// Na compra, o total ao fornecedor de cada item é arredondado PARA CIMA ao
// múltiplo do fator e a sobra vai para o estoque (célula de reposição na mesma
// compra). Quem grava é o banco (mat_arredondar_compra); aqui só a mesma conta
// para a prévia da tela e o texto do Excel. Lógica pura.

/** Fator válido (inteiro ≥ 1); qualquer coisa estranha vale 1 (nada muda). */
export function fatorValido(fator: unknown): number {
  const n = Number(fator)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export interface Arredondamento {
  /** Quantidade que vai ao fornecedor (múltiplo do fator). */
  total: number
  /** Quantas unidades de compra (kits, caixas, bombonas). */
  embalagens: number
  /** O que passa do pedido e vai para o estoque. */
  sobra: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 3 flanelas, kit c/ 100 → total 100, 1 kit, sobra 97. Fator 1 = sem sobra. */
export function arredondarMultiplo(quantidade: number, fator: number): Arredondamento {
  const q = Math.max(0, Number(quantidade) || 0)
  const f = fatorValido(fator)
  if (q === 0) return { total: 0, embalagens: 0, sobra: 0 }
  if (f === 1) return { total: q, embalagens: q, sobra: 0 }
  const embalagens = Math.ceil(r2(q / f) - 1e-9)
  const total = embalagens * f
  return { total, embalagens, sobra: r2(total - q) }
}

/**
 * Texto da embalagem para o fornecedor: "1 kit c/ 100", "2 caixas c/ 4",
 * "3 bombonas 5L c/ 5". Se a quantidade não for múltiplo (compra antiga, fator
 * mudado depois), mostra o resto: "1 caixa c/ 4 + 1". Fator 1 → null (nada a dizer).
 */
export function textoEmbalagem(quantidade: number, fator: number | null | undefined, unidadeCompra: string | null | undefined): string | null {
  const f = fatorValido(fator)
  const q = Number(quantidade) || 0
  if (f === 1 || q <= 0) return null
  const unidade = (unidadeCompra ?? '').trim() || 'embalagem'
  const inteiras = Math.floor(r2(q / f) + 1e-9)
  const resto = r2(q - inteiras * f)
  const base = inteiras > 0 ? `${quantidadeComUnidade(inteiras, unidade)} c/ ${f}` : ''
  if (!resto) return base
  return base ? `${base} + ${String(resto).replace('.', ',')}` : `${String(resto).replace('.', ',')} (menos de 1 ${unidade} c/ ${f})`
}

/** Rótulo curto da regra do item, para selos: "compra em kit c/ 100". */
export function rotuloMultiplo(fator: number | null | undefined, unidadeCompra: string | null | undefined): string | null {
  const f = fatorValido(fator)
  if (f === 1) return null
  return `compra em ${(unidadeCompra ?? '').trim() || 'embalagem'} c/ ${f}`
}

/** Validação do formulário do catálogo (espelha as constraints da migration 152). */
export function erroMultiploItem(dados: {
  fator: string
  unidadeCompra: string
  fracionado: boolean
  preparoEscritorio?: boolean
}): string | null {
  const txt = dados.fator.trim()
  const n = Number(txt.replace(',', '.'))
  if (!txt || !Number.isInteger(n) || n < 1 || n > 10000) return 'O fator é um número inteiro de 1 a 10.000.'
  if (n > 1 && !dados.unidadeCompra.trim()) return 'Diga como o fornecedor vende (ex.: kit, caixa, bombona 5L).'
  if (dados.fracionado && dados.preparoEscritorio) return 'Item preparado no escritório não vai ao fornecedor: não pode ser fracionado.'
  return null
}
