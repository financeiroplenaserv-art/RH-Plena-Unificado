// Exclui as contas de TESTE (perfil + Auth) APÓS a transferência de autoria
// (transferir-autoria-usuarios-teste.mts + UPDATEs SQL de 03/08/2026).
// Uso: npx tsx scripts/excluir-usuarios-teste.mts
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

const { data: testes, error: e1 } = await supabase
  .from('perfis').select('id, nome, nivel_acesso').ilike('nome', '%teste%')
if (e1) throw e1
if (!testes?.length) {
  console.log('Nenhum perfil de teste encontrado.')
  process.exit(0)
}
console.log(`Excluindo ${testes.length} contas de teste:`)

for (const t of testes) {
  // 1) Perfil (service role ignora RLS; trigger de proteção é só UPDATE)
  const { data: del, error: eDel } = await supabase
    .from('perfis').delete().eq('id', t.id).select('id')
  if (eDel) {
    console.error(`  ✗ ${t.nome}: erro ao apagar perfil — ${eDel.message}`)
    continue
  }
  if (!del?.length) {
    console.error(`  ✗ ${t.nome}: perfil não apagado (0 linhas)`)
    continue
  }
  // 2) Conta no Auth (consentimentos_lgpd caem em cascata)
  const { error: eAuth } = await supabase.auth.admin.deleteUser(t.id)
  if (eAuth) {
    console.error(`  ✗ ${t.nome}: perfil apagado, mas erro no Auth — ${eAuth.message}`)
    continue
  }
  console.log(`  ✓ ${t.nome} [${t.nivel_acesso}]`)
}

// Verificação final
const { count } = await supabase
  .from('perfis').select('id', { count: 'exact', head: true }).ilike('nome', '%teste%')
console.log(`\nPerfis de teste restantes: ${count}`)
const { count: cConsent } = await supabase
  .from('consentimentos_lgpd').select('id', { count: 'exact', head: true })
console.log(`Consentimentos LGPD restantes no banco: ${cConsent}`)
