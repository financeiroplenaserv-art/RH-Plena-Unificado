import { PageHeader } from '@/components/PageHeader'
import { EscalasShell } from './EscalasShell'
import { AbaEscalasDiario } from './AbaEscalasDiario'

export function EscalasPage() {
  return (
    <EscalasShell>
      <PageHeader backTo="/" title="Escalas" description="Visualize e confira os locais de trabalho diários" />
      <AbaEscalasDiario />
    </EscalasShell>
  )
}
