// Verifica TUDO que os usuários de teste tocaram no sistema antes de deletar.
// Uso: npx tsx scripts/verificar-usuarios-teste.mts
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

const { data: testes, error: e0 } = await supabase
  .from('perfis')
  .select('id, email, nome, nivel_acesso, created_at')
  .ilike('nome', '%teste%')
if (e0) throw e0
console.log(`=== Perfis de teste (${testes?.length}) ===`)
for (const t of testes ?? []) console.log(`${t.id}  [${t.nivel_acesso}]  ${t.nome}  email=${t.email ?? '—'}`)
const ids = (testes ?? []).map(t => t.id)
if (ids.length === 0) process.exit(0)

// Existem no Auth?
const { data: authLista } = await supabase.auth.admin.listUsers({ perPage: 1000 })
const authIds = new Set((authLista?.users ?? []).map(u => u.id))
console.log(`\n=== Existência no Auth ===`)
for (const t of testes ?? []) console.log(`${t.nome}: ${authIds.has(t.id) ? 'TEM conta no Auth' : 'NÃO tem conta no Auth (só perfil)'}`)

// Tabelas/colunas que podem referenciar o usuário
const VERIFICACOES: { tabela: string; coluna: string }[] = [
  { tabela: 'log_auditoria', coluna: 'usuario_id' },
  { tabela: 'extras', coluna: 'usuario_id' },
  { tabela: 'recibos_extras', coluna: 'usuario_id' },
  { tabela: 'projetos_vr', coluna: 'usuario_id' },
  { tabela: 'escalas_importacoes', coluna: 'usuario_id' },
  { tabela: 'ferias_notificacoes', coluna: 'usuario_id' },
  { tabela: 'consentimentos_lgpd', coluna: 'usuario_id' },
  { tabela: 'ponto_espelho_arquivos', coluna: 'enviado_por' },
  { tabela: 'ceu_tamanhos', coluna: 'updated_by' },
]

console.log('\n=== Registros vinculados aos usuários de teste ===')
let totalGeral = 0
for (const v of VERIFICACOES) {
  const { count, error } = await supabase
    .from(v.tabela)
    .select('id', { count: 'exact', head: true })
    .in(v.coluna, ids)
  if (error) {
    console.log(`${v.tabela}.${v.coluna}: (erro — ${error.message})`)
    continue
  }
  totalGeral += count ?? 0
  if ((count ?? 0) > 0) console.log(`${v.tabela}.${v.coluna}: ${count} registro(s)`)
}
if (totalGeral === 0) console.log('NENHUM registro encontrado — os usuários de teste não fizeram nada no sistema.')
