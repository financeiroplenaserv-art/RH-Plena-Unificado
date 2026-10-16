// Extrai o ÚLTIMO pedido do líder de cada contrato do piloto, listando só
// colunas preenchidas (coluna = valor), de "docs/Pedido de material/pedido_materiais_todas_abas.md".
const fs = require('fs')

const CONTRATOS = {
  '## 5. ABAETÉ': 'ABAETÉ',
  '## 30. ITAGUAÍ': 'ITAGUAÍ',
  '## 18. ENSEADA PARK': 'ENSEADA PARK',
  '## 65. TELEX LOJAS BAR/TIJ/IPA': 'TELEX BAR/TIJ/IPA',
  '## 21. EXCLUSIVE': 'EXCLUSIVE',
}

const md = fs.readFileSync('docs/Pedido de material/pedido_materiais_todas_abas.md', 'utf8')
const secoes = md.split(/^## /m).slice(1)
const porTitulo = {}
for (const s of secoes) {
  const titulo = '## ' + s.slice(0, s.indexOf('\n')).trim()
  porTitulo[titulo] = s
}

function celulas(linha) {
  return linha.split('|').slice(1, -1).map((c) => c.trim())
}

for (const [titulo, nome] of Object.entries(CONTRATOS)) {
  const sec = porTitulo[titulo]
  if (!sec) {
    console.log(`\n########## ${nome} — SEÇÃO NÃO ENCONTRADA`)
    continue
  }
  const linhas = sec.split('\n').filter((l) => l.startsWith('|'))
  const cabecalho = celulas(linhas[0])
  const dados = linhas.slice(2) // pula cabeçalho e separador
  const ultima = dados[dados.length - 1]
  const valores = celulas(ultima)
  console.log(`\n########## ${nome} — último pedido (${valores[0]}) — ${dados.length} respostas no total`)
  for (let i = 0; i < cabecalho.length; i++) {
    const v = valores[i] || ''
    if (v && v !== 'Não precisa.' && v !== 'Não precisa' && v !== 'Não-precisa' && v !== 'NÃO PRECISA' && v !== 'Não Precisa' && v !== 'Não-precisa.' && v !== 'Não' && v !== 'Sim, concordo.' && v !== 'Sim, estou ciente e concordo.' && v !== 'Sim') {
      console.log(`- ${cabecalho[i].slice(0, 110)}: ${v}`)
    }
  }
}
