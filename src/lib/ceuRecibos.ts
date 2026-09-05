import { escapeHtml, parseDataLocal } from '@/lib/utils'

/* ============================================================
   RECIBOS CEU — EPI e Uniforme/Crachá
   Colorido (digital) + Preto e Branco (impressão)
   ============================================================ */

// Situações permitidas na entrega (regra de negócio validada em 24/07/2026).
export const SITUACOES_ENTREGA = ['Novo', 'Substituição', 'Troca', 'Extravio/Perda'] as const

function coresSituacao(situacao: string): { bg: string; fg: string } {
  switch (situacao) {
    case 'Novo':
      return { bg: '#16A34A20', fg: '#16A34A' }
    case 'Substituição':
      return { bg: '#F9731620', fg: '#EA580C' }
    case 'Troca':
      return { bg: '#3B82F620', fg: '#2563EB' }
    case 'Extravio/Perda':
      return { bg: '#DC262620', fg: '#DC2626' }
    case 'Devolvido':
      return { bg: '#64748B20', fg: '#475569' }
    default:
      return { bg: '#64748B20', fg: '#475569' }
  }
}

function formatarData(dataStr: string | null): string {
  if (!dataStr) return '—'
  return parseDataLocal(dataStr).toLocaleDateString('pt-BR')
}

/**
 * CPF SEMPRE no formato 000.000.000-00 nos recibos (regra do programa de
 * assinatura, 04/08/2026): CPFs gravados sem o zero à esquerda na base
 * (importação de planilha) chegavam com 10 dígitos e saíam sem máscara,
 * misturando formatos no mesmo lote e fazendo o programa agrupar páginas.
 */
