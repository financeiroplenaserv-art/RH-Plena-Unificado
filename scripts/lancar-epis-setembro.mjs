// Lança as entregas de EPI de setembro (docs/epis_setembro_lancamentos.csv)
// na tabela `entregas`, reproduzindo exatamente o que o Lançamento Rápido
// grava (src/pages/ceu/CeuLancamentoRapidoPage.tsx): data 01/09, situação
// "Troca", snapshot_item com a foto do item. NÃO emite recibo
// (recibo_emitido fica false).
//
// Uso:
//   node scripts/lancar-epis-setembro.mjs            # dry-run: só relatório
//   node scripts/lancar-epis-setembro.mjs --aplicar  # grava no banco
//
// Antes de gravar, salva backup dos IDs inseridos em dados-locais/.

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function carregarEnv(caminho) {
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
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

const APLICAR = process.argv.includes('--aplicar')
const DATA_ENTREGA = '2026-09-01'
const CSV = 'docs/epis_setembro_lancamentos.csv'

function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function buscarTudo(tabela, colunas) {
  const linhas = []
  const PASSO = 1000
  for (let i = 0; ; i += PASSO) {
    const { data, error } = await supabase.from(tabela).select(colunas).range(i, i + PASSO - 1)
    if (error) throw new Error(`${tabela}: ${error.message}`)
    if (!data || data.length === 0) break
    linhas.push(...data)
    if (data.length < PASSO) break
  }
  return linhas
}

// ---------- leitura do CSV ----------
const linhasCsv = fs.readFileSync(CSV, 'utf-8').split(/\r?\n/).filter((l) => l.trim())
const registros = []
for (const linha of linhasCsv.slice(1)) {
  const [colaborador, quantidade, item, tamanho, descricao_original] = linha.split(';')
  registros.push({
    colaborador: colaborador.trim(),
    quantidade: parseInt(quantidade, 10),
    item: (item || '').trim(),
    tamanho: (tamanho || '').trim(),
    descricao_original: (descricao_original || '').trim(),
  })
}
console.log(`CSV: ${registros.length} linhas de entrega`)

// ---------- matching de itens ----------
// Palavra-chave que identifica o item no catálogo + como comparar o tamanho.
function chaveBuscaItem(item) {
  const n = norm(item)
  if (n.includes('nitril')) return { kw: 'nitril' }
  if (n.includes('pvc')) return { kw: 'pvc' }
  if (n.includes('pu')) return { kw: ' pu' } // evita casar com outras palavras
  if (n.includes('latex')) return { kw: 'latex' }
  if (n.includes('botina')) return { kw: 'botina' }
  if (n === 'bota' || n.startsWith('bota')) return { kw: 'bota' }
  if (n.includes('mascara')) return { kw: 'mascara' }
  if (n.includes('oculos')) return { kw: 'oculos' }
  if (n.includes('avental')) return { kw: 'avental' }
  if (n.includes('protetor')) return { kw: 'protetor' }
  return { kw: n }
}

function normTamanho(t) {
  const n = norm(t).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (['extra g', 'xg', 'eg', 'xgg', 'gg'].includes(n)) return 'eg'
  if (n === 'g' || n === 'g verde') return 'g'
  if (n === 'm' || n === 'm verde') return 'm'
  if (n === 'p' || n === 'p verde') return 'p'
  if (/^\d{1,2}$/.test(n)) return n
  return n
}

const LETRAS_TAM = ['p', 'm', 'g', 'gg', 'eg', 'xg', 'pp', 'xgg']

function tamanhoDoNomeItem(nome) {
  const m = nome.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) return normTamanho(m[1])
  const tokens = norm(nome).split(/[\s\-–—]+/).filter(Boolean)
  const ultimo = tokens[tokens.length - 1]
  if (!ultimo) return null
  if (/^\d{1,2}$/.test(ultimo)) return ultimo
  if (LETRAS_TAM.includes(ultimo)) return normTamanho(ultimo)
  return null
}

// Escolhas fixas confirmadas pelo histórico de entregas (item em uso atual):
// máscara → respirador com válvula (132x, última 03/09), óculos → incolor
// (111x), avental → AVENTAL liso (61x), protetor → auricular, luva PVC →
// item exato "LUVA PVC" (o kw "pvc" também casa com as botas).
const PREFERE_EXATO = {
  mascara: 'mascara respirador com valvula',
  oculos: 'oculos lente incolor',
  avental: 'avental',
  protetor: 'protetor auricular',
  pvc: 'luva pvc',
}

