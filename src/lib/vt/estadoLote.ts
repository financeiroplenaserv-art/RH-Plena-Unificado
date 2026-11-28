// Estado do lote da carga NO BANCO, para o banner da aba Carga (incidente de 28/11/2026: a carga de
// dezembro foi "importada" mas o cálculo só existia na tela de quem importou — nada no banco, e a
// aba não dizia isso). Qualquer pessoa que abre a aba vê o que está realmente salvo.

import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import type { CoberturaMesRelatorio } from '@/lib/vt/gestaoEscalasFlit'

export type TomEstadoLote = 'vermelho' | 'ambar' | 'verde'

export interface BannerEstadoLote {
  tom: TomEstadoLote
  titulo: string
  detalhe: string
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Texto de aviso quando o relatório não traz o mês inteiro (null = completo ou sem relatório). */
export function avisoCargaParcial(cobertura: CoberturaMesRelatorio | null | undefined): string | null {
  if (!cobertura || cobertura.completo) return null
  if (!cobertura.ultimo) return 'O relatório não tem nenhum dia deste mês.'
  return (
    `O relatório vai só até ${dataBr(cobertura.ultimo)}: a carga fica PARCIAL (${cobertura.diasFaltando.length} dia(s) sem VT). ` +
    'O rascunho pode ser salvo e recalculado depois com o relatório completo — mas NÃO confirme o lote antes disso: ' +
    'confirmar fecha a competência e o restante do mês só entraria por substituição do lote.'
  )
}

export function bannerEstadoLote(entrada: {
  competencia: string
  lote: LoteCargaVT | null
  /** Já terminou de ler o banco para esta competência? */
  carregado: boolean
  /** Há relatório processado neste aparelho (dias calculados)? */
  temRelatorioNaTela: boolean
  /** Formata o carimbo de hora (ISO) para exibição; padrão = texto cru. */
  formatarQuando?: (iso: string) => string
}): BannerEstadoLote | null {
  const { competencia, lote, carregado, temRelatorioNaTela } = entrada
  const formatar = entrada.formatarQuando ?? ((iso: string) => iso)
  if (!competencia || !carregado) return null
  if (!lote) {
    return temRelatorioNaTela
      ? {
          tom: 'vermelho',
          titulo: `A carga de ${competencia} AINDA NÃO está salva no banco`,
          detalhe: 'O cálculo existe só nesta tela. Clique em "Construir rascunho" (ou aguarde o salvamento automático) — sem isso, outra pessoa não vê nada.',
        }
      : {
          tom: 'vermelho',
          titulo: `Nenhuma carga salva no banco para ${competencia}`,
          detalhe: 'Importe o relatório "Gestão de escalas" do mês: o rascunho é salvo no banco automaticamente e passa a aparecer para todos.',
        }
  }
  const pessoas = lote.totaisPorColaborador.length
  const quando = lote.fonte?.importadoEm ? ` Calculado em ${formatar(lote.fonte.importadoEm)}.` : ''
  if (lote.status === 'confirmado') {
    return {
      tom: 'verde',
      titulo: `Lote de ${competencia} CONFIRMADO no banco (${pessoas} pessoa(s))`,
      detalhe: `Versão ${lote.versaoConteudo}.${quando}`,
    }
  }
  return {
    tom: 'ambar',
    titulo: `Rascunho de ${competencia} SALVO no banco (${pessoas} pessoa(s), versão ${lote.versaoConteudo})`,
    detalhe: `Ainda não confirmado: ninguém recebe até confirmar o lote.${quando}`,
  }
}
