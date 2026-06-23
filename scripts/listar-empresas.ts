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

async function listar() {
  const { data, error } = await supabase.from('empresas').select('*').order('nome')
  if (error) {
    console.error('Erro:', error.message)
    return
  }
  console.log('Empresas cadastradas:')
  data?.forEach((e: { id: string; nome: string; cnpj: string | null }) => {
    console.log(`${e.id} | ${e.nome} | ${e.cnpj || 'sem CNPJ'}`)
  })
}

listar()
