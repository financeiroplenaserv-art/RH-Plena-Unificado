// Quantifica: dos dias NÃO identificados hoje, quantos seriam resgatados se a
// inferência também lesse o campo TURNO (horário) contra os mapeamentos
// turno_departamento existentes? Não grava nada — só simula.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '../src/lib/escalas/inferirLocalTrabalho'
import { normalizarTexto } from '../src/lib/escalas/normalizarTexto'
import type { MapeamentoFlitLocalTrabalho } from '../src/types/database'

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const sb = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const { data: maps } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('id, local_trabalho_id, tipo_match, valor_flit, prioridade, ativo, created_at, updated_at')
const mapeamentos = maps as MapeamentoFlitLocalTrabalho[]
const mapTurno = mapeamentos.filter((m) => m.ativo !== false && m.tipo_match === 'turno_departamento')

const { data: locaisRows } = await sb.from('locais_trabalho').select('id, nome_curto')
const nomeLocal = new Map((locaisRows || []).map((l) => [l.id, l.nome_curto]))

const { data: arquivos } = await sb.from('escala_arquivos').select('nome_arquivo, storage_path').order('created_at', { ascending: false }).limit(1)
const { data: blob } = await sb.storage.from('escala-arquivos').download(arquivos![0].storage_path)
const dias = agruparBatidasPorDia(await parseWorkbookBinary(Buffer.from(await blob!.arrayBuffer())))

let falhos = 0
let resgatados = 0
const porTurno = new Map<string, { count: number; local: string | undefined; exemplos: string[] }>()
const semSalvacao: string[] = []

for (const dia of dias) {
  const atual = inferirLocalTrabalho(mapeamentos, {
    tipoDispositivo: dia.tipoDispositivo,
    nomeDispositivo: dia.nomeDispositivo,
    perimetro: dia.perimetro,
    departamento: dia.departamento,
    turno: dia.turno,
  })
  if (atual) continue
  falhos++

  // Simula o 4º passo: turno contra os mesmos mapeamentos turno_departamento
  const turnoNorm = normalizarTexto(dia.turno)
  const match = turnoNorm
    ? mapTurno
        .sort((a, b) => (a.prioridade ?? 100) - (b.prioridade ?? 100) || b.valor_flit.length - a.valor_flit.length)
        .find((m) => {
          const v = normalizarTexto(m.valor_flit)
          return v && turnoNorm.includes(v)
        })
    : undefined

  if (match) {
    resgatados++
    const chave = dia.turno
    const entry = porTurno.get(chave) || { count: 0, local: nomeLocal.get(match.local_trabalho_id), exemplos: [] }
    entry.count++
    if (entry.exemplos.length < 2) entry.exemplos.push(`${dia.nomeColaborador} (${dia.data})`)
    porTurno.set(chave, entry)
  } else if (semSalvacao.length < 15) {
    semSalvacao.push(`${dia.data} | ${dia.nomeColaborador} | depto="${dia.departamento}" | turno="${dia.turno}"`)
  }
}

console.log(`Dias no Excel: ${dias.length}`)
console.log(`Não identificados hoje: ${falhos}`)
console.log(`Resgatados se o turno fosse lido (mapeamentos atuais): ${resgatados}`)
console.log(`\n=== Turnos que resgatariam ===`)
Array.from(porTurno.entries())
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 15)
  .forEach(([turno, e]) => console.log(`  ${e.count}x -> ${e.local} | "${turno}" | ex: ${e.exemplos.join('; ')}`))
console.log(`\n=== Ainda sem salvação (primeiros 15) ===`)
semSalvacao.forEach((l) => console.log(`  ${l}`))
