// Extrai o texto (com posição X/Y) de todas as páginas das NFe em docs/notas fiscais/
// para dados-locais/nfe_textos/<arquivo>.txt — base para mapear itens e preços.
const fs = require('fs')
const path = require('path')

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const dir = 'docs/notas fiscais'
  const saida = 'dados-locais/nfe_textos'
  fs.mkdirSync(saida, { recursive: true })
  for (const arq of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
    const data = new Uint8Array(fs.readFileSync(path.join(dir, arq)))
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
    const partes = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const linhas = new Map()
      for (const item of content.items) {
        const y = Math.round(item.transform[5])
        if (!linhas.has(y)) linhas.set(y, [])
        linhas.get(y).push({ x: Math.round(item.transform[4]), t: item.str })
      }
      partes.push(`===== PÁGINA ${p} =====`)
      for (const [y, itens] of [...linhas.entries()].sort((a, b) => b[0] - a[0])) {
        partes.push(itens.sort((a, b) => a.x - b.x).map((i) => i.t).join(' | '))
      }
    }
    const destino = path.join(saida, arq.replace(/\.pdf$/i, '') + '.txt')
    fs.writeFileSync(destino, partes.join('\n'), 'utf8')
    console.log('ok:', destino, `(${doc.numPages} páginas)`)
  }
}

main()