function formatarCPF(cpf: string): string {
  const limpo = (cpf || '').replace(/\D/g, '')
  if (!limpo) return '—'
  const completo = limpo.padStart(11, '0')
  if (completo.length !== 11) return limpo
  return completo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

interface ReciboItem {
  descricao: string
  numero_ca?: string | null
  grupo_macro: string
  subgrupo: string
}

interface ReciboEntrega {
  item: ReciboItem
  quantidade: number
  situacao: string
}

interface ReciboColaborador {
  nome: string
  matricula: string
  funcao: string
  departamento: string
  cpf: string
  data_admissao: string | null
}

export interface ReciboData {
  colaborador: ReciboColaborador
  entregas: ReciboEntrega[]
  dataEntrega: string
  numeroRecibo: string
  nomeEmpresa: string
  cnpjEmpresa: string
}

/* ============================================================
   COMPACTAÇÃO — recibo com muitos itens deve caber em 1 página A4.
   Medido com impressão headless (Chrome) em 04/08/2026: o layout
   normal do EPI estoura a página a partir de ~8 itens com CA
   (a linha do item ganha uma 2ª linha com o CA); o de Uniforme,
   a partir de ~12. Recibo de 2 páginas faz o programa de
   assinatura juntar a página de continuação com a anterior,
   gerando "arquivo com as páginas N e N+1".
   ============================================================ */

/** Altura útil da página A4 com margens de 1.5cm, ~96dpi: (297 − 30)mm */
const ALTURA_UTIL_PAGINA_PX = 1009

/** Altura fixa estimada de cada template (cabeçalho, seções, declaração, assinatura, rodapé). */
const ALTURA_FIXA_EPI_PX = 820
const ALTURA_FIXA_UNIFORME_PX = 640

function alturaItensPx(entregas: ReciboEntrega[]): number {
  // Linha com CA ocupa 2 linhas de texto (~37px); sem CA, ~24px.
  return entregas.reduce((acc, e) => acc + (e.item.numero_ca ? 37 : 24), 0)
}

const CSS_COMPACTO = `
    /* Compactação automática: recibo com muitos itens, para manter 1 página */
    body { font-size: 8.5pt !important; line-height: 1.25 !important; }
    .container { padding: 4px !important; }
    .header { padding: 8px 12px !important; margin-bottom: 8px !important; }
    .header h1 { font-size: 13pt !important; }
    .header p { font-size: 8pt !important; margin-top: 2px !important; }
    .empresa-info { padding: 5px 10px !important; margin-bottom: 6px !important; }
    .empresa-nome { font-size: 9.5pt !important; }
    .empresa-cnpj { font-size: 8pt !important; }
    .section { padding: 6px 8px !important; margin-bottom: 6px !important; }
    .section-title { font-size: 9pt !important; margin-bottom: 4px !important; padding-bottom: 2px !important; }
    .info-grid { gap: 2px 12px !important; }
    .info-item { margin-bottom: 1px !important; }
    table { margin-top: 4px !important; }
    th, td { padding: 3px 4px !important; font-size: 8.5pt !important; }
    td span { font-size: 7.5pt !important; padding: 2px 5px !important; }
    .treinamento { padding: 5px 8px !important; margin: 5px 0 !important; }
    .declaracao { padding: 5px 8px !important; margin: 5px 0 !important; }
    .declaracao p { margin-bottom: 4px !important; }
    .declaracao ul { font-size: 6.5pt !important; line-height: 1.35 !important; padding-left: 14px !important; }
    .assinatura { margin-top: 12px !important; }
    .footer { margin-top: 8px !important; padding-top: 4px !important; }`

const CSS_ULTRA_COMPACTO = `
    body { font-size: 7.5pt !important; line-height: 1.15 !important; }
    .header { padding: 6px 10px !important; margin-bottom: 6px !important; }
    .header h1 { font-size: 12pt !important; }
    th, td { padding: 2px 3px !important; font-size: 7.5pt !important; }
    td span { font-size: 6.5pt !important; padding: 1px 4px !important; }
    .declaracao ul { font-size: 6pt !important; }
    .assinatura { margin-top: 8px !important; }
    .footer { margin-top: 6px !important; }`

/**
 * CSS de compactação injetado no fim do <style> do recibo, escolhido pela
 * altura estimada do conteúdo. O nível compacto reduz fontes/espaçamentos;
 * quando a estimativa fica perto do limite da página, aplica ainda um zoom
 * calculado como margem de segurança (Chromium aplica zoom na impressão);
 * listas muito longas recebem o nível ultra compacto.
 */
function cssCompactacao(entregas: ReciboEntrega[], alturaFixa: number): string {
  const alturaItens = alturaItensPx(entregas)
  if (alturaFixa + alturaItens <= ALTURA_UTIL_PAGINA_PX) return ''

  // Estimativa conservadora da altura no modo compacto (calibrada por
  // medição real com impressão headless: o fixo encolhe ~15%, a linha ~28%).
  const alturaEstimada = alturaFixa * 0.85 + alturaItens * 0.72
  const limite = ALTURA_UTIL_PAGINA_PX * 0.93
  const zoom = alturaEstimada > limite
    ? Math.max(0.6, limite / alturaEstimada)
    : 1
  const ultra = zoom < 0.85 ? `\n${CSS_ULTRA_COMPACTO}` : ''
  const zoomCss = zoom < 1 ? `\n    .container { zoom: ${zoom.toFixed(3)}; }` : ''
  return `${CSS_COMPACTO}${ultra}${zoomCss}`
}

/* ============================================================
   RECIBO DE EPI — COLORIDO (para assinatura digital)
   ============================================================ */
export function gerarReciboEPIColorido(data: ReciboData): string {
  const { colaborador, entregas, dataEntrega, numeroRecibo, nomeEmpresa, cnpjEmpresa } = data

  const itensHTML = entregas
    .map(
      (e, idx) => `
    <tr>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #1E3A5F; font-size: 10pt;">${idx + 1}</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; font-size: 10pt;">
        <strong style="color: #1E3A5F;">${escapeHtml(e.item.descricao)}</strong>
        ${e.item.numero_ca ? `<br><span style="color: #64748b; font-size: 8pt; font-weight: 500;">CA: ${escapeHtml(e.item.numero_ca)}</span>` : ''}
      </td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 9pt;">
        <span style="background: #F97316; color: #fff; padding: 3px 8px; border-radius: 15px; font-weight: 600;">
          ${escapeHtml(e.item.subgrupo)}
        </span>
      </td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; font-size: 10pt;">${e.quantidade}</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 9pt;">
        <span style="background: ${coresSituacao(e.situacao).bg};
                     color: ${coresSituacao(e.situacao).fg};
                     padding: 3px 8px; border-radius: 12px; font-weight: 500;">
          ${escapeHtml(e.situacao)}
        </span>
      </td>
    </tr>
  `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Recibo EPI ${escapeHtml(numeroRecibo)}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #1E3A5F;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 100%;
      max-width: 100%;
      background: white;
      padding: 10px;
    }
    .header {
      background: linear-gradient(135deg, #EA580C 0%, #F97316 100%);
      color: white;
      padding: 12px 15px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 16pt;
      margin: 0;
      letter-spacing: 1px;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 9pt;
      opacity: 0.9;
    }
    .empresa-info {
      background: #FFF7ED;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      text-align: center;
      border: 1px solid #FED7AA;
    }
    .empresa-nome {
      font-weight: bold;
      font-size: 11pt;
      color: #1E3A5F;
    }
    .empresa-cnpj {
      font-size: 9pt;
      color: #64748b;
    }
    .section {
      margin-bottom: 10px;
      background: #FFF7ED;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #FED7AA;
    }
    .section-title {
      font-weight: bold;
      font-size: 10pt;
      color: #1E3A5F;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #F97316;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 15px;
    }
    .info-item {
      margin-bottom: 3px;
    }
    .info-label {
      font-weight: 600;
      font-size: 7pt;
      color: #64748b;
      text-transform: uppercase;
    }
    .info-value {
      font-size: 9pt;
      color: #1E3A5F;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    th {
      background: linear-gradient(135deg, #EA580C 0%, #F97316 100%);
      color: white;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
    }
    td {
      border: 1px solid #e2e8f0;
    }
    .declaracao {
      background: #DBEAFE;
      padding: 10px;
      border-radius: 8px;
      border-left: 4px solid #3B82F6;
      margin: 10px 0;
      font-size: 8pt;
    }
    .declaracao-title {
      font-weight: bold;
      color: #1E3A5F;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .treinamento {
      background: #FEF3C7;
      padding: 8px;
      border-radius: 8px;
      border-left: 4px solid #F59E0B;
      margin: 8px 0;
      font-size: 8pt;
    }
    .treinamento-title {
      font-weight: bold;
      color: #92400E;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .assinatura {
      margin-top: 15px;
      text-align: center;
    }
    .assinatura-line {
      border-top: 2px solid #1E3A5F;
      margin: 0 auto;
      padding-top: 6px;
      font-size: 8pt;
      color: #475569;
      max-width: 280px;
    }
    .footer {
      margin-top: 12px;
      font-size: 7pt;
      color: #64748b;
      text-align: center;
      padding-top: 8px;
      border-top: 1px solid #FED7AA;
    }
    ${cssCompactacao(entregas, ALTURA_FIXA_EPI_PX)}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RECIBO DE ENTREGA - EPI</h1>
      <p>${escapeHtml(numeroRecibo)} | Data: ${formatarData(dataEntrega)}</p>
    </div>

    <div class="empresa-info">
      <div class="empresa-nome">${escapeHtml(nomeEmpresa)}</div>
      <div class="empresa-cnpj">CNPJ: ${escapeHtml(cnpjEmpresa)}</div>
    </div>

    <div class="section">
      <div class="section-title">DADOS DO COLABORADOR</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nome</div>
          <div class="info-value">${escapeHtml(colaborador.nome)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Matrícula</div>
          <div class="info-value">${escapeHtml(colaborador.matricula)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Função</div>
          <div class="info-value">${escapeHtml(colaborador.funcao)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Departamento</div>
          <div class="info-value">${escapeHtml(colaborador.departamento)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">CPF</div>
          <div class="info-value">${formatarCPF(colaborador.cpf)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Data de Admissão</div>
          <div class="info-value">${formatarData(colaborador.data_admissao)}</div>
        </div>
      </div>
    </div>

    <div class="section" style="background: white; border: 1px solid #e2e8f0;">
      <div class="section-title">EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL - EPI</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Descrição</th>
            <th style="width: 90px; text-align: center;">Subgrupo</th>
            <th style="width: 45px; text-align: center;">Qtd</th>
            <th style="width: 80px; text-align: center;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${itensHTML}
        </tbody>
      </table>
    </div>

    <div class="treinamento">
      <div class="treinamento-title">TREINAMENTO - NR-6</div>
      <p style="margin: 0;">Declaro que recebi treinamento sobre uso, conservação e limitações dos EPIs entregues, conforme NR-6 item 6.6.</p>
    </div>

    <div class="declaracao">
      <div class="declaracao-title">DECLARAÇÃO DE RESPONSABILIDADE</div>
      <p style="margin: 0 0 8px 0;">
        Eu, <strong>${escapeHtml(colaborador.nome)}</strong>, CPF <strong>${formatarCPF(colaborador.cpf)}</strong>,
        declaro ter recebido os EPIs listados acima em perfeitas condições e estou ciente de que:
      </p>
      <ul style="margin: 0; padding-left: 20px; font-size: 7.5pt; line-height: 1.5;">
        <li>Os EPIs são de caráter <strong>individual</strong> e impróprios para uso coletivo;</li>
        <li>Irei usá-los apenas para a <strong>finalidade a que se destinam</strong>;</li>
        <li>Responsabilizar-me-ei por sua <strong>guarda e conservação</strong>;</li>
        <li>Comunicarei à empresa qualquer alteração que os tornem <strong>impróprios para uso</strong>;</li>
        <li>A não utilização do EPI acarretará <strong>sanções e possível rescisão por justa causa</strong>.</li>
      </ul>
    </div>

    <div class="assinatura" style="margin-top: 25px;">
      <div class="assinatura-line">
        <strong style="font-size: 9pt; color: #1E3A5F;">${escapeHtml(colaborador.nome)}</strong><br>
        CPF: ${formatarCPF(colaborador.cpf)}<br>
        <span style="font-size: 7pt;">Colaborador</span>
      </div>
    </div>

    <div class="footer">
      <p>Documento gerado eletronicamente - <strong style="color: #F97316;">${escapeHtml(numeroRecibo)}</strong></p>
      <p>Este documento é válido para fins de comprovação de entrega de EPI</p>
    </div>
  </div>
</body>
</html>`
}

/* ============================================================
   RECIBO DE EPI — PRETO E BRANCO (para impressão)
   ============================================================ */
export function gerarReciboEPIPB(data: ReciboData): string {
  const { colaborador, entregas, dataEntrega, numeroRecibo, nomeEmpresa, cnpjEmpresa } = data

  const itensHTML = entregas
    .map(
      (e, idx) => `
    <tr>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${idx + 1}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; font-size: 9pt;">
        <strong>${escapeHtml(e.item.descricao)}</strong>
        ${e.item.numero_ca ? `<br><span style="font-size: 8pt;">CA: ${escapeHtml(e.item.numero_ca)}</span>` : ''}
      </td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${escapeHtml(e.item.subgrupo)}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${e.quantidade}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${escapeHtml(e.situacao)}</td>
    </tr>
  `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Recibo EPI ${escapeHtml(numeroRecibo)}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .header {
      border: 2px solid #000;
      padding: 10px;
      text-align: center;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 14pt;
      margin: 0;
    }
    .header p {
      margin: 3px 0 0 0;
      font-size: 9pt;
    }
    .empresa-info {
      border: 1px solid #333;
      padding: 6px;
      margin-bottom: 8px;
      text-align: center;
      background: #f5f5f5;
    }
    .empresa-nome {
      font-weight: bold;
      font-size: 10pt;
    }
    .section {
      margin-bottom: 8px;
      border: 1px solid #333;
      padding: 8px;
    }
    .section-title {
      font-weight: bold;
      font-size: 9pt;
      border-bottom: 1px solid #333;
      padding-bottom: 3px;
      margin-bottom: 6px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
    }
    .info-item {
      margin-bottom: 2px;
    }
    .info-label {
      font-weight: bold;
      font-size: 7pt;
    }
    .info-value {
      font-size: 9pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 6px;
    }
    th, td {
      border: 1px solid #333;
      padding: 5px 4px;
    }
    th {
      background: #e0e0e0;
      font-weight: bold;
    }
    .declaracao {
      border: 1px solid #333;
      padding: 8px;
      margin: 8px 0;
      background: #f5f5f5;
      font-size: 8pt;
    }
    .declaracao-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .treinamento {
      border: 1px solid #333;
      padding: 6px;
      margin: 6px 0;
      background: #f9f9f9;
      font-size: 8pt;
    }
    .treinamento-title {
      font-weight: bold;
      margin-bottom: 3px;
      font-size: 9pt;
    }
    .assinatura {
      margin-top: 12px;
      text-align: center;
    }
    .assinatura-line {
      border-top: 1px solid #000;
      margin: 0 auto;
      padding-top: 4px;
      font-size: 8pt;
      max-width: 250px;
    }
    .footer {
      margin-top: 12px;
      font-size: 7pt;
      text-align: center;
      border-top: 1px solid #333;
      padding-top: 6px;
    }
    ${cssCompactacao(entregas, ALTURA_FIXA_EPI_PX)}
  </style>
</head>
<body>
  <div class="header">
    <h1>RECIBO DE ENTREGA - EPI</h1>
    <p>${escapeHtml(numeroRecibo)} | Data: ${formatarData(dataEntrega)}</p>
  </div>

  <div class="empresa-info">
    <div class="empresa-nome">${escapeHtml(nomeEmpresa)}</div>
    <div>CNPJ: ${escapeHtml(cnpjEmpresa)}</div>
  </div>

  <div class="section">
    <div class="section-title">DADOS DO COLABORADOR</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Nome:</div><div class="info-value">${escapeHtml(colaborador.nome)}</div></div>
      <div class="info-item"><div class="info-label">Matrícula:</div><div class="info-value">${escapeHtml(colaborador.matricula)}</div></div>
      <div class="info-item"><div class="info-label">Função:</div><div class="info-value">${escapeHtml(colaborador.funcao)}</div></div>
      <div class="info-item"><div class="info-label">Departamento:</div><div class="info-value">${escapeHtml(colaborador.departamento)}</div></div>
      <div class="info-item"><div class="info-label">CPF:</div><div class="info-value">${formatarCPF(colaborador.cpf)}</div></div>
      <div class="info-item"><div class="info-label">Data de Admissão:</div><div class="info-value">${formatarData(colaborador.data_admissao)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL - EPI</div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th>Descrição</th>
          <th style="width: 80px; text-align: center;">Subgrupo</th>
          <th style="width: 40px; text-align: center;">Qtd</th>
          <th style="width: 70px; text-align: center;">Situação</th>
        </tr>
      </thead>
      <tbody>${itensHTML}</tbody>
    </table>
  </div>

  <div class="treinamento">
    <div class="treinamento-title">TREINAMENTO - NR-6</div>
    <p style="margin: 0;">Declaro que recebi treinamento sobre uso, conservação e limitações dos EPIs entregues, conforme NR-6 item 6.6.</p>
  </div>

  <div class="declaracao">
    <div class="declaracao-title">DECLARAÇÃO DE RESPONSABILIDADE</div>
    <p style="margin: 0 0 6px 0;">
      Eu, <strong>${escapeHtml(colaborador.nome)}</strong>, CPF <strong>${formatarCPF(colaborador.cpf)}</strong>,
      declaro ter recebido os EPIs listados acima em perfeitas condições e estou ciente de que:
    </p>
    <ul style="margin: 0; padding-left: 18px; font-size: 7.5pt; line-height: 1.4;">
      <li>Os EPIs são de caráter <strong>individual</strong> e impróprios para uso coletivo;</li>
      <li>Irei usá-los apenas para a <strong>finalidade a que se destinam</strong>;</li>
      <li>Responsabilizar-me-ei por sua <strong>guarda e conservação</strong>;</li>
      <li>Comunicarei à empresa qualquer alteração que os tornem <strong>impróprios para uso</strong>;</li>
      <li>A não utilização do EPI acarretará <strong>sanções e possível rescisão por justa causa</strong>.</li>
    </ul>
  </div>

  <div class="assinatura" style="margin-top: 20px;">
    <div class="assinatura-line">
      <strong>${escapeHtml(colaborador.nome)}</strong><br>
      CPF: ${formatarCPF(colaborador.cpf)}<br>
      Colaborador
    </div>
  </div>

  <div class="footer">
    <p>${escapeHtml(numeroRecibo)} - Documento para impressão</p>
  </div>
</body>
</html>`
}

/* ============================================================
   RECIBO DE UNIFORME/CRACHÁ — COLORIDO (para assinatura digital)
   ============================================================ */
export function gerarReciboUniformeColorido(data: ReciboData): string {
  const { colaborador, entregas, dataEntrega, numeroRecibo, nomeEmpresa, cnpjEmpresa } = data

  const itensHTML = entregas
    .map(
      (e, idx) => `
    <tr>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #1E3A5F; font-size: 10pt;">${idx + 1}</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; font-size: 10pt;">
        <strong style="color: #1E3A5F;">${escapeHtml(e.item.descricao)}</strong>
      </td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 9pt;">
        <span style="background: ${e.item.grupo_macro === 'Uniformes' ? '#16A34A' : '#FACC15'};
                     color: ${e.item.grupo_macro === 'Uniformes' ? '#fff' : '#000'};
                     padding: 3px 8px; border-radius: 15px; font-weight: 600;">
          ${escapeHtml(e.item.subgrupo)}
        </span>
      </td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; font-size: 10pt;">${e.quantidade}</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 9pt;">
        <span style="background: ${coresSituacao(e.situacao).bg};
                     color: ${coresSituacao(e.situacao).fg};
                     padding: 3px 8px; border-radius: 12px; font-weight: 500;">
          ${escapeHtml(e.situacao)}
        </span>
      </td>
    </tr>
  `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Recibo Uniforme/Crachá ${escapeHtml(numeroRecibo)}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #1E3A5F;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 100%;
      max-width: 100%;
      background: white;
      padding: 10px;
    }
    .header {
      background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
      color: white;
      padding: 12px 15px;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 16pt;
      margin: 0;
      letter-spacing: 1px;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 9pt;
      opacity: 0.9;
    }
    .empresa-info {
      background: #F0FDF4;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      text-align: center;
      border: 1px solid #BBF7D0;
    }
    .empresa-nome {
      font-weight: bold;
      font-size: 11pt;
      color: #1E3A5F;
    }
    .empresa-cnpj {
      font-size: 9pt;
      color: #64748b;
    }
    .section {
      margin-bottom: 10px;
      background: #F0FDF4;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #BBF7D0;
    }
    .section-title {
      font-weight: bold;
      font-size: 10pt;
      color: #1E3A5F;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #16A34A;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 15px;
    }
    .info-item {
      margin-bottom: 3px;
    }
    .info-label {
      font-weight: 600;
      font-size: 7pt;
      color: #64748b;
      text-transform: uppercase;
    }
    .info-value {
      font-size: 9pt;
      color: #1E3A5F;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    th {
      background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
      color: white;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
    }
    td {
      border: 1px solid #e2e8f0;
    }
    .declaracao {
      background: #DBEAFE;
      padding: 10px;
      border-radius: 8px;
      border-left: 4px solid #3B82F6;
      margin: 10px 0;
      font-size: 8pt;
    }
    .declaracao-title {
      font-weight: bold;
      color: #1E3A5F;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .assinatura {
      margin-top: 15px;
      text-align: center;
    }
    .assinatura-line {
      border-top: 2px solid #1E3A5F;
      margin: 0 auto;
      padding-top: 6px;
      font-size: 8pt;
      color: #475569;
      max-width: 280px;
    }
    .footer {
      margin-top: 12px;
      font-size: 7pt;
      color: #64748b;
      text-align: center;
      padding-top: 8px;
      border-top: 1px solid #BBF7D0;
    }
    ${cssCompactacao(entregas, ALTURA_FIXA_UNIFORME_PX)}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RECIBO DE ENTREGA - UNIFORME/CRACHÁ</h1>
      <p>${escapeHtml(numeroRecibo)} | Data: ${formatarData(dataEntrega)}</p>
    </div>

    <div class="empresa-info">
      <div class="empresa-nome">${escapeHtml(nomeEmpresa)}</div>
      <div class="empresa-cnpj">CNPJ: ${escapeHtml(cnpjEmpresa)}</div>
    </div>

    <div class="section">
      <div class="section-title">DADOS DO COLABORADOR</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nome</div>
          <div class="info-value">${escapeHtml(colaborador.nome)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Matrícula</div>
          <div class="info-value">${escapeHtml(colaborador.matricula)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Função</div>
          <div class="info-value">${escapeHtml(colaborador.funcao)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Departamento</div>
          <div class="info-value">${escapeHtml(colaborador.departamento)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">CPF</div>
          <div class="info-value">${formatarCPF(colaborador.cpf)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Data de Admissão</div>
          <div class="info-value">${formatarData(colaborador.data_admissao)}</div>
        </div>
      </div>
    </div>

    <div class="section" style="background: white; border: 1px solid #e2e8f0;">
      <div class="section-title">ITENS ENTREGUES</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Descrição</th>
            <th style="width: 90px; text-align: center;">Subgrupo</th>
            <th style="width: 45px; text-align: center;">Qtd</th>
            <th style="width: 80px; text-align: center;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${itensHTML}
        </tbody>
      </table>
    </div>

    <div class="declaracao">
      <div class="declaracao-title">DECLARAÇÃO</div>
      <p style="margin: 0;">
        Eu, <strong>${escapeHtml(colaborador.nome)}</strong>, CPF <strong>${formatarCPF(colaborador.cpf)}</strong>,
        declaro ter recebido os itens listados em perfeitas condições.
      </p>
    </div>

    <div class="assinatura">
      <div class="assinatura-line">
        <strong style="font-size: 9pt; color: #1E3A5F;">${escapeHtml(colaborador.nome)}</strong><br>
        CPF: ${formatarCPF(colaborador.cpf)}<br>
        <span style="font-size: 7pt;">Colaborador</span>
      </div>
    </div>

    <div class="footer">
      <p>Documento gerado eletronicamente - <strong style="color: #16A34A;">${escapeHtml(numeroRecibo)}</strong></p>
      <p>Este documento é válido para fins de comprovação de entrega de uniforme/crachá</p>
    </div>
  </div>
</body>
</html>`
}

/* ============================================================
   RECIBO DE UNIFORME/CRACHÁ — PRETO E BRANCO (para impressão)
   ============================================================ */
export function gerarReciboUniformePB(data: ReciboData): string {
  const { colaborador, entregas, dataEntrega, numeroRecibo, nomeEmpresa, cnpjEmpresa } = data

  const itensHTML = entregas
    .map(
      (e, idx) => `
    <tr>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${idx + 1}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; font-size: 9pt;"><strong>${escapeHtml(e.item.descricao)}</strong></td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${escapeHtml(e.item.subgrupo)}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${e.quantidade}</td>
      <td style="padding: 6px 4px; border: 1px solid #333; text-align: center; font-size: 9pt;">${escapeHtml(e.situacao)}</td>
    </tr>
  `
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Recibo Uniforme/Crachá ${escapeHtml(numeroRecibo)}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.3; color: #000; margin: 0; padding: 0; }
    .header { border: 2px solid #000; padding: 10px; text-align: center; margin-bottom: 10px; }
    .header h1 { font-size: 14pt; margin: 0; }
    .header p { margin: 3px 0 0 0; font-size: 9pt; }
    .empresa-info { border: 1px solid #333; padding: 6px; margin-bottom: 8px; text-align: center; background: #f5f5f5; }
    .empresa-nome { font-weight: bold; font-size: 10pt; }
    .section { margin-bottom: 8px; border: 1px solid #333; padding: 8px; }
    .section-title { font-weight: bold; font-size: 9pt; border-bottom: 1px solid #333; padding-bottom: 3px; margin-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .info-item { margin-bottom: 2px; }
    .info-label { font-weight: bold; font-size: 7pt; }
    .info-value { font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
    th, td { border: 1px solid #333; padding: 5px 4px; }
    th { background: #e0e0e0; font-weight: bold; }
    .declaracao { border: 1px solid #333; padding: 8px; margin: 8px 0; background: #f5f5f5; font-size: 8pt; }
    .declaracao-title { font-weight: bold; margin-bottom: 4px; font-size: 9pt; }
    .assinatura { margin-top: 12px; text-align: center; }
    .assinatura-line { border-top: 1px solid #000; margin: 0 auto; padding-top: 4px; font-size: 8pt; max-width: 250px; }
    .footer { margin-top: 12px; font-size: 7pt; text-align: center; border-top: 1px solid #333; padding-top: 6px; }
    ${cssCompactacao(entregas, ALTURA_FIXA_UNIFORME_PX)}
  </style>
</head>
<body>
  <div class="header">
    <h1>RECIBO DE ENTREGA - UNIFORME/CRACHÁ</h1>
    <p>${escapeHtml(numeroRecibo)} | Data: ${formatarData(dataEntrega)}</p>
  </div>

  <div class="empresa-info">
    <div class="empresa-nome">${escapeHtml(nomeEmpresa)}</div>
    <div>CNPJ: ${escapeHtml(cnpjEmpresa)}</div>
  </div>

  <div class="section">
    <div class="section-title">DADOS DO COLABORADOR</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Nome:</div><div class="info-value">${escapeHtml(colaborador.nome)}</div></div>
      <div class="info-item"><div class="info-label">Matrícula:</div><div class="info-value">${escapeHtml(colaborador.matricula)}</div></div>
      <div class="info-item"><div class="info-label">Função:</div><div class="info-value">${escapeHtml(colaborador.funcao)}</div></div>
      <div class="info-item"><div class="info-label">Departamento:</div><div class="info-value">${escapeHtml(colaborador.departamento)}</div></div>
      <div class="info-item"><div class="info-label">CPF:</div><div class="info-value">${formatarCPF(colaborador.cpf)}</div></div>
      <div class="info-item"><div class="info-label">Data de Admissão:</div><div class="info-value">${formatarData(colaborador.data_admissao)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ITENS ENTREGUES</div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th>Descrição</th>
          <th style="width: 80px; text-align: center;">Subgrupo</th>
          <th style="width: 40px; text-align: center;">Qtd</th>
          <th style="width: 70px; text-align: center;">Situação</th>
        </tr>
      </thead>
      <tbody>${itensHTML}</tbody>
    </table>
  </div>

  <div class="declaracao">
    <div class="declaracao-title">DECLARAÇÃO</div>
    <p style="margin: 0;">
      Eu, <strong>${escapeHtml(colaborador.nome)}</strong>, CPF <strong>${formatarCPF(colaborador.cpf)}</strong>,
      declaro ter recebido os itens acima em perfeitas condições.
    </p>
  </div>

  <div class="assinatura">
    <div class="assinatura-line">
      <strong>${escapeHtml(colaborador.nome)}</strong><br>
      CPF: ${formatarCPF(colaborador.cpf)}<br>
      Colaborador
    </div>
  </div>

  <div class="footer">
    <p>${escapeHtml(numeroRecibo)} - Documento para impressão</p>
  </div>
</body>
</html>`
}

/* ============================================================
   FUNÇÃO GERADORA DE NÚMERO DE RECIBO
   ============================================================ */
export function gerarNumeroRecibo(): string {
  const ano = new Date().getFullYear()
  const sequencial = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, '0')
  return `REC-${ano}-${sequencial}`
}
