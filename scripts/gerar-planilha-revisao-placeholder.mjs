// Gera a planilha de revisão humana das ocorrências vinculadas ao colaborador
// placeholder "OCORRENCIAS HISTORICAS - NAO IDENTIFICADO" (matrícula 999999).
// SOMENTE LEITURA no banco — nenhum UPDATE/INSERT/DELETE é executado.
// Saída: dados-locais/revisao_placeholder_331.xlsx
import { createClient } from '@supabase/supabase-js'
import * as XLSX from '@e965/xlsx'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias')
  process.exit(1)
}
const supabase = createClient(url, key)

// ---------- Normalização e similaridade ----------

function normalizar(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove acentos (U+0300–U+036F)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function tokens(str) {
  return normalizar(str).split(' ').filter(t => t.length > 0)
}

// Dice coefficient sobre bigramas da string completa
function diceBigramas(a, b) {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigramas = (s) => {
    const mapa = new Map()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      mapa.set(bg, (mapa.get(bg) || 0) + 1)
    }
    return mapa
  }
  const mapaA = bigramas(a)
  const mapaB = bigramas(b)
  let inter = 0
  for (const [bg, qtdA] of mapaA) {
    if (mapaB.has(bg)) inter += Math.min(qtdA, mapaB.get(bg))
  }
  return (2 * inter) / (a.length - 1 + (b.length - 1))
}

// Dice sobre conjuntos de tokens — independe da ordem (cobre nomes invertidos)
function diceTokens(tokA, tokB) {
  if (tokA.length === 0 || tokB.length === 0) return 0
  const setB = new Set(tokB)
  const usados = new Set()
  let inter = 0
  for (const t of new Set(tokA)) {
    if (setB.has(t) && !usados.has(t)) {
      inter++
      usados.add(t)
    }
  }
  return (2 * inter) / (new Set(tokA).size + setB.size)
}

function scoreSimilaridade(nomeNormA, tokA, nomeNormB, tokB) {
  return Math.max(diceBigramas(nomeNormA, nomeNormB), diceTokens(tokA, tokB))
}

// Score mínimo para um candidato entrar na planilha
const SCORE_MINIMO = 0.45

// ---------- Busca paginada genérica ----------

