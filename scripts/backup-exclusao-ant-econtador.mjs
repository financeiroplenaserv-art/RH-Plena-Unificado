// Backup pré-exclusão dos 4 colaboradores ANT- que conflitavam na importação
// e-Contador (12/08/2026), das ocorrências ligadas a eles e dos registros que
// serão RELIGADOS à Alessandra (entregas e férias importadas na matrícula
// 000016 antes da renumeração ANT-). Inclui também o duplicado vazio da
// Alessandra (matricula "16", sem empresa), apenas como registro.
//
// Uso: node scripts/backup-exclusao-ant-econtador.mjs

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

const IDS_ANT = [
  '293c0712-72f6-404b-9afd-47e9a4bf259a', // ANT-000003 NADIA
  '11332f2f-369d-4f6d-b672-83e8698bd1ef', // ANT-000008 ELZA
  '9c2c4e57-9696-4691-aa14-5f696127f340', // ANT-000016 ROSANE
  '1394a02d-84b5-4fe4-8ff9-ac4164a575ad', // ANT-000017 ISANEIVA
]
const ID_DUP_ALESSANDRA = '2d11990b-be23-4f77-bc98-d6a80084b9c9' // matricula "16", sem empresa

async function buscar(tabela, coluna, ids) {
  const { data, error } = await supabase.from(tabela).select('*').in(coluna, ids)
  if (error) throw new Error(`${tabela}: ${error.message}`)
  return data
}

const backup = {
  data_backup: new Date().toISOString(),
  motivo: 'Exclusão dos 4 colaboradores ANT- conflitantes na importação e-Contador (demitidos 2015-2018, matrículas reutilizadas). Dados também existem no sistema antigo.',
  colaboradores_excluidos: await buscar('colaboradores', 'id', IDS_ANT),
  ocorrencias_excluidas: await buscar('ocorrencias', 'colaborador_id', IDS_ANT),
  entregas_religadas_para_alessandra: await buscar('entregas', 'colaborador_id', IDS_ANT),
  ferias_religadas_para_alessandra: await buscar('ferias_periodos', 'colaborador_id', IDS_ANT),
  duplicado_alessandra_matricula_16: await buscar('colaboradores', 'id', [ID_DUP_ALESSANDRA]),
}

const arquivo = 'dados-locais/backup_exclusao_ant_econtador_2026-08-12.json'
fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2))
console.log(`Backup salvo em ${arquivo}`)
console.log(`colaboradores: ${backup.colaboradores_excluidos.length}`)
console.log(`ocorrencias: ${backup.ocorrencias_excluidas.length}`)
console.log(`entregas: ${backup.entregas_religadas_para_alessandra.length}`)
console.log(`ferias: ${backup.ferias_religadas_para_alessandra.length}`)
