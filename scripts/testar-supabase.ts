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

console.log('URL:', supabaseUrl)
console.log('KEY presente:', !!supabaseKey)

const supabase = createClient(supabaseUrl!, supabaseKey!)

async function testar() {
  const { data, error } = await supabase.from('colaboradores').select('count').limit(1)
  console.log('data:', data)
  console.log('error:', error)
}

testar()
