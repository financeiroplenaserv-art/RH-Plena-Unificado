import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)

const itensCracha = [
  {
    codigo: '1001',
    nome: 'CRACHÁ COMPLETO',
    tipo: 'Crachá',
    unidade: 'UN',
    situacao: 'A',
    estoque: 0,
    estoque_minimo: 0,
  },
  {
    codigo: '1002',
    nome: 'CRACHÁ COM CORDINHA',
    tipo: 'Crachá',
    unidade: 'UN',
    situacao: 'A',
    estoque: 0,
    estoque_minimo: 0,
  },
  {
    codigo: '1003',
    nome: 'CRACHÁ SEM CORDINHA',
    tipo: 'Crachá',
    unidade: 'UN',
    situacao: 'A',
    estoque: 0,
    estoque_minimo: 0,
  },
]

async function criar() {
  let criados = 0
  let existentes = 0

  for (const item of itensCracha) {
    const { data: existente } = await supabase.from('itens').select('id').eq('codigo', item.codigo).single()
    if (existente) {
      console.log(`Item ${item.codigo} já existe: ${item.nome}`)
      existentes++
      continue
    }

    const { error } = await supabase.from('itens').insert({
      ...item,
      ca: null,
      validade: null,
      subgrupo: null,
      fornecedor_id: null,
      valor: null,
      prazo_uso_dias: null,
      ultima_compra: null,
    })

    if (error) {
      console.error(`Erro ao criar ${item.codigo}:`, error.message)
    } else {
      console.log(`Criado ${item.codigo}: ${item.nome}`)
      criados++
    }
  }

  console.log('\n=== Resumo ===')
  console.log(`Criados: ${criados}`)
  console.log(`Já existentes: ${existentes}`)
}

criar().catch((err) => {
  console.error(err)
  process.exit(1)
})
