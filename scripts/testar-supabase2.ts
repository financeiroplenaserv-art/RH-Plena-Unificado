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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function testar() {
  const { data, error, count } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, empresa_id, departamento, status', { count: 'exact' })
    .limit(10)
  console.log('count:', count)
  console.log('data:', JSON.stringify(data, null, 2))
  console.log('error:', error)
}

testar()
