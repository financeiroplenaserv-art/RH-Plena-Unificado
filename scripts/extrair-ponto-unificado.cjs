// Estágio 1 — Extrai Falta/Atestado/Afastado/Suspensão do espelho de ponto (dados-locais/unificado.pdf),
// casa colaboradores por CPF no Supabase e gera planilha de revisão + JSON intermediário.
// NÃO grava nada no banco. Uso: node scripts/extrair-ponto-unificado.cjs
const fs = require('fs')

const CATEGORIAS_ALVO = ['Falta', 'Falta BH', 'Atestado', 'Afastado', 'Suspensão', 'Férias', 'Feriado']

// Mapeamento proposto categoria -> tipo de ocorrência do catálogo (src/lib/ocorrencias/tiposOcorrencia.ts)
const MAPA_TIPOS = {
  Falta: { tipo: 'Falta Injustificada', macro: '1. Jornada e Ponto', status: 'Ativa', importar: 'SIM' },
  'Falta BH': { tipo: 'Falta Abonada', macro: '1. Jornada e Ponto', status: 'Ativa', importar: 'REVISAR' },
  Atestado: { tipo: 'Falta Justificada (atestado)', macro: '1. Jornada e Ponto', status: 'Pendente', importar: 'SIM' },
  Afastado: { tipo: 'Licença Médica (até 15 dias)', macro: '4. Afastamentos e Licenças', status: 'Pendente', importar: 'REVISAR' },
  'Suspensão': { tipo: 'Suspensão 1 (1ª ocorrência)', macro: '2. Conduta e Disciplina', status: 'Ativa', importar: 'REVISAR' },
  'Férias': { tipo: '(não importar — módulo Férias)', macro: '', status: '', importar: 'NÃO' },
  Feriado: { tipo: '(não importar — calendário)', macro: '', status: '', importar: 'NÃO' },
}

function carregarEnv() {
  const env = {}
  for (const linha of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const normCPF = (cpf) => (cpf || '').replace(/\D/g, '').padStart(11, '0')
const normNome = (nome) =>
  (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[….]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

async function extrairPDF() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync('dados-locais/unificado.pdf'))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  const registros = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const linhas = new Map()
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      if (!linhas.has(y)) linhas.set(y, [])
      linhas.get(y).push({ x: Math.round(item.transform[4]), t: item.str })
    }
    const ordenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0])

    let nome = ''
    let cpf = ''
    for (const [, itens] of ordenadas) {
      itens.sort((a, b) => a.x - b.x)
      const textoLinha = itens.map((i) => i.t).join(' ')

      if (!cpf) {
        const mCpf = textoLinha.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
        if (mCpf && textoLinha.includes('Colaborador CPF')) cpf = mCpf[0]
      }
      const idxColab = itens.findIndex((i) => i.t.trim() === 'Colaborador:')
      if (idxColab >= 0) {
        const partes = []
        for (let i = idxColab + 1; i < itens.length; i++) {
          if (itens[i].t.trim() === 'Período:') break
          partes.push(itens[i].t)
        }
        nome = partes.join('').replace(/\s+/g, ' ').trim()
        continue
      }

      // Linhas de dados começam com data dd/mm/aa
      const primeiro = itens.find((i) => i.t.trim())
      if (!primeiro || !/^\d{2}\/\d{2}\/\d{2}/.test(primeiro.t.trim())) continue
      const dataStr = primeiro.t.trim().slice(0, 8) // dd/mm/aa

      const realizado = itens
        .filter((i) => i.x >= 290 && i.x < 440)
        .map((i) => i.t.trim())
        .filter(Boolean)
        .join(' ')
      const realizadoLower = realizado.toLowerCase()
      const categoria = [...CATEGORIAS_ALVO]
        .sort((a, b) => b.length - a.length)
        .find((c) => realizadoLower.startsWith(c.toLowerCase()))
      if (!categoria) continue

      const justificativa = itens
        .filter((i) => i.x >= 645 && i.x < 775 && !/^[\d:]+$/.test(i.t.trim()))
        .map((i) => i.t.trim())
        .filter(Boolean)
        .join(' ')

      const [dd, mm, aa] = dataStr.split('/')
      registros.push({
        pagina: p,
        nome_pdf: nome,
        cpf_pdf: cpf,
        data: `20${aa}-${mm}-${dd}`, // ISO
        categoria,
        justificativa,
      })
    }
  }
  return registros
}

