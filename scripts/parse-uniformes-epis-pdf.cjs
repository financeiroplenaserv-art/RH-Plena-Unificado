// Parser do relatório GESOPER "Materiais Transferidos para Funcionários"
// (dados-locais/uniformes e epis.pdf, 228 páginas). Extrai TODAS as linhas de
// entrega para dados-locais/uniformes_epis_pdf_extraido.json.
//
// Layout posicional (coordenada X de início do texto, arredondada):
//   - Cabeçalho de funcionário: "<códFunc> <NOME>" (x≈19-28), cargo (x≈193),
//     admissão (x≈389), matrícula (x≈468).
//   - Linha de entrega: Número (x≈23-26), Dt.Transf. (x≈43), Material (x≈138),
//     Descrição (x≈151+, pode ter vários fragmentos), CA/Epi (x≈377-410, vazio
//     para uniformes), Qtde (x≈424), Sit. (x≈430), Tipo (x≈464).
//   - Ignorar: cabeçalho/rodapé do relatório, header de colunas, linha de
//     local (x≈109 ... NITERÓI) e "Sub-total de itens pedidos".
//
// Uso: node scripts/parse-uniformes-epis-pdf.cjs

const fs = require('fs')

const RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/

/** Converte dd/mm/aaaa para ISO aaaa-mm-dd. */
function dataISO(br) {
  const [d, m, a] = br.split('/')
  return `${a}-${m}-${d}`
}

/** Agrupa os itens de texto da página por linha (mesmo y arredondado). */
function agruparLinhas(items) {
  const linhas = new Map()
  for (const item of items) {
    const y = Math.round(item.transform[5])
    if (!linhas.has(y)) linhas.set(y, [])
    linhas.get(y).push({ x: Math.round(item.transform[4]), t: item.str })
  }
  // ordena de cima para baixo e os fragmentos da esquerda para a direita
  return [...linhas.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, itens]) => ({ y, itens: itens.sort((a, b) => a.x - b.x) }))
}

