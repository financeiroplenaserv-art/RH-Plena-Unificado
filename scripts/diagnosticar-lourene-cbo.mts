// Diagnóstico: Lourene x CBO / CBO Niterói
// 1) Locais com "CBO" no nome; 2) colaboradora Lourene; 3) diário dela;
// 4) linhas dela no Excel mais recente; 5) mapeamentos que envolvem CBO.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'

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

const { data: locaisCbo } = await sb
  .from('locais_trabalho')
  .select('id, nome, nome_curto, status')
  .or('nome.ilike.%cbo%,nome_curto.ilike.%cbo%')
console.log('=== Locais "CBO" ===')
console.log(JSON.stringify(locaisCbo, null, 2))

const { data: lou } = await sb
  .from('colaboradores')
  .select('id, nome_completo, matricula, status')
  .ilike('nome_completo', '%louren%')
console.log('\n=== Colaboradoras "Louren..." ===')
console.log(JSON.stringify(lou, null, 2))

const { data: maps } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('tipo_match, valor_flit, ativo, local_trabalho:locais_trabalho(nome, nome_curto)')
  .ilike('valor_flit', '%cbo%')
console.log('\n=== Mapeamentos com "CBO" ===')
for (const m of maps || []) {
  console.log(`  [${m.ativo ? 'ATIVO' : 'inativo'}] ${m.tipo_match} | "${m.valor_flit}" -> ${m.local_trabalho?.nome_curto} (${m.local_trabalho?.nome})`)
}

for (const c of lou || []) {
  const { data: dias } = await sb
    .from('locais_trabalho_diario')
    .select('data, fonte, local_trabalho:locais_trabalho(nome, nome_curto)')
    .eq('colaborador_id', c.id)
    .order('data', { ascending: false })
    .limit(40)
  console.log(`\n=== Diário de ${c.nome_completo} (${c.matricula}) — ${dias?.length} dias ===`)
  for (const d of dias || []) {
    const lt = d.local_trabalho as unknown as { nome: string; nome_curto: string } | null
    console.log(`  ${d.data} | ${d.fonte} | ${lt ? `${lt.nome_curto} (${lt.nome})` : '(sem local)'}`)
  }
}

// Excel mais recente: linhas da Lourene e de qualquer um com CBO
const { data: arquivos } = await sb
  .from('escala_arquivos')
  .select('nome_arquivo, storage_path')
  .order('created_at', { ascending: false })
  .limit(1)
if (arquivos && arquivos.length > 0) {
  const { data: blob } = await sb.storage.from('escala-arquivos').download(arquivos[0].storage_path)
  const buffer = Buffer.from(await blob!.arrayBuffer())
  const dias = agruparBatidasPorDia(await parseWorkbookBinary(buffer))
  console.log(`\n=== Excel: ${arquivos[0].nome_arquivo} ===`)
  const louren = dias.filter((d) => d.nomeColaborador.toUpperCase().includes('LOUREN'))
  console.log(`-- ${louren.length} dia(s) de colaboradores "Louren...":`)
  for (const d of louren) {
    console.log(`  ${d.data} | ${d.nomeColaborador} | tipoDisp="${d.tipoDispositivo}" | nomeDisp="${d.nomeDispositivo}" | perimetro="${d.perimetro}" | depto="${d.departamento}" | turno="${d.turno}"`)
  }
  const cbo = new Map<string, number>()
  for (const d of dias) {
    for (const [campo, valor] of [['nomeDisp', d.nomeDispositivo], ['depto', d.departamento], ['turno', d.turno]] as const) {
      if (valor && valor.toUpperCase().includes('CBO')) {
        const chave = `${campo}="${valor}"`
        cbo.set(chave, (cbo.get(chave) || 0) + 1)
      }
    }
  }
  console.log('-- Valores com "CBO" em todo o Excel:')
  for (const [k, n] of Array.from(cbo.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${n}x | ${k}`)
}
