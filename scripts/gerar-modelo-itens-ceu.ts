import { createClient } from '@supabase/supabase-js'
import * as XLSX from '@e965/xlsx'
import * as fs from 'fs'
import * as path from 'path'

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const chave = trimmed.slice(0, idx).trim()
    const valor = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    process.env[chave] = valor
  }
}

carregarEnv(path.resolve(process.cwd(), '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)

async function gerarModelo() {
  const { data, error } = await supabase
    .from('itens')
    .select('id, nome, tipo, ca, validade, subgrupo, estoque, estoque_minimo, prazo_uso_dias, codigo, valor')
    .order('nome', { ascending: true })

  if (error) {
    console.error('Erro ao buscar itens:', error.message)
    process.exit(1)
  }

  const rows = (data || []).map((item) => ({
    codigo: item.codigo || '',
    nome: item.nome,
    tipo: item.tipo,
    ca: item.ca || '',
    validade: item.validade || '',
    subgrupo: item.subgrupo || '',
    estoque: item.estoque ?? 0,
    estoque_minimo: item.estoque_minimo ?? 0,
    prazo_uso_dias: item.prazo_uso_dias ?? '',
    valor: item.valor ? item.valor / 100 : '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens CEU')

  const fileName = path.resolve(process.cwd(), 'modelo-itens-ceu.xlsx')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  fs.writeFileSync(fileName, buffer as Buffer)

  console.log(`Modelo gerado com ${rows.length} itens:`)
  console.log(fileName)
}

gerarModelo().catch((err) => {
  console.error(err)
  process.exit(1)
})
