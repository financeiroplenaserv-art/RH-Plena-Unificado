// Audita divergências entre permissoes_perfil (banco, dinâmico — tem
// precedência) e PERMISSOES_PADRAO (código, fallback).
//
// Para cada linha da tabela cujo (recurso, acao) existe no PERMISSOES_PADRAO,
// compara o valor dinâmico com o padrão efetivo do perfil. Perfis admin/adm
// são ignorados (acesso total sempre, as linhas são redundantes).
// Recursos fora do mapa (menu, rota, escala) são só de UI e não entram na
// contagem — são listados à parte.
//
// Uso: npx tsx scripts/auditar-divergencias-permissoes.ts

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { PERMISSOES_PADRAO } from '../src/lib/permissoes'
import type { NivelAcesso } from '../src/types/database'

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { persistSession: false } }
)

interface Linha { perfil: string; recurso: string; acao: string; permitido: boolean }

const { data, error } = await supabase
  .from('permissoes_perfil')
  .select('perfil, recurso, acao, permitido')
if (error) throw error

const linhas = (data || []) as Linha[]
const divergencias: { perfil: string; chave: string; dinamico: boolean; padrao: boolean }[] = []
let foraDoMapa = 0

for (const l of linhas) {
  if (l.perfil === 'admin' || l.perfil === 'adm') continue
  const padraoRecursos = PERMISSOES_PADRAO[l.recurso]
  if (!padraoRecursos || !(l.acao in padraoRecursos)) {
    foraDoMapa++
    continue
  }
  const padrao = padraoRecursos[l.acao]?.includes(l.perfil as NivelAcesso) ?? false
  if (l.permitido !== padrao) {
    divergencias.push({ perfil: l.perfil, chave: `${l.recurso}.${l.acao}`, dinamico: l.permitido, padrao })
  }
}

divergencias.sort((a, b) => a.chave.localeCompare(b.chave) || a.perfil.localeCompare(b.perfil))

console.log(`Total de linhas na tabela: ${linhas.length}`)
console.log(`Linhas fora do PERMISSOES_PADRAO (menu/rota/escala — só UI): ${foraDoMapa}`)
console.log(`\nDIVERGÊNCIAS (${divergencias.length}):\n`)
for (const d of divergencias) {
  const tipo = d.dinamico ? 'CONCESSÃO (tela permite, padrão não)' : 'RESTRIÇÃO (tela nega, padrão permite)'
  console.log(`${d.perfil.padEnd(12)} ${d.chave.padEnd(32)} dinâmico=${d.dinamico} padrão=${d.padrao}  → ${tipo}`)
}
