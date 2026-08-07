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

// Mapeamentos que mencionam cartório (com e sem acento)
const { data: m1 } = await sb.from('mapeamento_flit_local_trabalho').select('*, local_trabalho:locais_trabalho(nome, nome_curto)').ilike('valor_flit', '%cartório%')
const { data: m2 } = await sb.from('mapeamento_flit_local_trabalho').select('*, local_trabalho:locais_trabalho(nome, nome_curto)').ilike('valor_flit', '%oficio%')
console.log('=== Mapeamentos "CARTÓRIO" ===')
console.log(JSON.stringify(m1, null, 2))
console.log('=== Mapeamentos "OFICIO" ===')
console.log(JSON.stringify(m2, null, 2))

// Local Cartório atual
const { data: loc } = await sb.from('locais_trabalho').select('*').ilike('nome_curto', '%cartório%')
console.log('=== Local Cartório ===')
console.log(JSON.stringify(loc, null, 2))
