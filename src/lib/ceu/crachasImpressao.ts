/**
 * Impressão por iframe oculto (srcdoc): o documento das folhas é isolado do
 * app (o CSS do CORH não interfere nas medidas em mm). Aguarda as imagens
 * (data URLs) carregarem antes de abrir o diálogo de impressão. Nada vem da internet.
 */
export function imprimirDocumentoHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'

    const limpar = () => {
      window.setTimeout(() => iframe.remove(), 1000)
    }

    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument
        const janela = iframe.contentWindow
        if (!doc || !janela) throw new Error('Não foi possível preparar a impressão')

        const imagens = Array.from(doc.images)
        await Promise.all(
          imagens.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((ok) => {
                  img.onload = () => ok()
                  img.onerror = () => ok()
                })
          )
        )
        janela.focus()
        janela.addEventListener('afterprint', limpar, { once: true })
        janela.print()
        // Fallback caso o navegador não dispare afterprint
        window.setTimeout(() => iframe.remove(), 5 * 60 * 1000)
        resolve()
      } catch (err) {
        limpar()
        reject(err instanceof Error ? err : new Error('Erro ao imprimir'))
      }
    }

    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}
