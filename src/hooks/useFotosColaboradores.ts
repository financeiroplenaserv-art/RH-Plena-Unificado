import { useEffect, useState } from 'react'
import { urlsAssinadasFotos } from '@/lib/colaboradorFotos'

/**
 * URLs assinadas das fotos dos caminhos informados (uma chamada em lote por conjunto).
 * Caminho sem URL no mapa = sem foto/falha: a tela mostra as iniciais.
 */
export function useFotosColaboradores(paths: (string | null | undefined)[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const chave = Array.from(new Set(paths.filter(Boolean) as string[])).sort().join('|')

  useEffect(() => {
    if (!chave) {
      setUrls(new Map())
      return
    }
    let ativo = true
    urlsAssinadasFotos(chave.split('|')).then((m) => {
      if (ativo) setUrls(m)
    })
    return () => {
      ativo = false
    }
  }, [chave])

  return urls
}
