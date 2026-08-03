// Backup + limpeza do calendário da Mariana (vínculo 20/06–19/07, Insalub. Quatre)
// para ela relançar a escala pela tela. Uso: npx tsx scripts/limpar-calendario-mariana.mts
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

const VINCULO_ID = '9e195212-fa46-48f7-8bb4-b57c7fcff9da' // Mariana, Insalub. Quatre, 20/06–19/07
const INICIO = '2026-06-20'
const FIM = '2026-07-19'

// 1) Backup
const { data: linhas, error: eSel } = await supabase
  .from('calendario_adicionais')
  .select('*')
  .eq('vinculo_id', VINCULO_ID)
  .gte('data', INICIO)
  .lte('data', FIM)
  .order('data')
if (eSel) throw eSel
if (!linhas?.length) {
  console.log('Nenhuma linha encontrada — nada a fazer.')
  process.exit(0)
}
const arquivoBackup = `dados-locais/backup_mariana_limpeza_calendario_2026-08-03.json`
fs.writeFileSync(arquivoBackup, JSON.stringify(linhas, null, 2))
console.log(`Backup de ${linhas.length} linhas salvo em ${arquivoBackup}`)

// 2) Delete
const { data: apagadas, error: eDel } = await supabase
  .from('calendario_adicionais')
  .delete()
  .eq('vinculo_id', VINCULO_ID)
  .gte('data', INICIO)
  .lte('data', FIM)
  .select('id')
if (eDel) throw eDel
console.log(`Linhas apagadas: ${apagadas?.length ?? 0}`)

// 3) Verificação
const { count, error: eCnt } = await supabase
  .from('calendario_adicionais')
  .select('id', { count: 'exact', head: true })
  .eq('vinculo_id', VINCULO_ID)
  .gte('data', INICIO)
  .lte('data', FIM)
if (eCnt) throw eCnt
console.log(`Linhas restantes no período: ${count}`)