// Nitrílica usa numeração 8/9; o catálogo tem M/G (CA 16.314): 8→M, 9→G.
const MAPA_NUM_NITRILICA = { '7': 'p', '8': 'm', '9': 'g', '10': 'eg' }

// ---------- main ----------
const itens = await buscarTudo('itens', 'id, codigo, nome, tipo, ca, valor, prazo_uso_dias, situacao')
const itensAtivos = itens.filter((i) => i.situacao !== 'I')
console.log(`Catálogo: ${itensAtivos.length} itens ativos (${itens.length} no total)`)

const colaboradores = await buscarTudo('colaboradores', 'id, nome_completo, matricula, status')
const mapaColab = new Map()
for (const c of colaboradores) {
  const chave = norm(c.nome_completo)
  if (!mapaColab.has(chave)) mapaColab.set(chave, [])
  mapaColab.get(chave).push(c)
}

// usuario_id: usa o mesmo operador das entregas mais recentes
const { data: ultimas } = await supabase
  .from('entregas')
  .select('usuario_id')
  .order('created_at', { ascending: false })
  .limit(50)
const freq = new Map()
for (const e of ultimas || []) freq.set(e.usuario_id, (freq.get(e.usuario_id) || 0) + 1)
const usuarioId = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
const { data: perfilOp } = await supabase.from('perfis').select('id, nome, email').eq('id', usuarioId).maybeSingle()
console.log(`Operador (usuario_id): ${perfilOp?.nome || '?'} <${perfilOp?.email || '?'}> — ${usuarioId}`)

const plano = []
const problemas = []

for (const reg of registros) {
  // colaborador: ignora observações entre parênteses no nome
  const nomeLimpo = reg.colaborador.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  let candidatos = mapaColab.get(norm(nomeLimpo)) || []
  if (candidatos.length === 0) {
    // fallback: nome do CSV pode estar truncado (ex.: "MARCOS VINÍCIUS STELLET MONT")
    candidatos = colaboradores.filter((c) => {
      const n = norm(c.nome_completo)
      return n.startsWith(norm(nomeLimpo)) || norm(nomeLimpo).startsWith(n)
    })
  }
  const colab = candidatos.find((c) => c.status === 'Ativo') || candidatos[0]
  if (!colab) {
    problemas.push(`COLABORADOR NÃO ENCONTRADO: "${reg.colaborador}"`)
    continue
  }
  if (colab.status !== 'Ativo') {
    // decisão da usuária (04/09/2026): inativos/afastados ficam de fora
    problemas.push(`COLABORADOR PULADO (${colab.status}): ${colab.nome_completo} — ${reg.descricao_original}`)
    continue
  }

  // item — tamanho pode vir grudado no nome ("luva nitrílica9")
  let tamanhoCsv = reg.tamanho
  if (!tamanhoCsv) {
    const m = reg.item.match(/(\d{1,2})\s*$/)
    if (m) tamanhoCsv = m[1]
  }

  const { kw } = chaveBuscaItem(reg.item)
  let candidatosItens = itensAtivos.filter((i) => norm(i.nome).includes(kw))
  if (kw === 'bota') candidatosItens = candidatosItens.filter((i) => !norm(i.nome).includes('botina'))

  let item = null
  // 1) escolha fixa confirmada pelo histórico
  const nomePreferido = PREFERE_EXATO[kw.trim()]
  if (nomePreferido) {
    item = candidatosItens.find((i) => norm(i.nome) === nomePreferido) || null
  }
  // 2) por tamanho
  if (!item && tamanhoCsv) {
    let tam = normTamanho(tamanhoCsv)
    if (kw === 'nitril' && MAPA_NUM_NITRILICA[tam]) tam = MAPA_NUM_NITRILICA[tam]
    item = candidatosItens.find((i) => tamanhoDoNomeItem(i.nome) === tam) || null
  }
  if (!item && candidatosItens.length === 1) item = candidatosItens[0]
  if (!item && !tamanhoCsv && candidatosItens.length > 0) {
    // sem tamanho no CSV: prefere item também sem tamanho no nome
    item = candidatosItens.find((i) => !tamanhoDoNomeItem(i.nome)) || null
  }
  if (!item) {
    problemas.push(
      `ITEM NÃO RESOLVIDO: "${reg.descricao_original}" (busca "${kw}"${tamanhoCsv ? ` tam ${normTamanho(tamanhoCsv)}` : ''}) — candidatos: ${candidatosItens.map((i) => i.nome).join(' | ') || 'nenhum'}`
    )
    continue
  }

  plano.push({ reg, colab, item })
}

