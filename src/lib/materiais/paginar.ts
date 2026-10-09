// O PostgREST corta em 1.000 linhas por consulta (lição do bug do Deleon —
// AGENTS.md §11). Kits (≈65 contratos × ~20 itens) e históricos passam disso,
// então as listas do módulo são lidas em lotes.

export const TAMANHO_LOTE = 1000

export interface ResultadoLote<T> {
  data: T[] | null
  error: { code?: string; message?: string } | null
}

export async function selecionarTudo<T>(
  buscar: (de: number, ate: number) => PromiseLike<ResultadoLote<T>>,
  tamanho = TAMANHO_LOTE
): Promise<ResultadoLote<T>> {
  const todas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await buscar(de, de + tamanho - 1)
    if (error) return { data: null, error }
    const lote = data ?? []
    todas.push(...lote)
    if (lote.length < tamanho) break
  }
  return { data: todas, error: null }
}
