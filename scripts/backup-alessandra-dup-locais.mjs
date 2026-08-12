// Backup complementar (12/08/2026): os 22 registros de locais_trabalho_diario
// ligados ao duplicado vazio da Alessandra (matricula "16", sem empresa).
// As datas sem sobreposição serão religadas ao cadastro oficial dela
// (matricula 000016, Plena Tech); as sobrepostas serão descartadas (vale a
// linha já existente no cadastro oficial, de importação mais recente).
//
// Uso: node scripts/backup-alessandra-dup-locais.mjs

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

const ID_DUP = '2d11990b-be23-4f77-bc98-d6a80084b9c9'

const { data, error } = await supabase.from('locais_trabalho_diario').select('*').eq('colaborador_id', ID_DUP)
if (error) throw new Error(error.message)

const arquivo = 'dados-locais/backup_alessandra_dup_locais_2026-08-12.json'
fs.writeFileSync(arquivo, JSON.stringify({ data_backup: new Date().toISOString(), locais_trabalho_diario: data }, null, 2))
console.log(`Backup salvo em ${arquivo} (${data.length} registros)`)
