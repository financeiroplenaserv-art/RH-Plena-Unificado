import { removerAcentos } from '@/lib/utils'
import type { VtBilhete, VtTrajeto } from '@/types/vt'
import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  ComponentePacoteVT,
  DecisaoTrajetoVT,
  PacoteBeneficioVT,
  RequisitoFinanciamentoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'

export interface PacotesLegadosAdaptados {
  pacotes: PacoteBeneficioVT[]
  versoes: VersaoPrecoPacoteVT[]
  componentes: ComponentePacoteVT[]
  requisitos: RequisitoFinanciamentoVT[]
  pacoteIdPorBilheteId: ReadonlyMap<string, string>
}

function slug(nome: string): string {
  return removerAcentos(nome).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function diaAnterior(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10)
}

export function adaptarPacotesLegados(bilhetes: readonly VtBilhete[]): PacotesLegadosAdaptados {
  const pacotes: PacoteBeneficioVT[] = []
  const versoes: VersaoPrecoPacoteVT[] = []
  const componentes: ComponentePacoteVT[] = []
  const requisitos: RequisitoFinanciamentoVT[] = []
  const pacoteIdPorBilheteId = new Map<string, string>()
  const requisitosVistos = new Set<string>()
  const nomes = [...new Set(bilhetes.map((bilhete) => bilhete.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  for (const nome of nomes) {
    const pacoteId = `legado_${slug(nome)}`
    const linhas = bilhetes
      .filter((bilhete) => bilhete.nome === nome)
      .sort((a, b) =>
        a.vigente_desde.localeCompare(b.vigente_desde) ||
        (a.created_at ?? '').localeCompare(b.created_at ?? '') ||
        a.id.localeCompare(b.id)
      )
    pacotes.push({ id: pacoteId, nome, ativo: linhas.some((bilhete) => bilhete.ativo) })
    componentes.push({ id: `${pacoteId}_componente`, pacoteId, descricao: nome, ordem: 1 })

    for (const [indice, bilhete] of linhas.entries()) {
      const seguinte = linhas[indice + 1]
      versoes.push({
        id: bilhete.id,
        pacoteId,
        valorDiarioCentavos: bilhete.valor_diario_centavos,
        vigenteDesde: bilhete.vigente_desde,
        vigenteAte: seguinte ? diaAnterior(seguinte.vigente_desde) : null,
        bilheteLegadoId: bilhete.id,
      })
      pacoteIdPorBilheteId.set(bilhete.id, pacoteId)
      if (bilhete.cartao_necessario) {
        const cartao = {
          bun: 'riocard_bun',
          bui: 'riocard_bui',
          jae: 'jae',
          comum: 'comum',
        } as const
        const chave = `${pacoteId}:${bilhete.cartao_necessario}`
        if (!requisitosVistos.has(chave)) {
          requisitos.push({ pacoteId, cartao: cartao[bilhete.cartao_necessario], obrigatorio: true })
          requisitosVistos.add(chave)
        }
      }
    }
  }
  return { pacotes, versoes, componentes, requisitos, pacoteIdPorBilheteId }
}

export interface DecisaoTrajetoLegadaAdaptada {
  decisao: DecisaoTrajetoVT
  componentes: ComponenteDecisaoTrajetoVT[]
  ajustes: AjusteBeneficioVT[]
}

export function adaptarDecisaoTrajetoLegado(
  trajeto: VtTrajeto,
  pacoteIdPorBilheteId: ReadonlyMap<string, string>,
  cotacaoId: string | null,
  dataCorte: string,
): DecisaoTrajetoLegadaAdaptada {
  const decisaoId = `${trajeto.id}:decisao:1`
  const referencias = [trajeto.bilhete_id, trajeto.bilhete_2_id].filter((id): id is string => !!id)
  const referenciasLegadasNaoResolvidas = referencias.filter((id) => !pacoteIdPorBilheteId.has(id))
  const vigenteDesde = dataCorte
  const decisao: DecisaoTrajetoVT = {
    id: decisaoId,
    trajetoLegadoId: trajeto.id,
    colaboradorId: trajeto.colaborador_id,
    departamentoId: trajeto.departamento_id,
    revisao: 1,
    cotacaoId,
    status: trajeto.status === 'confirmado' ? 'confirmada' : 'sugerida',
    confirmadaPor: trajeto.confirmado_por,
    confirmadaEm: trajeto.confirmado_em,
    vigenteDesde,
    vigenteAte: null,
    origem: 'legado',
    referenciasLegadasNaoResolvidas,
  }
  const componentes = referencias.flatMap((bilheteId, indice) => {
    const pacoteId = pacoteIdPorBilheteId.get(bilheteId)
    if (!pacoteId) return []
    return [{
      id: `${decisaoId}:componente:${indice + 1}`,
      decisaoTrajetoId: decisaoId,
      pacoteId,
      ordem: indice + 1,
    }]
  })
  const ajustes: AjusteBeneficioVT[] = (trajeto.valor_extra_centavos ?? 0) === 0 ? [] : [{
    id: `${decisaoId}:ajuste:1`,
    decisaoTrajetoId: decisaoId,
    valorDiarioCentavos: trajeto.valor_extra_centavos,
    motivo: trajeto.observacao?.trim() || 'Valor extra manual importado do trajeto legado',
    autorId: trajeto.confirmado_por,
    vigenteDesde,
    vigenteAte: null,
    origem: 'legado',
  }]
  return { decisao, componentes, ajustes }
}
