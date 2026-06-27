async function getPdfjsLib() {
  const isVitest = typeof process !== 'undefined' && process.env?.VITEST === 'true'
  if (typeof document === 'undefined' || isVitest) {
    // Node.js / Vitest: usa o legacy build que não depende do DOM nem de worker
    const pdfjsLibNode = await import('pdfjs-dist/legacy/build/pdf.mjs')
    return pdfjsLibNode
  }
  // Browser: importa o build normal e configura o worker
  const pdfjsLibBrowser = await import('pdfjs-dist')
  pdfjsLibBrowser.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjsLibBrowser
}

export async function extrairTextoPDF(file: File | ArrayBuffer): Promise<string> {
  const paginas = await extrairPaginasPDF(file)
  return paginas.join('\n')
}

export async function extrairPaginasPDF(file: File | ArrayBuffer): Promise<string[]> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
  const pdfjsLib = await getPdfjsLib()
  // CORREÇÃO: em ambiente Node.js (testes/scripts), usa fontes do sistema
  // para evitar UnknownErrorException sobre standardFontDataUrl.
  const isNode = typeof document === 'undefined'
  const standardFontDataUrl = isNode
    ? new URL(/* @vite-ignore */ '../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href
    : undefined
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: isNode,
    standardFontDataUrl,
  }).promise

  const paginas: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const texto = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('\n')
    paginas.push(texto)
  }

  return paginas
}
