import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'
import { readFileSync } from 'fs'

function carregarEnv(caminho: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const conteudo = readFileSync(caminho, 'utf-8')
    conteudo.split('\n').forEach((linha) => {
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
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verificar() {
  console.log('--- Empresas ---')
  const { data: empresas, error: errEmp } = await supabase.from('empresas').select('*').order('nome')
  if (errEmp) console.error('Erro empresas:', errEmp.message)
  else empresas?.forEach((e: { id: string; nome: string }) => console.log(`${e.id} | ${e.nome}`))

  console.log('\n--- Colaboradores específicos ---')
  const { data: cols, error: errCols } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, empresa_id, departamento, status')
    .or('nome_completo.ilike.%Elza Colodina%,nome_completo.ilike.%Nádia Maria%')

  if (errCols) console.error('Erro colaboradores:', errCols.message)
  else {
    cols?.forEach((c: { id: string; nome_completo: string; empresa_id: string | null; departamento: string | null; status: string }) => {
      const empresa = empresas?.find((e: { id: string; nome: string }) => e.id === c.empresa_id)
      console.log(`${c.id} | ${c.nome_completo} | empresa_id=${c.empresa_id} (${empresa?.nome || 'não encontrada'}) | dept=${c.departamento} | status=${c.status}`)
    })
  }

  console.log('\n--- Distribuição de empresa_id entre colaboradores ativos ---')
  const { data: ativos, error: errAtivos } = await supabase
    .from('colaboradores')
    .select('empresa_id')
    .eq('status', 'Ativo')

  if (errAtivos) console.error('Erro ativos:', errAtivos.message)
  else {
    const contagem: Record<string, number> = {}
    ativos?.forEach((c: { empresa_id: string | null }) => {
      const key = c.empresa_id || 'null'
      contagem[key] = (contagem[key] || 0) + 1
    })
    Object.entries(contagem).forEach(([id, qtd]) => {
      const empresa = empresas?.find((e: { id: string; nome: string }) => e.id === id)
      console.log(`${id} (${empresa?.nome || 'sem nome'}): ${qtd}`)
    })
  }
}

verificar()
