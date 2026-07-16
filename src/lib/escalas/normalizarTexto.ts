/**
 * Normaliza um texto para comparações case-insensitive e sem acentos.
 * Remove espaços extras e converte para minúsculas.
 */
export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
