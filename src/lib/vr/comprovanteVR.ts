import type { VRResultadoCalculo, VRConfiguracao } from '@/types'
import { escapeHtml } from '@/lib/utils'

export function gerarComprovanteIndividualHTML(
  resultado: VRResultadoCalculo,
  config: VRConfiguracao
): string {
  const valorDias = resultado.diasElegiveis * config.valorVR
  const valorExtra = resultado.extra || 0
  const valorTotal = valorDias + valorExtra
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante VR - ${escapeHtml(resultado.nome)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .card { border: 2px solid #2563eb; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; }
    h1 { color: #2563eb; margin-top: 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .total { font-size: 1.25rem; font-weight: bold; color: #059669; margin-top: 16px; }
    @media print {
      body { margin: 0; padding: 20px; }
      .card { border: 2px solid #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🍽️ Comprovante de Vale Refeição</h1>
    <div class="row"><span>👤 Colaborador</span><span>${escapeHtml(resultado.nome)}</span></div>
    <div class="row"><span>🆔 CPF</span><span>${escapeHtml(resultado.cpf)}</span></div>
    <div class="row"><span>🎫 Matrícula</span><span>${escapeHtml(resultado.matricula) || '-'}</span></div>
    <div class="row"><span>📅 Período de corte</span><span>${config.dataCorte ? new Date(config.dataCorte + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span></div>
    <div class="row"><span>✅ Dias elegíveis</span><span>${resultado.diasElegiveis}</span></div>
    <div class="row"><span>💵 Valor unitário</span><span>R$ ${config.valorVR.toFixed(2)}</span></div>
    <div class="row"><span>💵 Valor dias</span><span>R$ ${valorDias.toFixed(2)}</span></div>
    <div class="row"><span>➕ Valor extra</span><span>R$ ${valorExtra.toFixed(2)}</span></div>
    <div class="row total"><span>💰 Valor total</span><span>R$ ${valorTotal.toFixed(2)}</span></div>
    <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
      Corte: ${escapeHtml(config.dataCorte)} | Efetivação: ${escapeHtml(config.dataEfetivacao)}
    </p>
  </div>
</body>
</html>
  `.trim()
}

export function gerarComprovanteGeralHTML(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao
): string {
  const total = resultados.reduce((s, r) => s + r.valorBruto, 0)
  const rows = resultados.map(r => `
    <tr>
      <td>${escapeHtml(r.nome)}</td>
      <td>${escapeHtml(r.cpf)}</td>
      <td>${escapeHtml(r.matricula) || '-'}</td>
      <td>${r.diasElegiveis}</td>
      <td>R$ ${config.valorVR.toFixed(2)}</td>
      <td>R$ ${r.valorBruto.toFixed(2)}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovantes VR</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    .total { font-weight: bold; background: #f9fafb; }
  </style>
</head>
<body>
  <h1>Comprovantes de Vale Refeição</h1>
  <p>Período: ${escapeHtml(config.dataCorte)} | Total: R$ ${total.toFixed(2)}</p>
  <table>
    <thead>
      <tr>
        <th>Nome</th><th>CPF</th><th>Matrícula</th><th>Dias</th><th>Valor Unit.</th><th>Valor Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total">
        <td colspan="5">Total geral</td>
        <td>R$ ${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
  `.trim()
}

export function gerarRecibosLoteHTML(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao,
  projetoNome?: string
): string {
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const totalGeral = resultados.reduce((s, r) => s + r.valorBruto + (r.extra || 0), 0)
  const escProjetoNome = escapeHtml(projetoNome) || 'Plena EA Facilities'
  const escDataCorte = config.dataCorte ? new Date(config.dataCorte + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
  const escDataEfetivacao = config.dataEfetivacao ? new Date(config.dataEfetivacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

  const recibos = resultados.map(r => {
    const valorDias = r.diasElegiveis * config.valorVR
    const valorExtra = r.extra || 0
    const valorTotal = valorDias + valorExtra
    return `
    <div class="page">
      <div class="card">
        <div class="header">
          <div class="icon">VR</div>
          <h1>Recibo de Vale Refeição</h1>
          <p class="empresa">${escProjetoNome}</p>
        </div>
        <div class="body">
          <div class="info-row">
            <span class="label">Colaborador</span>
            <span class="value">${escapeHtml(r.nome)}</span>
          </div>
          <div class="info-row">
            <span class="label">CPF</span>
            <span class="value">${escapeHtml(r.cpf)}</span>
          </div>
          <div class="info-row">
            <span class="label">Matrícula</span>
            <span class="value">${escapeHtml(r.matricula) || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">Período de corte</span>
            <span class="value">${escDataCorte}</span>
          </div>
          <div class="info-row">
            <span class="label">Dias elegíveis</span>
            <span class="value highlight">${r.diasElegiveis}</span>
          </div>
          <div class="info-row">
            <span class="label">Valor unitário</span>
            <span class="value">R$ ${config.valorVR.toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="label">💵 Valor dias</span>
            <span class="value">R$ ${valorDias.toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="label">➕ Valor extra</span>
            <span class="value">R$ ${valorExtra.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="info-row total">
            <span class="label">💰 Valor total</span>
            <span class="value">R$ ${valorTotal.toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Data de emissão: ${dataEmissao}</p>
          <p>Este recibo é um comprovante de crédito de vale refeição.</p>
        </div>
      </div>
    </div>
  `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibos VR - ${escProjetoNome}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, 'Helvetica Neue', sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #1e3a8a;
      color: white;
      text-align: center;
      padding: 40px;
    }
    .cover h1 { font-size: 2.5rem; margin: 0 0 16px; }
    .cover p { font-size: 1.1rem; margin: 4px 0; }
    .cover .total-box {
      margin-top: 32px;
      border: 2px solid white;
      padding: 24px 48px;
      border-radius: 16px;
    }
    .cover .total-box strong { font-size: 2rem; display: block; }
    .page {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .page:last-child { page-break-after: auto; }
    .card {
      width: 100%;
      max-width: 680px;
      background: white;
      border-radius: 16px;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }
    .header {
      background: #1e3a8a;
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header .icon { font-size: 3rem; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 1.6rem; }
    .header .empresa { margin: 8px 0 0; font-size: 0.95rem; }
    .body { padding: 32px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px dashed #cbd5e1;
    }
    .info-row .label { font-size: 0.95rem; color: #475569; }
    .info-row .value { font-weight: 600; color: #0f172a; }
    .info-row .value.highlight { color: #15803d; font-size: 1.1rem; }
    .divider { height: 2px; background: #1e3a8a; margin: 16px 0; }
    .info-row.total { border-bottom: none; }
    .info-row.total .label { font-size: 1.1rem; color: #1e3a8a; }
    .info-row.total .value { font-size: 1.4rem; color: #15803d; }
    .assinaturas {
      display: flex;
      justify-content: space-between;
      padding: 0 32px 24px;
      gap: 32px;
    }
    .footer {
      background: #f8fafc;
      padding: 16px 32px;
      text-align: center;
      font-size: 0.8rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p { margin: 4px 0; }
    @media print {
      body { background: white; }
      .cover { background: #1e3a8a !important; }
      .header { background: #1e3a8a !important; }
      .page { padding: 0; }
      .card { box-shadow: none; border: 1px solid #000; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="icon">🍽️</div>
    <h1>Recibos de Vale Refeição</h1>
    <p>${escProjetoNome}</p>
    <p>Período: ${escDataCorte} • Efetivação: ${escDataEfetivacao}</p>
    <div class="total-box">
      <p>Total de colaboradores</p>
      <strong>${resultados.length}</strong>
      <p style="margin-top:8px">Valor total</p>
      <strong>R$ ${totalGeral.toFixed(2)}</strong>
    </div>
  </div>
  ${recibos}
</body>
</html>
  `.trim()
}

export function gerarComprovanteExcel(
  resultados: VRResultadoCalculo[],
  config: VRConfiguracao
): string {
  const linhas: string[] = []
  linhas.push(['NOME', 'CPF', 'MATRICULA', 'DIAS_ELEGIVEIS', 'VALOR_UNITARIO', 'VALOR_TOTAL'].join('\t'))

  for (const r of resultados) {
    linhas.push([
      r.nome, r.cpf, r.matricula || '', String(r.diasElegiveis),
      String(config.valorVR), String(r.valorBruto)
    ].join('\t'))
  }

  linhas.push(`TOTAL\t\t\t\t\tR$ ${resultados.reduce((s, r) => s + r.valorBruto, 0).toFixed(2)}`)
  return linhas.join('\n')
}
