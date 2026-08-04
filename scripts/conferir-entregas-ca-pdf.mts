// Confere o CA (Certificado de Aprovação) das entregas SEM recibo emitido
// contra a fonte histórica: o relatório GESOPER parseado em
// dados-locais/uniformes_epis_pdf_extraido.json (gerado por
// scripts/parse-uniformes-epis-pdf.cjs).
//
// Somente LEITURA no banco. Saída: dados-locais/revisao_ca_entregas.xlsx
// com uma aba por categoria (OK, DIVERGENTE, SEM_PAR_PDF, PDF_SEM_ENTREGA,
// CA_VAZIO_AMBOS).
//
// Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/conferir-entregas-ca-pdf.mts

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import XLSX from '@e965/xlsx'

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

// ---------- tipos ----------

interface LinhaPdf {
  pagina: number
  codigoFuncionario: string
  nomeFuncionario: string
  matricula: string
  dataEntrega: string // ISO aaaa-mm-dd
  codigoMaterial: string
  descricao: string
  ca: string
  quantidade: string
  situacao: string
  tipo: string // Ent | Dev
}

interface Entrega {
  id: string
  colaborador_id: string
  item_id: string
  data_entrega: string
  quantidade: number
  matricula: string | null
  snapshot_item: { nome?: string; codigo?: string; tipo?: string; ca?: string } | null
  colaboradores: { nome_completo: string; matricula: string | null } | null
}

interface LinhaRevisao {
  entrega_id: string
  colaborador: string
  matricula: string
  data_entrega: string
  item: string
  codigo_item: string
  quantidade: number | string
  ca_sistema: string
  ca_pdf: string
  status: string
  observacao: string
}

// ---------- normalização ----------

/** Normaliza nome de item/pessoa para comparação: minúsculas, sem acento,
 *  sem sufixo "Tam. X", espaços colapsados e sem separadores sobrando. */
function norm(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/-?\s*tam\.?\s*:?\s*\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s\-–—]+$/g, '')
    .trim()
}

/** Matrícula comparável: só dígitos, sem zeros à esquerda. */
function normMatricula(m: string | null | undefined): string {
  if (!m) return ''
  const d = m.replace(/\D/g, '').replace(/^0+/, '')
  return d
}

/** Código de material comparável (numérico nos dois lados). */
function normCodigo(c: string | null | undefined): string {
  if (!c) return ''
  return String(c).trim().replace(/^0+/, '')
}

/** CA para exibição/comparação: espaços colapsados. */
function normCA(ca: string | null | undefined): string {
  return (ca ?? '').trim().replace(/\s+/g, ' ')
}

/** CA reduzido a dígitos — detecta divergência só de formatação ('38.362' vs '38362'). */
function digitosCA(ca: string): string {
  return ca.replace(/\D/g, '')
}

// ---------- carga de dados ----------

async function buscarEntregasSemRecibo(): Promise<Entrega[]> {
  const linhas: Entrega[] = []
  const PASSO = 1000
  for (let i = 0; ; i += PASSO) {
    const { data, error } = await supabase
      .from('entregas')
      .select('id, colaborador_id, item_id, data_entrega, quantidade, matricula, snapshot_item, colaboradores(nome_completo, matricula)')
      .eq('recibo_emitido', false)
      .range(i, i + PASSO - 1)
    if (error) throw new Error('entregas: ' + error.message)
    if (!data || data.length === 0) break
    linhas.push(...(data as unknown as Entrega[]))
    if (data.length < PASSO) break
  }
  return linhas
}

const pdfTodas = JSON.parse(fs.readFileSync('dados-locais/uniformes_epis_pdf_extraido.json', 'utf-8')) as LinhaPdf[]
// Linhas "Dev" são devoluções, não entregas — não participam do casamento,
// mas aparecem na aba PDF_SEM_ENTREGA para não sumirem silenciosamente.
const pdfEntregas = pdfTodas.filter((l) => l.tipo === 'Ent')
const pdfDevolucoes = pdfTodas.filter((l) => l.tipo !== 'Ent')
console.log(`PDF: ${pdfTodas.length} linhas (${pdfEntregas.length} Ent, ${pdfDevolucoes.length} Dev)`)

const entregas = await buscarEntregasSemRecibo()
console.log(`Entregas sem recibo emitido: ${entregas.length}`)

// Total com recibo (só para o resumo — ficam fora da conferência por serem imutáveis)
const { count: comRecibo } = await supabase
  .from('entregas')
  .select('id', { count: 'exact', head: true })
  .eq('recibo_emitido', true)
