/* Gera uma prévia do Informativo de Apresentação (dados fictícios) para validar
 * o layout com a gestão — mesmo fluxo dos protótipos do quadro de colaboradores.
 * Saída: dados-locais/tmp_informativo_teste/informativo.html + .pdf (Chrome headless).
 *
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/gerar-informativo-apresentacao.ts
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  montarDocumentoInformativo,
  primeiroNomeSobrenome,
  textoPadraoApresentacao,
} from '../src/lib/ceu/informativoApresentacao'

const dir = 'dados-locais/tmp_informativo_teste'
mkdirSync(dir, { recursive: true })

const paraDataUrl = (caminho: string, mime: string) =>
  `data:${mime};base64,${readFileSync(caminho).toString('base64')}`

// foto de exemplo: a do próprio modelo em PDF (extraída para dados-locais/_p_extraido)
const foto = existsSync('dados-locais/_p_extraido/img_02_x7.jpeg')
  ? paraDataUrl('dados-locais/_p_extraido/img_02_x7.jpeg', 'image/jpeg')
  : null

const nomeCompleto = 'Flaviano da Silva Vicente'
const html = montarDocumentoInformativo({
  nomeExibicao: primeiroNomeSobrenome(nomeCompleto),
  funcao: 'Porteiro',
  cliente: 'Condomínio Grand Valley',
  texto: textoPadraoApresentacao({
    funcao: 'Porteiro',
    nomeCompleto,
    cliente: 'Condomínio Grand Valley',
  }),
  fotoDataUrl: foto,
  foco: null,
  logoDataUrl: paraDataUrl('public/logo_plena_cab.jpg', 'image/jpeg'),
  pFotosDataUrl: paraDataUrl('public/plena_p_fotos.jpg', 'image/jpeg'),
  logo30DataUrl: paraDataUrl('public/logo_plena_30anos_redonda.png', 'image/png'),
})

writeFileSync(`${dir}/informativo.html`, html)

const dirAbs = `${process.cwd()}\\dados-locais\\tmp_informativo_teste`
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
try {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${dirAbs}\\profile`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${dirAbs}\\informativo.pdf`,
    `file:///${dirAbs.replaceAll('\\', '/')}/informativo.html`,
  ], { stdio: 'ignore' })
} catch {
  /* o Chrome headless no Windows pode sair com código != 0 mesmo gerando o PDF */
}
if (!existsSync(`${dir}/informativo.pdf`)) throw new Error('PDF não gerado')
console.log(`OK: ${dir}/informativo.html + informativo.pdf`)
