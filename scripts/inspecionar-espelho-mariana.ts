// Baixa o espelho salvo no bucket ponto-espelhos e mostra os dias parseados
// da Mariana (ou do nome passado como argumento). Uso:
//   npx tsx scripts/inspecionar-espelho-mariana.ts [NOME]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import {
  parsePaginasEspelho,
} from '../src/lib/ocorrencias/importacaoPonto'

function carregarEnv(caminho) {
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const alvo = (process.argv[2] || 'MARIANA').toUpperCase()
const alvoDigitos = alvo.replace(/\D/g, '')

const { data: arquivos, error: erroLista } = await supabase
  .from('ponto_espelho_arquivos')
  .select('nome_arquivo, storage_path')
  .order('created_at', { ascending: false })
  .limit(1)
if (erroLista) throw erroLista
if (!arquivos?.length) throw new Error('Nenhum espelho salvo na tabela ponto_espelho_arquivos')

const arquivo = arquivos[0]
console.log(`Baixando: ${arquivo.nome_arquivo} (${arquivo.storage_path})`)
const { data: blob, error: erroDownload } = await supabase.storage
  .from('ponto-espelhos')
  .download(arquivo.storage_path)
if (erroDownload) throw erroDownload

const buffer = new Uint8Array(await blob.arrayBuffer())
fs.writeFileSync('dados-locais/espelho_inspecionado.pdf', buffer)
console.log(`PDF salvo em dados-locais/espelho_inspecionado.pdf (${buffer.length} bytes)`)

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: buffer, useSystemFonts: true }).promise

const paginas = []
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p)
  const content = await page.getTextContent()
  paginas.push({
    numero: p,
    itens: content.items
      .filter((i) => 'str' in i)
      .map((i) => ({ x: i.transform[4], y: i.transform[5], texto: i.str })),
  })
}

const espelhos = parsePaginasEspelho(paginas)
console.log(`Espelhos parseados: ${espelhos.length}`)

const encontrados = espelhos.filter((e) =>
  e.nome?.toUpperCase().includes(alvo) ||
  (alvoDigitos.length >= 5 && (e.cpfPdf || '').replace(/\D/g, '').includes(alvoDigitos))
)
if (encontrados.length === 0) {
  console.log(`Nenhum espelho com nome contendo "${alvo}".`)
  process.exit(0)
}

for (const e of encontrados) {
  console.log(`\n=== ${e.nome} (CPF ${e.cpfPdf || '—'}) ===`)
  for (const dia of e.dias) {
    console.log(`${dia.dataOriginal}  classificacao=${dia.classificacao}  categoria=${dia.categoria || '—'}  ${dia.horarios?.join(' ') || ''} ${dia.observacao || ''}`)
  }
}
