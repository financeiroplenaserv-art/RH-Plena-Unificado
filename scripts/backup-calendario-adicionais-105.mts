// Backup da tabela calendario_adicionais antes da migration 105
// (coluna substituto_sem_adicional — decisão da gestão, 27/08/2026).
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

const todos: unknown[] = []
const PAGINA = 1000
for (let desde = 0; ; desde += PAGINA) {
  const { data, error } = await supabase
    .from('calendario_adicionais')
    .select('*')
    .range(desde, desde + PAGINA - 1)
  if (error) throw error
  todos.push(...(data || []))
  if (!data || data.length < PAGINA) break
}

const arquivo = 'dados-locais/backup_calendario_adicionais_105_2026-08-27.json'
fs.writeFileSync(arquivo, JSON.stringify(todos, null, 2))
console.log(`Backup gravado em ${arquivo} — ${todos.length} linha(s)`)
