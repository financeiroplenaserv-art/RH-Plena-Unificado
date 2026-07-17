import { CeuBadge } from '@/components/ceu/CeuBadge'
import { badgeType, formatarData, nomeItem, tipoItem } from './relatorios.utils'
import type { EntregaComSnapshot } from './relatorios.utils'

type AbaDataProps = {
  entregasFiltradas: EntregaComSnapshot[]
}

export function AbaData({ entregasFiltradas }: AbaDataProps) {
  return (
    <div className="border rounded-lg border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {entregasFiltradas.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-8 text-slate-500">
                Nenhuma entrega encontrada no período/filtro.
              </td>
            </tr>
          ) : (
            entregasFiltradas.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                <td className="px-4 py-2 break-words max-w-[220px]">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                <td className="px-4 py-2 break-words max-w-[200px]">{nomeItem(e)}</td>
                <td className="px-4 py-2">
                  <CeuBadge type={badgeType(tipoItem(e))}>
                    {tipoItem(e) || '—'}
                  </CeuBadge>
                </td>
                <td className="px-4 py-2">{e.quantidade}</td>
                <td className="px-4 py-2">
                  <CeuBadge type={e.data_devolucao ? 'equipamento' : 'epi'}>
                    {e.data_devolucao ? 'Devolvido' : 'Em aberto'}
                  </CeuBadge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
