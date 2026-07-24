// Importa as "últimas férias gozadas" do PDF Previsão de Férias (Flit)
// para colaboradores SEM nenhum período de gozo no CORH.
//
// Uso:
//   node scripts/importar-ferias-gozadas-pdf.cjs           → só prévia (não grava)
//   node scripts/importar-ferias-gozadas-pdf.cjs --aplicar → grava no banco
//
// O PDF é frente/verso: página ímpar = matrícula+nome, página par = datas,
// linhas alinhadas pela posição vertical. Período de gozo = data + 29 dias
// (30 dias CLT, padrão do relatório — "SALDO DIAS" = 30).

const fs = require('fs')

const APLICAR = process.argv.includes('--aplicar')
const env = fs.readFileSync('.env', 'utf8')
const get = (k) => (env.match(new RegExp(k + '=(.+)')))?.[1]?.trim()
const url = get('VITE_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY')
const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }

const RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/

function paraISO(dataBR) {
  const [d, m, a] = dataBR.split('/')
  return `${a}-${m}-${d}`
}

function mais29Dias(iso) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + 29)
  return d.toISOString().split('T')[0]
}

async function parsePDF() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync('dados-locais/Férias.pdf'))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise

  const registros = []
  for (let p = 1; p <= doc.numPages; p += 2) {
    const paginaA = await doc.getPage(p) // matrícula + nome
    const paginaB = await doc.getPage(p + 1) // datas
    const linhasA = linhasPorY(await paginaA.getTextContent())
    const linhasB = linhasPorY(await paginaB.getTextContent())

    for (const [y, itensA] of linhasA) {
      const matricula = itensA.find((i) => /^\d{6}$/.test(i.t))?.t
      const nome = itensA.filter((i) => i.x >= 330 && i.x < 480).map((i) => i.t).join(' ').trim()
      if (!matricula) continue

      // Casa a linha do verso pela posição Y (tolerância 3px)
      const yB = [...linhasB.keys()].find((yb) => Math.abs(yb - y) <= 3)
      const itensB = yB !== undefined ? linhasB.get(yB) : []
      const ultimaFerias = itensB.find((i) => i.x < 45 && RE_DATA.test(i.t))?.t || null

      registros.push({ matricula, nome, ultimaFerias })
    }
  }
  return registros
}

function linhasPorY(content) {
  const linhas = new Map()
  for (const item of content.items) {
    const y = Math.round(item.transform[5])
    if (!linhas.has(y)) linhas.set(y, [])
    linhas.get(y).push({ x: Math.round(item.transform[4]), t: item.str })
  }
  return linhas
}

async function main() {
  const registros = await parsePDF()
  console.log(`Linhas lidas do PDF: ${registros.length}`)

  // Colaboradores do banco (por matrícula)
  const colabs = await (await fetch(
    url + '/rest/v1/colaboradores?select=id,matricula,nome_completo,status&limit=10000',
    { headers: H }
  )).json()
  const porMatricula = new Map()
  for (const c of colabs) {
    if (c.matricula && !porMatricula.has(c.matricula)) porMatricula.set(c.matricula, c)
  }

  // Quem já tem gozo ou agendado registrado
  const periodos = await (await fetch(
    url + "/rest/v1/ferias_periodos?select=colaborador_id,tipo&limit=10000",
    { headers: H }
  )).json()
  const temGozo = new Set(periodos.filter((p) => p.tipo === 'gozo').map((p) => p.colaborador_id))
  const temAgendado = new Set(periodos.filter((p) => p.tipo === 'agendado').map((p) => p.colaborador_id))

  const hoje = new Date().toISOString().split('T')[0]
  const inserir = []
  const agendar = []
  const stats = { semDataPDF: 0, naoEncontrado: [], jaTemGozo: 0, jaTemAgendado: 0 }

  for (const r of registros) {
    if (!r.ultimaFerias) { stats.semDataPDF++; continue }
    const iso = paraISO(r.ultimaFerias)
    const colab = porMatricula.get(r.matricula)
    if (!colab) { stats.naoEncontrado.push(`${r.matricula} ${r.nome}`); continue }
    // Data futura = férias prestes a começar → registra como 'agendado'
    if (iso > hoje) {
      if (temAgendado.has(colab.id)) { stats.jaTemAgendado++; continue }
      agendar.push({
        colaborador_id: colab.id,
        data_inicio: iso,
        data_fim: mais29Dias(iso),
        tipo: 'agendado',
        descricao: 'Importado do PDF "Previsão de Férias" (início em ' + r.ultimaFerias + ')',
        origem: 'flit',
        _nome: colab.nome_completo,
        _matricula: r.matricula,
      })
      continue
    }
    if (temGozo.has(colab.id)) { stats.jaTemGozo++; continue }
    inserir.push({
      colaborador_id: colab.id,
      data_inicio: iso,
      data_fim: mais29Dias(iso),
      tipo: 'gozo',
      descricao: 'Importado do PDF "Previsão de Férias" (últimas férias gozadas)',
      origem: 'flit',
      _nome: colab.nome_completo,
      _matricula: r.matricula,
    })
  }

  console.log(`\nSem data de últimas férias no PDF: ${stats.semDataPDF}`)
  console.log(`Já tinham gozo no CORH (pulados): ${stats.jaTemGozo}`)
  console.log(`Já tinham agendado no CORH (pulados): ${stats.jaTemAgendado}`)
  console.log(`Matrícula não encontrada no CORH: ${stats.naoEncontrado.length}`)
  stats.naoEncontrado.forEach((n) => console.log('  - ' + n))
  console.log(`\n>>> A PREENCHER gozo (vazios no CORH): ${inserir.length}`)
  inserir.slice(0, 15).forEach((i) => console.log(`  ${i._matricula} ${i._nome} → ${i.data_inicio} a ${i.data_fim}`))
  if (inserir.length > 15) console.log(`  ... e mais ${inserir.length - 15}`)
  console.log(`>>> A AGENDAR (início futuro): ${agendar.length}`)
  agendar.forEach((i) => console.log(`  ${i._matricula} ${i._nome} → ${i.data_inicio} a ${i.data_fim}`))

  if (!APLICAR) {
    console.log('\n(Prévia — rode com --aplicar para gravar)')
    return
  }

  const payloads = [...inserir, ...agendar].map(({ _nome, _matricula, ...resto }) => resto)
  const res = await fetch(url + '/rest/v1/ferias_periodos', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(payloads),
  })
  if (!res.ok) {
    console.error('Erro ao inserir:', res.status, await res.text())
    process.exit(1)
  }
  const gravados = await res.json()
  console.log(`\n✅ Gravados: ${gravados.length} períodos de gozo`)
}

main().catch((e) => { console.error(e); process.exit(1) })
