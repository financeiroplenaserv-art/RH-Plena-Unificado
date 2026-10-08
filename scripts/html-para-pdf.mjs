/* Converte HTML em PDF (A4) e PNG de prévia via Chrome headless.
 *
 * Uso: node scripts/html-para-pdf.mjs <arquivo.html> [outro.html ...]
 * Gera <nome>.pdf e <nome>.previa.png ao lado de cada HTML e imprime o
 * número de páginas de cada PDF.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync } from 'node:fs'

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

for (const html of process.argv.slice(2)) {
  const abs = resolve(html)
  const pdf = abs.replace(/\.html$/, '.pdf')
  const png = abs.replace(/\.html$/, '.previa.png')
  const url = 'file:///' + abs.replace(/\\/g, '/')
  const perfil = abs.replace(/\.html$/, '').replace(/[^a-zA-Z0-9]/g, '_')
  // O Chrome headless no Windows pode sair com código != 0 mesmo gerando os arquivos.
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', `--user-data-dir=${abs}\\..\\prof_${perfil}`,
      '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, url,
    ], { stdio: 'ignore' })
  } catch { /* validação é a existência do arquivo */ }
  if (!existsSync(pdf)) throw new Error(`PDF não gerado: ${pdf}`)
  const doc = await getDocument(pdf).promise
  console.log(`${pdf} — ${doc.numPages} página(s)`)
  // prévia com a altura exata das páginas (1123 px por página A4 a 96 dpi)
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', `--user-data-dir=${abs}\\..\\prof_${perfil}_s`,
      `--screenshot=${png}`, `--window-size=794,${1123 * doc.numPages}`, '--force-device-scale-factor=1.5', url,
    ], { stdio: 'ignore' })
  } catch { /* idem */ }
}
