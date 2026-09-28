import { hojeBrasil, parseDataLocal } from '@/lib/utils'
import { podeCobrirFuncao } from './funcoesFerias'
import { periodosSeSobrepoem } from './tetoSimultaneo'
import type { FeriasAlocacao, FeriasFerista, FeriasFuncao, FeriasSolicitacao, OrigemAlocacaoFerias } from '@/types/ferias'

// ============================================================
// Alocação automática de feristas (RN-02 a RN-08, RN-10)
// ------------------------------------------------------------
// Elegibilidade de um ferista para uma vaga:
//   * RN-02.3 MATRIZ EXPLÍCITA (migration 113, decisão da gestão
//     25/09/2026) — a função do ferista cobre a da vaga quando a vaga
//     está em `cobre_funcoes` (cobrir a própria função é implícito).
//     O `nivel` NÃO decide elegibilidade — só desempate/exibição.
//     Vaga sem função aceita qualquer ferista
//   * RN-03 — nunca 2 coberturas no mesmo período
//   * RN-04 — as férias próprias (gozo/agendado não cancelada) bloqueiam
//   * RN-05 — limites de carga: max_coberturas_mes (conta alocações
//     confirmadas com qualquer dia no mês da vaga) e
//     max_dias_consecutivos (dias da vaga + coberturas confirmadas
//     ADJACENTES — fim de uma = início da outra − 1 dia).
//     EXCEÇÃO DE CONTINUAÇÃO (decisão da gestão, 25/09/2026): quando a
//     cobertura mais recente do ferista é no MESMO contrato da vaga e
//     termina até 3 dias antes do início dela (mesma folga do RN-07),
//     os limites de carga NÃO se aplicam — emendar coberturas no mesmo
//     posto é o ideal operacional, não sobrecarga.
//
// Score (pesos decrescentes, documentados no cabeçalho):
//   400 sequência (RN-07: mesmo ferista na vaga seguinte do mesmo
//       posto, folga ≤ 3 dias — RN-05 fora da continuação vence RN-07)
//   300 mesmo contrato + mesma função
//   200 mesma função, outro contrato
//   100 cobre via matriz, função diferente (antigo tier "hierarquia")
//   0–99 fairness (RN-02.4: mais tempo sem alocar; quem nunca
//       alocou = 99, acima de todos)
// Desempate final: nome do ferista (determinístico).
// ============================================================

const PESO_SEQUENCIA = 400
const PESO_MESMO_CONTRATO = 300
const PESO_MESMA_FUNCAO = 200
const PESO_HIERARQUIA = 100
const PESO_FAIRNESS_MAX = 99

/** Folga máxima (dias) entre duas vagas para a sequência RN-07 valer. */
export const FOLGA_MAXIMA_SEQUENCIA = 3

/** Período ocupado de um ferista (alocação confirmada ou sugestão já feita no lote). */
export interface OcupacaoFerista {
  ferista_id: string
  departamento_id: string | null
  data_inicio: string
  data_fim: string
}

export interface EntradaElegibilidade {
  vaga: Pick<FeriasSolicitacao, 'id' | 'departamento_id' | 'funcao_id' | 'data_inicio' | 'data_fim'>
  feristas: FeriasFerista[]
  funcoes: FeriasFuncao[]
  /** Alocações confirmadas existentes (de todos os feristas) */
  alocacoes: Pick<FeriasAlocacao, 'ferista_id' | 'departamento_id' | 'data_inicio' | 'data_fim' | 'status'>[]
  /** Férias dos feristas (o filtro por colaborador é feito aqui dentro) */
  feriasFeristas: Pick<FeriasSolicitacao, 'colaborador_id' | 'data_inicio' | 'data_fim' | 'tipo' | 'status'>[]
  /** Sugestões já feitas nesta execução — contam como ocupação (RN-03/RN-06 no mesmo lote) */
  ocupacoes?: OcupacaoFerista[]
  /** YYYY-MM-DD; padrão = hoje (Brasília) */
  hoje?: string
}

