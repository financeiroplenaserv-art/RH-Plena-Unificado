import type { VRResultadoCalculo, VRConfiguracao } from '@/types'

export function gerarComprovanteIndividualHTML(
  resultado: VRResultadoCalculo,
  config: VRConfiguracao
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante VR - ${resultado.nome}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .card { border: 2px solid #2563eb; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; }
    h1 { color: #2563eb; margin-top: 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .total { font-size: 1.25rem; font-weight: bold; color: #059669; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Comprovante de Vale Refeição</h1>
    <div class="row"><span>Colaborador</span><span>${resultado.nome}</span></div>
    <div class="row"><span>CPF</span><span>${resultado.cpf}</span></div>
    <div class="row"><span>Matrícula</span><span>${resultado.matricula || '-'}</span></div>
    <div class="row"><span>Dias elegíveis</span><span>${resultado.diasElegiveis}</span></div>
    <div class="row"><span>Valor unitário</span><span>R$ ${config.valorVR.toFixed(2)}</span></div>
    <div class="row total"><span>Valor total</span><span>R$ ${resultado.valorBruto.toFixed(2)}</span></div>
    <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
      Corte: ${config.dataCorte} | Efetivação: ${config.dataEfetivacao}
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
      <td>${r.nome}</td>
      <td>${r.cpf}</td>
      <td>${r.matricula || '-'}</td>
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
  <p>Período: ${config.dataCorte} | Total: R$ ${total.toFixed(2)}</p>
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
  const totalGeral = resultados.reduce((s, r) => s + r.valorBruto, 0)

  const recibos = resultados.map(r => `
    <div class="page">
      <div class="card">
        <div class="header">
          <div class="icon">🍽️</div>
          <h1>Recibo de Vale Refeição</h1>
          <p class="empresa">${projetoNome || 'Plena EA Facilities'}</p>
        </div>
        <div class="body">
          <div class="info-row">
            <span class="label">👤 Colaborador</span>
            <span class="value">${r.nome}</span>
          </div>
          <div class="info-row">
            <span class="label">🆔 CPF</span>
            <span class="value">${r.cpf}</span>
          </div>
          <div class="info-row">
            <span class="label">🎫 Matrícula</span>
            <span class="value">${r.matricula || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">📅 Período de corte</span>
            <span class="value">${config.dataCorte ? new Date(config.dataCorte + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">✅ Dias elegíveis</span>
            <span class="value highlight">${r.diasElegiveis}</span>
          </div>
          <div class="info-row">
            <span class="label">💵 Valor unitário</span>
            <span class="value">R$ ${config.valorVR.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="info-row total">
            <span class="label">💰 Valor total</span>
            <span class="value">R$ ${r.valorBruto.toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Data de emissão: ${dataEmissao}</p>
          <p>Este recibo é um comprovante de crédito de vale refeição.</p>
        </div>
      </div>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibos VR - ${projetoNome || 'Vale Refeição'}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
    }
    .cover {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white;
      text-align: center;
      padding: 40px;
    }
    .cover h1 { font-size: 2.5rem; margin: 0 0 16px; }
    .cover p { font-size: 1.1rem; margin: 4px 0; opacity: 0.9; }
    .cover .total-box {
      margin-top: 32px;
      background: rgba(255,255,255,0.15);
      padding: 24px 48px;
      border-radius: 16px;
      backdrop-filter: blur(4px);
    }
    .cover .total-box strong { font-size: 2rem; }
    .page {
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .page:last-child { page-break-after: auto; }
    .card {
      width: 100%;
      max-width: 680px;
      background: white;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.12);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header .icon { font-size: 3rem; margin-bottom: 8px; }
    .header h1 { margin: 0; font-size: 1.6rem; }
    .header .empresa { margin: 8px 0 0; opacity: 0.85; font-size: 0.95rem; }
    .body { padding: 32px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .info-row .label { font-size: 0.9rem; color: #64748b; }
    .info-row .value { font-weight: 600; color: #0f172a; }
    .info-row .value.highlight { color: #16a34a; font-size: 1.1rem; }
    .divider { height: 2px; background: linear-gradient(90deg, #1e3a8a, #3b82f6); margin: 16px 0; border-radius: 2px; }
    .info-row.total { border-bottom: none; }
    .info-row.total .label { font-size: 1.1rem; color: #1e3a8a; }
    .info-row.total .value { font-size: 1.4rem; color: #16a34a; }
    .footer {
      background: #f8fafc;
      padding: 20px 32px;
      text-align: center;
      font-size: 0.8rem;
      color: #64748b;
    }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="icon">🍽️</div>
    <h1>Recibos de Vale Refeição</h1>
    <p>${projetoNome || 'Plena EA Facilities'}</p>
    <p>Período: ${config.dataCorte ? new Date(config.dataCorte + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} • Efetivação: ${config.dataEfetivacao ? new Date(config.dataEfetivacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
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
