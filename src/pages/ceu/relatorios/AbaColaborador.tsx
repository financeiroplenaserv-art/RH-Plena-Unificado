import { ModuleButton } from '@/components/layout/ModuleShell'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import type { Colaborador } from '@/types/database'
import { badgeType, formatarData, nomeItem, tipoItem } from './relatorios.utils'
import type { EntregaComSnapshot } from './relatorios.utils'

type AbaColaboradorProps = {
  colaboradoresUnicos: Colaborador[]
  entregasFiltradas: EntregaComSnapshot[]
  exportarExcel: () => void
}

export function AbaColaborador({ colaboradoresUnicos, entregasFiltradas, exportarExcel }: AbaColaboradorProps) {
  const porColaborador = colaboradoresUnicos
    .map((c) => ({
      colaborador: c,
      entregas: entregasFiltradas.filter((e) => e.colaborador_id === c.id),
    }))
    .filter(({ entregas }) => entregas.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Itens por Colaborador</h3>
        <div className="flex flex-wrap gap-2">
          <ModuleButton variant="outline" size="sm">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Relatório em Lote
          </ModuleButton>
          <ModuleButton variant="outline" size="sm" onClick={exportarExcel}>
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Exportar Excel
          </ModuleButton>
        </div>
      </div>

      {porColaborador.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Nenhum resultado encontrado.</p>
      ) : (
        porColaborador.map(({ colaborador, entregas }) => (
          <div key={colaborador.id} className="border rounded-lg border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{colaborador.nome_completo}</p>
                  <p className="text-xs text-slate-500">
                    {colaborador.matricula} — {colaborador.departamento || '—'}
                  </p>
                </div>
                <ModuleButton variant="outline" size="sm">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Gerar Recibo
                </ModuleButton>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Data</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Grupo</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Situação</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => {
                  const tipo = tipoItem(e)
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 whitespace-nowrap">{formatarData(e.data_entrega)}</td>
                      <td className="px-4 py-2 break-words max-w-[200px]">{nomeItem(e)}</td>
                      <td className="px-4 py-2">
                        <CeuBadge type={badgeType(tipo)}>
                          {tipo || '—'}
                        </CeuBadge>
                      </td>
                      <td className="px-4 py-2">{e.quantidade}</td>
                      <td className="px-4 py-2">
                        <CeuBadge type={e.data_devolucao ? 'equipamento' : 'uniforme'}>
                          {e.data_devolucao ? 'Devolvido' : 'Novo'}
                        </CeuBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
