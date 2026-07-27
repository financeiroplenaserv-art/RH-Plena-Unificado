// Diagnóstico: por que o termo LGPD não aparece para usuários de teste
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY)

// 1. Termo ativo existe?
const { data: termos, error: errTermos } = await supabase
  .from('termos_lgpd')
  .select('id, versao, titulo, ativo, created_at')
console.log('== termos_lgpd ==')
if (errTermos) console.log('ERRO:', errTermos.message)
else console.table(termos)

// 2. Perfis e consentimento
const { data: perfis, error: errPerfis } = await supabase
  .from('perfis')
  .select('email, nome, nivel_acesso, consentimento_lgpd, consentimento_lgpd_data, consentimento_lgpd_versao')
console.log('== perfis ==')
if (errPerfis) console.log('ERRO:', errPerfis.message)
else console.table(perfis)

// 3. RPC existe?
const { error: errRpc } = await supabase.rpc('registrar_consentimento_lgpd', { p_versao: '__teste__', p_finalidades: [] })
console.log('== RPC registrar_consentimento_lgpd ==')
console.log(errRpc ? `resposta: ${errRpc.code} - ${errRpc.message}` : 'OK (sem erro)')
