import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
for (const linha of fs.readFileSync('.env', 'utf-8').split('\n')) {
  const t = linha.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)

const termos = ['ROSAS', 'CHÁCARA ITAGUAÍ', 'ENSEADA', 'TATHIANA', 'THATIANA', 'QUINTAS', 'MARINO', 'GREAT', 'CRISTIANA', 'LAS PALMAS', 'NUTRINDO']
const { data: locais } = await sb.from('locais_trabalho').select('id, nome, nome_curto, status')
const achados = (locais || []).filter((l) => termos.some((t) => (l.nome || '').toUpperCase().includes(t) || (l.nome_curto || '').toUpperCase().includes(t)))
for (const l of achados) {
  const { count } = await sb.from('locais_trabalho_diario').select('id', { count: 'exact', head: true }).eq('local_trabalho_id', l.id)
  const { data: maps } = await sb.from('mapeamento_flit_local_trabalho').select('tipo_match, valor_flit').eq('local_trabalho_id', l.id)
  console.log(`${l.nome_curto} | nome="${l.nome}" | dias=${count} | maps=[${(maps || []).map((m) => `${m.tipo_match}:"${m.valor_flit}"`).join(', ')}]`)
}
