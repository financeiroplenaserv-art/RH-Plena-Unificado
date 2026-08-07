import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
for (const linha of fs.readFileSync('.env', 'utf-8').split('\n')) {
  const t = linha.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await sb.from('locais_trabalho').select('id, nome, nome_curto, status').ilike('nome', '%oficio%')
if (error) throw error
console.log(JSON.stringify(data, null, 2))
