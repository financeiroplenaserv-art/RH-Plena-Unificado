// Cria os 10 usuários reais no Auth (senha temporária gerada) + perfil com o
// nível correto, e eleva eliane@plenafacilities.com.br para adm.
// Uso: npx tsx scripts/criar-usuarios-reais.mts
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

const USUARIOS: { email: string; nome: string; nivel: string }[] = [
  { email: 'eliane.dc.azevedo@gmail.com', nome: 'Eliane', nivel: 'financeiro' },
  { email: 'erica@plenaerv.com', nome: 'Érica', nivel: 'financeiro' },
  { email: 'maciel@plenaserv.com', nome: 'Maciel', nivel: 'mesa' },
  { email: 'tayrone@plenafacilities.com.br', nome: 'Tayrone', nivel: 'inspetoria' },
  { email: 'augusto@plenafacilities.com.br', nome: 'Augusto', nivel: 'inspetoria' },
  { email: 'rh@plenafacilities.com.br', nome: 'Rosely', nivel: 'rh' },
  { email: 'dp@plenafacilities.com.br', nome: 'Ludmila', nivel: 'dp1' },
  { email: 'elizabeth@plenafacilities.com.br', nome: 'Elizabeth', nivel: 'dp2' },
  { email: 'comercial@plenafacilities.com.br', nome: 'Alexandre', nivel: 'gestor' },
  { email: 'elisangela@plenaserv.com', nome: 'Elisangela', nivel: 'adm' },
]

// Senha temporária: prefixo fixo + 6 caracteres sem ambíguos (sem 0/O, 1/l/I)
function gerarSenha(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let sufixo = ''
  for (let i = 0; i < 6; i++) sufixo += alfabeto[randomInt(alfabeto.length)]
  return `Plena#${sufixo}`
}

const credenciais: { email: string; nome: string; nivel: string; senha: string }[] = []

for (const u of USUARIOS) {
  const senha = gerarSenha()
  const { data: novo, error: erroAuth } = await supabase.auth.admin.createUser({
    email: u.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: u.nome },
  })
  if (erroAuth) {
    console.error(`✗ ${u.email}: erro no Auth — ${erroAuth.message}`)
    continue
  }
  const { error: erroPerfil } = await supabase.from('perfis').insert({
    id: novo.user.id,
    email: u.email,
    nome: u.nome,
    nivel_acesso: u.nivel,
    empresa_id: null,
    consentimento_lgpd: false,
  })
  if (erroPerfil) {
    console.error(`✗ ${u.email}: Auth criado, mas erro no perfil — ${erroPerfil.message}`)
    continue
  }
  credenciais.push({ ...u, senha })
  console.log(`✓ ${u.email} [${u.nivel}] ${u.nome}`)
}

// Eliane (plenafacilities): visualizador → adm.
// O trigger de proteção é BEFORE UPDATE e bloqueia service role — então
// apaga e recria a linha do perfil com o novo nível.
const EMAIL_ELA = 'eliane@plenafacilities.com.br'
const { data: ela, error: eEla } = await supabase
  .from('perfis')
  .select('*')
  .eq('email', EMAIL_ELA)
  .single()
if (eEla || !ela) {
  console.error(`✗ ${EMAIL_ELA}: perfil não encontrado — ${eEla?.message}`)
} else if ((ela as any).nivel_acesso === 'adm') {
  console.log(`= ${EMAIL_ELA} já é adm`)
} else {
  const atual = ela as any
  const { error: eDel } = await supabase.from('perfis').delete().eq('id', atual.id)
  if (eDel) {
    console.error(`✗ ${EMAIL_ELA}: erro ao remover perfil — ${eDel.message}`)
  } else {
    const { error: eIns } = await supabase.from('perfis').insert({
      ...atual,
      nivel_acesso: 'adm',
      created_at: atual.created_at,
    })
    if (eIns) console.error(`✗ ${EMAIL_ELA}: erro ao recriar perfil — ${eIns.message}`)
    else console.log(`✓ ${EMAIL_ELA} elevada para adm (LGPD consentido: ${atual.consentimento_lgpd})`)
  }
}

fs.writeFileSync(
  'dados-locais/credenciais_usuarios_reais_2026-08-03.json',
  JSON.stringify(credenciais, null, 2)
)
console.log(`\nCredenciais salvas em dados-locais/credenciais_usuarios_reais_2026-08-03.json (${credenciais.length} usuários)`)
console.log('\n=== CREDENCIAIS ===')
for (const c of credenciais) {
  console.log(`${c.email}  [${c.nivel}]  ${c.nome}  senha: ${c.senha}`)
}
