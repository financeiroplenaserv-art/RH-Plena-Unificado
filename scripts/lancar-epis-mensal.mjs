// Lança as entregas de EPI do mês na tabela `entregas`, reproduzindo
// exatamente o que o Lançamento Rápido grava
// (src/pages/ceu/CeuLancamentoRapidoPage.tsx): data escolhida (padrão =
// dia 1 do mês corrente), situação "Troca", snapshot_item com a foto do
// item. NÃO emite recibo (recibo_emitido fica false).
//
// Roteiro completo do lançamento mensal: docs/LANCAMENTO_MENSAL_EPIS.md
//
// Uso:
//   node scripts/lancar-epis-mensal.mjs --csv=<arquivo.csv> [--data=AAAA-MM-DD] [--aplicar]
//
//   --csv     obrigatório; colunas separadas por ';':
//             colaborador;quantidade;item;tamanho;descricao_original
//   --data    opcional; padrão = dia 1 do mês corrente (horário de Brasília)
//   --aplicar sem ele, roda em dry-run (só relatório, nada é gravado)
//
// Antes de gravar, salva backup dos IDs inseridos em dados-locais/.
// Guarda anti-duplicidade: linhas já existentes na data (mesmo
// colaborador+item+quantidade) são puladas.

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

// ---------- argumentos ----------
const APLICAR = process.argv.includes('--aplicar')
function argValor(nome) {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return arg ? arg.slice(nome.length + 3) : null
}

const CSV = argValor('csv')
if (!CSV) {
  console.error('Informe o arquivo: --csv=<arquivo.csv> (ver docs/LANCAMENTO_MENSAL_EPIS.md)')
  process.exit(1)
}
if (!fs.existsSync(CSV)) {
  console.error(`Arquivo não encontrado: ${CSV}`)
  process.exit(1)
}

function primeiroDiaMesCorrente() {
  const hojeSP = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return hojeSP.slice(0, 8) + '01'
}

const DATA_ENTREGA = argValor('data') || primeiroDiaMesCorrente()
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATA_ENTREGA)) {
  console.error(`Data inválida: "${DATA_ENTREGA}" (use AAAA-MM-DD)`)
  process.exit(1)
}
const COMPETENCIA = DATA_ENTREGA.slice(0, 7).replace('-', '')

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
const linhasCsv = fs
  .readFileSync(CSV, 'utf-8')
  .replace(/^﻿/, '')
  .split(/\r?\n/)
  .filter((l) => l.trim())
const registros = []
for (const linha of linhasCsv.slice(1)) {
  const [colaborador, quantidade, item, tamanho, descricao_original] = linha.split(';')
  registros.push({
    colaborador: (colaborador || '').trim(),
    quantidade: parseInt(quantidade, 10),
    item: (item || '').trim(),
    tamanho: (tamanho || '').trim(),
    descricao_original: (descricao_original || '').trim(),
  })
}
console.log(`CSV ${CSV}: ${registros.length} linhas de entrega — data de entrega ${DATA_ENTREGA}`)

// ---------- matching de itens ----------
// Palavra-chave que identifica o item no catálogo + como comparar o tamanho.
function chaveBuscaItem(item) {
  const n = norm(item)
  if (n.includes('nitril')) return { kw: 'nitril' }
  if (n.includes('pvc')) return { kw: 'pvc' }
  if (n.includes('pu')) return { kw: ' pu' } // evita casar com outras palavras
  if (n.includes('latex')) return { kw: 'latex' }
  if (n.includes('pigment')) return { kw: 'pigment' }
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

// ---------- divergência de tamanho (selo vermelho do Lançamento Rápido) ----------
// Espelho das funções puras de src/lib/ceu/tamanhosPuro.ts — mesma regra da
// tela: compara o tamanho embutido no nome do item escolhido com a medida do
// cadastro CEU (ceu_tamanhos). Só reporta; NUNCA bloqueia o lançamento.

// Categoria da medida pelo nome do item (luva/camisa/calça/calçado).
function categoriaTamanho(nomeItem) {
  const nome = nomeItem.toLowerCase()
  if (nome.includes('luva')) return 'luva'
  if (nome.includes('camisa') || nome.includes('jaleco')) return 'camisa'
  if (nome.includes('calça') || nome.includes('calca')) return 'calca'
  if (/bota|botina|sapato|calçado|calcado|tênis|tenis|sandália|sandalia/.test(nome)) return 'calcado'
  return null
}

// Tamanho embutido no nome do item (maiúsculas; número de 2 dígitos).
function tamanhoDoNomeItemTela(nomeItem) {
  const m = nomeItem.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) return m[1].toUpperCase()
  const tokens = nomeItem.toUpperCase().split(/[\s\-–—]+/).filter(Boolean)
  const ultimo = tokens[tokens.length - 1]
  if (!ultimo) return null
  if (/^\d{2}$/.test(ultimo)) return ultimo
  if (['P', 'M', 'G', 'GG', 'EG', 'XG', 'XGG', 'PP'].includes(ultimo)) return ultimo
  return null
}

