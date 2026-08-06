/* Converte os HTMLs de teste em PDF sequencialmente e conta páginas de cada um. */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const dir = 'dados-locais/tmp_recibos_teste'
const dirAbs = 'C:\\Users\\usuario\\Documents\\projetos\\RH-Plena-Unificado\\dados-locais\\tmp_recibos_teste'
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const htmls = readdirSync(dir).filter((f) => f.endsWith('.html')).sort()
for (const f of htmls) {
  const n = f.replace(/\.html$/, '')
  // O Chrome headless no Windows pode sair com código != 0 mesmo gerando o PDF.
  try {
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${dirAbs}\\profile_${n}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${dirAbs}\\${n}.pdf`,
      `file:///C:/Users/usuario/Documents/projetos/RH-Plena-Unificado/${dir}/${f}`,
    ], { stdio: 'ignore' })
  } catch {
    /* ignora: validação é a existência do PDF */
  }
  if (!existsSync(`${dir}/${n}.pdf`)) throw new Error(`PDF não gerado: ${n}`)
}

async function paginas(pdfPath: string): Promise<number> {
  const data = new Uint8Array(readFileSync(pdfPath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  return doc.numPages
}

for (const f of htmls) {
  const n = f.replace(/\.html$/, '')
  const p = await paginas(`${dir}/${n}.pdf`)
  console.log(`${n}: ${p} página(s)`)
}
