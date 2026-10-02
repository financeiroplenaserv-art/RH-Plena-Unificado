import { supabase } from '@/lib/supabase'

const BUCKET = 'colaborador-fotos'
const VALIDADE_SEG = 3600
// Renova antes de expirar de fato (margem de 10 min).
const VALIDADE_CACHE_MS = (VALIDADE_SEG - 600) * 1000

type ClienteStorage = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number,
      ) => Promise<{
        data: { path: string | null; signedUrl: string; error: string | null }[] | null
        error: { message: string } | null
      }>
    }
  }
}

const cache = new Map<string, { url: string; expira: number }>()

/** Limpa o cache em memória (troca/remoção de foto e testes). */
export function limparCacheFotos(path?: string) {
  if (path) cache.delete(path)
  else cache.clear()
}

/**
 * Gera URLs assinadas em LOTE (uma chamada) para os caminhos ainda sem cache válido.
 * Devolve um mapa path -> url só com os que deram certo; falha vira mapa parcial
 * (a tela volta às iniciais) — nunca lança.
 */
export async function urlsAssinadasFotos(
  paths: (string | null | undefined)[],
  cliente: ClienteStorage = supabase as unknown as ClienteStorage,
  agora: number = Date.now(),
): Promise<Map<string, string>> {
  const resultado = new Map<string, string>()
  const faltantes: string[] = []
  for (const p of new Set(paths.filter((x): x is string => !!x))) {
    const hit = cache.get(p)
    if (hit && hit.expira > agora) resultado.set(p, hit.url)
    else faltantes.push(p)
  }
  if (faltantes.length === 0) return resultado
  try {
    const { data, error } = await cliente.storage.from(BUCKET).createSignedUrls(faltantes, VALIDADE_SEG)
    if (error || !data) return resultado
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) {
        cache.set(item.path, { url: item.signedUrl, expira: agora + VALIDADE_CACHE_MS })
        resultado.set(item.path, item.signedUrl)
      }
    }
  } catch (err) {
    console.error('Erro ao gerar URLs das fotos:', err)
  }
  return resultado
}
