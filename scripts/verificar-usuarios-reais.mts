// Verifica quais dos usuários reais já existem (perfis + auth) e lista perfis atuais
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

const ALVOS = [
  'eliane.dc.azevedo@gmail.com',
  'erica@plenaerv.com',
  'maciel@plenaserv.com',
  'tayrone@plenafacilities.com.br',
  'augusto@plenafacilities.com.br',
  'rh@plenafacilities.com.br',
  'dp@plenafacilities.com.br',
  'elizabeth@plenafacilities.com.br',
  'comercial@plenafacilities.com.br',
  'elisangela@plenaserv.com',
]

const { data: perfis, error } = await supabase
  .from('perfis')
  .select('id, email, nome, nivel_acesso, created_at')
  .order('created_at')
if (error) throw error

console.log('=== Todos os perfis atuais ===')
for (const p of perfis ?? []) {
  const alvo = ALVOS.includes((p.email ?? '').toLowerCase()) ? ' ← ALVO' : ''
  console.log(`${p.email ?? '—'}  [${p.nivel_acesso}]  ${p.nome ?? ''}${alvo}`)
}

console.log('\n=== E-mails alvo SEM perfil ===')
for (const email of ALVOS) {
  const existe = (perfis ?? []).some((p) => (p.email ?? '').toLowerCase() === email)
  if (!existe) console.log(email)
}
