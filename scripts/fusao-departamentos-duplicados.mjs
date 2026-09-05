// Fusão das linhas duplicadas de `departamentos` (decisão da gestão, 05/09/2026):
//
//   ALIANÇA/CBO (Niterói): mantém 6863ec8e (nome_curto 'CBO'); absorve
//     6e2e9d11 (Ativa, sem nome_curto — 17 colaboradores) e 8643771f (Inativa).
//   CBO SERVIÇOS MARÍTIMOS (Macaé): mantém 7503715c (nome_curto 'CBO MACAÉ');
//     absorve 5e42bb43 (Inativa) e liga os 11 colaboradores que só têm o texto
//     legado "CBO SERVICOS MARITIMOS" (departamento_id NULL) à linha oficial.
//
// contratos_adicionais e extras não referenciam nenhuma das linhas absorvidas
// (verificado em 05/09/2026). Linhas absorvidas viram status 'Inativo'
// (nunca excluídas — histórico e RLS).
//
// Uso:
//   node scripts/fusao-departamentos-duplicados.mjs            # dry-run
//   node scripts/fusao-departamentos-duplicados.mjs --aplicar  # grava
//
// Antes de gravar, salva backup em dados-locais/.

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function carregarEnv(caminho) {
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
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const APLICAR = process.argv.includes('--aplicar')

const CBO_OFICIAL = '6863ec8e-e92c-44fa-980c-28bf4d215eda' // ALIANÇA S/A (nome_curto CBO)
const CBO_DUPLICADAS = ['6e2e9d11-9927-4cf3-a15a-192b5da5b06f', '8643771f-009c-46b7-934c-d501b78a4741']
const MACAE_OFICIAL = '7503715c-4118-4d16-9c2e-662b1cf59f71' // CBO SERVICOS MARITIMOS S.A. (CBO MACAÉ)
const MACAE_DUPLICADA = '5e42bb43-0693-4775-9e2c-167cd7063b88'

const idsEnvolvidos = [CBO_OFICIAL, ...CBO_DUPLICADAS, MACAE_OFICIAL, MACAE_DUPLICADA]

// 1. Lê o estado atual
const { data: depts, error: erroDepts } = await supabase
  .from('departamentos')
  .select('id, nome, nome_curto, status, empresa_id')
  .in('id', idsEnvolvidos)
if (erroDepts) throw erroDepts

const { data: colabsCbo, error: e1 } = await supabase
  .from('colaboradores')
  .select('id, nome_completo, departamento, departamento_id')
  .in('departamento_id', CBO_DUPLICADAS)
if (e1) throw e1

const { data: colabsMacae, error: e2 } = await supabase
  .from('colaboradores')
  .select('id, nome_completo, departamento, departamento_id')
  .is('departamento_id', null)
  .ilike('departamento', 'CBO SERVICOS%')
if (e2) throw e2

console.log(`Colaboradores Aliança (duplicadas → CBO oficial): ${colabsCbo.length}`)
console.log(`Colaboradores CBO Macaé (só texto → oficial): ${colabsMacae.length}`)
console.log('Departamentos envolvidos:', depts.map((d) => `${d.id.slice(0, 8)} ${d.nome_curto || '(sem nome_curto)'} [${d.status}]`).join(' | '))

if (!APLICAR) {
  console.log('\nDry-run. Rode com --aplicar para gravar.')
  process.exit(0)
}

// 2. Backup
const backup = {
  data: new Date().toISOString(),
  operacao: 'fusao_departamentos_duplicados',
  departamentos_antes: depts,
  colaboradores_cbo_antes: colabsCbo,
  colaboradores_macae_antes: colabsMacae,
}
const nomeBackup = `dados-locais/backup_fusao_departamentos_2026-09-05.json`
fs.writeFileSync(nomeBackup, JSON.stringify(backup, null, 2))
console.log(`\nBackup salvo em ${nomeBackup}`)

// 3. Reaponta colaboradores (com checagem de linhas afetadas — padrão anti-falso-sucesso)
const { data: upd1, error: eu1 } = await supabase
  .from('colaboradores')
  .update({ departamento_id: CBO_OFICIAL })
  .in('departamento_id', CBO_DUPLICADAS)
  .select('id')
if (eu1) throw eu1
if ((upd1?.length || 0) !== colabsCbo.length) throw new Error(`CBO: esperado ${colabsCbo.length} atualizados, veio ${upd1?.length}`)

const { data: upd2, error: eu2 } = await supabase
  .from('colaboradores')
  .update({ departamento_id: MACAE_OFICIAL })
  .is('departamento_id', null)
  .ilike('departamento', 'CBO SERVICOS%')
  .select('id')
if (eu2) throw eu2
if ((upd2?.length || 0) !== colabsMacae.length) throw new Error(`Macaé: esperado ${colabsMacae.length} atualizados, veio ${upd2?.length}`)

// 4. Inativa as linhas absorvidas
const { data: upd3, error: eu3 } = await supabase
  .from('departamentos')
  .update({ status: 'Inativo' })
  .in('id', [...CBO_DUPLICADAS, MACAE_DUPLICADA])
  .select('id')
if (eu3) throw eu3

console.log(`✓ ${upd1.length} colaboradores reapontados para CBO (Aliança/Niterói)`)
console.log(`✓ ${upd2.length} colaboradores ligados a CBO Macaé`)
console.log(`✓ ${upd3.length} linhas duplicadas inativadas`)
