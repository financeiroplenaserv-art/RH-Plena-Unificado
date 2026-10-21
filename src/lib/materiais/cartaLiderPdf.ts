import type jsPDF from 'jspdf'
import { formatarData, hojeBrasil } from '@/lib/utils'
import {
  fonteDaTabela,
  mesPorExtenso,
  nomeArquivoCarta,
  nomesUnicos,
  saudacaoCarta,
  ROTULO_SECAO_CARTA,
  type CartaLider,
  type SecaoCarta,
} from './cartaLider'
import { montarZip } from './zipSimples'

// Desenho da carta ao líder em PDF de verdade (jspdf + jspdf-autotable, como
// src/lib/pdf.ts): A4 retrato, uma carta por contrato, cabe em 1 página
// sempre que possível (fonte da tabela reduz com o número de linhas — mesma
// lição dos recibos do CEU, que o programa de assinatura juntava). Se não
// couber, as páginas seguintes levam o nome do contrato no topo e
// "página X de Y" no rodapé. Termina com o bloco de assinatura para a
// ferramenta digital externa (sem certificado próprio — regra do projeto).

interface DocComTabela extends jsPDF {
  lastAutoTable?: { finalY: number }
}

type AutoTable = (doc: jsPDF, opcoes: Record<string, unknown>) => void

async function getJsPDF() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { JsPDF, autoTable: autoTable as unknown as AutoTable }
}

let logoCache: string | null | undefined
async function logoPadrao(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache
  try {
    const r = await fetch('/logo_plena_cab.jpg')
    if (!r.ok) throw new Error(String(r.status))
    const blob = await r.blob()
    logoCache = await new Promise<string>((ok, erro) => {
      const leitor = new FileReader()
      leitor.onload = () => ok(leitor.result as string)
      leitor.onerror = () => erro(leitor.error)
      leitor.readAsDataURL(blob)
    })
  } catch {
    logoCache = null
  }
  return logoCache
}

/** Fontes padrão do PDF (WinAnsi): troca travessão e aspas curvas. */
const t = (s: string) => s.replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")

const MARGEM = 14
const AZUL: [number, number, number] = [15, 108, 189]

function desenharCabecalho(doc: jsPDF, carta: CartaLider, logo: string | null): number {
  const largura = doc.internal.pageSize.getWidth()
  let y = MARGEM
  if (logo) {
    try {
      const p = doc.getImageProperties(logo)
      const h = 14
      const w = Math.min(60, (p.width / p.height) * h)
      doc.addImage(logo, 'JPEG', MARGEM, y, w, h)
    } catch {
      /* sem logo: segue */
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...AZUL)
  doc.text(t('Retorno do pedido de materiais'), largura - MARGEM, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60)
  doc.text(t(`${carta.contratoNome} · ${mesPorExtenso(carta.competencia)}`), largura - MARGEM, y + 11, { align: 'right' })
  y += 20
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.5)
  doc.line(MARGEM, y, largura - MARGEM, y)
  return y + 6
}

