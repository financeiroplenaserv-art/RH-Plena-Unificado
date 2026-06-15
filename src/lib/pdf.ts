import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Colaborador, Ocorrencia, OcorrenciaAnexo, OcorrenciaTestemunha } from '@/types/database'

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number }
}

export function gerarPDFColaborador(colaborador: Colaborador, ocorrencias: Ocorrencia[]) {
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setTextColor(30, 30, 30)
  doc.text('Ficha do Colaborador', w / 2, 18, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, w / 2, 24, { align: 'center' })

  doc.setDrawColor(200, 200, 200)
  doc.line(14, 28, w - 14, 28)

  const dadosPessoais = [
    ['Nome Completo', colaborador.nome_completo || '-'],
    ['Matrícula', colaborador.matricula || '-'],
    ['CPF', colaborador.cpf || '-'],
    ['Cargo', colaborador.cargo || '-'],
    ['Departamento', colaborador.departamento || '-'],
    ['Status', colaborador.status || '-'],
    [
      'Data de Admissão',
      colaborador.data_admissao
        ? new Date(colaborador.data_admissao).toLocaleDateString('pt-BR')
        : '-',
    ],
    ['E-mail', colaborador.email || '-'],
    ['Telefone / Celular', colaborador.celular || colaborador.telefone || '-'],
  ]

  autoTable(doc, {
    startY: 32,
    body: dadosPessoais,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] } },
  })

  if (ocorrencias.length > 0) {
    doc.addPage()
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Histórico de Ocorrências', w / 2, 18, { align: 'center' })

    const rows = ocorrencias.map((o) => [
      new Date(o.data_ocorrencia).toLocaleDateString('pt-BR'),
      o.tipo_ocorrencia,
      o.descricao.substring(0, 70) + (o.descricao.length > 70 ? '...' : ''),
      o.status,
    ])

    autoTable(doc, {
      startY: 26,
      head: [['Data', 'Tipo', 'Descrição', 'Status']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 80 } },
    })
  }

  doc.save(`ficha_${colaborador.matricula}.pdf`)
  return doc
}