const ROTULO_CATEGORIA = { luva: 'luva', camisa: 'camisa', calca: 'calça', calcado: 'calçado' }

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

// Medidas do cadastro CEU (migration 096) — referência do relatório de
// divergências de tamanho (mesmo selo vermelho do Lançamento Rápido).
const tamanhos = await buscarTudo(
  'ceu_tamanhos',
  'colaborador_id, tamanho_camisa, tamanho_calca, tamanho_calcado, tamanho_luva'
)
const mapaTamanhos = new Map(tamanhos.map((t) => [t.colaborador_id, t]))

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
    // fallback 1: nome do CSV pode estar truncado (ex.: "MARCOS VINÍCIUS STELLET MONT")
    candidatos = colaboradores.filter((c) => {
      const n = norm(c.nome_completo)
      return n.startsWith(norm(nomeLimpo)) || norm(nomeLimpo).startsWith(n)
    })
  }
  if (candidatos.length === 0) {
    // fallback 2: preposições a mais/a menos ("JEAN CARLOS PINTO DE SOUZA" ×
    // cadastro "JEAN CARLOS PINTO SOUZA") — casa por conjunto de palavras;
    // só aceita quando converge para um único colaborador (senão é ambíguo)
    const tokensCsv = norm(nomeLimpo).split(' ').filter(Boolean)
    candidatos = colaboradores.filter((c) => {
      const tokensCad = norm(c.nome_completo).split(' ').filter(Boolean)
      return (
        tokensCsv.every((t) => tokensCad.includes(t)) ||
        tokensCad.every((t) => tokensCsv.includes(t))
      )
    })
    if (candidatos.length > 1) {
      const ativos = candidatos.filter((c) => c.status === 'Ativo')
      candidatos = ativos.length === 1 ? ativos : []
    }
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

// divergências de tamanho — mesma regra do selo vermelho do Lançamento
// Rápido: tamanho do item escolhido × medida do cadastro CEU
const divergencias = []
for (const p of plano) {
  const t = mapaTamanhos.get(p.colab.id)
  if (!t) continue
  const cat = categoriaTamanho(p.item.nome)
  if (!cat) continue
  const sugerido = (t[`tamanho_${cat}`] || '').trim().toUpperCase()
  const tamItem = tamanhoDoNomeItemTela(p.item.nome)
  if (sugerido && tamItem && sugerido !== tamItem) {
    divergencias.push({ p, cat, sugerido, tamItem })
  }
}

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

console.log('\n--- DIVERGÊNCIAS DE TAMANHO (ficariam vermelhas no Lançamento Rápido — só alerta, não bloqueia) ---')
if (divergencias.length === 0) {
  console.log('  nenhuma')
} else {
  for (const d of divergencias) {
    console.log(
      `  ${d.p.colab.nome_completo} [${d.p.colab.matricula}] → ${d.p.reg.quantidade}x ${d.p.item.nome} — cadastro indica ${ROTULO_CATEGORIA[d.cat]} ${d.sugerido}`
    )
  }
  // salva a lista em arquivo (dados-locais/) para consulta/encaminhamento;
  // o BOM (\ufeff) faz o Excel reconhecer o UTF-8 e separar as colunas
  const hojeDiv = new Date().toISOString().slice(0, 10)
  const arqDiv = `dados-locais/divergencias_tamanho_${COMPETENCIA}_${hojeDiv}.csv`
  const linhasDiv = ['colaborador;matricula;quantidade;item_escolhido;tamanho_item;medida_cadastro']
  for (const d of divergencias) {
    linhasDiv.push(
      [
        d.p.colab.nome_completo,
        d.p.colab.matricula,
        d.p.reg.quantidade,
        d.p.item.nome,
        d.tamItem,
        `${ROTULO_CATEGORIA[d.cat]} ${d.sugerido}`,
      ].join(';')
    )
  }
  fs.writeFileSync(arqDiv, '﻿' + linhasDiv.join('\n') + '\n')
  console.log(`  (lista salva em ${arqDiv})`)
}

// guarda anti-duplicidade: entregas já existentes na data para os mesmos pares
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
const arquivoBackup = `dados-locais/backup_epis_${COMPETENCIA}_entregas_${hoje}.json`
fs.writeFileSync(arquivoBackup, JSON.stringify(inseridas, null, 2))
console.log(`\n✔ ${inseridas.length} entregas inseridas. Backup dos IDs em ${arquivoBackup}`)
if (divergencias.length) console.log(`⚠ ${divergencias.length} divergência(s) de tamanho — ver seção acima.`)
if (problemas.length) console.log(`⚠ ${problemas.length} linha(s) ficaram de fora — ver lista acima.`)
