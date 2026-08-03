// Roda a mesma query do app (useCEUItens.listar sem filtros) e confere o 1004
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

function carregarEnv(caminho: string) {
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
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const COLUNAS_ITEM_CEU = 'id, codigo, nome, tipo, ca, validade, subgrupo, valor, fornecedor_id, estoque, estoque_minimo, prazo_uso_dias, unidade, ultima_compra, situacao, created_at'

const { data, error } = await supabase
  .from('itens')
  .select(COLUNAS_ITEM_CEU)
  .order('nome')
if (error) throw error

console.log(`Itens retornados pela query do app: ${data?.length}`)
const item1004 = (data ?? []).find((i: any) => i.codigo === '1004')
console.log('Item 1004 presente:', item1004 ? `SIM (posição ${(data ?? []).indexOf(item1004) + 1}, nome "${item1004.nome}")` : 'NÃO')

// Simula com filtro de busca que poderia estar persistido
for (const busca of ['cordinha', 'corda', '1004']) {
  const { data: f } = await supabase
    .from('itens')
    .select(COLUNAS_ITEM_CEU)
    .or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,ca.ilike.%${busca}%`)
    .order('nome')
  console.log(`Busca "${busca}": ${f?.length} itens`)
}
