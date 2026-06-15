async function getPdfjsLib() {
  if (typeof document === 'undefined') {
    // Node.js: usa o legacy build que não depende do DOM
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
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

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