console.log(`\nPlano: ${plano.length} entregas prontas, ${problemas.length} problema(s)`)

// resumo por item
const porItem = new Map()
for (const p of plano) {
  const k = `${p.item.nome} [${p.item.tipo}${p.item.ca ? ` CA ${p.item.ca}` : ''}]`
  porItem.set(k, (porItem.get(k) || 0) + p.reg.quantidade)
}
console.log('\n--- Itens que serão entregues (qtd total) ---')
for (const [k, v] of [...porItem.entries()].sort()) console.log(`  ${v}x ${k}`)

console.log('\n--- Plano linha a linha (colaborador → item) ---')
for (const p of plano) {
  console.log(`  ${p.colab.nome_completo} [${p.colab.matricula}] → ${p.reg.quantidade}x ${p.item.nome}`)
}

if (problemas.length) {
  console.log('\n--- PROBLEMAS (linhas fora do plano) ---')
  for (const p of problemas) console.log('  ' + p)
}

// guarda anti-duplicidade: entregas já existentes em 01/09 para os mesmos pares
const idsColab = [...new Set(plano.map((p) => p.colab.id))]
const existentes = []
for (let i = 0; i < idsColab.length; i += 100) {
  const { data, error } = await supabase
    .from('entregas')
    .select('id, colaborador_id, item_id, quantidade')
    .eq('data_entrega', DATA_ENTREGA)
    .in('colaborador_id', idsColab.slice(i, i + 100))
  if (error) throw new Error('verificação de duplicidade: ' + error.message)
  existentes.push(...(data || []))
}
const chaveExistente = new Set(existentes.map((e) => `${e.colaborador_id}|${e.item_id}|${e.quantidade}`))
const aInserir = plano.filter((p) => !chaveExistente.has(`${p.colab.id}|${p.item.id}|${p.reg.quantidade}`))
const jaExistiam = plano.length - aInserir.length
if (jaExistiam > 0) console.log(`\n⚠ ${jaExistiam} linha(s) já existem em ${DATA_ENTREGA} (mesmo colaborador+item+quantidade) e serão PULADAS`)

if (!APLICAR) {
  console.log('\nDry-run — nada foi gravado. Rode com --aplicar para inserir.')
  process.exit(problemas.length ? 1 : 0)
}

if (aInserir.length === 0) {
  console.log('Nada a inserir.')
  process.exit(0)
}

const payloads = aInserir.map(({ reg, colab, item }) => ({
  colaborador_id: colab.id,
  item_id: item.id,
  data_entrega: DATA_ENTREGA,
  quantidade: reg.quantidade,
  situacao: 'Troca',
  observacao: 'Troca',
  matricula: colab.matricula,
  usuario_id: usuarioId,
  snapshot_item: {
    nome: item.nome,
    codigo: item.codigo || '',
    tipo: item.tipo,
    ca: item.ca || '',
    valor: item.valor || null,
    prazo_uso_dias: item.prazo_uso_dias || null,
  },
}))

const { data: inseridas, error } = await supabase
  .from('entregas')
  .insert(payloads)
  .select('id, colaborador_id, item_id, data_entrega, quantidade, situacao')
if (error) {
  console.error('ERRO ao inserir:', error.message)
  process.exit(1)
}

const hoje = new Date().toISOString().slice(0, 10)
const arquivoBackup = `dados-locais/backup_epis_setembro_entregas_${hoje}.json`
fs.writeFileSync(arquivoBackup, JSON.stringify(inseridas, null, 2))
console.log(`\n✔ ${inseridas.length} entregas inseridas. Backup dos IDs em ${arquivoBackup}`)
if (problemas.length) console.log(`⚠ ${problemas.length} linha(s) ficaram de fora — ver lista acima.`)
