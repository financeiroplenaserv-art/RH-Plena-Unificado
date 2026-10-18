import { FileArchive, FileText, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/corh/Button'
import { useCartaLider } from '@/hooks/useCartaLider'
import { baixarCartaPdf, baixarCartasMalote, baixarCartasZip } from '@/lib/materiais/cartaLiderPdf'

// Botões da carta ao líder (PDF). Com `contratoId`: a carta daquele contrato
// no mês. Sem ele: todas as cartas do mês — .zip com um PDF por contrato (para
// a assinatura digital) e um PDF único para o malote.

export function CartasLiderBotoes({ competencia, contratoId }: { competencia: string; contratoId?: string | null }) {
  const { gerando, montar } = useCartaLider()

  const executar = async (modo: 'uma' | 'zip' | 'malote') => {
    const cartas = await montar(competencia, contratoId)
    if (!cartas) return
    if (cartas.length === 0) return toast.error('Não há pedido com itens neste mês para gerar carta.')
    try {
      if (modo === 'uma') await baixarCartaPdf(cartas[0])
      else if (modo === 'zip') await baixarCartasZip(cartas, competencia)
      else await baixarCartasMalote(cartas, competencia)
      const emAnalise = cartas.filter((c) => c.emAnalise).length
      toast.success(
        `${cartas.length === 1 ? 'Carta gerada' : `${cartas.length} cartas geradas`}${
          emAnalise ? ` — ${emAnalise} com itens ainda em análise (marcados na carta)` : ''
        }`
      )
    } catch (e) {
      toast.error(`Não foi possível gerar o PDF: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    }
  }

  if (contratoId) {
    return (
      <Button variant="outline" onClick={() => executar('uma')} disabled={gerando}>
        <Mail className="size-4" /> {gerando ? 'Gerando…' : 'Carta ao líder (PDF)'}
      </Button>
    )
  }
  return (
    <>
      <Button variant="outline" onClick={() => executar('zip')} disabled={gerando} title="Um PDF por contrato, num arquivo .zip (para assinar)">
        <FileArchive className="size-4" /> {gerando ? 'Gerando…' : 'Cartas aos líderes (.zip)'}
      </Button>
      <Button variant="outline" onClick={() => executar('malote')} disabled={gerando} title="Todas as cartas num PDF só, para imprimir e mandar no malote">
        <FileText className="size-4" /> PDF único (malote)
      </Button>
    </>
  )
}
