import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { Users } from 'lucide-react'
import type { Colaborador } from '@/types/database'

interface ColaboradorSectionProps {
  colaborador: Colaborador | null
  onColaboradorChange: (colab: Colaborador | null) => void
  empresa: { nome: string; cnpj: string } | null
  colaboradorId?: string
}

export function ColaboradorSection({
  colaborador,
  onColaboradorChange,
  empresa,
  colaboradorId,
}: ColaboradorSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> 1. Colaborador
        </CardTitle>
      </CardHeader>
      <CardContent>
        {colaborador ? (
          <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">{colaborador.nome_completo}</p>
              <p className="text-xs text-slate-500">
                Matrícula: {colaborador.matricula} | {colaborador.cargo}
                {empresa ? ` | ${empresa.nome}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <AutocompleteColaborador
            value={colaboradorId || ''}
            onChange={onColaboradorChange}
            placeholder="Digite nome ou matrícula do colaborador..."
            label="Colaborador"
          />
        )}
      </CardContent>
    </Card>
  )
}