/** Desenha uma carta a partir da página atual do doc (que deve estar em branco). Devolve as páginas usadas. */
function desenharCarta(doc: DocComTabela, autoTable: AutoTable, carta: CartaLider, logo: string | null): { inicio: number; fim: number } {
  const inicio = doc.getNumberOfPages()
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()
  let y = desenharCabecalho(doc, carta, logo)

  doc.setTextColor(30)
  doc.setFontSize(10)
  const ola = saudacaoCarta(carta)
  const intro = doc.splitTextToSize(
    t(`${ola} Este é o retorno do pedido do posto em ${mesPorExtenso(carta.competencia)}: o que você pediu e o que vamos enviar. Quando algo não puder ser enviado como foi pedido, a observação explica o motivo.`),
    largura - 2 * MARGEM
  )
  doc.text(intro, MARGEM, y)
  y += intro.length * 4.6 + 2

  if (carta.emAnalise) {
    doc.setFillColor(255, 247, 230)
    doc.setDrawColor(240, 190, 90)
    doc.roundedRect(MARGEM, y, largura - 2 * MARGEM, 9, 1.5, 1.5, 'FD')
    doc.setFontSize(9)
    doc.setTextColor(120, 70, 0)
    doc.text(t('Parte do pedido ainda está em análise pelo escritório. Esses itens aparecem como "Em análise".'), MARGEM + 3, y + 5.8)
    doc.setTextColor(30)
    y += 13
  }

  const fonte = fonteDaTabela(carta.linhas.length)
  const corpo: unknown[] = []
  let secao: SecaoCarta | null = null
  for (const l of carta.linhas) {
    if (l.secao !== secao) {
      secao = l.secao
      corpo.push([
        {
          content: t(ROTULO_SECAO_CARTA[l.secao]),
          colSpan: 4,
          styles: { fontStyle: 'bold', fillColor: [234, 242, 251], textColor: AZUL },
        },
      ])
    }
    corpo.push([
      t(l.descricao),
      t(l.pediu),
      {
        content: t(l.vamosEnviar),
        styles: { fontStyle: l.situacao === 'atendido' ? 'normal' : 'bold' },
      },
      t(l.observacao),
    ])
  }
  if (carta.linhas.length === 0) corpo.push([{ content: 'Nenhum item pedido neste mês.', colSpan: 4 }])

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, top: MARGEM + 10, bottom: MARGEM + 6 },
    head: [['Item', t('Você pediu'), 'Vamos enviar', t('Observação')]],
    body: corpo,
    theme: 'grid',
    styles: { fontSize: fonte, cellPadding: fonte >= 8.5 ? 1.6 : 1.1, overflow: 'linebreak', lineColor: [210, 215, 222], lineWidth: 0.1 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 26, halign: 'right' }, 2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 'auto' } },
    didDrawPage: (dados: { pageNumber: number }) => {
      // Páginas de continuação: nome do contrato no topo.
      if (doc.getNumberOfPages() > inicio && dados.pageNumber > 0) {
        doc.setFontSize(8.5)
        doc.setTextColor(90)
        doc.text(t(`${carta.contratoNome} · ${mesPorExtenso(carta.competencia)} (continuação)`), MARGEM, MARGEM + 4)
      }
    },
  })
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  const blocoFinal = 34
  if (y + blocoFinal > altura - MARGEM) {
    doc.addPage()
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text(t(`${carta.contratoNome} · ${mesPorExtenso(carta.competencia)} (continuação)`), MARGEM, MARGEM + 4)
    y = MARGEM + 12
  }
  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text(t('Qualquer dúvida, fale com o seu inspetor. Obrigado pelo cuidado com o posto!'), MARGEM, y)
  y += 7
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(t(`Gerado pelo CORH em ${formatarData(hojeBrasil())}.`), MARGEM, y)
  y += 12
  doc.setTextColor(30)
  doc.setFontSize(10)
  doc.text('Recebido e conferido por (líder): ______________________________________', MARGEM, y)
  doc.text('Data: ____/____/________', largura - MARGEM, y, { align: 'right' })
  return { inicio, fim: doc.getNumberOfPages() }
}

function rodapes(doc: jsPDF, faixas: { inicio: number; fim: number; carta: CartaLider }[]) {
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()
  for (const f of faixas) {
    const total = f.fim - f.inicio + 1
    if (total <= 1) continue
    for (let p = f.inicio; p <= f.fim; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(110)
      doc.text(t(`${f.carta.contratoNome} - página ${p - f.inicio + 1} de ${total}`), largura - MARGEM, altura - MARGEM + 2, { align: 'right' })
    }
  }
}

async function documento(cartas: CartaLider[]): Promise<jsPDF> {
  const { JsPDF, autoTable } = await getJsPDF()
  const logo = await logoPadrao()
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }) as DocComTabela
  const faixas: { inicio: number; fim: number; carta: CartaLider }[] = []
  cartas.forEach((c, i) => {
    if (i > 0) doc.addPage()
    faixas.push({ ...desenharCarta(doc, autoTable, c, logo), carta: c })
  })
  rodapes(doc, faixas)
  return doc
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Uma carta → um PDF baixado (carta-lider_<contrato>_<AAAA-MM>.pdf). */
export async function baixarCartaPdf(carta: CartaLider): Promise<void> {
  const doc = await documento([carta])
  baixarBlob(doc.output('blob'), nomeArquivoCarta(carta.contratoNome, carta.competencia))
}

/** Todas as cartas: .zip com um PDF por contrato (para assinar) e, opcionalmente, um PDF único para o malote. */
export async function baixarCartasZip(cartas: CartaLider[], competencia: string): Promise<void> {
  const nomes = nomesUnicos(cartas.map((c) => nomeArquivoCarta(c.contratoNome, c.competencia)))
  const arquivos = []
  for (let i = 0; i < cartas.length; i++) {
    const doc = await documento([cartas[i]])
    arquivos.push({ nome: nomes[i], dados: new Uint8Array(doc.output('arraybuffer')) })
  }
  const zip = montarZip(arquivos)
  baixarBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `cartas-lider_${competencia.slice(0, 7)}.zip`)
}

export async function baixarCartasMalote(cartas: CartaLider[], competencia: string): Promise<void> {
  const doc = await documento(cartas)
  baixarBlob(doc.output('blob'), `cartas-lider_${competencia.slice(0, 7)}_malote.pdf`)
}
