import { Construction } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'

interface PlaceholderPageProps {
  titulo: string
  descricao: string
}

export function PlaceholderPage({ titulo, descricao }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-500">{descricao}</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <Construction className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <CardTitle className="text-lg mb-2">Módulo em construção</CardTitle>
          <p className="text-slate-500 max-w-md mx-auto">
            Este módulo será implementado na próxima fase. A estrutura base já está pronta para receber as funcionalidades.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
