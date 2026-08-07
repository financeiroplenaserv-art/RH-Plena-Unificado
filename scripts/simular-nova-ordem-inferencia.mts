// Simula a NOVA ordem (dispositivo -> perímetro -> turno -> departamento) no
// Excel real e compara com a ANTIGA (turno ignorado = passar turno vazio).
// Não grava nada.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '../src/lib/escalas/inferirLocalTrabalho'
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

const { data: arquivos } = await sb.from('escala_arquivos').select('nome_arquivo, storage_path').order('created_at', { ascending: false }).limit(1)
const { data: blob } = await sb.storage.from('escala-arquivos').download(arquivos![0].storage_path)
const dias = agruparBatidasPorDia(await parseWorkbookBinary(Buffer.from(await blob!.arrayBuffer())))

let antigoIdent = 0
let novoIdent = 0
let resgatados = 0
const divergencias = new Map<string, { count: number; de?: string; para?: string; exemplos: string[] }>()

for (const dia of dias) {
  const entrada = {
    tipoDispositivo: dia.tipoDispositivo,
    nomeDispositivo: dia.nomeDispositivo,
    perimetro: dia.perimetro,
    departamento: dia.departamento,
    turno: dia.turno,
  }
  const antigo = inferirLocalTrabalho(mapeamentos, { ...entrada, turno: '' }) // turno vazio = comportamento antigo
  const novo = inferirLocalTrabalho(mapeamentos, entrada)

  if (antigo) antigoIdent++
  if (novo) novoIdent++

  if (!antigo && novo) resgatados++
  if (antigo && novo && antigo.localTrabalhoId !== novo.localTrabalhoId) {
    const chave = `${nomeLocal.get(antigo.localTrabalhoId)} -> ${nomeLocal.get(novo.localTrabalhoId)} | turno="${dia.turno}" | depto="${dia.departamento}"`
    const e = divergencias.get(chave) || { count: 0, de: nomeLocal.get(antigo.localTrabalhoId), para: nomeLocal.get(novo.localTrabalhoId), exemplos: [] }
    e.count++
    if (e.exemplos.length < 3) e.exemplos.push(`${dia.nomeColaborador} (${dia.data})`)
    divergencias.set(chave, e)
  }
}

console.log(`Dias no Excel: ${dias.length}`)
console.log(`Identificados — ordem ANTIGA: ${antigoIdent} | ordem NOVA: ${novoIdent} | resgatados pelo turno: ${resgatados}`)
console.log(`\n=== Divergências (turno venceu o departamento): ${Array.from(divergencias.values()).reduce((s, e) => s + e.count, 0)} dias ===`)
Array.from(divergencias.entries())
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([chave, e]) => console.log(`  ${e.count}x | ${chave}\n      ex: ${e.exemplos.join('; ')}`))
