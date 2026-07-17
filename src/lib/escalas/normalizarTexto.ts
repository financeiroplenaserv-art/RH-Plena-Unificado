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

/**
 * Normaliza uma matrícula para comparação, removendo zeros à esquerda,
 * espaços e pontuação. Garante que '000772', '772' e ' 772 ' sejam equivalentes.
 */
export function normalizarMatricula(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .toString()
    .replace(/\D/g, '')
    .replace(/^0+/, '')
    .trim()
}