async function buscarTudo(tabela, colunas, filtro) {
  const linhas = []
  let pagina = 0
  while (true) {
    let query = supabase.from(tabela).select(colunas).range(pagina * 1000, (pagina + 1) * 1000 - 1)
    if (filtro) query = filtro(query)
    const { data, error } = await query
    if (error) {
      console.error(`Erro ao buscar ${tabela}:`, error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    linhas.push(...data)
    if (data.length < 1000) break
    pagina++
  }
  return linhas
}

// ---------- Main ----------

async function main() {
  console.log('=== Geração da planilha de revisão do placeholder (SOMENTE LEITURA) ===\n')

  // 1. Localiza o placeholder pela matrícula
  const { data: placeholders, error: erroPh } = await supabase
    .from('colaboradores')
    .select('id, nome_completo, matricula, status')
    .eq('matricula', '999999')
  if (erroPh) {
    console.error('Erro ao localizar placeholder:', erroPh.message)
    process.exit(1)
  }
  if (!placeholders || placeholders.length === 0) {
    console.error('Placeholder com matrícula 999999 não encontrado.')
    process.exit(1)
  }
  const placeholder = placeholders[0]
  console.log(`Placeholder: ${placeholder.nome_completo} (matrícula ${placeholder.matricula})`)

  // 2. Ocorrências do placeholder — só leitura do campo colaborador_nome
  const ocorrencias = await buscarTudo('ocorrencias', 'colaborador_nome', (q) =>
    q.eq('colaborador_id', placeholder.id)
  )
  console.log(`Ocorrências vinculadas ao placeholder: ${ocorrencias.length}`)

  // Agrupa por nome normalizado, mantendo a grafia crua mais frequente para exibição
  const grupos = new Map() // nomeNorm -> { exibicao: Map<raw, qtd>, total }
  let semNome = 0
  for (const oc of ocorrencias) {
    const raw = String(oc.colaborador_nome || '').trim()
    if (!raw) {
      semNome++
      continue
    }
    const norm = normalizar(raw)
    if (!grupos.has(norm)) grupos.set(norm, { variantes: new Map(), total: 0 })
    const g = grupos.get(norm)
    g.variantes.set(raw, (g.variantes.get(raw) || 0) + 1)
    g.total++
  }
  const nomes = [...grupos.entries()].map(([norm, g]) => {
    const exibicao = [...g.variantes.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return { norm, exibicao, qtd: g.total, variantes: g.variantes.size }
  })
  nomes.sort((a, b) => b.qtd - a.qtd)
  console.log(`Nomes distintos (normalizados): ${nomes.length}`)
  if (semNome > 0) console.log(`Ocorrências sem colaborador_nome: ${semNome}`)

  // 3. Todos os colaboradores (ativos e inativos), exceto o placeholder
  const colaboradores = (
    await buscarTudo('colaboradores', 'id, matricula, nome_completo, status, cpf')
  ).filter((c) => c.id !== placeholder.id)
  console.log(`Colaboradores cadastrados (candidatos): ${colaboradores.length}`)

  const candidatos = colaboradores.map((c) => ({
    ...c,
    norm: normalizar(c.nome_completo),
    tok: tokens(c.nome_completo),
  }))

  // 4. Matching por nome
  const linhas = []
  let qtdExato = 0
  let qtdSoFuzzy = 0
  let qtdSemCandidato = 0
  const duvidosos = []

  for (const nome of nomes) {
    const tokNome = tokens(nome.exibicao)
    const avaliados = []
    for (const cand of candidatos) {
      if (cand.norm === nome.norm) {
        avaliados.push({ cand, score: 1, tipo: 'exato' })
      } else {
        const score = scoreSimilaridade(nome.norm, tokNome, cand.norm, cand.tok)
        if (score >= SCORE_MINIMO) avaliados.push({ cand, score, tipo: 'fuzzy' })
      }
    }
    avaliados.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const ativo = (x) => (String(x.cand.status).toLowerCase() === 'ativo' ? 0 : 1)
      if (ativo(a) !== ativo(b)) return ativo(a) - ativo(b)
      return a.cand.nome_completo.localeCompare(b.cand.nome_completo)
    })
    const top = avaliados.slice(0, 3)

    const exatos = avaliados.filter((a) => a.tipo === 'exato')
    const observacoes = []
    if (exatos.length > 1) observacoes.push(`${exatos.length} matches exatos (possíveis homônimos) — verificar CPF/matrícula`)
    if (nome.variantes > 1) observacoes.push(`${nome.variantes} grafias diferentes agrupadas`)
    if (top.length === 0) observacoes.push('nenhum candidato acima do score mínimo')

    if (top.length > 0 && top[0].tipo === 'exato') qtdExato++
    else if (top.length > 0) qtdSoFuzzy++
    else qtdSemCandidato++

    // Casos duvidosos: melhor candidato é fuzzy com score intermediário
    if (top.length > 0 && top[0].tipo === 'fuzzy' && top[0].score >= 0.5 && top[0].score < 0.8) {
      duvidosos.push({
        nome: nome.exibicao,
        qtd: nome.qtd,
        candidato: `${top[0].cand.nome_completo} — ${top[0].cand.matricula} — ${top[0].cand.status}`,
        score: top[0].score,
      })
    }

    const fmtCand = (a) => (a ? `${a.cand.nome_completo} — ${a.cand.matricula} — ${a.cand.status}` : '')
    linhas.push({
      nome: nome.exibicao,
      qtd: nome.qtd,
      c1: fmtCand(top[0]),
      t1: top[0] ? top[0].tipo : '',
      s1: top[0] ? Math.round(top[0].score * 100) / 100 : '',
      c2: fmtCand(top[1]),
      s2: top[1] ? Math.round(top[1].score * 100) / 100 : '',
      c3: fmtCand(top[2]),
      s3: top[2] ? Math.round(top[2].score * 100) / 100 : '',
      decisao: '',
      obs: observacoes.join('; '),
    })
  }

  // 5. Gera o XLSX
  const cabecalho = [
    'Nome na ocorrência',
    'Qtd ocorrências',
    'Candidato 1 (nome — matrícula — status)',
    'Tipo match 1',
    'Score 1',
    'Candidato 2',
    'Score 2',
    'Candidato 3',
    'Score 3',
    'DECISÃO',
    'Observação',
  ]
  const aoa = [
    cabecalho,
    ...linhas.map((l) => [l.nome, l.qtd, l.c1, l.t1, l.s1, l.c2, l.s2, l.c3, l.s3, l.decisao, l.obs]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 42 }, // nome na ocorrência
    { wch: 14 }, // qtd
    { wch: 50 }, // candidato 1
    { wch: 12 }, // tipo match 1
    { wch: 9 },  // score 1
    { wch: 50 }, // candidato 2
    { wch: 9 },  // score 2
    { wch: 50 }, // candidato 3
    { wch: 9 },  // score 3
    { wch: 28 }, // DECISÃO (largura maior, para preenchimento)
    { wch: 55 }, // observação
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Revisão')

  const saida = path.resolve(process.cwd(), 'dados-locais', 'revisao_placeholder_331.xlsx')
  fs.mkdirSync(path.dirname(saida), { recursive: true })
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // A lib não grava freeze panes: injeta o pane congelado na primeira linha
  // diretamente no XML da planilha dentro do xlsx (que é um zip).
  const arquivos = unzipSync(new Uint8Array(buffer))
  const sheetPath = Object.keys(arquivos).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
  if (sheetPath) {
    let xml = strFromU8(arquivos[sheetPath])
    const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
    if (/<sheetView\b[^>]*\/>/.test(xml)) {
      xml = xml.replace(/<sheetView\b([^>]*)\/>/, `<sheetView$1>${pane}</sheetView>`)
    } else if (/<sheetView\b[^>]*>/.test(xml)) {
      xml = xml.replace(/(<sheetView\b[^>]*>)/, `$1${pane}`)
    }
    arquivos[sheetPath] = strToU8(xml)
  }
  fs.writeFileSync(saida, Buffer.from(zipSync(arquivos)))

  // 6. Relatório no console
  console.log('\n=== Resumo do matching ===')
  console.log(`Match exato:            ${qtdExato}`)
  console.log(`Somente fuzzy:          ${qtdSoFuzzy}`)
  console.log(`Sem nenhum candidato:   ${qtdSemCandidato}`)

  const fuzzyScores = linhas.filter((l) => l.t1 === 'fuzzy').map((l) => l.s1)
  const faixas = [
    ['0.90 – 0.99', (s) => s >= 0.9],
    ['0.80 – 0.89', (s) => s >= 0.8 && s < 0.9],
    ['0.70 – 0.79', (s) => s >= 0.7 && s < 0.8],
    ['0.60 – 0.69', (s) => s >= 0.6 && s < 0.7],
    ['0.45 – 0.59', (s) => s < 0.6],
  ]
  if (fuzzyScores.length > 0) {
    console.log('\nDistribuição dos scores (melhor candidato fuzzy):')
    for (const [faixa, teste] of faixas) {
      console.log(`  ${faixa}: ${fuzzyScores.filter(teste).length}`)
    }
  }

  duvidosos.sort((a, b) => a.score - b.score || b.qtd - a.qtd)
  if (duvidosos.length > 0) {
    console.log('\nCasos mais duvidosos (score intermediário 0.50–0.79):')
    for (const d of duvidosos.slice(0, 10)) {
      console.log(`  [${d.score.toFixed(2)}] ${d.nome} (${d.qtd} ocorr.) → ${d.candidato}`)
    }
  }

  console.log(`\nPlanilha gerada em: ${saida}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
