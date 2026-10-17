import { Selo } from '@/components/materiais/filas'
import { formatarData } from '@/lib/utils'

/**
 * Conteúdo da célula "Última entrega" — visual único e minimalista nas telas
 * internas (Materiais → detalhe do pedido e CEU → Pedidos): data em texto
 * normal, embaixo o detalhe discreto (quantidade em materiais, "tam. 40" em
 * uniforme/EPI) e, quando a entrega foi antes do prazo, um selo pequeno em
 * âmbar suave (vermelho fica reservado para erro). Sem histórico: só "—".
 * Nunca é usado no link público do líder.
 */
export function UltimaEntregaCelula({
  data,
  detalhe,
  antesDoPrazo = false,
  titleSelo = 'A última entrega foi há menos tempo que o prazo do item',
}: {
  /** AAAA-MM-DD; vazio = sem histórico. */
  data: string | null | undefined
  /** Ex.: "3 un" (materiais) ou "tam. 40" (uniforme). */
  detalhe?: string | null
  antesDoPrazo?: boolean
  titleSelo?: string
}) {
  if (!data) return <span className="text-muted-foreground">—</span>
  return (
    <div className="space-y-0.5 tabular-nums">
      <p>{formatarData(data)}</p>
      {detalhe && <p className="text-[11px] text-muted-foreground">{detalhe}</p>}
      {antesDoPrazo && <Selo tom="ambar" title={titleSelo}>antes do prazo</Selo>}
    </div>
  )
}