async function buscarColaboradores(url, key) {
  const todos = []
  const passo = 1000
  for (let offset = 0; ; offset += passo) {
    const resp = await fetch(
      `${url}/rest/v1/colaboradores?select=id,nome_completo,cpf,matricula,status,empresa_id&order=nome_completo&offset=${offset}&limit=${passo}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!resp.ok) throw new Error(`Erro ao buscar colaboradores: ${resp.status} ${await resp.text()}`)
    const lote = await resp.json()
    todos.push(...lote)
    if (lote.length < passo) break
  }
  return todos
}

function agruparConsecutivos(registros) {
  const chave = (r) => `${r.cpf_pdf}|${r.categoria}`
  const grupos = new Map()
  for (const r of registros) {
    if (!grupos.has(chave(r))) grupos.set(chave(r), [])
    grupos.get(chave(r)).push(r)
  }
  const periodos = []
  for (const regs of grupos.values()) {
    regs.sort((a, b) => a.data.localeCompare(b.data))
    let atual = null
    for (const r of regs) {
      const anterior = atual ? new Date(atual.fim + 'T00:00:00') : null
      const atualData = new Date(r.data + 'T00:00:00')
      const diffDias = anterior ? (atualData - anterior) / 86400000 : null
      if (atual && diffDias === 1) {
        atual.fim = r.data
        atual.dias++
        if (r.justificativa && !atual.justificativas.includes(r.justificativa)) atual.justificativas.push(r.justificativa)
      } else {
        if (atual) periodos.push(atual)
        atual = {
          ...r,
          inicio: r.data,
          fim: r.data,
          dias: 1,
          justificativas: r.justificativa ? [r.justificativa] : [],
        }
      }
    }
    if (atual) periodos.push(atual)
  }
  return periodos.sort((a, b) => a.nome_pdf.localeCompare(b.nome_pdf) || a.inicio.localeCompare(b.inicio))
}

async function main() {
  console.log('1/4 Extraindo PDF...')
  const registros = await extrairPDF()
  console.log(`   ${registros.length} registros extraídos (${new Set(registros.map((r) => r.cpf_pdf)).size} CPFs distintos)`)

  console.log('2/4 Buscando colaboradores no Supabase...')
  const env = carregarEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL ou chave não encontradas no .env')
  const colaboradores = await buscarColaboradores(url, key)
  console.log(`   ${colaboradores.length} colaboradores no banco`)

  console.log('3/4 Casando por CPF...')
  const porCpf = new Map()
  for (const c of colaboradores) {
    if (!c.cpf) continue
    const n = normCPF(c.cpf)
    if (!porCpf.has(n)) porCpf.set(n, [])
    porCpf.get(n).push(c)
  }
  for (const r of registros) {
    const candidatos = porCpf.get(normCPF(r.cpf_pdf)) || []
    let escolhido = candidatos.find((c) => c.status === 'Ativo') || candidatos[0] || null
    r.colaborador_id = escolhido ? escolhido.id : null
    r.nome_corh = escolhido ? escolhido.nome_completo : ''
    r.matricula_corh = escolhido ? escolhido.matricula : ''
    if (!escolhido) {
      r.match = 'NAO_ENCONTRADO'
    } else if (candidatos.length > 1) {
      r.match = 'CPF_DUPLICADO'
    } else {
      const nPdf = normNome(r.nome_pdf)
      const nCorh = normNome(r.nome_corh)
      r.match = nCorh.startsWith(nPdf) || nPdf.startsWith(nCorh) ? 'OK' : 'NOME_DIVERGE'
    }
  }
  const resumoMatch = registros.reduce((acc, r) => ((acc[r.match] = (acc[r.match] || 0) + 1), acc), {})
  console.log('   Match:', JSON.stringify(resumoMatch))

  console.log('4/4 Gerando planilha de revisão e JSON...')
  const periodos = agruparConsecutivos(registros)

  const XLSX = require('@e965/xlsx')
  const fmtData = (iso) => iso.split('-').reverse().join('/')
  const linhaPeriodo = (p) => ({
    'Importar?': MAPA_TIPOS[p.categoria].importar,
    'Categoria (PDF)': p.categoria,
    'Tipo de ocorrência proposto': MAPA_TIPOS[p.categoria].tipo,
    'Status proposto': MAPA_TIPOS[p.categoria].status,
    'Match': p.match,
    'Nome (PDF)': p.nome_pdf,
    'Nome (CORH)': p.nome_corh,
    'CPF': p.cpf_pdf,
    'Matrícula (CORH)': p.matricula_corh,
    'Início': fmtData(p.inicio),
    'Fim': fmtData(p.fim),
    'Dias': p.dias,
    'Justificativa (PDF)': p.justificativas.join('; '),
    'Página PDF': p.pagina,
  })
  const abaPeriodos = XLSX.utils.json_to_sheet(periodos.map(linhaPeriodo))
  const abaDetalhe = XLSX.utils.json_to_sheet(
    registros.map((r) => ({
      'Importar?': MAPA_TIPOS[r.categoria].importar,
      'Categoria (PDF)': r.categoria,
      'Match': r.match,
      'Nome (PDF)': r.nome_pdf,
      'Nome (CORH)': r.nome_corh,
      'CPF': r.cpf_pdf,
      'Data': fmtData(r.data),
      'Justificativa (PDF)': r.justificativa,
      'Página PDF': r.pagina,
    }))
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, abaPeriodos, 'Períodos agrupados')
  XLSX.utils.book_append_sheet(wb, abaDetalhe, 'Detalhado por dia')
  XLSX.writeFile(wb, 'dados-locais/revisao_ponto_ocorrencias.xlsx')

  fs.writeFileSync(
    'dados-locais/ponto_ocorrencias_extraido.json',
    JSON.stringify({ gerado_em: new Date().toISOString(), periodos, registros }, null, 2)
  )

  const resumoCat = periodos.reduce((acc, p) => ((acc[p.categoria] = (acc[p.categoria] || 0) + 1), acc), {})
  console.log('\nPeríodos agrupados por categoria:', JSON.stringify(resumoCat))
  console.log('\nPronto: dados-locais/revisao_ponto_ocorrencias.xlsx')
  console.log('        dados-locais/ponto_ocorrencias_extraido.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
