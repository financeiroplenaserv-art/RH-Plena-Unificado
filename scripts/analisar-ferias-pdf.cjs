// Dump bruto dos itens de texto (com posição X) das páginas 1 e 2 do PDF de férias.
const fs = require('fs')

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync('dados-locais/Férias.pdf'))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  for (const p of [1, 2]) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    console.log(`\n===== PÁGINA ${p} — ${content.items.length} itens =====`)
    const linhas = new Map()
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      if (!linhas.has(y)) linhas.set(y, [])
      linhas.get(y).push({ x: Math.round(item.transform[4]), t: item.str })
    }
    const ordenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0]).slice(0, 15)
    for (const [y, itens] of ordenadas) {
      console.log(`y=${y}:`, itens.sort((a, b) => a.x - b.x).map((i) => `[${i.x}]${i.t}`).join(' '))
    }
  }
}

main()
