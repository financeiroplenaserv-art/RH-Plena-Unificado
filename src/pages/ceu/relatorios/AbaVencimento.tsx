import { CeuBadge } from '@/components/ceu/CeuBadge'
import { badgeType, diasAte, diasAteTroca, formatarData, prazoUsoItem, nomeItem } from './relatorios.utils'
import type { ItemCEU } from '@/types/database'
import type { EntregaComSnapshot } from './relatorios.utils'

type AbaVencimentoProps = {
  dadosItens: ItemCEU[]
  dadosEntregas: EntregaComSnapshot[]
}

export function AbaVencimento({ dadosItens, dadosEntregas }: AbaVencimentoProps) {
  const vencimentosCA = dadosItens
    .filter((item) => item.ca && item.validade)
    .map((item) => ({ item, dias: diasAte(item.validade!) }))
    .filter(({ dias }) => dias <= 30)
    .sort((a, b) => a.dias - b.dias)

  const trocasPrazo = dadosEntregas
    .filter((e) => !e.data_devolucao)
    .map((e) => {
      const prazo = prazoUsoItem(e)
      const dias = diasAteTroca(e.data_entrega, prazo)
      return { e, prazo, dias }
    })
    .filter(({ dias }) => dias !== null && dias <= 30)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Validade do Certificado de Aprovação (CA)
        </h3>
        <div className="border rounded-lg border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">CA</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Validade</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Dias restantes</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Situação</th>
              </tr>
            </thead>
            <tbody>
              {vencimentosCA.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Nenhum CA próximo do vencimento.
                  </td>
                </tr>
              ) : (
                vencimentosCA.map(({ item, dias }) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{item.nome}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                    </td>
                    <td className="px-4 py-2">{item.ca}</td>
                    <td className="px-4 py-2">{formatarData(item.validade)}</td>
                    <td className="px-4 py-2 font-semibold">{dias}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={dias < 0 ? 'epi' : dias <= 15 ? 'epi' : 'cracha'}>
                        {dias < 0 ? 'Vencido' : 'Próximo do vencimento'}
                      </CeuBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Prazo de Troca — Colaboradores com itens a vencer
        </h3>
        <div className="border rounded-lg border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Matrícula</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Prazo (dias)</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Dias até troca</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Situação</th>
              </tr>
            </thead>
            <tbody>
              {trocasPrazo.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Nenhum colaborador com prazo de troca próximo.
                  </td>
                </tr>
              ) : (
                trocasPrazo.map(({ e, prazo, dias }) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                    <td className="px-4 py-2">{e.colaborador?.matricula || '—'}</td>
                    <td className="px-4 py-2">{nomeItem(e)}</td>
                    <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                    <td className="px-4 py-2">{prazo}</td>
                    <td className="px-4 py-2 font-semibold">{dias}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={dias! < 0 ? 'epi' : dias! <= 15 ? 'epi' : 'cracha'}>
                        {dias! < 0 ? 'Vencido' : 'Próximo da troca'}
                      </CeuBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
