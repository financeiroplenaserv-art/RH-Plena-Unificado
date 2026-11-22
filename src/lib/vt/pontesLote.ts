/**
 * Pontes entre o lote de carga (rotas confirmadas — vt_carga_lotes) e o resto do VT
 * (21/11/2026, depois do recomeço): a aba Fechamento lê `vt_cargas` gravadas, e o ajuste
 * do mês anterior vem de `vt_fechamentos`. Lógica pura — a gravação fica no componente.
 */
import type { LancamentoAjusteVT, LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import type { VtCargaDetalhe } from '@/types/vt'

export interface ExtraMensalParaAjuste {
  id: string
  colaborador_id: string
  competencia: string
  valor_centavos: number
  motivo: string
  criado_por?: string | null
  criado_em?: string
}

/** "Extra no mês" (vt_extras_mensais) → crédito do lote com origem própria e o motivo como evidência. */
export function ajustesDosExtrasMensais(
  extras: readonly ExtraMensalParaAjuste[],
  criadoEm: string,
): LancamentoAjusteVT[] {
  return extras
    .filter((e) => e.valor_centavos > 0)
    .map((e) => {
      const motivo = e.motivo.trim()
      if (!motivo) throw new Error('O extra do mês precisa de motivo.')
      return {
        id: `extra:${e.id}`,
        loteOrigemId: `extra_mensal:${e.competencia}`,
        linhaOrigemId: null,
        colaboradorId: e.colaborador_id,
        data: null,
        tipo: 'credito' as const,
        origem: 'extra_mensal' as const,
        valorCentavos: e.valor_centavos,
        evidencia: motivo,
        criadoPor: e.criado_por ?? 'extra_mensal',
        criadoEm: e.criado_em ?? criadoEm,
        consumidoPorLoteId: null,
      }
    })
}

export interface FechamentoParaAjuste {
  id: string
  colaborador_id: string
  competencia: string
  desconto_centavos: number | null
  credito_centavos: number | null
}

/**
 * Fechamento do mês anterior → lançamentos do lote: falta comprovada vira débito e dia
 * trabalhado fora da carga vira crédito (mesma regra do fluxo antigo: ajuste = crédito − desconto).
 */
export function ajustesDoFechamentoAnterior(
  fechamentos: readonly FechamentoParaAjuste[],
  criadoEm: string,
): LancamentoAjusteVT[] {
  const lancamentos: LancamentoAjusteVT[] = []
  for (const f of fechamentos) {
    const base = {
      loteOrigemId: `fechamento:${f.competencia}`,
      linhaOrigemId: null,
      colaboradorId: f.colaborador_id,
      data: null,
      criadoPor: 'fechamento',
      criadoEm,
      consumidoPorLoteId: null,
    }
    if ((f.desconto_centavos ?? 0) > 0) {
      lancamentos.push({
        ...base,
        id: `fechamento:${f.id}:desconto`,
        tipo: 'debito',
        valorCentavos: f.desconto_centavos!,
        evidencia: `Fechamento de ${f.competencia}: faltas descontadas`,
      })
    }
    if ((f.credito_centavos ?? 0) > 0) {
      lancamentos.push({
        ...base,
        id: `fechamento:${f.id}:credito`,
        tipo: 'credito',
        valorCentavos: f.credito_centavos!,
        evidencia: `Fechamento de ${f.competencia}: dias trabalhados fora da carga`,
      })
    }
  }
  return lancamentos
}

export type CargaGravadaDoLote = {
  colaborador_id: string
  competencia: string
  detalhe: VtCargaDetalhe[]
  necessidade_centavos: number
  ajuste_centavos: number
  valor_centavos: number
  gerada_por: string
  status: 'gravada'
  confirmada_em: string
  confirmada_por: string
}

/**
 * Lote CONFIRMADO → linhas de `vt_cargas` gravadas (uma por pessoa completa), no formato que
 * o Fechamento já lê: detalhe por posto e custo do dia, com as datas planejadas.
 * Pessoa parcial (sem valor) não entra — continua pendente.
 */
export function cargasDoLoteConfirmado(
  lote: LoteCargaVT,
  nomePosto: (departamentoId: string) => string,
  usuarioId: string,
  confirmadaEm: string,
): CargaGravadaDoLote[] {
  if (lote.status !== 'confirmado') throw new Error('Só um lote confirmado vira carga gravada.')
  const cargas: CargaGravadaDoLote[] = []
  for (const total of lote.totaisPorColaborador) {
    if (total.status !== 'completo' || total.valorCentavos == null) continue
    const grupos = new Map<string, VtCargaDetalhe>()
    for (const linha of lote.linhas) {
      if (linha.colaboradorId !== total.colaboradorId || linha.custoDiaCentavos == null) continue
      const chave = `${linha.departamentoId}|${linha.custoDiaCentavos}`
      const grupo = grupos.get(chave) ?? {
        departamento_id: linha.departamentoId,
        posto: nomePosto(linha.departamentoId),
        dias: 0,
        custo_dia_centavos: linha.custoDiaCentavos,
        subtotal_centavos: 0,
        dias_cobertura: 0,
        dias_treinamento: 0,
        datas: [],
      }
      grupo.dias += 1
      grupo.subtotal_centavos += linha.custoDiaCentavos
      if (linha.origemDia === 'cobertura') grupo.dias_cobertura = (grupo.dias_cobertura ?? 0) + 1
      if (linha.origemDia === 'treinamento') grupo.dias_treinamento = (grupo.dias_treinamento ?? 0) + 1
      grupo.datas!.push(linha.data)
      grupos.set(chave, grupo)
    }
    const detalhe = [...grupos.values()]
      .map((g) => ({ ...g, datas: [...g.datas!].sort() }))
      .sort((a, b) => a.posto.localeCompare(b.posto, 'pt-BR') || a.custo_dia_centavos - b.custo_dia_centavos)
    cargas.push({
      colaborador_id: total.colaboradorId,
      competencia: lote.competencia,
      detalhe,
      necessidade_centavos: total.necessidadeCentavos,
      // Inclui o "Extra no mês" (migration 176) para que necessidade + ajuste = valor. O extra NÃO tem
      // datas em `detalhe`, então o Fechamento (que só lê detalhe[].datas) nunca o desconta nem credita;
      // o motivo fica em vt_extras_mensais.
      ajuste_centavos: total.ajusteCentavos,
      valor_centavos: total.valorCentavos,
      gerada_por: usuarioId,
      status: 'gravada',
      confirmada_em: confirmadaEm,
      confirmada_por: usuarioId,
    })
  }
  return cargas
}
