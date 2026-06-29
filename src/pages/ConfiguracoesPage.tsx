import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { Settings } from 'lucide-react'

export function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader backTo="/" title="Configurações" description="Gerencie integrações e parâmetros da plataforma" />

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
