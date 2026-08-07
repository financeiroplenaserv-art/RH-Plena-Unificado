// Cadastra os mapeamentos faltantes detectados na auditoria do arquivo-catálogo.
// Uso:  node|tsx scripts/cadastrar-mapeamentos-faltantes.mts          -> dry-run (só mostra)
//       npx tsx ... cadastrar-mapeamentos-faltantes.mts --apply       -> insere de verdade
import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'
import { normalizarTexto } from '../src/lib/escalas/normalizarTexto'

const APPLY = process.argv.includes('--apply')

// [tipo, valor_flit, nome_curto do local alvo]
const PROPOSTAS: Array<[string, string, string]> = [
  ['dispositivo', 'IDA SCARSELLI', 'IDA SCARSELLI'],
  ['perimetro', 'CBO NITERÓI', 'CBO NITERÓI'],
  ['perimetro', 'Macedo', 'MACEDO'],
  ['turno_departamento', 'MACEDO', 'MACEDO'],
  ['turno_departamento', 'JARDINS', 'JARDINS'],
  ['turno_departamento', 'PRAIA D OFIR', "PRAIA D'OFIR"],
  ['turno_departamento', 'ADRIANA', 'ADRIANA'],
  ['turno_departamento', 'CBO -', 'CBO NITERÓI'],
  ['turno_departamento', 'CASCAIS', 'CASCAIS'],
  ['turno_departamento', 'MATIZES', 'MATIZES  DE ICARAÍ'],
  ['turno_departamento', 'CARMO', 'CARMO CAMPANELLA'],
  ['turno_departamento', 'NOVAS C.', 'NOVAS CORES'],
  ['turno_departamento', 'CALLE', 'CALLE MAGGIORE'],
  ['turno_departamento', 'CNOOC', 'CNOOC PETROLEUM'],
  ['turno_departamento', 'EXCLUSIVE', 'EXCLUSIVE'],
  ['turno_departamento', 'OSCAR PER', 'OSCAR PEREIRA'],
  ['turno_departamento', 'MÉRITO', 'MÉRITO BARRETO'],
  ['turno_departamento', 'SUMMER B.', 'SUMMER BAY'],
  ['turno_departamento', 'IGREJA', 'IGREJA METODISTA'],
  ['turno_departamento', 'OLÍMPIO', 'OLÍMPIO BARGIELA'],
  ['turno_departamento', 'SAN F. HILLS', 'SAN FRANCISCO HILLS'],
  ['turno_departamento', 'BLUE TERMINAL', 'BLUE TERMINAL'],
  ['turno_departamento', 'BUSINESS', 'BUSINESS CENTER'],
  ['turno_departamento', 'IDA SC', 'IDA SCARSELLI'],
  ['turno_departamento', 'AMAPÁ', 'AMAPÁ'],
]

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

const { data: locaisRows, error: eL } = await sb.from('locais_trabalho').select('id, nome, nome_curto')
if (eL) throw eL
const { data: existentes, error: eM } = await sb
  .from('mapeamento_flit_local_trabalho')
  .select('tipo_match, valor_flit')
if (eM) throw eM
const chavesExistentes = new Set((existentes || []).map((m) => `${m.tipo_match}|${normalizarTexto(m.valor_flit)}`))

// Resolve ids dos locais por nome_curto (normalizado)
const localPorNomeCurto = new Map<string, { id: string; nome_curto: string }>()
for (const l of locaisRows || []) {
  localPorNomeCurto.set(normalizarTexto(l.nome_curto || l.nome), { id: l.id, nome_curto: l.nome_curto })
}

// Arquivo-catálogo para validar o que cada proposta casaria
const wb = XLSX.read(fs.readFileSync(path.resolve('dados-locais/Marcacoes 01_06_2026 - 01_08_2026.xlsx')))
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
const corpus = rows.map((r) => ({
  departamento: String(r['Departamento'] || '').trim(),
  nomeDispositivo: String(r['Nome do dispositivo'] || '').trim(),
  tipoDispositivo: String(r['Dispositivo'] || '').trim(),
  turno: String(r['Escala'] || '').trim(),
  perimetro: String(r['Perímetro'] || '').trim(),
}))

console.log(APPLY ? '*** MODO APPLY — vai inserir ***\n' : '*** DRY-RUN — nada será gravado ***\n')

const insercoes: Array<Record<string, unknown>> = []
let bloqueadas = 0

for (const [tipo, valor, nomeCurto] of PROPOSTAS) {
  const local = localPorNomeCurto.get(normalizarTexto(nomeCurto))
  if (!local) {
    console.log(`BLOQUEADA: local "${nomeCurto}" não encontrado -> ${tipo} "${valor}"`)
    bloqueadas++
    continue
  }
  if (chavesExistentes.has(`${tipo}|${normalizarTexto(valor)}`)) {
    console.log(`PULA (já existe): ${tipo} "${valor}"`)
    continue
  }

  // Validação: o que esse valor casaria no corpus, por coluna
  const v = normalizarTexto(valor)
  let matches = 0
  const deptos = new Map<string, number>()
  for (const l of corpus) {
    const coluna =
      tipo === 'dispositivo'
        ? normalizarTexto(l.tipoDispositivo).includes('multi')
          ? normalizarTexto(l.nomeDispositivo)
          : ''
        : tipo === 'perimetro'
          ? normalizarTexto(l.perimetro)
          : '' // turno_departamento casa com turno OU departamento
    const alvos = tipo === 'turno_departamento' ? [normalizarTexto(l.turno), normalizarTexto(l.departamento)] : [coluna]
    if (alvos.some((a) => a && a.includes(v))) {
      matches++
      deptos.set(l.departamento, (deptos.get(l.departamento) || 0) + 1)
    }
  }
  const top = Array.from(deptos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
  console.log(`${tipo} | "${valor}" -> ${local.nome_curto} | casaria ${matches} marcações`)
  top.forEach(([d, n]) => console.log(`     ${n}x depto="${d}"`))

  insercoes.push({ local_trabalho_id: local.id, tipo_match: tipo, valor_flit: valor, prioridade: 100, ativo: true })
}

console.log(`\nPropostas válidas: ${insercoes.length} | bloqueadas: ${bloqueadas}`)

if (APPLY && insercoes.length > 0) {
  const { data, error } = await sb.from('mapeamento_flit_local_trabalho').insert(insercoes).select('id')
  if (error) {
    console.error('ERRO ao inserir:', error)
    process.exit(1)
  }
  console.log(`INSERIDOS: ${data.length} mapeamentos`)
}
