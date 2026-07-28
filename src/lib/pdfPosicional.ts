// Helper compartilhado de extração posicional de PDF via pdfjs.
// Usado pelas telas de importação de espelho de ponto (Adicionais/Ocorrências).
// Mesmo padrão de carregamento do pdfjs usado em src/lib/vr/pdfExtractor.ts.
import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'

export async function getPdfjsLib() {
  const isVitest = typeof process !== 'undefined' && process.env?.VITEST === 'true'
  if (typeof document === 'undefined' || isVitest) {
    return await import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  const pdfjsLibBrowser = await import('pdfjs-dist')
  pdfjsLibBrowser.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjsLibBrowser
}

/** Extrai de cada página os itens de texto posicionados (x, y) exigidos pelo parser. */
export async function extrairPaginasPosicionais(file: File): Promise<PaginaPDF[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjsLib = await getPdfjsLib()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const paginas: PaginaPDF[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    paginas.push({
      numero: p,
      itens: content.items
        .filter((item) => 'str' in item)
        .map((item) => ({
          x: (item as { transform: number[] }).transform[4],
          y: (item as { transform: number[] }).transform[5],
          texto: (item as { str: string }).str,
        })),
    })
  }
  return paginas
}
