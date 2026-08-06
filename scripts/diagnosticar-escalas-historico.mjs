// Diagnóstico: histórico de locais_trabalho_diario do colaborador DAMIAO (matrícula 000821)
// e panorama geral de dias identificados — investiga por que o modal "Confirmar local"
// não mostra "Locais usados recentemente por este colaborador".
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

const { data: colab, error: e1 } = await sb
  .from('colaboradores')
  .select('id, nome_completo, matricula')
  .eq('matricula', '000821')
  .single()
if (e1) throw e1
console.log('Colaborador:', colab)

const { data: dias, error: e2 } = await sb
  .from('locais_trabalho_diario')
  .select('id, data, local_trabalho_id, fonte, local_trabalho:locais_trabalho(id, nome, nome_curto)')
  .eq('colaborador_id', colab.id)
  .order('data', { ascending: false })
if (e2) throw e2

const ident = dias.filter((d) => d.local_trabalho_id)
console.log(`Total de dias: ${dias.length} | identificados: ${ident.length} | não identificados: ${dias.length - ident.length}`)
console.log('Últimos 10 identificados:')
for (const d of ident.slice(0, 10)) {
  console.log(`  ${d.data} | ${d.fonte} | ${d.local_trabalho?.nome_curto || d.local_trabalho?.nome || d.local_trabalho_id}`)
}

// Panorama geral: dias por fonte nos últimos 60 dias
const desde = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
const { data: geral, error: e3 } = await sb
  .from('locais_trabalho_diario')
  .select('fonte, local_trabalho_id')
  .gte('data', desde)
if (e3) throw e3
const porFonte = {}
for (const d of geral) {
  const k = `${d.fonte}${d.local_trabalho_id ? ' (com local)' : ' (sem local)'}`
  porFonte[k] = (porFonte[k] || 0) + 1
}
console.log(`\nPanorama desde ${desde}:`, porFonte)
