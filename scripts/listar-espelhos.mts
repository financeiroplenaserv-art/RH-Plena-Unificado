// Lista todos os espelhos salvos (tabela ponto_espelho_arquivos)
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

const { data, error } = await supabase
  .from('ponto_espelho_arquivos')
  .select('id, nome_arquivo, storage_path, tamanho_bytes, enviado_por, created_at')
  .order('created_at', { ascending: false })
if (error) throw error
for (const a of data ?? []) {
  console.log(`${a.created_at}  ${a.nome_arquivo}  (${a.tamanho_bytes} bytes)  ${a.storage_path}`)
}
