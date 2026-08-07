// Conta referências (diário + mapeamentos) de cada local CBO para decidir consolidação.
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

const ids = [
  ['b5f87b18-b540-47b2-992c-0bae4ee56bb0', 'CBO (nome: ALIANÇA S/A...)'],
  ['ae46ff3f-a3d0-49d8-90b4-630c0317c52c', 'CBO MACAÉ (nome: CBO SERVICOS MARITIMOS S.A.)'],
  ['57787180-3d9f-4c8f-ba08-c705e59dee43', 'CBO MACAÉ (nome: CBO MACAÉ)'],
  ['2ad4864d-0240-4770-9954-7d486d888466', 'CBO NITERÓI'],
]

for (const [id, rotulo] of ids) {
  const { count: diario } = await sb
    .from('locais_trabalho_diario')
    .select('id', { count: 'exact', head: true })
    .eq('local_trabalho_id', id)
  const { data: maps } = await sb
    .from('mapeamento_flit_local_trabalho')
    .select('tipo_match, valor_flit')
    .eq('local_trabalho_id', id)
  console.log(`${rotulo}`)
  console.log(`  dias no diário: ${diario} | mapeamentos: ${(maps || []).map((m) => `${m.tipo_match}:"${m.valor_flit}"`).join(', ') || 'nenhum'}`)
}
