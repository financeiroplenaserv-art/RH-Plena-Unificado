import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  // Ocorrência para inativo/demitido é esporádica (ex.: registro após o
  // desligamento) — por padrão a busca mostra só ativos; trocar o filtro
  // para "Inativos" restringe a busca a eles.
  const [statusBusca, setStatusBusca] = useState<'ativo' | 'inativo'>('ativo')

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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Colaborador</label>
              <Select value={statusBusca} onValueChange={(v) => setStatusBusca(v as 'ativo' | 'inativo')}>
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AutocompleteColaborador
              // Remonta ao trocar o filtro: limpa busca/seleção do status anterior.
              key={statusBusca}
              value={colaboradorId || ''}
              onChange={onColaboradorChange}
              placeholder={
                statusBusca === 'ativo'
                  ? 'Digite nome ou matrícula do colaborador...'
                  : 'Digite nome ou matrícula do colaborador inativo...'
              }
              somenteAtivos={statusBusca === 'ativo'}
              somenteInativos={statusBusca === 'inativo'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
