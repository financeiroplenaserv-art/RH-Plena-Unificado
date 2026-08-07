// Auditoria de mapeamentos contra o arquivo-catálogo de marcações
// (colunas: Departamento, Dispositivo, Nome do dispositivo, Escala, Perímetro).
// Usa a NOVA ordem da inferência (dispositivo -> perímetro -> turno -> departamento).
// Não grava nada.
import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'
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
const { data: locaisRows } = await sb.from('locais_trabalho').select('id, nome_curto')
const nomeLocal = new Map((locaisRows || []).map((l) => [l.id, l.nome_curto]))

const arquivo = process.argv[2] || 'dados-locais/Marcacoes 01_06_2026 - 01_08_2026.xlsx'
const wb = XLSX.read(fs.readFileSync(path.resolve(arquivo)))
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })

interface Linha {
  departamento: string
  tipoDispositivo: string
  nomeDispositivo: string
  turno: string
  perimetro: string
}
const linhas: Linha[] = rows.map((r) => ({
  departamento: String(r['Departamento'] || '').trim(),
  tipoDispositivo: String(r['Dispositivo'] || '').trim(),
  nomeDispositivo: String(r['Nome do dispositivo'] || '').trim(),
  turno: String(r['Escala'] || '').trim(),
  perimetro: String(r['Perímetro'] || r['Perimetro'] || '').trim(),
}))
console.log(`Arquivo: ${arquivo} — ${linhas.length} marcações\n`)

function casadoPor(tipo: MapeamentoFlitLocalTrabalho['tipo_match'], valor: string): string | null {
  const norm = normalizarTexto(valor)
  if (!norm) return null
  const m = mapeamentos
    .filter((x) => x.ativo !== false && x.tipo_match === tipo)
    .sort((a, b) => (a.prioridade ?? 100) - (b.prioridade ?? 100) || normalizarTexto(b.valor_flit).length - normalizarTexto(a.valor_flit).length)
    .find((x) => {
      const v = normalizarTexto(x.valor_flit)
      return v && norm.includes(v)
    })
  return m ? `${nomeLocal.get(m.local_trabalho_id)} (regra "${m.valor_flit}")` : null
}

function auditarColuna(rotulo: string, tipo: MapeamentoFlitLocalTrabalho['tipo_match'], valores: Map<string, number>) {
  const ordenado = Array.from(valores.entries()).sort((a, b) => b[1] - a[1])
  const semMatch = ordenado.filter(([v]) => !casadoPor(tipo, v))
  console.log(`=== ${rotulo}: ${ordenado.length} valores distintos | sem mapeamento: ${semMatch.length} ===`)
  for (const [v, n] of semMatch) console.log(`  FALTA ${n}x | "${v}"`)
  console.log('')
}

function contar(extrair: (l: Linha) => string): Map<string, number> {
  const c = new Map<string, number>()
  for (const l of linhas) {
    const v = extrair(l)
    if (v && v !== '--') c.set(v, (c.get(v) || 0) + 1)
  }
  return c
}

auditarColuna('DISPOSITIVOS Flit Multi', 'dispositivo', contar((l) => (normalizarTexto(l.tipoDispositivo).includes('multi') ? l.nomeDispositivo : '')))
auditarColuna('PERÍMETROS', 'perimetro', contar((l) => l.perimetro))
auditarColuna('TURNOS (Escala)', 'turno_departamento', contar((l) => l.turno))
auditarColuna('DEPARTAMENTOS', 'turno_departamento', contar((l) => l.departamento))

// Resolução final por combinação distinta com a NOVA ordem
const combos = new Map<string, { linha: Linha; count: number }>()
for (const l of linhas) {
  const chave = `${l.tipoDispositivo}|${l.nomeDispositivo}|${l.perimetro}|${l.departamento}|${l.turno}`
  const e = combos.get(chave) || { linha: l, count: 0 }
  e.count++
  combos.set(chave, e)
}
let okCombos = 0
let okMarcacoes = 0
const falhas: Array<{ count: number; linha: Linha }> = []
for (const { linha, count } of combos.values()) {
  const r = inferirLocalTrabalho(mapeamentos, linha)
  if (r) {
    okCombos++
    okMarcacoes += count
  } else {
    falhas.push({ count, linha })
  }
}
console.log(`=== RESOLUÇÃO FINAL (nova ordem) ===`)
console.log(`Combinações distintas: ${combos.size} | resolvidas: ${okCombos} | sem solução: ${falhas.length}`)
console.log(`Marcações: ${linhas.length} | identificadas: ${okMarcacoes} | pendentes: ${linhas.length - okMarcacoes}`)
console.log(`\n=== Combinações SEM solução (ordenadas por volume) ===`)
falhas
  .sort((a, b) => b.count - a.count)
  .forEach(({ count, linha }) => {
    console.log(`  ${count}x | disp="${linha.tipoDispositivo}" nomeDisp="${linha.nomeDispositivo}" per="${linha.perimetro}"`)
    console.log(`       depto="${linha.departamento}" turno="${linha.turno}"`)
  })

// Turnos com "CBO" — checagem específica pedida pela usuária
console.log(`\n=== Turnos com "CBO" e seu destino ===`)
const turnosCbo = contar((l) => (l.turno.toUpperCase().includes('CBO') ? l.turno : ''))
for (const [t, n] of Array.from(turnosCbo.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n}x | "${t}" -> ${casadoPor('turno_departamento', t) || 'sem match no passo turno (cai no departamento)'}`)
}
