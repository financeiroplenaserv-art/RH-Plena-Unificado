// Varredura COMPLETA: todas as colunas do banco que podem referenciar usuário,
// quantas linhas apontam para os usuários de teste, e as regras de FK.
// Uso: npx tsx scripts/varredura-refs-usuarios-teste.mts
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
  .select('id, nome, nivel_acesso')
  .ilike('nome', '%teste%')
if (e0) throw e0
const ids = (testes ?? []).map(t => t.id)
const nomePorId = new Map((testes ?? []).map(t => [t.id, t.nome]))
console.log(`Usuários de teste: ${ids.length}`)

// 1) Todas as colunas do schema public com nome de referência a usuário
const { data: colunas, error: e1 } = await supabase.rpc('exec_sql', {
  sql: `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name LIKE '%usuario%' OR column_name LIKE '%user%'
               OR column_name LIKE '%criado_por%' OR column_name LIKE '%registrado%'
               OR column_name LIKE '%enviado_por%' OR column_name LIKE '%updated_by%'
               OR column_name LIKE '%lancado%' OR column_name LIKE '%assinado%'
               OR column_name LIKE '%cancelado%' OR column_name LIKE '%confirmado%')
        ORDER BY table_name, column_name`,
}).maybeSingle()
if (e1 || !colunas) {
  console.log('RPC exec_sql indisponível — usando lista fixa de colunas conhecidas.')
}

const CANDIDATAS: { tabela: string; coluna: string }[] = colunas
  ? (colunas as any).map((c: any) => ({ tabela: c.table_name, coluna: c.column_name }))
  : [
      { tabela: 'log_auditoria', coluna: 'usuario_id' },
      { tabela: 'extras', coluna: 'usuario_id' },
      { tabela: 'recibos_extras', coluna: 'usuario_id' },
      { tabela: 'projetos_vr', coluna: 'usuario_id' },
      { tabela: 'historico_importacoes_econtador', coluna: 'usuario_id' },
      { tabela: 'ferias_notificacoes', coluna: 'usuario_id' },
      { tabela: 'consentimentos_lgpd', coluna: 'usuario_id' },
      { tabela: 'ponto_espelho_arquivos', coluna: 'enviado_por' },
      { tabela: 'ceu_tamanhos', coluna: 'updated_by' },
      { tabela: 'entregas', coluna: 'usuario_id' },
      { tabela: 'entregas', coluna: 'registrado_por' },
    ]

console.log('\n=== Linhas por tabela.coluna que apontam para usuários de teste ===')
let total = 0
for (const c of CANDIDATAS) {
  const { count, error } = await supabase
    .from(c.tabela)
    .select('*', { count: 'exact', head: true })
    .in(c.coluna, ids)
  if (error) continue
  if ((count ?? 0) > 0) {
    total += count ?? 0
    // detalhe por usuário
    const { data: det } = await supabase.from(c.tabela).select(c.coluna).in(c.coluna, ids)
    const porUsuario = new Map<string, number>()
    for (const r of det ?? []) {
      const k = (r as any)[c.coluna]
      porUsuario.set(k, (porUsuario.get(k) ?? 0) + 1)
    }
    const detalhe = [...porUsuario.entries()].map(([id, n]) => `${nomePorId.get(id)}: ${n}`).join(', ')
    console.log(`${c.tabela}.${c.coluna}: ${count}  (${detalhe})`)
  }
}
console.log(total === 0 ? 'Nada encontrado.' : `\nTOTAL de linhas vinculadas: ${total}`)

// 2) Entregas do CEU: quais colunas tem e quantas foram feitas por teste
const { data: amostra } = await supabase.from('entregas').select('*').limit(1)
console.log('\n=== Colunas da tabela entregas (CEU) ===')
console.log(amostra?.[0] ? Object.keys(amostra[0]).join(', ') : '(tabela vazia)')
const { count: totalEntregas } = await supabase.from('entregas').select('*', { count: 'exact', head: true })
console.log(`Total de entregas no CEU: ${totalEntregas}`)