export function gerarPDFOcorrencia(
  colaborador: Colaborador,
  ocorrencia: Ocorrencia,
  anexos?: OcorrenciaAnexo[],
  testemunhas?: OcorrenciaTestemunha[],
  empresa?: { nome?: string; cnpj?: string } | null
) {
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  const nomeEmpresa = empresa?.nome || '[EMPRESA]'
  const cnpjEmpresa = empresa?.cnpj || '[CNPJ]'
  doc.text(nomeEmpresa, w / 2, 14, { align: 'center' })

  doc.setFontSize(8)
  doc.text(`CNPJ: ${cnpjEmpresa}`, w / 2, 19, { align: 'center' })

  doc.setFontSize(16)
  doc.text('REGISTRO DE OCORRÊNCIA', w / 2, 26, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Ref: ${ocorrencia.id?.substring(0, 8).toUpperCase()}`, w / 2, 32, { align: 'center' })

  doc.setDrawColor(200, 200, 200)
  doc.line(14, 35, w - 14, 35)

  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('Dados do Colaborador', 14, 42)

  const dadosColab = [
    ['Nome', colaborador.nome_completo || '-'],
    ['Matrícula', colaborador.matricula || '-'],
    ['CPF', colaborador.cpf || '-'],
    ['Cargo', colaborador.cargo || '-'],
    ['Departamento', colaborador.departamento || '-'],
  ]

  autoTable(doc, {
    startY: 46,
    body: dadosColab,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] } },
  })

  const y2 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || 75

  doc.setFontSize(10)
  doc.text('Dados da Ocorrência', 14, y2 + 10)

  const dadosOcor: (string | null)[][] = [
    ['Tipo', ocorrencia.tipo_ocorrencia || '-'],
    ['Data', ocorrencia.data_ocorrencia ? new Date(ocorrencia.data_ocorrencia).toLocaleDateString('pt-BR') : '-'],
  ]

  if (ocorrencia.tipo_penalidade && ocorrencia.tipo_penalidade !== ocorrencia.tipo_ocorrencia) {
    dadosOcor.push(['Penalidade', ocorrencia.tipo_penalidade])
  }
  if (ocorrencia.gravidade) {
    dadosOcor.push(['Gravidade', ocorrencia.gravidade])
  }
  if (ocorrencia.base_legal) {
    dadosOcor.push(['Base Legal', ocorrencia.base_legal])
  }

  autoTable(doc, {
    startY: y2 + 14,
    body: dadosOcor,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] } },
  })

  const y3 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || 110

  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('Descrição do Fato', 14, y3 + 10)

  const descricaoTexto = ocorrencia.descricao || '-'

  autoTable(doc, {
    startY: y3 + 14,
    body: [[descricaoTexto]],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', minCellHeight: 60 },
    columnStyles: { 0: { cellWidth: w - 28 } },
  })

  const yDesc = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || y3 + 30
  let yCurrent = yDesc + 6

  if (anexos && anexos.length > 0) {
    if (yCurrent > h - 80) {
      doc.addPage()
      yCurrent = 30
    }

    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text('Documentos Anexados', 14, yCurrent)

    const anexosRows = anexos.map((a) => {
      const tipo = a.tipo_arquivo?.startsWith('video/')
        ? 'Vídeo'
        : a.tipo_arquivo?.startsWith('audio/')
          ? 'Áudio'
          : 'Documento'
      return [a.nome_arquivo, tipo]
    })

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['Arquivo', 'Tipo']],
      body: anexosRows,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    })

    const lastY = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY
    yCurrent = lastY !== undefined ? lastY + 8 : yCurrent + 20
  }

  if (testemunhas && testemunhas.length > 0) {
    if (yCurrent > h - 80) {
      doc.addPage()
      yCurrent = 30
    }

    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text('Testemunhas', 14, yCurrent)

    const testRows = testemunhas.map((t, i) => [
      `${i + 1}`,
      t.nome,
      t.cargo || '-',
      t.departamento || '-',
    ])

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['N', 'Nome', 'Cargo', 'Depto']],
      body: testRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    })

    const lastY2 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY
    yCurrent = lastY2 !== undefined ? lastY2 + 8 : yCurrent + 20
  }

  if (yCurrent > h - 60) {
    doc.addPage()
    yCurrent = 40
  }

  doc.setDrawColor(80, 80, 80)

  doc.line(14, yCurrent, 80, yCurrent)
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Assinatura do Colaborador', 14, yCurrent + 4)
  doc.text('Data ___/___/______', 14, yCurrent + 8)
  doc.text(`Nome: ${colaborador.nome_completo}`, 14, yCurrent + 12)

  doc.line(w - 80, yCurrent, w - 14, yCurrent)
  doc.text('Assinatura do Responsável (RH)', w - 80, yCurrent + 4)
  doc.text('Data ___/___/______', w - 80, yCurrent + 8)

  if (testemunhas && testemunhas.length > 0) {
    let yTest = yCurrent + 20

    if (yTest > h - 40) {
      doc.addPage()
      yTest = 30
    }

    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text('Assinaturas das Testemunhas:', 14, yTest)
    yTest += 8

    testemunhas.forEach((t, i) => {
      if (yTest > h - 30) {
        doc.addPage()
        yTest = 30
      }
      doc.line(14, yTest, 80, yTest)
      doc.setFontSize(7)
      doc.setTextColor(80, 80, 80)
      doc.text(
        `Testemunha ${i + 1}: ${t.nome}${t.cpf ? ` (CPF: ${t.cpf})` : ''}`,
        14,
        yTest + 3
      )
      doc.text('Data ___/___/______', 14, yTest + 6)

      if (i + 1 < testemunhas.length) {
        const t2 = testemunhas[i + 1]
        doc.line(w - 80, yTest, w - 14, yTest)
        doc.text(
          `Testemunha ${i + 2}: ${t2.nome}${t2.cpf ? ` (CPF: ${t2.cpf})` : ''}`,
          w - 80,
          yTest + 3
        )
        doc.text('Data ___/___/______', w - 80, yTest + 6)
      }
      yTest += 16
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Documento gerado eletronicamente em ${new Date().toLocaleDateString('pt-BR')} - Sistema RH Plena`,
      w / 2,
      h - 8,
      { align: 'center' }
    )
  }

  doc.save(`ocorrencia_${ocorrencia.id?.substring(0, 8)}.pdf`)
  return doc
}


