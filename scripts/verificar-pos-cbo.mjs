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

const { data: lou } = await sb.from('colaboradores').select('id').eq('matricula', '000938').single()
const { data: dias } = await sb
  .from('locais_trabalho_diario')
  .select('data, fonte, local_trabalho:locais_trabalho(nome_curto)')
  .eq('colaborador_id', lou.id)
  .order('data', { ascending: false })
  .limit(12)
console.log('=== Últimos dias da Lourene ===')
for (const d of dias) console.log(`  ${d.data} | ${d.fonte} | ${d.local_trabalho?.nome_curto || '(sem local)'}`)

// Contagem geral por local CBO desde 20/06
for (const [id, nome] of [['b5f87b18-b540-47b2-992c-0bae4ee56bb0', 'CBO NITERÓI'], ['57787180-3d9f-4c8f-ba08-c705e59dee43', 'CBO MACAÉ']]) {
  const { count } = await sb.from('locais_trabalho_diario').select('id', { count: 'exact', head: true }).eq('local_trabalho_id', id)
  console.log(`${nome}: ${count} dias no diário (total)`)
}
