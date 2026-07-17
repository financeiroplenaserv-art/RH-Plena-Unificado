import { CeuBadge } from '@/components/ceu/CeuBadge'
import { badgeType, estoqueBaixo } from './relatorios.utils'
import type { ItemCEU } from '@/types/database'

type AbaEstoqueProps = {
  dadosItens: ItemCEU[]
}

export function AbaEstoque({ dadosItens }: AbaEstoqueProps) {
  const itensEstoqueBaixo = dadosItens
    .filter(estoqueBaixo)
    .sort((a, b) => (a.estoque || 0) - (b.estoque || 0))

  return (
    <div className="border rounded-lg border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Estoque atual</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Estoque mínimo</th>
            <th className="text-left px-4 py-2 font-medium text-slate-700">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {itensEstoqueBaixo.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-slate-500">
                Nenhum item abaixo do estoque mínimo.
              </td>
            </tr>
          ) : (
            itensEstoqueBaixo.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{item.nome}</td>
                <td className="px-4 py-2">
                  <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                </td>
                <td className="px-4 py-2 font-semibold text-orange-600">{item.estoque}</td>
                <td className="px-4 py-2">{item.estoque_minimo}</td>
                <td className="px-4 py-2">{(item.estoque || 0) - (item.estoque_minimo || 0)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
