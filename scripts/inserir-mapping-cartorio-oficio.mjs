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
const { data, error } = await sb
  .from('mapeamento_flit_local_trabalho')
  .insert({ local_trabalho_id: '84f25518-a285-4214-a904-d52fe0002afc', tipo_match: 'turno_departamento', valor_flit: 'OFICIO DE NOTAS', prioridade: 100, ativo: true })
  .select('id, tipo_match, valor_flit')
if (error) { console.error('ERRO:', error); process.exit(1) }
console.log('Inserido:', data)
