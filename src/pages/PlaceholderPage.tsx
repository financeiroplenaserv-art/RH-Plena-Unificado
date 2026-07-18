import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/corh/EmptyState'

interface PlaceholderPageProps {
  titulo: string
  descricao: string
}

export function PlaceholderPage({ titulo, descricao }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-foreground">{titulo}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{descricao}</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={<Construction className="size-6" strokeWidth={1.8} />}
            title="Módulo em construção"
            description="Este módulo será implementado na próxima fase. A estrutura base já está pronta para receber as funcionalidades."
          />
        </CardContent>
      </Card>
    </div>
  )
}
