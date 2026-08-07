// Diagnóstico: por que a Joane (Cartório) não é identificada automaticamente?
// Cruza: colaborador, local "Cartório", mapeamentos Flit e dias em locais_trabalho_diario.
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

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 1. Colaboradora
const { data: joanes, error: e1 } = await sb
  .from('colaboradores')
  .select('id, nome_completo, matricula, status')
  .ilike('nome_completo', '%joane%')
if (e1) throw e1
console.log('=== Colaboradoras "Joane" ===')
console.log(joanes)

// 2. Local Cartório
const { data: locais, error: e2 } = await sb
  .from('locais_trabalho')
  .select('id, nome, nome_curto, status')
  .or('nome.ilike.%cartorio%,nome_curto.ilike.%cartorio%')
if (e2) throw e2
console.log('\n=== Locais "Cartório" ===')
console.log(locais)

// 3. TODOS os mapeamentos (para ver o que existe e o que falta)
const { data: mapeamentos, error: e3 } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('id, tipo_match, valor_flit, prioridade, ativo, local_trabalho:locais_trabalho(nome, nome_curto)')
  .order('tipo_match')
if (e3) throw e3
console.log('\n=== Todos os mapeamentos Flit ===')
for (const m of mapeamentos) {
  console.log(`  [${m.ativo ? 'ATIVO' : 'inativo'}] ${m.tipo_match} | "${m.valor_flit}" -> ${m.local_trabalho?.nome_curto || m.local_trabalho?.nome}`)
}

// 4. Dias da(s) Joane(s) no diário (últimos 60)
for (const j of joanes || []) {
  const { data: dias, error: e4 } = await sb
    .from('locais_trabalho_diario')
    .select('data, local_trabalho_id, fonte, observacao, local_trabalho:locais_trabalho(nome, nome_curto)')
    .eq('colaborador_id', j.id)
    .order('data', { ascending: false })
    .limit(60)
  if (e4) throw e4
  const ident = dias.filter((d) => d.local_trabalho_id)
  console.log(`\n=== Diário de ${j.nome_completo} (${j.matricula}) — ${dias.length} dias, ${ident.length} identificados ===`)
  for (const d of dias.slice(0, 30)) {
    console.log(`  ${d.data} | ${d.fonte} | ${d.local_trabalho?.nome_curto || d.local_trabalho?.nome || '(sem local)'}${d.observacao ? ' | obs: ' + d.observacao : ''}`)
  }
}
