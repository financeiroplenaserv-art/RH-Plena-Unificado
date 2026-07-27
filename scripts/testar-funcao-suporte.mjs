// Teste end-to-end da Edge Function suporte:
// cria um usuário temporário, pega um JWT real, chama a função e mostra a resposta.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const emailTeste = `teste-suporte-${Date.now()}@example.com`
const senha = 'Teste123!@#'

// 1. Cria usuário temporário
const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
  email: emailTeste,
  password: senha,
  email_confirm: true,
})
if (erroCriar) {
  console.error('ERRO ao criar usuário:', erroCriar.message)
  process.exit(1)
}
const userId = criado.user.id
console.log('1. Usuário temporário criado:', userId)

try {
  // 2. Login para obter JWT
  const cliente = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sessao, error: erroLogin } = await cliente.auth.signInWithPassword({ email: emailTeste, password: senha })
  if (erroLogin) {
    console.error('ERRO no login:', erroLogin.message)
    process.exit(1)
  }
  console.log('2. JWT obtido')

  // 3. Chama a função suporte
  const resp = await fetch(`${url}/functions/v1/suporte`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessao.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mensagem: 'Teste automatizado da função suporte (script). Pode ignorar.', pagina: '/teste' }),
  })
  const corpo = await resp.text()
  console.log('3. Resposta da função:', resp.status, corpo)
} finally {
  // 4. Remove o usuário temporário
  const { error: erroDel } = await admin.auth.admin.deleteUser(userId)
  console.log('4. Usuário removido:', erroDel ? `ERRO: ${erroDel.message}` : 'ok')
}
