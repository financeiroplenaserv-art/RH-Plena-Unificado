// Reseta o consentimento LGPD dos usuários de teste para que a tela de
// consentimento volte a aparecer no próximo login (solicitado em 27/07/2026).
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

const { data, error } = await supabase
  .from('perfis')
  .update({
    consentimento_lgpd: false,
    consentimento_lgpd_data: null,
    consentimento_lgpd_versao: null,
    consentimento_lgpd_finalidades: null,
  })
  .like('nome', '% Teste')
  .select('nome, nivel_acesso')

if (error) {
  console.error('ERRO:', error.message)
  process.exit(1)
}
console.log('Consentimento resetado para:')
console.table(data)
