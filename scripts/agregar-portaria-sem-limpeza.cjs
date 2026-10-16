// Agrega os pedidos de KIT PORTARIA dos 27 contratos sem limpeza a partir das
// respostas reais dos líderes em "docs/Pedido de material/pedido_materiais_todas_abas.md".
const fs = require('fs')

// seção (## N. NOME) → exibição
const SEM_LIMPEZA = {
  6: 'ADRIANA', 7: 'AMAPÁ', 8: 'BLUE TERMINAL', 9: 'BUSINESS CENTER',
  11: 'CALLE MAGGIORE', 12: 'CARMO CAMPANELLA', 19: 'CRISTIANA', 21: 'EXCLUSIVE',
  22: 'FLAMBOYANT', 23: 'FONSECA', 24: 'GERANIUM', 28: 'GREAT PLACE',
  31: 'JARDINS', 33: 'LAGOA MAR', 34: 'LA ROCHELLE', 40: 'MIRAFLORES',
  45: 'OCEAN PLACE', 46: 'OITICICA', 47: 'OLIMPIO BARGIELA', 49: 'OSCAR PEREIRA',
  50: 'PALAZZO ITAÚBA', 52: "PRAIA D'OFIR", 53: 'QUATRE',
  55: 'QUINCAS PATRIMONIAL', 63: 'TATHIANA', 64: 'TECH', 70: 'WINBLEDON',
}

const md = fs.readFileSync('docs/Pedido de material/pedido_materiais_todas_abas.md', 'utf8')
const secoes = md.split(/^## /m).slice(1)
const porNum = {}
for (const s of secoes) {
  const m = s.match(/^(\d+)\./)
  if (m) porNum[Number(m[1])] = s
}

const celulas = (l) => l.split('|').slice(1, -1).map((c) => c.trim())
const VAZIO = /^(|não|nao|não precisa\.?|nao precisa\.?|não-precisa\.?|não precisa\.?)$/i

const relatorio = []
for (const [num, nome] of Object.entries(SEM_LIMPEZA)) {
  const sec = porNum[num]
  if (!sec) { relatorio.push({ nome, erro: 'seção não encontrada' }); continue }
  const linhas = sec.split('\n').filter((l) => l.startsWith('|'))
  const cab = celulas(linhas[0])
  const idxQuais = cab.findIndex((h) => /qual dos materiais/i.test(h))
  const idxQtd = cab.findIndex((h) => /cite abaixo a quantidade|quantidade necessária/i.test(h))
  const itens = {}
  let pedidos = 0
  for (const l of linhas.slice(2)) {
    const v = celulas(l)
    const quais = idxQuais >= 0 ? v[idxQuais] || '' : ''
    const qtd = idxQtd >= 0 ? v[idxQtd] || '' : ''
    if (VAZIO.test(quais) && VAZIO.test(qtd)) continue
    pedidos++
    const data = (v[0] || '').slice(0, 10)
    const chave = quais || '(só quantidade informada)'
    itens[chave] = itens[chave] || []
    itens[chave].push(`${data}: ${qtd || '(qtd não informada)'}`)
  }
  relatorio.push({ nome, pedidos, itens })
}

for (const r of relatorio) {
  console.log(`\n### ${r.nome} — ${r.erro || r.pedidos + ' pedido(s) de portaria no período'}`)
  if (r.itens) {
    for (const [item, ocorrencias] of Object.entries(r.itens)) {
      console.log(`  - ${item}`)
      for (const o of ocorrencias) console.log(`      ${o}`)
    }
  }
}
