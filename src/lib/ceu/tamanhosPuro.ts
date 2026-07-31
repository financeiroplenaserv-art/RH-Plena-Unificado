import type { CeuTamanhos } from '@/types/database'

/**
 * Funções puras de medidas do CEU (sem acesso ao banco — testáveis).
 * As operações de banco ficam em `tamanhos.ts`.
 */

/** Resumo "Camisa M · Calça 42 · Calçado 40 · Luva G" (linha 📏 do Lançamento Rápido). */
export function resumoTamanhos(t?: CeuTamanhos | null): string {
  if (!t) return ''
  return [
    t.tamanho_camisa ? `Camisa ${t.tamanho_camisa}` : null,
    t.tamanho_calca ? `Calça ${t.tamanho_calca}` : null,
    t.tamanho_calcado ? `Calçado ${t.tamanho_calcado}` : null,
    t.tamanho_luva ? `Luva ${t.tamanho_luva}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Tamanho de referência para um item, pelo nome (ex.: "Luva Látex" → luva,
 * "Botina" → calçado). Apenas orientação visual — não é gravado na entrega
 * nem no recibo (o código do item já contém o tamanho).
 */
export function tamanhoParaItem(nomeItem: string, t?: CeuTamanhos | null): string | null {
  if (!t) return null
  const nome = nomeItem.toLowerCase()
  if (nome.includes('luva')) return t.tamanho_luva
  if (nome.includes('camisa') || nome.includes('jaleco')) return t.tamanho_camisa
  if (nome.includes('calça') || nome.includes('calca')) return t.tamanho_calca
  if (/bota|botina|sapato|calçado|calcado|tênis|tenis|sandália|sandalia/.test(nome)) return t.tamanho_calcado
  return null
}

/**
 * Tamanho embutido no nome do item (ex.: "BOTINA COM ELÁSTICO 40 - Tam. 40"
 * ou "LUVA LATEX M"). Usado para comparar com a medida do cadastro e
 * alertar divergência no Lançamento Rápido.
 */
export function tamanhoDoNomeItem(nomeItem: string): string | null {
  const m = nomeItem.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) return m[1].toUpperCase()
  const tokens = nomeItem.toUpperCase().split(/[\s\-–—]+/).filter(Boolean)
  const ultimo = tokens[tokens.length - 1]
  if (!ultimo) return null
  if (/^\d{2}$/.test(ultimo)) return ultimo
  if (['P', 'M', 'G', 'GG', 'EG', 'XG', 'XGG', 'PP'].includes(ultimo)) return ultimo
  return null
}
