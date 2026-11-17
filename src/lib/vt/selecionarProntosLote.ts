import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import type { DiaPlanejadoLoteVT } from '@/lib/vt/construirLote'
import { resolverCustoDiarioNaData } from '@/lib/vt/temporalidade'

export function selecionarProntosLote({
  dias,
  colaboradorIds,
  decisoes,
  componentes,
  versoesPreco,
  ajustesBeneficio,
}: {
  dias: readonly DiaPlanejadoLoteVT[]
  colaboradorIds: readonly string[]
  decisoes: readonly DecisaoTrajetoVT[]
  componentes: readonly ComponenteDecisaoTrajetoVT[]
  versoesPreco: readonly VersaoPrecoPacoteVT[]
  ajustesBeneficio: readonly AjusteBeneficioVT[]
}) {
  const prontos = new Set(colaboradorIds)
  for (const colaboradorId of colaboradorIds) {
    const diasDaPessoa = dias.filter((dia) => dia.colaboradorId === colaboradorId)
    const completo = diasDaPessoa.every((dia) =>
      resolverCustoDiarioNaData({
        colaboradorId: dia.colaboradorId,
        departamentoId: dia.departamentoId,
        dataServico: dia.data,
        decisoes,
        componentes,
        versoesPreco,
        ajustes: ajustesBeneficio,
      }).pendencias.length === 0
    )
    if (!completo) prontos.delete(colaboradorId)
  }
  return {
    dias: dias.filter((dia) => prontos.has(dia.colaboradorId)),
    colaboradorIds: colaboradorIds.filter((id) => prontos.has(id)),
    pendentesIds: colaboradorIds.filter((id) => !prontos.has(id)),
  }
}
