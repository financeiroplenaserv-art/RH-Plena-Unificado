// Reverte a emissão acidental dos recibos das entregas de 01/09/2026
// (pedido da usuária em 05/09/2026): todas as entregas do dia voltam para
// recibo_emitido = false e numero_recibo = NULL ("recibo a emitir").
// Os números queimados na ceu_recibo_seq não são reaproveitados (sequencial
// fiscal — regra da migration 073); a próxima emissão pega números novos.
//
// Uso:
//   node scripts/reverter-recibos-2026-09-01.mjs            # dry-run
//   node scripts/reverter-recibos-2026-09-01.mjs --aplicar  # grava
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
const DATA = '2026-09-01'

const { data: emitidas, error } = await supabase
  .from('entregas')
  .select('id, colaborador_id, item_id, numero_recibo, recibo_emitido')
  .eq('data_entrega', DATA)
  .eq('recibo_emitido', true)
if (error) throw error

console.log(`Entregas de ${DATA} com recibo emitido: ${emitidas.length}`)

if (!APLICAR) {
  console.log('Dry-run. Rode com --aplicar para reverter.')
  process.exit(0)
}

const nomeBackup = 'dados-locais/backup_reversao_recibos_2026-09-01.json'
fs.writeFileSync(
  nomeBackup,
  JSON.stringify({ data: new Date().toISOString(), operacao: 'reversao_recibos_2026-09-01', entregas_antes: emitidas }, null, 2)
)
console.log(`Backup salvo em ${nomeBackup}`)

const { data: atualizadas, error: erroUpd } = await supabase
  .from('entregas')
  .update({ recibo_emitido: false, numero_recibo: null })
  .eq('data_entrega', DATA)
  .eq('recibo_emitido', true)
  .select('id')
if (erroUpd) throw erroUpd
if (atualizadas.length !== emitidas.length) {
  throw new Error(`Esperado reverter ${emitidas.length}, veio ${atualizadas.length}`)
}
console.log(`✓ ${atualizadas.length} entregas de ${DATA} voltaram para "recibo a emitir"`)
