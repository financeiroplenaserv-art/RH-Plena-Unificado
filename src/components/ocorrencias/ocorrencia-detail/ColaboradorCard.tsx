import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import type { Colaborador } from '@/types/database'

interface ColaboradorCardProps {
  colaborador: Colaborador | null
  colaboradorNomeFallback: string | null
}

export function ColaboradorCard({ colaborador, colaboradorNomeFallback }: ColaboradorCardProps) {
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])

  useEffect(() => {
    // Lista completa (sem filtro de nome_curto) para resolver linhas duplicadas.
    supabase
      .from('departamentos')
      .select('id, nome, nome_curto, empresa_id, status')
      .then(({ data }) => setDepartamentos((data as DepartamentoFuzzy[]) || []))
  }, [])
  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Colaborador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {colaborador?.matricula === '999999' || !colaborador ? (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-2">
            <p className="text-xs text-amber-800 font-medium mb-1">
              {colaborador?.matricula === '999999'
                ? 'Ocorrência histórica — colaborador não identificado'
                : 'Colaborador inativo/não cadastrado'}
            </p>
            <p className="text-sm text-slate-800">{colaboradorNomeFallback || 'Nome não informado'}</p>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-slate-500 text-xs">Nome</span>
            <span className="text-slate-800">{colaborador.nome_completo}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Matrícula</span>
          <span className="text-slate-800">{colaborador?.matricula || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">CPF</span>
          <span className="text-slate-800">{colaborador?.cpf || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Cargo</span>
          <span className="text-slate-800">{colaborador?.cargo || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Departamento</span>
          <span className="text-slate-800">
            {colaborador
              ? nomeCurtoDepartamentoFuzzy(departamentos, colaborador.departamento_id, colaborador.departamento, colaborador.empresa_id)
              : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
