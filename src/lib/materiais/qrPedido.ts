import { renderSVG } from 'uqr'

// QR code do link de pedido do contrato (gerado no navegador, sem serviço
// externo — o link é o segredo do contrato). Cartaz A4 para o quadro do posto.

const escaparHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** SVG do QR (correção de erro M, borda de 2 módulos). */
export function svgQrPedido(url: string): string {
  return renderSVG(url, { ecc: 'M', border: 2, pixelSize: 8 })
}

/** Documento HTML do cartaz A4 (impressão por iframe isolado). */
export function htmlCartazQr(nomeContrato: string, url: string): string {
  const nome = escaparHtml(nomeContrato)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR do pedido — ${nome}</title>
<style>
@page { size: A4 portrait; margin: 15mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0C1730; text-align: center; }
.marca { font-size: 11pt; letter-spacing: .08em; text-transform: uppercase; color: #0F6CBD; margin-top: 10mm; }
h1 { font-size: 26pt; margin: 6mm 0 2mm; }
.contrato { font-size: 18pt; margin: 0 0 10mm; }
.qr svg { width: 120mm; height: 120mm; }
.passos { font-size: 13pt; line-height: 1.5; margin: 10mm auto 0; max-width: 150mm; }
.prazo { font-size: 12pt; margin-top: 6mm; color: #444; }
</style></head><body>
<div class="marca">Plena Facilities</div>
<h1>Pedido mensal de materiais</h1>
<p class="contrato">${nome}</p>
<div class="qr">${svgQrPedido(url)}</div>
<p class="passos">Aponte a câmera do celular para o código e faça o pedido de materiais, uniformes, EPIs, crachás e kit portaria do posto.</p>
<p class="prazo">Prazo: do dia 1 ao dia 15 de cada mês.</p>
</body></html>`
}