export interface CandidatoElegivel {
  ferista: FeriasFerista
  score: number
  motivo: string
}

export interface ResultadoElegibilidade {
  elegiveis: CandidatoElegivel[]
  /** Motivo consolidado quando ninguém é elegível (RN-08) */
  motivoSemElegiveis: string | null
}

export interface SugestaoAlocacao {
  vaga: FeriasSolicitacao
  ferista: FeriasFerista
  score: number
  motivo: string
}

export interface CoberturaCritica {
  vaga: FeriasSolicitacao
  motivo: string
}

export interface ResultadoAlocacao {
  sugestoes: SugestaoAlocacao[]
  criticas: CoberturaCritica[]
}

const MS_DIA = 24 * 60 * 60 * 1000

function diffDias(aISO: string, bISO: string): number {
  return Math.round((parseDataLocal(aISO).getTime() - parseDataLocal(bISO).getTime()) / MS_DIA)
}

function somarDias(iso: string, dias: number): string {
  const data = new Date(parseDataLocal(iso).getTime() + dias * MS_DIA)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** Meses (YYYY-MM) tocados pelo período. */
function mesesDoPeriodo(inicio: string, fim: string): string[] {
  const meses: string[] = []
  let [ano, mes] = inicio.split('-').map(Number)
  const [anoFim, mesFim] = fim.split('-').map(Number)
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`)
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return meses
}

type MotivoRejeicao = 'funcao' | 'conflito' | 'ferias' | 'carga'

/**
 * Feristas elegíveis para uma vaga, com score e motivo — mesma regra usada
 * pelo algoritmo automático e pelo dropdown de troca manual da aba Alocação.
 */
export function elegiveisParaVaga(entrada: EntradaElegibilidade): ResultadoElegibilidade {
  const { vaga, feristas, funcoes, alocacoes, feriasFeristas, ocupacoes = [], hoje = hojeBrasil() } = entrada
  const funcaoVaga = vaga.funcao_id ? (funcoes.find((f) => f.id === vaga.funcao_id) ?? null) : null
  const confirmadas = alocacoes.filter((a) => a.status === 'confirmada')
  const mesesVaga = mesesDoPeriodo(vaga.data_inicio, vaga.data_fim)

  const elegiveis: CandidatoElegivel[] = []
  const rejeicoes: MotivoRejeicao[] = []

  for (const ferista of feristas) {
    if (!ferista.ativo) continue

    const coberturas: OcupacaoFerista[] = [
      ...confirmadas
        .filter((a) => a.ferista_id === ferista.id)
        .map((a) => ({ ferista_id: a.ferista_id, departamento_id: a.departamento_id, data_inicio: a.data_inicio, data_fim: a.data_fim })),
      ...ocupacoes.filter((o) => o.ferista_id === ferista.id),
    ]

    // RN-02.3 — matriz explícita de cobertura (migration 113)
    const funcaoCobridor = ferista.funcao_id ? (funcoes.find((f) => f.id === ferista.funcao_id) ?? null) : null
    const mesmaFuncao = !vaga.funcao_id || ferista.funcao_id === vaga.funcao_id
    if (!mesmaFuncao) {
      if (!funcaoVaga || !funcaoCobridor || !podeCobrirFuncao(funcaoCobridor, funcaoVaga)) {
        rejeicoes.push('funcao')
        continue
      }
    }

    // RN-03 — conflito de datas com outra cobertura
    if (coberturas.some((c) => periodosSeSobrepoem(c.data_inicio, c.data_fim, vaga.data_inicio, vaga.data_fim))) {
      rejeicoes.push('conflito')
      continue
    }

    // RN-04 — férias próprias no período da vaga
    const deFerias = feriasFeristas.some(
      (s) =>
        s.colaborador_id === ferista.colaborador_id &&
        (s.tipo === 'gozo' || s.tipo === 'agendado') &&
        s.status !== 'cancelada' &&
        periodosSeSobrepoem(s.data_inicio, s.data_fim, vaga.data_inicio, vaga.data_fim)
    )
    if (deFerias) {
      rejeicoes.push('ferias')
      continue
    }

    // RN-05 — EXCEÇÃO DE CONTINUAÇÃO: a cobertura mais recente do ferista é
    // no mesmo contrato da vaga e termina até 3 dias antes do início dela →
    // continuidade no mesmo posto é o ideal operacional, os limites de carga
    // não se aplicam (eles só freiam a rotação entre contratos).
    const ultimaCobertura = [...coberturas].sort((a, b) => b.data_fim.localeCompare(a.data_fim))[0] ?? null
    const continuacaoMesmoContrato =
      ultimaCobertura !== null &&
      ultimaCobertura.departamento_id !== null &&
      ultimaCobertura.departamento_id === vaga.departamento_id &&
      ultimaCobertura.data_fim <= vaga.data_inicio &&
      diffDias(vaga.data_inicio, ultimaCobertura.data_fim) - 1 <= FOLGA_MAXIMA_SEQUENCIA

    if (!continuacaoMesmoContrato) {
      // RN-05 — limite de coberturas no(s) mês(es) da vaga
      const estourouMes = mesesVaga.some((mes) => {
        const noMes = coberturas.filter((c) => mesesDoPeriodo(c.data_inicio, c.data_fim).includes(mes)).length
        return noMes + 1 > ferista.max_coberturas_mes
      })
      if (estourouMes) {
        rejeicoes.push('carga')
        continue
      }

      // RN-05 — dias consecutivos: vaga + coberturas adjacentes encadeadas
      let inicioCadeia = vaga.data_inicio
      let fimCadeia = vaga.data_fim
      let mudou = true
      while (mudou) {
        mudou = false
        for (const c of coberturas) {
          if (c.data_fim === somarDias(inicioCadeia, -1) && c.data_inicio < inicioCadeia) {
            inicioCadeia = c.data_inicio
            mudou = true
          }
          if (c.data_inicio === somarDias(fimCadeia, 1) && c.data_fim > fimCadeia) {
            fimCadeia = c.data_fim
            mudou = true
          }
        }
      }
      if (diffDias(fimCadeia, inicioCadeia) + 1 > ferista.max_dias_consecutivos) {
        rejeicoes.push('carga')
        continue
      }
    }

    // ---- elegível: calcula score e motivo ----
    // RN-07 — sequência: última cobertura no mesmo posto terminou há ≤ 3 dias
    const sequencia = coberturas.some(
      (c) =>
        c.departamento_id !== null &&
        c.departamento_id === vaga.departamento_id &&
        c.data_fim <= vaga.data_inicio &&
        diffDias(vaga.data_inicio, c.data_fim) - 1 <= FOLGA_MAXIMA_SEQUENCIA
    )

    // "Mesmo contrato" = o contrato de origem do ferista no cadastro
    // (colaboradores.departamento_id), não o posto das coberturas dele.
    const mesmoContrato =
      vaga.departamento_id !== null && ferista.colaborador?.departamento_id === vaga.departamento_id

    let categoria: number
    let motivoCategoria: string
    if (mesmaFuncao && vaga.funcao_id !== null) {
      if (mesmoContrato) {
        categoria = PESO_MESMO_CONTRATO
        motivoCategoria = 'mesmo contrato e função'
      } else {
        categoria = PESO_MESMA_FUNCAO
        motivoCategoria = 'mesma função, outro contrato'
      }
    } else if (mesmaFuncao) {
      // vaga sem função: aceita qualquer ferista, trata como "mesma função"
      categoria = PESO_MESMA_FUNCAO
      motivoCategoria = 'vaga sem função definida'
    } else {
      // Tier "cobre via matriz, função diferente" (antiga hierarquia numérica)
      categoria = PESO_HIERARQUIA
      motivoCategoria = `cobra via matriz (${funcaoCobridor?.nome ?? '?'} → ${funcaoVaga?.nome ?? '?'})`
    }

    // RN-02.4 — fairness: mais tempo sem alocar; quem nunca alocou vem primeiro
    const ultimoFim = coberturas.map((c) => c.data_fim).filter((f) => f <= hoje).sort().pop() ?? null
    const diasSemAlocar = ultimoFim === null ? PESO_FAIRNESS_MAX : Math.min(diffDias(hoje, ultimoFim), PESO_FAIRNESS_MAX - 1)
    const motivoFairness = ultimoFim === null ? 'nunca alocou' : `há ${diasSemAlocar}d sem alocar`

    const partes = [sequencia ? 'sequência no contrato' : null, motivoCategoria, motivoFairness].filter(Boolean)
    elegiveis.push({
      ferista,
      score: (sequencia ? PESO_SEQUENCIA : 0) + categoria + Math.max(diasSemAlocar, 0),
      motivo: partes.join(' · '),
    })
  }

  if (elegiveis.length === 0) {
    let motivoSemElegiveis: string
    if (rejeicoes.length === 0 || rejeicoes.every((r) => r === 'funcao')) {
      motivoSemElegiveis = 'nenhum ferista elegível para a função'
    } else if (rejeicoes.every((r) => r === 'carga')) {
      motivoSemElegiveis = 'todos os feristas elegíveis no limite de carga'
    } else if (rejeicoes.every((r) => r === 'ferias')) {
      motivoSemElegiveis = 'todos os feristas elegíveis de férias no período'
    } else {
      motivoSemElegiveis = 'todos os feristas elegíveis em conflito de datas, férias ou limite de carga'
    }
    return { elegiveis, motivoSemElegiveis }
  }

  elegiveis.sort((a, b) => b.score - a.score || (a.ferista.colaborador?.nome_completo ?? '').localeCompare(b.ferista.colaborador?.nome_completo ?? ''))
  return { elegiveis, motivoSemElegiveis: null }
}

/**
 * Sugere feristas para as vagas sem cobertura, uma a uma em ordem de início;
 * cada sugestão vira ocupação para as vagas seguintes do mesmo lote
 * (RN-03/RN-06). Vagas sem nenhum elegível caem em `criticas` (RN-08).
 */
export function sugerirAlocacoes(entrada: {
  vagas: FeriasSolicitacao[]
  feristas: FeriasFerista[]
  funcoes: FeriasFuncao[]
  alocacoes: Pick<FeriasAlocacao, 'ferista_id' | 'departamento_id' | 'data_inicio' | 'data_fim' | 'status'>[]
  feriasFeristas: Pick<FeriasSolicitacao, 'colaborador_id' | 'data_inicio' | 'data_fim' | 'tipo' | 'status'>[]
  hoje?: string
}): ResultadoAlocacao {
  const { vagas, feristas, funcoes, alocacoes, feriasFeristas, hoje } = entrada
  const ocupacoes: OcupacaoFerista[] = []
  const sugestoes: SugestaoAlocacao[] = []
  const criticas: CoberturaCritica[] = []

  const vagasOrdenadas = [...vagas].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))

  for (const vaga of vagasOrdenadas) {
    const { elegiveis, motivoSemElegiveis } = elegiveisParaVaga({
      vaga,
      feristas,
      funcoes,
      alocacoes,
      feriasFeristas,
      ocupacoes,
      hoje,
    })
    const melhor = elegiveis[0]
    if (!melhor) {
      criticas.push({ vaga, motivo: motivoSemElegiveis ?? 'nenhum ferista elegível' })
      continue
    }
    sugestoes.push({ vaga, ferista: melhor.ferista, score: melhor.score, motivo: melhor.motivo })
    ocupacoes.push({
      ferista_id: melhor.ferista.id,
      departamento_id: vaga.departamento_id,
      data_inicio: vaga.data_inicio,
      data_fim: vaga.data_fim,
    })
  }

  return { sugestoes, criticas }
}

/** Origem gravada na alocação conforme quem disparou (RN-10). */
export function origemAlocacao(automatica: boolean): OrigemAlocacaoFerias {
  return automatica ? 'automatica' : 'manual'
}
