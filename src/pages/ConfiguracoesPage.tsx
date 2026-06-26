import { Card, CardContent } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Configurações</h2>
          <p className="text-sm text-slate-500">Gerencie integrações e parâmetros da plataforma</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          <Settings className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">Nenhuma configuração ativa no momento.</p>
          <p className="mt-1">A configuração do token do e-Contador foi movida para a tela de importação.</p>
        </CardContent>
      </Card>
    </div>
  )
}