export function gerarReciboEntregaCEU(
  colaborador: Colaborador,
  itens: { nome: string; tipo: string; ca?: string | null; quantidade: number }[],
  dataEntrega: string,
  observacao?: string | null,
  empresa?: { nome?: string; cnpj?: string } | null
) {
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  doc.setFontSize(12)
  doc.setTextColor(30, 58, 95)
  const nomeEmpresa = empresa?.nome || '[EMPRESA]'
  const cnpjEmpresa = empresa?.cnpj || '[CNPJ]'
  doc.text(nomeEmpresa, w / 2, 14, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text(`CNPJ: ${cnpjEmpresa}`, w / 2, 19, { align: 'center' })

  doc.setFontSize(16)
  doc.setTextColor(30, 58, 95)
  doc.text('RECIBO DE ENTREGA CEU', w / 2, 28, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`Data da entrega: ${new Date(dataEntrega).toLocaleDateString('pt-BR')}`, w / 2, 34, { align: 'center' })

  doc.setDrawColor(200, 200, 200)
  doc.line(14, 38, w - 14, 38)

  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('Dados do Colaborador', 14, 46)

  const dadosColab = [
    ['Nome', colaborador.nome_completo || '-'],
    ['Matrícula', colaborador.matricula || '-'],
    ['Cargo', colaborador.cargo || '-'],
    ['Departamento', colaborador.departamento || '-'],
    ['Status', colaborador.status || '-'],
  ]

  autoTable(doc, {
    startY: 50,
    body: dadosColab,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [80, 80, 80] } },
  })

  const y2 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || 80

  doc.setFontSize(10)
  doc.text('Itens Entregues', 14, y2 + 10)

  const rows = itens.map((i) => [
    i.nome,
    i.tipo,
    i.ca || '-',
    String(i.quantidade),
  ])

  autoTable(doc, {
    startY: y2 + 14,
    head: [['Item', 'Tipo', 'CA', 'Qtd']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  const y3 = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY || y2 + 40

  if (observacao) {
    doc.setFontSize(10)
    doc.text('Observação', 14, y3 + 10)
    autoTable(doc, {
      startY: y3 + 14,
      body: [[observacao]],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: w - 28 } },
    })
  }

  let yAss = ((doc as JsPDFWithAutoTable).lastAutoTable?.finalY || y3 + 20) + 20

  if (yAss > h - 60) {
    doc.addPage()
    yAss = 40
  }

  doc.setDrawColor(80, 80, 80)
  doc.line(14, yAss, 80, yAss)
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Assinatura do Colaborador', 14, yAss + 4)
  doc.text('Data ___/___/______', 14, yAss + 8)

  doc.line(w - 80, yAss, w - 14, yAss)
  doc.text('Assinatura do Responsável', w - 80, yAss + 4)
  doc.text('Data ___/___/______', w - 80, yAss + 8)

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Documento gerado eletronicamente em ${new Date().toLocaleDateString('pt-BR')} - Sistema RH Plena`,
      w / 2,
      h - 8,
      { align: 'center' }
    )
  }

  doc.save(`recibo_entrega_${colaborador.matricula}.pdf`)
  return doc
}
