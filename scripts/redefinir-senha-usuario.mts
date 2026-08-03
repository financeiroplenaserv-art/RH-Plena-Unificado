// Redefine a senha de um usuário existente para uma temporária nova.
// Uso: npx tsx scripts/redefinir-senha-usuario.mts <email>
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
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

const email = process.argv[2]
if (!email) {
  console.error('Uso: npx tsx scripts/redefinir-senha-usuario.mts <email>')
  process.exit(1)
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const { data: perfil, error: e1 } = await supabase
  .from('perfis')
  .select('id, email, nome, nivel_acesso')
  .eq('email', email)
  .single()
if (e1 || !perfil) {
  console.error(`Perfil não encontrado para ${email}: ${e1?.message}`)
  process.exit(1)
}

const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
let sufixo = ''
for (let i = 0; i < 6; i++) sufixo += alfabeto[randomInt(alfabeto.length)]
const senha = `Plena#${sufixo}`

const { error: e2 } = await supabase.auth.admin.updateUserById((perfil as any).id, { password: senha })
if (e2) {
  console.error(`Erro ao redefinir senha: ${e2.message}`)
  process.exit(1)
}
console.log(`✓ Senha redefinida: ${email} [${(perfil as any).nivel_acesso}] ${(perfil as any).nome}  nova senha: ${senha}`)
