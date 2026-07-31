// Preenche ceu_tamanhos dos colaboradores ATIVOS a partir do histórico de
// entregas: para cada categoria (camisa/blusa, calça, calçado, luva) vale o
// tamanho da entrega MAIS RECENTE cujo item tenha tamanho identificável no
// nome ("... - Tam. G" ou sufixo "G"/"42"). Gera planilha de revisão em
// dados-locais/ e aplica upsert na ceu_tamanhos.
//
// Uso: node scripts/preencher-tamanhos-ceu.mjs

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import XLSX from '@e965/xlsx'

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

const CATEGORIAS = [
  { campo: 'tamanho_luva', regex: /LUVA/ },
  { campo: 'tamanho_calcado', regex: /BOTA|BOTINA|SAPATO/ },
  { campo: 'tamanho_calca', regex: /CALÇA|CALCA/ },
  { campo: 'tamanho_camisa', regex: /CAMISA|BLUSA|JALECO|TERNO|CASACO|BLAZER/ },
]

function classificar(nome) {
  const n = nome.toUpperCase()
  for (const c of CATEGORIAS) if (c.regex.test(n)) return c.campo
  return null
}

const LETRAS_TAMANHO = ['P', 'M', 'G', 'GG', 'EG', 'XG', 'XGG', 'PP']

function extrairTamanho(nome, campo) {
  // Padrão principal: "... - Tam. G" / "Tam. 42"
  const m = nome.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) return m[1].toUpperCase()
  // Sufixo no próprio nome (importação antiga): "LUVA LATEX M", "BOTINA COM ELÁSTICO 40"
  const tokens = nome.toUpperCase().split(/[\s\-–—]+/).filter(Boolean)
  const ultimo = tokens[tokens.length - 1]
  if (!ultimo) return null
  if (/^\d{2}$/.test(ultimo) && (campo === 'tamanho_calcado' || campo === 'tamanho_calca')) {
    const n = parseInt(ultimo, 10)
    if (n >= 33 && n <= 54) return ultimo
  }
  if (LETRAS_TAMANHO.includes(ultimo)) return ultimo
  return null
}

/** Nome mais fiel do item entregue: importações antigas guardam o nome original na observação. */
function nomeDoItem(e, nomeItemCadastro) {
  const obs = (e.observacao || '').match(/item:\s*(.+)$/i)
  if (obs) return obs[1].trim()
  return e.snapshot_item?.nome || nomeItemCadastro || ''
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

const colaboradores = await buscarTudo('colaboradores', 'id, nome_completo, matricula, status')
const ativos = new Map(colaboradores.filter((c) => c.status === 'Ativo').map((c) => [c.id, c]))
console.log(`Colaboradores ativos: ${ativos.size}`)

const itens = await buscarTudo('itens', 'id, nome')
const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))

const entregas = await buscarTudo('entregas', 'colaborador_id, item_id, data_entrega, observacao, snapshot_item')
console.log(`Entregas lidas: ${entregas.length}`)

// Percorre em ordem cronológica — o último tamanho gravado por categoria vence
entregas.sort((a, b) => (a.data_entrega < b.data_entrega ? -1 : 1))

const tamanhos = new Map() // colaborador_id -> { campo: tamanho }
const fontes = new Map() // `${colab}|${campo}` -> { data, item }
let semCategoria = 0
let semTamanhoIdentificavel = 0

for (const e of entregas) {
  if (!ativos.has(e.colaborador_id)) continue
  const nome = nomeDoItem(e, nomeItem.get(e.item_id))
  if (!nome) { semCategoria++; continue }
  const campo = classificar(nome)
  if (!campo) { semCategoria++; continue }
  const tamanho = extrairTamanho(nome, campo)
  if (!tamanho) { semTamanhoIdentificavel++; continue }
  if (!tamanhos.has(e.colaborador_id)) tamanhos.set(e.colaborador_id, {})
  tamanhos.get(e.colaborador_id)[campo] = tamanho
  fontes.set(`${e.colaborador_id}|${campo}`, { data: e.data_entrega, item: nome })
}

console.log(`Entregas fora das 4 categorias (ou sem nome): ${semCategoria}`)
console.log(`Entregas das categorias SEM tamanho no nome do item: ${semTamanhoIdentificavel}`)

// Monta linhas do resultado + planilha de revisão
const revisao = []
let comAlgum = 0
for (const [id, t] of tamanhos) {
  const c = ativos.get(id)
  const fonte = (campo) => {
    const f = fontes.get(`${id}|${campo}`)
    return f ? `${f.data} — ${f.item}` : ''
  }
  revisao.push({
    'Matrícula': c.matricula,
    'Colaborador': c.nome_completo,
    'Camisa': t.tamanho_camisa || '',
    'Fonte Camisa': fonte('tamanho_camisa'),
    'Calça': t.tamanho_calca || '',
    'Fonte Calça': fonte('tamanho_calca'),
    'Calçado': t.tamanho_calcado || '',
    'Fonte Calçado': fonte('tamanho_calcado'),
    'Luva': t.tamanho_luva || '',
    'Fonte Luva': fonte('tamanho_luva'),
  })
  comAlgum++
}
revisao.sort((a, b) => a['Colaborador'].localeCompare(b['Colaborador']))

const ws = XLSX.utils.json_to_sheet(revisao)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Tamanhos derivados')
fs.mkdirSync('dados-locais', { recursive: true })
const arquivoRevisao = 'dados-locais/revisao_tamanhos_ceu.xlsx'
// XLSX.writeFile falha em alguns ambientes Windows — grava via buffer
fs.writeFileSync(arquivoRevisao, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`Planilha de revisão: ${arquivoRevisao} (${revisao.length} colaboradores)`)

// Upsert na ceu_tamanhos (só quem tem pelo menos 1 tamanho identificado)
const payloads = [...tamanhos.entries()].map(([colaborador_id, t]) => ({
  colaborador_id,
  tamanho_camisa: t.tamanho_camisa || null,
  tamanho_calca: t.tamanho_calca || null,
  tamanho_calcado: t.tamanho_calcado || null,
  tamanho_luva: t.tamanho_luva || null,
  updated_at: new Date().toISOString(),
}))

let gravados = 0
const LOTE = 200
for (let i = 0; i < payloads.length; i += LOTE) {
  const { error } = await supabase
    .from('ceu_tamanhos')
    .upsert(payloads.slice(i, i + LOTE), { onConflict: 'colaborador_id' })
  if (error) throw new Error('upsert ceu_tamanhos: ' + error.message)
  gravados += Math.min(LOTE, payloads.length - i)
}

console.log(`\n=== RESULTADO ===`)
console.log(`Ativos com algum tamanho preenchido: ${comAlgum} de ${ativos.size}`)
console.log(`Registros gravados na ceu_tamanhos: ${gravados}`)
const semNada = [...ativos.values()].filter((c) => !tamanhos.has(c.id))
console.log(`Ativos SEM nenhuma entrega com tamanho identificável: ${semNada.length}`)
if (semNada.length > 0 && semNada.length <= 60) {
  for (const c of semNada) console.log(`  - ${c.nome_completo} (${c.matricula})`)
}