console.log(`Entregas COM recibo (fora da conferência): ${comRecibo ?? '?'}`)

// ---------- índices do PDF ----------

// chave -> linhas do PDF (consumo único por linha)
const usadas = new Set<LinhaPdf>()
const idxMatData = new Map<string, LinhaPdf[]>()
const idxNomeData = new Map<string, LinhaPdf[]>()

for (const l of pdfEntregas) {
  const kM = `${normMatricula(l.matricula)}|${l.dataEntrega}`
  if (!idxMatData.has(kM)) idxMatData.set(kM, [])
  idxMatData.get(kM)!.push(l)
  const kN = `${norm(l.nomeFuncionario)}|${l.dataEntrega}`
  if (!idxNomeData.has(kN)) idxNomeData.set(kN, [])
  idxNomeData.get(kN)!.push(l)
}

/** Procura par não-consumido na lista por código do material ou nome normalizado. */
function acharPar(cands: LinhaPdf[], codigo: string, nome: string): { linha: LinhaPdf; via: 'codigo' | 'nome' } | null {
  const livres = cands.filter((l) => !usadas.has(l))
  if (livres.length === 0) return null
  if (codigo) {
    const porCodigo = livres.find((l) => normCodigo(l.codigoMaterial) === codigo)
    if (porCodigo) return { linha: porCodigo, via: 'codigo' }
  }
  const porNome = livres.find((l) => norm(l.descricao) === nome)
  if (porNome) return { linha: porNome, via: 'nome' }
  return null
}

// ---------- casamento em camadas ----------

const revisao: LinhaRevisao[] = []
const camadas = { a_matricula_codigo: 0, b_matricula_nome: 0, c_nome_colaborador: 0 }

for (const e of entregas) {
  const snap = e.snapshot_item ?? {}
  const nomeItem = snap.nome ?? ''
  const codigoItem = normCodigo(snap.codigo)
  const nomeItemNorm = norm(nomeItem)
  const nomeColab = e.colaboradores?.nome_completo ?? '(sem colaborador)'
  const matriculas = [...new Set([normMatricula(e.matricula), normMatricula(e.colaboradores?.matricula)].filter(Boolean))]
  const data = e.data_entrega

  let par: { linha: LinhaPdf; via: 'codigo' | 'nome' } | null = null
  let camada: keyof typeof camadas | null = null

  // Camadas a/b: matrícula (da entrega ou do colaborador) + data
  for (const mat of matriculas) {
    const cands = idxMatData.get(`${mat}|${data}`)
    if (!cands) continue
    par = acharPar(cands, codigoItem, nomeItemNorm)
    if (par) {
      camada = par.via === 'codigo' ? 'a_matricula_codigo' : 'b_matricula_nome'
      break
    }
  }

  // Camada c: nome completo do colaborador + data
  if (!par) {
    const cands = idxNomeData.get(`${norm(nomeColab)}|${data}`)
    if (cands) {
      par = acharPar(cands, codigoItem, nomeItemNorm)
      if (par) camada = 'c_nome_colaborador'
    }
  }

  const caSistema = normCA(snap.ca)

  if (!par) {
    revisao.push({
      entrega_id: e.id,
      colaborador: nomeColab,
      matricula: matriculas[0] ?? '',
      data_entrega: data,
      item: nomeItem,
      codigo_item: snap.codigo ?? '',
      quantidade: e.quantidade,
      ca_sistema: caSistema,
      ca_pdf: '',
      status: 'SEM_PAR_PDF',
      observacao: '',
    })
    continue
  }

  camadas[camada!]++
  usadas.add(par.linha)

  const caPdf = normCA(par.linha.ca)
  const obs: string[] = [`par via ${camada} (${par.via})`, `pág ${par.linha.pagina}`]
  if (Number(par.linha.quantidade) !== Number(e.quantidade)) {
    obs.push(`quantidade diverge: sistema=${e.quantidade} pdf=${par.linha.quantidade}`)
  }

  let status: string
  if (caSistema === '' && caPdf === '') {
    status = 'CA_VAZIO_AMBOS' // uniformes — esperado
  } else if (caSistema === caPdf) {
    status = 'OK'
  } else if (digitosCA(caSistema) !== '' && digitosCA(caSistema) === digitosCA(caPdf)) {
    status = 'OK'
    obs.push('OK_FORMATACAO: CA difere só por pontuação')
  } else {
    status = 'DIVERGENTE' // o PDF é a verdade da época
  }

  revisao.push({
    entrega_id: e.id,
    colaborador: nomeColab,
    matricula: matriculas[0] ?? normMatricula(par.linha.matricula),
    data_entrega: data,
    item: nomeItem,
    codigo_item: snap.codigo ?? '',
    quantidade: e.quantidade,
    ca_sistema: caSistema,
    ca_pdf: caPdf,
    status,
    observacao: obs.join(' | '),
  })
}

