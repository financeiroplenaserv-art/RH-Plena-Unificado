// Lógica pura do módulo VT — carga mensal pela escala (Fase 2a,
// docs/PLANO_MODULO_VT.md §6). Sem reconciliação e sem desconto de 6% nesta
// etapa. Regra de ouro: posto sem trajeto confirmado NUNCA ganha custo
// inventado — vai para a fila de pendências.

import type { TipoCoberturaVT, VtBilhete, VtCobertura, VtTrajeto } from '@/types/vt'
import { custoDiaTrajetoCentavos } from '@/lib/vt/trajetos'
import {
  encontrarDepartamentoFuzzy,
  redirecionarDepartamentoInativo,
  type DepartamentoFuzzy,
} from '@/lib/departamentos'

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Mês seguinte ao da data ('AAAA-MM-DD' ou 'AAAA-MM') → 'AAAA-MM'. */
export function competenciaSeguinte(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number)
  const m = mes === 12 ? 1 : mes + 1
  const a = mes === 12 ? ano + 1 : ano
  return `${a}-${String(m).padStart(2, '0')}`
}

/** '2026-11' → 'novembro/2026' (pt-BR, sem depender de Intl). */
export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${MESES[mes - 1] ?? '??'}/${ano}`
}

export interface LinhaEscalaDia {
  colaborador_id: string
  data: string
  local_nome: string | null
  local_nome_curto: string | null
  /**
   * Override de cobertura de férias/treinamento (saída de
   * `aplicarCoberturas`): quando presente, o dia conta para ESTE posto, sem
   * passar pelo resolver fuzzy — cobertura vence escala. `tipo` discrimina
   * treinamento (migration 160) para a contagem em `diasTreinamento`.
   */
  cobertura?: { departamento_id: string; rotulo: string; tipo?: TipoCoberturaVT }
}

/** Bloco de férias vindo do relatório "Gestão de escalas" (marca [FR]). */
export interface FeriasBloco {
  colaborador_id: string
  data_inicio: string // 'AAAA-MM-DD'
  data_fim: string // 'AAAA-MM-DD'
  /** Posto do titular resolvido (exibição na seção "Férias no mês"). */
  departamento_id?: string | null
}

export type DestinoFerias =
  | { tipo: 'coberta'; cobertura: VtCobertura }
  | { tipo: 'sem_cobertura'; cobertura: VtCobertura }
  | { tipo: 'pendente' }

/**
 * Destino das férias na carga: cobertura com ferista = coberta; cobertura com
 * ferista NULL = declaração "sem cobertura"; nenhuma = pendente (bloqueia a
 * gravação — portão da decisão de 21/10/2026). Match por ferias_colaborador_id
 * + sobreposição de período; em empate vale a cobertura mais recente.
 * Linhas tipo 'treinamento' (migration 160) NÃO são destino de férias — ficam
 * de fora do match.
 */
export function destinoFerias(ferias: FeriasBloco, coberturas: VtCobertura[]): DestinoFerias {
  const matches = coberturas.filter(
    (c) =>
      (c.tipo ?? 'ferias') !== 'treinamento' &&
      c.ferias_colaborador_id === ferias.colaborador_id &&
      c.data_inicio <= ferias.data_fim &&
      c.data_fim >= ferias.data_inicio
  )
  if (matches.length === 0) return { tipo: 'pendente' }
  const vencedora = matches.reduce((mais, c) =>
    (c.created_at ?? '') > (mais.created_at ?? '') ? c : mais
  )
  return vencedora.colaborador_id
    ? { tipo: 'coberta', cobertura: vencedora }
    : { tipo: 'sem_cobertura', cobertura: vencedora }
}

/**
 * Posto (departamento) de um texto do relatório do Flit. O texto antigo do
 * Flit costuma casar EXATO com a linha INATIVA duplicada (Dalias, CNOCC, Blue
 * Terminals, Flor de Lotus) enquanto os trajetos confirmados moram na linha
 * ATIVA — sem o redirect, o optante virava "trajeto pendente" e travava a
 * gravação (simulação com dados reais de 23/10/2026: 10 optantes). Linha
 * inativa sem destino ativo é mantida (vira pendência visível, não some).
 */
export function resolverPostoDoRelatorio(
  departamentos: DepartamentoFuzzy[],
  texto: string,
): DepartamentoFuzzy | null {
  const dep = encontrarDepartamentoFuzzy(departamentos, null, texto)
  if (!dep) return null
  return redirecionarDepartamentoInativo(departamentos, dep) ?? dep
}

export interface ResolucaoPosto {
  id: string
  rotulo: string
}

export interface AgrupamentoEscala {
  /** colaborador → departamento_id → dias distintos no posto (diasCobertura/diasTreinamento = quantos vieram de cobertura de férias/treinamento; datas = os dias, ordenados — base do fechamento dia a dia). */
  porColaborador: Map<string, Map<string, { dias: number; rotulo: string; diasCobertura: number; diasTreinamento: number; datas: string[] }>>
  /** colaborador → nome cru do local → dias distintos sem match. */
  naoIdentificados: Map<string, Map<string, number>>
}

/**
 * Conta os DIAS DISTINTOS de cada colaborador por posto. A resolução
 * local → departamento é injetada (a fuzzy real fica no hook); sem match o dia
 * acumula em naoIdentificados com o nome cru do local. Linha com `cobertura`
 * pula o resolver: vale o posto da cobertura, marcado em diasCobertura
 * (tipo 'ferias') ou diasTreinamento (tipo 'treinamento', migration 160).
 */
export function agruparDiasPorPosto(
  linhas: LinhaEscalaDia[],
  resolver: (nome: string) => ResolucaoPosto | null,
): AgrupamentoEscala {
  const porColaborador = new Map<string, Map<string, { dias: number; rotulo: string; diasCobertura: number; diasTreinamento: number; datas: string[] }>>()
  const naoIdentificados = new Map<string, Map<string, number>>()
  // Deduplica por dia: (colab|posto|data) e (colab|local cru|data).
  const diasPorPosto = new Map<string, Set<string>>()
  const diasSemMatch = new Map<string, Set<string>>()

  for (const l of linhas) {
    const nome = l.local_nome_curto?.trim() || l.local_nome?.trim() || ''
    let res: (ResolucaoPosto & { cobertura: boolean; treinamento: boolean }) | null = null
    if (l.cobertura) {
      res = {
        id: l.cobertura.departamento_id,
        rotulo: l.cobertura.rotulo,
        cobertura: true,
        treinamento: l.cobertura.tipo === 'treinamento',
      }
    } else if (nome) {
      const r = resolver(nome)
      if (r) res = { ...r, cobertura: false, treinamento: false }
    }
    if (res) {
      const chave = `${l.colaborador_id}|${res.id}`
      let dias = diasPorPosto.get(chave)
      if (!dias) {
        dias = new Set()
        diasPorPosto.set(chave, dias)
      }
      if (dias.has(l.data)) continue
      dias.add(l.data)
      let porPosto = porColaborador.get(l.colaborador_id)
      if (!porPosto) {
        porPosto = new Map()
        porColaborador.set(l.colaborador_id, porPosto)
      }
      const atual = porPosto.get(res.id)
      porPosto.set(res.id, {
        dias: (atual?.dias ?? 0) + 1,
        rotulo: res.rotulo,
        diasCobertura: (atual?.diasCobertura ?? 0) + (res.cobertura && !res.treinamento ? 1 : 0),
        diasTreinamento: (atual?.diasTreinamento ?? 0) + (res.treinamento ? 1 : 0),
        datas: [...(atual?.datas ?? []), l.data],
      })
    } else {
      const localCru = nome || '(sem local)'
      const chave = `${l.colaborador_id}|${localCru}`
      let dias = diasSemMatch.get(chave)
      if (!dias) {
        dias = new Set()
        diasSemMatch.set(chave, dias)
      }
      if (dias.has(l.data)) continue
      dias.add(l.data)
      let porLocal = naoIdentificados.get(l.colaborador_id)
      if (!porLocal) {
        porLocal = new Map()
        naoIdentificados.set(l.colaborador_id, porLocal)
      }
      porLocal.set(localCru, (porLocal.get(localCru) ?? 0) + 1)
    }
  }

  // Datas ordenadas (a síntese de cobertura/treinamento entra no fim da lista).
  for (const porPosto of porColaborador.values()) {
    for (const v of porPosto.values()) v.datas.sort()
  }

  return { porColaborador, naoIdentificados }
}

/** Próximo dia como string local (Date.UTC → toISOString: sem bug de fuso). */
function proximoDia(data: string): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10)
}

function vencedoraDoDia(candidatas: VtCobertura[]): VtCobertura {
  return candidatas.reduce((mais, c) => ((c.created_at ?? '') > (mais.created_at ?? '') ? c : mais))
}

/** Marcas do relatório "Gestão de escalas" por colaborador e dia. */
export type MarcasPorDia = Map<string, Map<string, string>>

/**
 * Cobertura de férias e treinamento (migrations 158/159/160 — decisão da
 * gestora, 21-22/10/2026): o Flit não mostra o destino do ferista, então o
 * registro manual manda no relatório. Para cada dia de trabalho do ferista
 * dentro de [data_inicio, data_fim] de uma cobertura DELE, o posto do dia vira
 * o da cobertura — vale igual para tipo 'ferias' e tipo 'treinamento' (os dias
 * de treinamento também geram VT). Sobreposição no mesmo dia: vale a mais
 * recentemente criada (created_at). Cobertura com ferista NULL ("sem
 * cobertura") nunca altera dia.
 *
 * Com `marcasPorDia` (relatório importado), a cobertura também CRIA dias de
 * trabalho no posto coberto quando o relatório do ferista marca folga/vazio
 * (ou ele nem aparece no relatório) — é o caso real: o ferista trabalha, mas o
 * Flit não mostra o destino. Férias/afastado/atestado do ferista NUNCA viram
 * trabalho, mesmo com cobertura. Datas comparadas como string local
 * 'AAAA-MM-DD' (nunca `new Date('AAAA-MM-DD')` — regra de fuso do projeto).
 */
export function aplicarCoberturas(
  linhasDaEscala: LinhaEscalaDia[],
  coberturas: VtCobertura[],
  rotuloDoDepartamento: (departamentoId: string) => string,
  marcasPorDia?: MarcasPorDia,
): LinhaEscalaDia[] {
  const comFerista = coberturas.filter((c) => c.colaborador_id)
  if (comFerista.length === 0) return linhasDaEscala
  const porColaborador = new Map<string, VtCobertura[]>()
  for (const c of comFerista) {
    const lista = porColaborador.get(c.colaborador_id!) ?? []
    lista.push(c)
    porColaborador.set(c.colaborador_id!, lista)
  }
  const resultado = linhasDaEscala.map((linha) => {
    const candidatas = (porColaborador.get(linha.colaborador_id) ?? []).filter(
      (c) => c.data_inicio <= linha.data && linha.data <= c.data_fim
    )
    if (candidatas.length === 0) return linha
    const vencedora = vencedoraDoDia(candidatas)
    return {
      ...linha,
      cobertura: {
        departamento_id: vencedora.departamento_id,
        rotulo: rotuloDoDepartamento(vencedora.departamento_id),
        tipo: vencedora.tipo ?? 'ferias',
      },
    }
  })

  if (!marcasPorDia) return resultado

  // Síntese: dia de folga/vazio (ou fora do relatório) do ferista dentro da
  // cobertura vira dia de trabalho no posto coberto.
  const diasExistentes = new Set(resultado.map((l) => `${l.colaborador_id}|${l.data}`))
  const sintetizadas: LinhaEscalaDia[] = []
  for (const [feristaId, lista] of porColaborador) {
    const inicio = lista.map((c) => c.data_inicio).reduce((a, b) => (b < a ? b : a))
    const fim = lista.map((c) => c.data_fim).reduce((a, b) => (b > a ? b : a))
    for (let data = inicio; data <= fim; data = proximoDia(data)) {
      if (diasExistentes.has(`${feristaId}|${data}`)) continue
      const candidatas = lista.filter((c) => c.data_inicio <= data && data <= c.data_fim)
      if (candidatas.length === 0) continue
      const marca = marcasPorDia.get(feristaId)?.get(data)
      if (marca === 'ferias' || marca === 'afastado' || marca === 'atestado') continue
      const vencedora = vencedoraDoDia(candidatas)
      sintetizadas.push({
        colaborador_id: feristaId,
        data,
        local_nome: null,
        local_nome_curto: null,
        cobertura: {
          departamento_id: vencedora.departamento_id,
          rotulo: rotuloDoDepartamento(vencedora.departamento_id),
          tipo: vencedora.tipo ?? 'ferias',
        },
      })
    }
  }
  return [...resultado, ...sintetizadas]
}

export interface DetalheCargaPosto {
  departamento_id: string
  posto: string
  dias: number
  custo_dia_centavos: number
  subtotal_centavos: number
  /** Quantos desses dias vieram de cobertura de férias (0 = nenhum). */
  dias_cobertura: number
  /** Quantos desses dias vieram de treinamento (0 = nenhum; migration 160). */
  dias_treinamento: number
  /** As datas planejadas neste posto ('AAAA-MM-DD', ordenadas) — base do fechamento dia a dia (Fase 2b). */
  datas: string[]
}

export interface ResultadoCargaMes {
  detalhe: DetalheCargaPosto[]
  necessidade_centavos: number
  /** Postos com dias na escala mas SEM trajeto confirmado — não somam. */
  pendentes: { departamento_id: string; rotulo: string; dias: number }[]
}

/**
 * Carga do mês de UM colaborador: para cada posto com dias, o trajeto
 * CONFIRMADO do par colaborador × posto dá o custo do dia; subtotal =
 * dias × custo. Posto sem trajeto confirmado vai para `pendentes` e não soma.
 */
export function calcularCargaMes(
  diasPorPosto: { departamento_id: string; rotulo: string; dias: number; diasCobertura?: number; diasTreinamento?: number; datas?: string[] }[],
  trajetos: VtTrajeto[],
  bilhetes: VtBilhete[],
  hoje: string,
): ResultadoCargaMes {
  const confirmados = trajetos.filter((t) => t.status === 'confirmado')
  const detalhe: DetalheCargaPosto[] = []
  const pendentes: ResultadoCargaMes['pendentes'] = []
  let necessidade = 0

  for (const p of diasPorPosto) {
    const trajeto = confirmados.find((t) => t.departamento_id === p.departamento_id)
    const custoDia = trajeto ? custoDiaTrajetoCentavos(trajeto, bilhetes, hoje) : null
    if (trajeto && custoDia != null) {
      const subtotal = p.dias * custoDia
      detalhe.push({
        departamento_id: p.departamento_id,
        posto: p.rotulo,
        dias: p.dias,
        custo_dia_centavos: custoDia,
        subtotal_centavos: subtotal,
        dias_cobertura: p.diasCobertura ?? 0,
        dias_treinamento: p.diasTreinamento ?? 0,
        datas: p.datas ?? [],
      })
      necessidade += subtotal
    } else {
      pendentes.push({ departamento_id: p.departamento_id, rotulo: p.rotulo, dias: p.dias })
    }
  }

  return { detalhe, necessidade_centavos: necessidade, pendentes }
}

export interface ValorCarga {
  valor_centavos: number
  /** true quando o ajuste negativo superou a necessidade e o valor truncou no piso 0. */
  ajusteMaiorQueNecessidade: boolean
}

/** Situação de UMA pessoa do relatório na visão de completude (optante ou não). */
export type SituacaoCoberturaRelatorio =
  | 'escalado' // tem dia de trabalho e todos com posto identificado
  | 'dias_sem_posto' // tem dia [T] cujo local não casou com nenhum departamento
  | 'so_ausencias' // o mês inteiro em férias/afastado/atestado (ok, informativo)
  | 'sem_registro' // nenhum dia útil no relatório (só folga/vazio)

/**
 * Completude do relatório para TODOS (decisão da gestora, 23/10/2026): antes
 * de fechar a carga queremos certeza de que cada pessoa está em algum lugar —
 * trabalhando com posto identificado, de férias/afastada, ou cobrindo alguém.
 * Prioridade da classificação: problema primeiro (dia sem posto), depois
 * trabalho ok, depois só ausências, por fim sem registro.
 */
export function situacaoCoberturaRelatorio(d: {
  diasTrabalhoIdentificados: number
  diasTrabalhoSemPosto: number
  /** [FR] + [AF] + [AT]. */
  diasAusencia: number
}): SituacaoCoberturaRelatorio {
  if (d.diasTrabalhoSemPosto > 0) return 'dias_sem_posto'
  if (d.diasTrabalhoIdentificados > 0) return 'escalado'
  if (d.diasAusencia > 0) return 'so_ausencias'
  return 'sem_registro'
}

/** Valor a creditar: necessidade + ajuste, com piso 0 (nunca negativo). */
export function valorDaCarga(necessidadeCentavos: number, ajusteCentavos: number): ValorCarga {
  const bruto = necessidadeCentavos + ajusteCentavos
  return {
    valor_centavos: Math.max(0, bruto),
    ajusteMaiorQueNecessidade: bruto < 0,
  }
}
