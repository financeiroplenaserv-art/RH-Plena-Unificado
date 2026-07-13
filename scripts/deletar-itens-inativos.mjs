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

const CODIGOS_PARA_DELETAR = ['664', '665', '666', '667', '669']

async function deletar() {
  console.log('Buscando itens pelos códigos:', CODIGOS_PARA_DELETAR.join(', '))
  const { data: itens, error: erroBusca } = await supabase.from('itens').select('id, nome, codigo').in('codigo', CODIGOS_PARA_DELETAR)
  if (erroBusca) {
    console.error('Erro ao buscar itens:', erroBusca.message)
    process.exit(1)
  }

  console.log(`Itens encontrados: ${itens?.length || 0}`)
  for (const item of itens || []) {
    console.log(`- [${item.codigo}] ${item.nome}`)
  }

  if ((itens || []).length === 0) {
    console.log('Nenhum item encontrado para deletar.')
    return
  }

  const ids = itens.map(i => i.id)

  console.log('Apagando entregas vinculadas...')
  const { error: erroEntregas } = await supabase.from('entregas').delete().in('item_id', ids)
  if (erroEntregas) {
    console.error('Erro ao apagar entregas:', erroEntregas.message)
    process.exit(1)
  }

  console.log('Apagando itens...')
  const { error: erroItens } = await supabase.from('itens').delete().in('id', ids)
  if (erroItens) {
    console.error('Erro ao apagar itens:', erroItens.message)
    process.exit(1)
  }

  console.log(`✅ ${itens.length} item(ns) deletado(s) com sucesso.`)
}

deletar().catch((err) => {
  console.error(err)
  process.exit(1)
})
