// Diagnóstico SOMENTE LEITURA: por que o PDF de ocorrência cai no fallback Plena EA?
// Uso: npx tsx scripts/diagnostico-empresa-pdf.ts
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'
import { readFileSync } from 'fs'

function carregarEnv(caminho: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    readFileSync(caminho, 'utf-8')
      .split('\n')
      .forEach((linha) => {
        const [chave, ...valor] = linha.split('=')
        if (chave && valor.length > 0) {
          env[chave.trim()] = valor.join('=').trim().replace(/^["']|["']$/g, '')
        }
      })
  } catch {
    // ignorar
  }
  return env
}

const env = { ...process.env, ...carregarEnv(resolve(process.cwd(), '.env')) }
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis do Supabase não encontradas no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('=== EMPRESAS ===')
  const { data: empresas, error: errEmp } = await supabase
    .from('empresas')
    .select('id, nome, cnpj')
    .order('nome')
  if (errEmp) console.error('Erro:', errEmp.message)
  empresas?.forEach((e) => console.log(`${e.id} | ${e.nome} | ${e.cnpj || 'sem CNPJ'}`))

  console.log('\n=== DEPARTAMENTOS "PLENA TECH" ===')
  const { data: deps, error: errDep } = await supabase
    .from('departamentos')
    .select('id, nome, empresa_id')
    .ilike('nome', '%plena tech%')
  if (errDep) console.error('Erro:', errDep.message)
  if (!deps?.length) console.log('(nenhum departamento encontrado)')
  deps?.forEach((d) => console.log(`${d.id} | ${d.nome} | empresa_id: ${d.empresa_id || 'NULL'}`))

  console.log('\n=== COLABORADORA GRACIANE NEVES ===')
  const { data: colabs, error: errCol } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, matricula, empresa_id, departamento, departamento_id')
    .ilike('nome_completo', '%graciane neves%')
  if (errCol) console.error('Erro:', errCol.message)
  colabs?.forEach((c) =>
    console.log(
      `${c.id} | ${c.nome_completo} | matr ${c.matricula} | empresa_id: ${c.empresa_id || 'NULL'} | depto: "${c.departamento}" | departamento_id: ${c.departamento_id || 'NULL'}`
    )
  )

  console.log('\n=== OCORRÊNCIAS da colaboradora (sem empresa_id) ===')
  if (colabs?.length) {
    const { data: ocs } = await supabase
      .from('ocorrencias')
      .select('id, colaborador_nome, empresa_id, data_ocorrencia')
      .eq('colaborador_id', colabs[0].id)
      .order('data_ocorrencia', { ascending: false })
      .limit(5)
    ocs?.forEach((o) =>
      console.log(`${o.id} | ${o.data_ocorrencia} | empresa_id: ${o.empresa_id || 'NULL'}`)
    )
  }

  console.log('\n=== RESUMO: colaboradores sem empresa_id por departamento ===')
  const { data: semEmp } = await supabase
    .from('colaboradores')
    .select('departamento')
    .is('empresa_id', null)
  const contagem: Record<string, number> = {}
  semEmp?.forEach((c) => {
    const d = c.departamento || '(sem departamento)'
    contagem[d] = (contagem[d] || 0) + 1
  })
  Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log(`${n}x ${d}`))
}

main()
