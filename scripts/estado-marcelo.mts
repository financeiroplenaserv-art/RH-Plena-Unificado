// Verifica vínculos do Marcelo (substituto da Mariana) no contrato Insalub. Quatre
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

const { data: colabs, error: e1 } = await supabase
  .from('colaboradores')
  .select('id, nome_completo, cpf, matricula, status')
  .ilike('nome_completo', '%marcelo%ramos%')
if (e1) throw e1
console.log('=== Marcelo ===')
console.log(colabs)
const marcelo = colabs?.[0]
if (!marcelo) process.exit(0)

const { data: vinculos, error: e2 } = await supabase
  .from('vinculos_adicionais')
  .select('*, contratos_adicionais(nome, adicionais)')
  .eq('colaborador_id', marcelo.id)
if (e2) throw e2
console.log('\n=== Vínculos do Marcelo ===')
console.log(JSON.stringify(vinculos, null, 2))

const { data: cal, error: e3 } = await supabase
  .from('calendario_adicionais')
  .select('*')
  .in('vinculo_id', (vinculos ?? []).map((v: any) => v.id))
  .gte('data', '2026-06-20')
  .lte('data', '2026-07-19')
  .order('data')
if (e3) throw e3
console.log(`\n=== Calendário próprio do Marcelo 20/06–19/07 (${cal?.length ?? 0} linhas) ===`)
for (const d of cal ?? []) {
  console.log(`${(d as any).data}  ${(d as any).status}  vinculo=${(d as any).vinculo_id}`)
}
