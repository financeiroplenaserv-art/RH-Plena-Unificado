import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, Link2, Link2Off, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/corh/Button'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatarDataHora } from '@/lib/utils'
import { htmlCartazQr, svgQrPedido } from '@/lib/materiais/qrPedido'
import { imprimirDocumentoHtml } from '@/lib/ceu/crachasImpressao'
import { gerarLinkPedido, revogarLinkPedido, urlPedido, verLinkPedido, ErroPedidoApi } from '@/services/pedidoMateriaisApi'
import type { MatContrato, MatStatusLink } from '@/types/materiais'

// Link público do líder + QR code do quadro do contrato (sem PIN — decisão
// da gestão, 09/10/2026). Gerar um link novo invalida o anterior na hora
// (reimprimir o QR). O token nunca passa pelo banco em claro: a Edge Function
// guarda o hash e uma cópia cifrada (para reexibir aqui).

interface Props {
  contrato: MatContrato | null
  status: MatStatusLink | null
  onClose: () => void
  onAlterado: () => void
}

export function LinkPedidoDialog({ contrato, status, onClose, onAlterado }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState<'gerar' | 'revogar' | null>(null)
  const ativo = !!status?.ativo

  useEffect(() => {
    setToken(null)
    if (!contrato || !ativo) return
    let cancelado = false
    setOcupado(true)
    verLinkPedido(contrato.id)
      .then((l) => !cancelado && setToken(l.token))
      .catch((e) => !cancelado && toast.error(e instanceof ErroPedidoApi ? e.message : 'Erro ao buscar o link'))
      .finally(() => !cancelado && setOcupado(false))
    return () => {
      cancelado = true
    }
  }, [contrato, ativo])

  const url = token ? urlPedido(token) : null
  const svg = useMemo(() => (url ? svgQrPedido(url) : null), [url])

  const gerar = async () => {
    if (!contrato) return
    setConfirmar(null)
    setOcupado(true)
    try {
      const l = await gerarLinkPedido(contrato.id)
      setToken(l.token)
      toast.success(ativo ? 'Novo link gerado — o anterior deixou de valer. Reimprima o QR.' : 'Link gerado')
      onAlterado()
    } catch (e) {
      toast.error(e instanceof ErroPedidoApi ? e.message : 'Erro ao gerar o link')
    } finally {
      setOcupado(false)
    }
  }

  const revogar = async () => {
    if (!contrato) return
    setConfirmar(null)
    setOcupado(true)
    try {
      await revogarLinkPedido(contrato.id)
      setToken(null)
      toast.success('Link revogado — o QR do quadro deixou de funcionar')
      onAlterado()
    } catch (e) {
      toast.error(e instanceof ErroPedidoApi ? e.message : 'Erro ao revogar o link')
    } finally {
      setOcupado(false)
    }
  }

  const copiar = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const baixar = () => {
    if (!svg || !contrato) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `qr-pedido-${contrato.nome.replace(/[^\w-]+/g, '-').toLowerCase()}.svg`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const imprimir = () => {
    if (!url || !contrato) return
    imprimirDocumentoHtml(htmlCartazQr(contrato.nome, url)).catch(() => toast.error('Erro ao preparar a impressão'))
  }

  return (
    <>
      <Dialog open={!!contrato} onOpenChange={(aberto) => !aberto && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link do pedido — {contrato?.nome}</DialogTitle>
            <DialogDescription>
              O líder abre o link (ou lê o QR do quadro) e faz o pedido do mês sem login. A tela não mostra nenhum dado pessoal.
            </DialogDescription>
          </DialogHeader>

          {status && (
            <p className="text-sm text-muted-foreground">
              {ativo ? 'Link ativo' : 'Link revogado'} · versão {status.versao} · gerado em {formatarDataHora(status.gerado_em)}
            </p>
          )}

          {ativo && url && svg ? (
            <div className="space-y-3">
              <div
                className="mx-auto w-56 rounded-lg border border-border bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={`QR code do pedido de ${contrato?.nome}`}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  aria-label="Link do pedido"
                />
                <Button variant="outline" onClick={copiar}>
                  <Copy className="size-4" /> Copiar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={baixar}>
                  <Download className="size-4" /> Baixar QR
                </Button>
                <Button variant="outline" onClick={imprimir}>
                  <Printer className="size-4" /> Imprimir cartaz
                </Button>
              </div>
            </div>
          ) : (
            !ocupado && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {ativo ? 'Não foi possível exibir o link. Gere um novo.' : 'Este contrato ainda não tem link ativo.'}
              </p>
            )
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {ativo ? (
              <Button variant="danger" onClick={() => setConfirmar('revogar')} disabled={ocupado}>
                <Link2Off className="size-4" /> Revogar
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => (ativo ? setConfirmar('gerar') : gerar())} loading={ocupado} disabled={ocupado}>
              {ativo ? <RefreshCw className="size-4" /> : <Link2 className="size-4" />} {ativo ? 'Gerar novo link' : 'Gerar link / QR code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(aberto) => !aberto && setConfirmar(null)}
        title={confirmar === 'revogar' ? 'Revogar o link?' : 'Gerar um novo link?'}
        description={
          confirmar === 'revogar'
            ? 'O link e o QR do quadro deixam de funcionar na hora. Para voltar a receber pedidos, gere um novo link e reimprima o QR.'
            : 'O link atual e o QR impresso deixam de funcionar na hora. Será preciso reimprimir o QR do quadro e avisar o líder.'
        }
        confirmLabel={confirmar === 'revogar' ? 'Revogar' : 'Gerar novo link'}
        icon={confirmar === 'revogar' ? <Link2Off className="size-5" /> : <RefreshCw className="size-5" />}
        destructive={confirmar === 'revogar'}
        onConfirm={confirmar === 'revogar' ? revogar : gerar}
      />
    </>
  )
}
