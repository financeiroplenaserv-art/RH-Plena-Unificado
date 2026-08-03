// Inspeciona o item 1004 do CEU e os últimos itens criados
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

const { data: por1004, error: e1 } = await supabase
  .from('itens')
  .select('*')
  .or('codigo.ilike.%1004%,nome.ilike.%1004%,ca.ilike.%1004%')
if (e1) throw e1
console.log('=== Itens com "1004" ===')
console.log(JSON.stringify(por1004, null, 2))

const { data: ultimos, error: e2 } = await supabase
  .from('itens')
  .select('id, codigo, nome, tipo, situacao, created_at')
  .order('created_at', { ascending: false })
  .limit(8)
if (e2) throw e2
console.log('\n=== Últimos itens criados ===')
for (const i of ultimos ?? []) console.log(JSON.stringify(i))

const { count, error: e3 } = await supabase
  .from('itens')
  .select('id', { count: 'exact', head: true })
if (e3) throw e3
console.log(`\nTotal de itens na tabela: ${count}`)