/** Fragmento não-vazio dentro de uma faixa de X [min, max). */
function textoNaFaixa(itens, min, max) {
  return itens
    .filter((i) => i.x >= min && i.x < max && i.t.trim() !== '')
    .map((i) => i.t.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Detecta linha de cabeçalho/rodapé que deve ser ignorada. */
function ehLinhaIgnoravel(itens) {
  const full = itens.map((i) => i.t).join(' ')
  return (
    full.includes('PLENA SERVIÇOS') ||
    full.includes('Materiais Transferidos') ||
    full.includes('RFMat001') ||
    full.includes('GESOPER') ||
    full.includes('Filial =>') ||
    full.includes('Sub-total') ||
    full.includes('Dt.Transf.') || // header de colunas
    (full.includes('Funcionário') && full.includes('Matrícula')) // header da seção
  )
}

/**
 * Cabeçalho de funcionário: começa com "<código> <NOME>" em x < 40 e tem
 * matrícula numérica em x ≈ 450-480. Retorna null se não for.
 */
function parseCabecalhoFuncionario(itens) {
  const primeiro = itens.find((i) => i.x < 40 && i.t.trim() !== '')
  const matriculaItem = itens.find((i) => i.x >= 450 && i.x < 490 && /^\d+$/.test(i.t.trim()))
  if (!primeiro || !matriculaItem) return null
  const m = primeiro.t.trim().match(/^(\d+)\s+(.+)$/)
  if (!m) return null
  const cargo = textoNaFaixa(itens, 190, 380)
  const admissaoItem = itens.find((i) => i.x >= 385 && i.x < 450 && RE_DATA.test(i.t.trim()))
  return {
    codigoFuncionario: m[1],
    nomeFuncionario: m[2].replace(/\s+/g, ' ').trim(),
    cargo,
    dataAdmissao: admissaoItem ? dataISO(admissaoItem.t.trim()) : null,
    matricula: matriculaItem.t.trim(),
  }
}

/**
 * Linha de entrega: data dd/mm/aaaa em x≈43 e código de material numérico em
 * x≈138. Retorna null se não for.
 */
function parseLinhaEntrega(itens) {
  const dataItem = itens.find((i) => i.x >= 40 && i.x < 55 && RE_DATA.test(i.t.trim()))
  if (!dataItem) return null
  const numeroItem = itens.find((i) => i.x < 40 && /^\d+$/.test(i.t.trim()))
  const codigoMaterial = textoNaFaixa(itens, 130, 150)
  const descricao = textoNaFaixa(itens, 150, 370)
  if (!/^\d+$/.test(codigoMaterial) || !descricao) return null
  const ca = textoNaFaixa(itens, 370, 415)
  const quantidade = textoNaFaixa(itens, 415, 428)
  const situacao = textoNaFaixa(itens, 428, 455)
  const tipo = textoNaFaixa(itens, 455, 600)
  return {
    numero: numeroItem ? numeroItem.t.trim() : '',
    dataEntrega: dataISO(dataItem.t.trim()),
    codigoMaterial,
    descricao,
    ca,
    quantidade,
    situacao,
    tipo,
  }
}

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync('dados-locais/uniformes e epis.pdf'))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  console.log(`Total de páginas: ${doc.numPages}`)

  const saida = []
  const paginasSemLinhas = []
  let continuacoes = 0 // páginas que começam com entregas sem repetir cabeçalho
  const situacoes = new Set()
  const tipos = new Set()
  let funcionarioAtual = null // persiste entre páginas (funcionário que quebra)

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const linhas = agruparLinhas(content.items)
    const antes = saida.length
    let viuCabecalhoNestaPagina = false

    for (const { itens } of linhas) {
      if (ehLinhaIgnoravel(itens)) continue

      const cab = parseCabecalhoFuncionario(itens)
      if (cab) {
        funcionarioAtual = cab
        viuCabecalhoNestaPagina = true
        continue
      }

      const ent = parseLinhaEntrega(itens)
      if (ent) {
        if (!funcionarioAtual) {
          console.warn(`AVISO: pág ${p} tem entrega sem funcionário identificado — linha ignorada:`, ent)
          continue
        }
        if (!viuCabecalhoNestaPagina && saida.length === antes) {
          // Página que começa com entregas sem repetir o cabeçalho: as linhas
          // pertencem ao funcionário da página anterior (funcionarioAtual).
          continuacoes++
        }
        situacoes.add(ent.situacao)
        tipos.add(ent.tipo)
        saida.push({
          pagina: p,
          codigoFuncionario: funcionarioAtual.codigoFuncionario,
          nomeFuncionario: funcionarioAtual.nomeFuncionario,
          matricula: funcionarioAtual.matricula,
          dataEntrega: ent.dataEntrega,
          codigoMaterial: ent.codigoMaterial,
          descricao: ent.descricao,
          ca: ent.ca,
          quantidade: ent.quantidade,
          situacao: ent.situacao,
          tipo: ent.tipo,
        })
        continue
      }

      // Demais linhas (local "ELDORADO ... NITERÓI", valores "0,00") caem aqui.
    }

    if (saida.length === antes) paginasSemLinhas.push(p)
    if (!viuCabecalhoNestaPagina && saida.length > antes) {
      console.warn(`AVISO: pág ${p} começou sem cabeçalho de funcionário — continuou o anterior (${funcionarioAtual?.nomeFuncionario})`)
    }
  }

  // Estatísticas
  const funcionarios = new Set(saida.map((l) => `${l.codigoFuncionario}|${l.nomeFuncionario}`))
  const comCA = saida.filter((l) => l.ca !== '').length
  const quantidadesInvalidas = saida.filter((l) => !/^\d+$/.test(l.quantidade)).length
  const semMatricula = saida.filter((l) => !l.matricula).length

  console.log('\n=== ESTATÍSTICAS DO PARSE ===')
  console.log(`Linhas de entrega extraídas: ${saida.length}`)
  console.log(`Linhas com CA preenchido: ${comCA}`)
  console.log(`Linhas com CA vazio (uniformes): ${saida.length - comCA}`)
  console.log(`Funcionários distintos: ${funcionarios.size}`)
  console.log(`Páginas com zero linhas extraídas: ${paginasSemLinhas.length}${paginasSemLinhas.length ? ' -> ' + paginasSemLinhas.join(', ') : ''}`)
  console.log(`Linhas com quantidade inválida: ${quantidadesInvalidas}`)
  console.log(`Linhas sem matrícula: ${semMatricula}`)
  console.log(`Situações distintas: ${[...situacoes].join(' | ')}`)
  console.log(`Tipos distintos: ${[...tipos].join(' | ')}`)
  console.log(`Páginas que continuam funcionário da anterior (sem repetir cabeçalho): ${continuacoes}`)

  // Checksum contra o rodapé do relatório: "Total de itens pedidos 11.629,00"
  // (soma Ent − Dev) e "Total de Funcionários Listados 878".
  const somaEnt = saida.filter((l) => l.tipo === 'Ent').reduce((s, l) => s + Number(l.quantidade), 0)
  const somaDev = saida.filter((l) => l.tipo === 'Dev').reduce((s, l) => s + Number(l.quantidade), 0)
  console.log(`Checksum: Ent(${somaEnt}) − Dev(${somaDev}) = ${somaEnt - somaDev} (relatório diz 11.629) ${somaEnt - somaDev === 11629 ? 'OK' : '*** DIVERGE ***'}`)
  console.log(`Checksum funcionários: ${funcionarios.size} (relatório diz 878) ${funcionarios.size === 878 ? 'OK' : '*** DIVERGE ***'}`)

  fs.mkdirSync('dados-locais', { recursive: true })
  const caminho = 'dados-locais/uniformes_epis_pdf_extraido.json'
  fs.writeFileSync(caminho, JSON.stringify(saida, null, 2))
  console.log(`\nJSON gravado em ${caminho}`)

  // Spot-check de 3 páginas: reimprime as linhas extraídas para conferência
  // manual contra o PDF.
  for (const p of [1, 114, 228]) {
    const linhas = saida.filter((l) => l.pagina === p)
    console.log(`\n--- SPOT-CHECK pág ${p} (${linhas.length} linhas) ---`)
    for (const l of linhas.slice(0, 12)) {
      console.log(
        `${l.matricula} ${l.nomeFuncionario} | ${l.dataEntrega} | mat=${l.codigoMaterial} | ${l.descricao.slice(0, 45)} | CA='${l.ca}' | q=${l.quantidade} | ${l.situacao} | ${l.tipo}`
      )
    }
    if (linhas.length > 12) console.log(`... e mais ${linhas.length - 12}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
