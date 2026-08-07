// Verifica, com os mapeamentos ATUAIS do banco, se todo dia do Excel com
// assinatura CBO (dispositivo/departamento/turno) resolve para um local.
// Também testa o caso da Joane (CARTÓRIO / OFICIO DE NOTAS).
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

const { data: maps, error: eM } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('id, local_trabalho_id, tipo_match, valor_flit, prioridade, ativo, created_at, updated_at')
if (eM) throw eM
const mapeamentos = maps as MapeamentoFlitLocalTrabalho[]

// Alerta: existe mapeamento genérico "CBO" (casaria com CBO MACAÉ e CBO NITERÓI)?
const generico = mapeamentos.filter((m) => m.valor_flit.trim().toUpperCase() === 'CBO')
console.log(`Mapeamentos genéricos "CBO": ${generico.length} (tem que ser 0)`)

const { data: arquivos } = await sb.from('escala_arquivos').select('nome_arquivo, storage_path').order('created_at', { ascending: false }).limit(1)
const { data: blob } = await sb.storage.from('escala-arquivos').download(arquivos![0].storage_path)
const dias = agruparBatidasPorDia(await parseWorkbookBinary(Buffer.from(await blob!.arrayBuffer())))

let cboTotal = 0
let cboResolvido = 0
const cboPendente: string[] = []
let joaneTotal = 0
let joaneResolvido = 0
const joanePendente: string[] = []

for (const dia of dias) {
  const assinatura = `${dia.nomeDispositivo} ${dia.departamento} ${dia.turno}`.toUpperCase()
  const inferido = inferirLocalTrabalho(mapeamentos, {
    tipoDispositivo: dia.tipoDispositivo,
    nomeDispositivo: dia.nomeDispositivo,
    perimetro: dia.perimetro,
    departamento: dia.departamento,
    turno: dia.turno,
  })

  if (assinatura.includes('CBO') || assinatura.includes('ALIANCA')) {
    cboTotal++
    if (inferido) cboResolvido++
    else if (cboPendente.length < 10) {
      cboPendente.push(`${dia.data} | ${dia.nomeColaborador} | nomeDisp="${dia.nomeDispositivo}" | depto="${dia.departamento}" | turno="${dia.turno}"`)
    }
  }

  if (dia.nomeColaborador.toUpperCase().includes('JOANE')) {
    joaneTotal++
    if (inferido) joaneResolvido++
    else if (joanePendente.length < 10) {
      joanePendente.push(`${dia.data} | depto="${dia.departamento}" | turno="${dia.turno}"`)
    }
  }
}

console.log(`\n=== CBO ===`)
console.log(`Dias com assinatura CBO/ALIANCA: ${cboTotal} | resolvidos: ${cboResolvido} | pendentes: ${cboTotal - cboResolvido}`)
cboPendente.forEach((l) => console.log(`  PENDENTE: ${l}`))

console.log(`\n=== Joane (Cartório) ===`)
console.log(`Dias: ${joaneTotal} | resolvidos: ${joaneResolvido} | pendentes: ${joaneTotal - joaneResolvido}`)
joanePendente.forEach((l) => console.log(`  PENDENTE: ${l}`))
