import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { inferirSubgrupo } from './lib/subgrupos-itens.mjs'

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
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY) são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)


async function atualizar() {
  console.log('Buscando itens...')
  const { data: itens, error } = await supabase.from('itens').select('id, tipo, nome, subgrupo')

  if (error) {
    console.error('Erro ao buscar itens:', error.message)
    process.exit(1)
  }

  const atualizacoes = []
  const estatisticas = {}

  for (const item of itens || []) {
    const subgrupo = inferirSubgrupo(item.tipo, item.nome)
    if (subgrupo === item.subgrupo) continue

    atualizacoes.push({ id: item.id, nome: item.nome, tipo: item.tipo, subgrupo })

    const chave = `${item.tipo || 'Sem tipo'} → ${subgrupo || 'Sem subgrupo'}`
    estatisticas[chave] = (estatisticas[chave] || 0) + 1
  }

  console.log(`\nTotal de itens: ${itens.length}`)
  console.log(`Itens a atualizar: ${atualizacoes.length}`)

  if (atualizacoes.length === 0) {
    console.log('Nenhuma alteração necessária.')
    return
  }

  console.log('\nAmostra de alterações:')
  atualizacoes.slice(0, 10).forEach((a) => {
    console.log(`  [${a.tipo}] ${a.nome} => ${a.subgrupo}`)
  })
  if (atualizacoes.length > 10) console.log(`  ... e mais ${atualizacoes.length - 10}`)

  console.log('\nAplicando atualizações...')
  let sucessos = 0
  let erros = 0

  // Atualiza em lotes de 50 para evitar payloads grandes
  for (let i = 0; i < atualizacoes.length; i += 50) {
    const lote = atualizacoes.slice(i, i + 50)
    const resultados = await Promise.all(
      lote.map((a) => supabase.from('itens').update({ subgrupo: a.subgrupo }).eq('id', a.id))
    )

    for (const [idx, res] of resultados.entries()) {
      if (res.error) {
        erros++
        console.error(`Erro ao atualizar [${lote[idx].id}] ${lote[idx].nome}:`, res.error.message)
      } else {
        sucessos++
      }
    }
  }

  console.log('\n=== Resumo ===')
  console.log(`Atualizados com sucesso: ${sucessos}`)
  console.log(`Erros: ${erros}`)
  console.log('\nDistribuição aplicada:')
  Object.entries(estatisticas)
    .sort()
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

atualizar().catch((err) => {
  console.error(err)
  process.exit(1)
})