// Linhas do PDF (Ent) que sobraram sem entrega no sistema + devoluções
for (const l of pdfEntregas) {
  if (usadas.has(l)) continue
  revisao.push({
    entrega_id: '',
    colaborador: l.nomeFuncionario,
    matricula: normMatricula(l.matricula),
    data_entrega: l.dataEntrega,
    item: l.descricao,
    codigo_item: l.codigoMaterial,
    quantidade: l.quantidade,
    ca_sistema: '',
    ca_pdf: normCA(l.ca),
    status: 'PDF_SEM_ENTREGA',
    observacao: `pág ${l.pagina} — possível furo da importação histórica`,
  })
}
for (const l of pdfDevolucoes) {
  revisao.push({
    entrega_id: '',
    colaborador: l.nomeFuncionario,
    matricula: normMatricula(l.matricula),
    data_entrega: l.dataEntrega,
    item: l.descricao,
    codigo_item: l.codigoMaterial,
    quantidade: l.quantidade,
    ca_sistema: '',
    ca_pdf: normCA(l.ca),
    status: 'PDF_SEM_ENTREGA',
    observacao: `pág ${l.pagina} — linha de devolução (Dev) no PDF`,
  })
}

// ---------- planilha ----------

const ABAS = ['OK', 'DIVERGENTE', 'SEM_PAR_PDF', 'PDF_SEM_ENTREGA', 'CA_VAZIO_AMBOS'] as const
const wb = XLSX.utils.book_new()
for (const aba of ABAS) {
  const linhas = revisao.filter((r) => r.status === aba)
  const ws = XLSX.utils.json_to_sheet(
    linhas.length
      ? linhas
      : [{ entrega_id: '', colaborador: '', matricula: '', data_entrega: '', item: '', codigo_item: '', quantidade: '', ca_sistema: '', ca_pdf: '', status: aba, observacao: '(nenhuma linha)' }]
  )
  XLSX.utils.book_append_sheet(wb, ws, aba)
}
fs.mkdirSync('dados-locais', { recursive: true })
const arquivo = 'dados-locais/revisao_ca_entregas.xlsx'
// XLSX.writeFile falha em alguns ambientes Windows — grava via buffer
fs.writeFileSync(arquivo, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

// ---------- resumo ----------

const contagem = Object.fromEntries(ABAS.map((a) => [a, revisao.filter((r) => r.status === a).length]))
const comPar = contagem.OK + contagem.DIVERGENTE + contagem.CA_VAZIO_AMBOS
const cobertura = entregas.length ? ((comPar / entregas.length) * 100).toFixed(1) : '0.0'

console.log('\n=== RESUMO DA CONFERÊNCIA ===')
for (const a of ABAS) console.log(`${a}: ${contagem[a]}`)
console.log(`\nCamadas de casamento:`)
console.log(`  a) matrícula + data + código do material: ${camadas.a_matricula_codigo}`)
console.log(`  b) matrícula + data + nome do item: ${camadas.b_matricula_nome}`)
console.log(`  c) nome do colaborador + data + código/nome: ${camadas.c_nome_colaborador}`)
console.log(`\nCobertura do PDF sobre entregas sem recibo: ${comPar}/${entregas.length} = ${cobertura}%`)
console.log(`Planilha: ${arquivo}`)

const divergentes = revisao.filter((r) => r.status === 'DIVERGENTE')
console.log(`\n--- 10 exemplos DIVERGENTE (de ${divergentes.length}) ---`)
for (const d of divergentes.slice(0, 10)) {
  console.log(`${d.data_entrega} | ${d.colaborador} | ${d.item} | CA sistema='${d.ca_sistema}' vs PDF='${d.ca_pdf}'`)
}
const semPar = revisao.filter((r) => r.status === 'SEM_PAR_PDF')
console.log(`\n--- 10 exemplos SEM_PAR_PDF (de ${semPar.length}) ---`)
for (const s of semPar.slice(0, 10)) {
  console.log(`${s.data_entrega} | ${s.colaborador} (mat ${s.matricula}) | ${s.item} | CA sistema='${s.ca_sistema}'`)
}
