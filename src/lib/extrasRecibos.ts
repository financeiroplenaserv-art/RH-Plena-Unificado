import type { Extra } from '@/types/extras'
import { formatarCNPJ } from '@/lib/utils'

interface JsPDFWithAutoTable {
  lastAutoTable?: { finalY: number }
}

interface ColaboradorRecibo {
  nome: string
  cpf?: string | null
}

interface EmpresaRecibo {
  nome: string
  cnpj?: string | null
}

async function getJsPDF() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable }
}

function valorPorExtenso(valor: number): string {
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)

  const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function numeroPorExtenso(n: number): string {
    if (n === 0) return 'zero'
    if (n === 100) return 'cem'
    if (n < 10) return unidades[n]
    if (n < 20) return especiais[n - 10]
    if (n < 100) {
      const d = Math.floor(n / 10)
      const u = n % 10
      if (u === 0) return dezenas[d]
      return `${dezenas[d]} e ${unidades[u]}`
    }
    if (n < 1000) {
      const c = Math.floor(n / 100)
      const resto = n % 100
      if (resto === 0) return centenas[c]
      return `${centenas[c]} e ${numeroPorExtenso(resto)}`
    }
    if (n < 1000000) {
      const mil = Math.floor(n / 1000)
      const resto = n % 1000
      const textoMil = mil === 1 ? 'mil' : `${numeroPorExtenso(mil)} mil`
      if (resto === 0) return textoMil
      return `${textoMil} e ${numeroPorExtenso(resto)}`
    }
    if (n < 1000000000) {
      const milhao = Math.floor(n / 1000000)
      const resto = n % 1000000
      const textoMilhao = milhao === 1 ? 'um milhão' : `${numeroPorExtenso(milhao)} milhões`
      if (resto === 0) return textoMilhao
      return `${textoMilhao} e ${numeroPorExtenso(resto)}`
    }
    return String(n)
  }

  const partes: string[] = []
  if (reais > 0) {
    partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }

  if (partes.length === 0) return 'zero real'
  if (partes.length === 1) return partes[0]
  return `${partes[0]} e ${partes[1]}`
}

export async function gerarReciboExtraPDF(
  colaborador: ColaboradorRecibo,
  extras: Extra[],
  dataInicio: string,
  dataFim: string,
  assinaturaBase64: string,
  numeroRecibo?: string,
  empresa?: EmpresaRecibo,
  dataPagamento?: string | null,
  modoPapel = false
) {
  const { jsPDF, autoTable } = await getJsPDF()
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  const formatarData = (data: string) => {
    const somenteData = data.includes('T') ? data.split('T')[0] : data
    const [ano, mes, dia] = somenteData.split('-')
    return `${dia}/${mes}/${ano}`
  }
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const valorTotal = extras.reduce((acc, e) => acc + (Number(e.valor) || 0), 0)
  const hoje = new Date()
  const dataEmissao = hoje.toLocaleDateString('pt-BR')
  const dataRecebimento = dataPagamento ? formatarData(dataPagamento) : dataEmissao
  const nomeEmpresa = empresa?.nome || '[Empresa não informada]'

  function getCnpjEmpresa(cnpj?: string | null): string {
    return formatarCNPJ(cnpj) || '[CNPJ]'
  }

  const cnpjEmpresa = getCnpjEmpresa(empresa?.cnpj)

  // Título
  doc.setFontSize(26)
  doc.setTextColor(30, 30, 30)
  doc.text('RECIBO', w / 2, 24, { align: 'center' })

  // Local e data
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text(`Niterói, ${dataEmissao}`, w / 2, 32, { align: 'center' })

  // Número do recibo
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Nº ${numeroRecibo?.substring(0, 8).toUpperCase() || '---'}`, w / 2, 38, { align: 'center' })

  // Linha separadora
  doc.setDrawColor(200, 200, 200)
  doc.line(14, 42, w - 14, 42)

  // Texto principal de declaração
  const texto =
    `Eu, ${colaborador.nome}, inscrito(a) no CPF sob o nº ${colaborador.cpf || '[CPF]'}, ` +
    `declaro para os devidos fins que recebi de ${nomeEmpresa}, CNPJ nº ${cnpjEmpresa}, ` +
    `a importância de ${formatarMoeda(valorTotal)} (${valorPorExtenso(valorTotal)}), ` +
    `nesta data de ${dataRecebimento}, referente aos extras prestados no período de ${formatarData(dataInicio)} a ${formatarData(dataFim)}.`

  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  const linhasTexto = doc.splitTextToSize(texto, w - 28)
  doc.text(linhasTexto, 14, 54)

  const yTabela = 54 + linhasTexto.length * 7 + 8

  // Tabela apenas com data e departamento
  const rows = extras.map((e) => [
    formatarData(e.data_ocorrencia),
    e.departamento_nome || '-',
    formatarMoeda(e.valor),
  ])

  autoTable(doc, {
    startY: yTabela,
    head: [['Data', 'Departamento', 'Valor']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2 },
    foot: [['', 'TOTAL', formatarMoeda(valorTotal)]],
    footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold', fontSize: 9 },
  })

  const y3 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || yTabela + 40

  let yAss = y3 + 16
  if (yAss > h - 70) {
    doc.addPage()
    yAss = 40
  }

  // Assinatura
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  doc.text('Assinatura do colaborador:', 14, yAss)

  if (modoPapel) {
    doc.setDrawColor(80, 80, 80)
    doc.line(14, yAss + 30, 120, yAss + 30)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('Assinar no espaço acima', 14, yAss + 35)
  } else {
    const assinaturaLimpa = assinaturaBase64?.startsWith('data:image')
      ? assinaturaBase64
      : `data:image/png;base64,${assinaturaBase64}`

    try {
      doc.addImage(assinaturaLimpa, 'PNG', 14, yAss + 4, 80, 30)
    } catch {
      doc.setDrawColor(80, 80, 80)
      doc.rect(14, yAss + 4, 80, 30)
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('[Erro ao incluir assinatura digital]', 18, yAss + 20)
    }
  }

  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(colaborador.nome, 14, yAss + 44)
  doc.text(`Data: ${dataEmissao}`, 14, yAss + 49)

  // Rodapé
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Documento gerado eletronicamente em ${dataEmissao} - Sistema CORH`,
    w / 2,
    h - 8,
    { align: 'center' }
  )

  const nomeArquivo = `recibo_extra_${colaborador.nome.replace(/\s+/g, '_').toLowerCase()}_${dataInicio}`
  doc.save(`${nomeArquivo}.pdf`)
  return doc
}
