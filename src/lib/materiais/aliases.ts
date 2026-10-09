import type { MatAlias } from '@/types/materiais'
import { normalizarTexto } from './normalizar'

// Nomes antigos das planilhas → item do catálogo (mat_aliases). O nome legado
// é guardado já normalizado; `fator` converte a unidade (ex.: "Cloro 1L" →
// bombona 5L = 0,2).

export function resolverAlias<T extends Pick<MatAlias, 'nome_legado'>>(nomeLegado: string, aliases: T[]): T | null {
  const chave = normalizarTexto(nomeLegado)
  return chave ? (aliases.find((a) => a.nome_legado === chave) ?? null) : null
}

export function converterQuantidade(quantidade: number, fator: number): number {
  return Math.round(quantidade * fator * 1000) / 1000
}
