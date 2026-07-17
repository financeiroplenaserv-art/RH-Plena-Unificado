import { CeuBadge } from '@/components/ceu/CeuBadge'
import { badgeType, formatarData } from './relatorios.utils'
import type { ItemCEU } from '@/types/database'
import type { EntregaComSnapshot } from './relatorios.utils'

type AbaItensProps = {
  dadosItens: ItemCEU[]
  entregasFiltradas: EntregaComSnapshot[]
}

export function AbaItens({ dadosItens, entregasFiltradas }: AbaItensProps) {
  const entregasEmAberto = entregasFiltradas.filter((e) => !e.data_devolucao)
  const porItem = dadosItens
    .map((item) => ({
      item,
      entregas: entregasEmAberto.filter(
        (e) => e.item_id === item.id || e.item?.id === item.id
      ),
    }))
    .filter(({ entregas }) => entregas.length > 0)

  return (
    <div className="space-y-4">
      {porItem.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Nenhum item em aberto com colaboradores.</p>
      ) : (
        porItem.map(({ item, entregas }) => (
          <div key={item.id} className="border rounded-lg border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{item.nome}</p>
                  <p className="text-xs text-slate-500">{item.subgrupo || '—'}</p>
                </div>
                <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Matrícula</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                    <td className="px-4 py-2">{e.colaborador?.matricula || '—'}</td>
                    <td className="px-4 py-2">{e.quantidade}</td>
                    <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
