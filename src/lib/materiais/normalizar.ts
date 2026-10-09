// Normalização de texto do módulo Materiais.
// Espelha mat_normalizar_texto() do banco (migration 122): minúsculas, sem
// acentos, só [a-z0-9] e espaços simples. Usada em aliases (nomes antigos das
// planilhas) e nos avisos de repetição (nome digitado pelo líder).

export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Compara dois textos pela forma normalizada (vazio nunca é igual a vazio). */
export function mesmoTexto(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarTexto(a)
  return na !== '' && na === normalizarTexto(b)
}
