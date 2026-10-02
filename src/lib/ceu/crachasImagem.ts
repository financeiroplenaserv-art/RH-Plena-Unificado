import { LADO_MAXIMO_IMAGEM_PX } from './crachas'

/** Lê um arquivo como data URL. */
export function lerArquivoComoDataUrl(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo'))
    leitor.readAsDataURL(arquivo)
  })
}

/** Converte data URL em Blob (para enviar ao Storage). */
export function dataUrlParaBlob(dataUrl: string): Blob {
  const [cabecalho, corpo] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(cabecalho)?.[1] || 'application/octet-stream'
  const binario = atob(corpo)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Lê a imagem e reduz via canvas (lado máx. 600px) — mesmo critério do
 * `lerImagem` do cracha.html: JPEG 0.85 com fundo branco para foto, PNG
 * (preserva transparência) para logo. Rejeita arquivo que não abre como imagem.
 */
export async function reduzirImagem(arquivo: Blob, manterPng: boolean): Promise<string> {
  const url = await lerArquivoComoDataUrl(arquivo)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Não consegui abrir essa imagem. Tente outro arquivo (JPG ou PNG).'))
    el.src = url
  })
  const k = Math.min(1, LADO_MAXIMO_IMAGEM_PX / img.naturalHeight, LADO_MAXIMO_IMAGEM_PX / img.naturalWidth)
  const w = Math.max(1, Math.round(img.naturalWidth * k))
  const h = Math.max(1, Math.round(img.naturalHeight * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem')
  const png = manterPng && /^data:image\/(png|webp|gif)/.test(url)
  if (!png) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85)
}
