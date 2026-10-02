import type { ContratoAdicional, StatusDiaAdicional } from '@/types/adicionais'
import {
  diaIntrajornada,
  contarDiasFeriadoEscalado,
  adicionalTitular30,
  insalubridadeSubstituto,
  periculosidadeSubstituto,
  contarDiasTransferidos,
  substituicaoGeraAdicional,
  statusPrevistoPelaEscala,
  dentroDoVinculo,
  diasBaseAdicional,
  gerarDiasDoPeriodo,
} from './calculoAdicionais'

// ============================================================
// Relatório de Adicionais — agregação por colaborador × contrato.
// Lógica pura extraída de AdicionaisRelatorioPage (02/10/2026) para ser
// testável. A página só monta os mapas e chama calcularRelatorioAdicionais.
// ============================================================

export interface RelatorioAdicionalAgregado {
  colaborador_id: string
  colaborador_nome: string
  contrato_id: string
  contrato_nome: string
  departamento: string
  dias_trabalhados: number
  dias_noturno: number
  dias_periculosidade: number
  dias_insalubridade: number
  dias_intrajornada: number
  dias_feriado: number
  folgas: number
  faltas: number
  ferias: number
  afastados: number
}

export interface VinculoRelatorio {
  id: string
  contrato_id: string
  contrato_nome?: string
  colaborador_id: string
  colaborador_nome?: string
  data_inicio: string
  data_fim: string | null
}

export interface DiaCalendarioBasico {
  vinculo_id: string
  data: string
  status: StatusDiaAdicional | string
  substituto_colaborador_id?: string | null
  substituto_colaborador_nome?: string | null
  substituto_sem_adicional?: boolean | null
}

export interface ParametrosRelatorioAdicionais {
  inicio: string
  fim: string
  /** Vínculos que se sobrepõem ao período. */
  vinculos: VinculoRelatorio[]
  /** Calendário já deduplicado por vínculo + data. */
  calendario: DiaCalendarioBasico[]
  contratos: Map<string, ContratoAdicional>
  datasFeriados: Set<string>
  nomeColaborador?: (colaboradorId: string) => string | undefined
  nomeDepartamentoDoContrato?: (contrato: ContratoAdicional | undefined) => string
}

function normalizarStatus(status: unknown): StatusDiaAdicional {
  if (
    status === 'trabalhou' ||
    status === 'falta' ||
    status === 'ferias' ||
    status === 'afastado' ||
    status === 'folga' ||
    status === 'folga_substituicao'
  ) {
    return status
  }
  return 'trabalhou'
}

function registroVazio(base: Pick<RelatorioAdicionalAgregado, 'colaborador_id' | 'colaborador_nome' | 'contrato_id' | 'contrato_nome' | 'departamento'>): RelatorioAdicionalAgregado {
  return {
    ...base,
    dias_trabalhados: 0,
    dias_noturno: 0,
    dias_periculosidade: 0,
    dias_insalubridade: 0,
    dias_intrajornada: 0,
    dias_feriado: 0,
    folgas: 0,
    faltas: 0,
    ferias: 0,
    afastados: 0,
  }
}

function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1, d + n)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/**
 * Agrega o relatório de adicionais do período.
 *
 * Proporcional ao vínculo (decisão da gestão, 02/10/2026): o TITULAR só conta
 * os dias dentro de [data_inicio, data_fim] do vínculo — antes, os dias fora
 * do vínculo eram inferidos pela escala e o titular recebia como se estivesse
 * no posto o período todo. Insalubridade/periculosidade do titular =
 * min(30, dias do vínculo no período) − faltas − transferidos.
 * Lançamentos gravados FORA do vínculo são ignorados para o titular, mas as
 * coberturas de substituto continuam gerando o adicional do SUBSTITUTO
 * exatamente como antes (caso Pedro/Marcelo).
 */
export function calcularRelatorioAdicionais(p: ParametrosRelatorioAdicionais): RelatorioAdicionalAgregado[] {
  const { inicio, fim, vinculos, calendario, contratos: mapContrato, datasFeriados } = p
  const nomeColaborador = p.nomeColaborador ?? (() => undefined)
  const nomeDept = p.nomeDepartamentoDoContrato ?? (() => '—')

  const contagem = new Map<string, RelatorioAdicionalAgregado>()

  // Índice do calendário por vínculo|data (antes: find linear por dia)
  const calendarioPorChave = new Map<string, DiaCalendarioBasico>()
  calendario.forEach(d => calendarioPorChave.set(`${d.vinculo_id}|${d.data}`, d))

  /**
   * Dia efetivo do vínculo: o registro gravado ou, sem registro, a previsão
   * da escala — mas só DENTRO do vínculo. Fora dele, sem registro, não há
   * dia (null): ninguém é inferido como "trabalhou" antes da admissão.
   */
  const getDiaEfetivo = (vinculo: VinculoRelatorio, regime: string | undefined, data: string): DiaCalendarioBasico & { status: StatusDiaAdicional } | null => {
    const salvo = calendarioPorChave.get(`${vinculo.id}|${data}`)
    if (salvo) {
      return {
        vinculo_id: vinculo.id,
        data,
        status: normalizarStatus(salvo.status),
        substituto_colaborador_id: salvo.substituto_colaborador_id,
        substituto_colaborador_nome: salvo.substituto_colaborador_nome,
        substituto_sem_adicional: salvo.substituto_sem_adicional,
      }
    }
    if (!dentroDoVinculo(data, vinculo)) return null
    return {
      vinculo_id: vinculo.id,
      data,
      status: statusPrevistoPelaEscala(regime, vinculo.data_inicio, data),
      substituto_colaborador_id: null,
      substituto_colaborador_nome: null,
      substituto_sem_adicional: null,
    }
  }

  // Regra da gestão (01/08/2026) — estruturas da divisão titular/substituto:
  const chavesVinculos = new Set(vinculos.map(v => `${v.colaborador_id}|${v.contrato_id}`))
  const chavesSubstitutoPuro = new Set<string>() // linhas que existem só por cobertura (sem vínculo próprio)
  // férias/afastado e folga com substituição por vínculo (a folga pareada do
  // 12×36 é calculada no fechamento). `dentro` = dia dentro do vínculo: só
  // esses saem da conta do titular; os de fora servem apenas ao substituto.
  const diasTransferiveisPorVinculo = new Map<string, { data: string; substitutoId: string | null; dentro: boolean }[]>()
  const cobertosFaltaPorChave = new Map<string, number>() // substituto: dias de FALTA cobertos (folga com substituição entra pelos transferíveis)

  // Inicializa todos os vínculos ativos no período
  vinculos.forEach(v => {
    const contrato = mapContrato.get(v.contrato_id)
    const chave = `${v.colaborador_id}|${v.contrato_id}`
    if (!contagem.has(chave)) {
      contagem.set(chave, registroVazio({
        colaborador_id: v.colaborador_id,
        colaborador_nome: nomeColaborador(v.colaborador_id) || v.colaborador_nome || '—',
        contrato_id: v.contrato_id,
        contrato_nome: contrato?.nome || v.contrato_nome || '—',
        departamento: nomeDept(contrato),
      }))
    }
  })

  const diasDoPeriodo = gerarDiasDoPeriodo(inicio, fim)

  // Mapa auxiliar para corrigir dias 'afastado' isolados dentro de um bloco de férias
  const chaveDia = (vinculoId: string, data: string) => `${vinculoId}|${data}`
  const feriasPorVinculo = new Set<string>()
  vinculos.forEach(v => {
    const regime = mapContrato.get(v.contrato_id)?.regime_trabalho
    diasDoPeriodo.forEach(data => {
      if (getDiaEfetivo(v, regime, data)?.status === 'ferias') feriasPorVinculo.add(chaveDia(v.id, data))
    })
  })

  const statusEfetivo = (vinculo: VinculoRelatorio, status: StatusDiaAdicional, data: string): StatusDiaAdicional => {
    if (status !== 'afastado') return status
    if (feriasPorVinculo.has(chaveDia(vinculo.id, somarDias(data, -1))) || feriasPorVinculo.has(chaveDia(vinculo.id, somarDias(data, 1)))) {
      return 'ferias'
    }
    return 'afastado'
  }

  vinculos.forEach(vinculo => {
    const contrato = mapContrato.get(vinculo.contrato_id)
    const chave = `${vinculo.colaborador_id}|${vinculo.contrato_id}`
    const dept = nomeDept(contrato)
    const registro = contagem.get(chave)!

    const regime = contrato?.regime_trabalho
    const diasDentro = diasDoPeriodo.filter(data => dentroDoVinculo(data, vinculo))
    // Adicional de feriado (regra da gestão): só contratos com o flag, e
    // conta o feriado apenas quando a escala previa trabalho no dia — e
    // somente nos dias dentro do vínculo. Substituto/cobertura não recebe.
    if (contrato?.adicionais?.feriado) {
      registro.dias_feriado += contarDiasFeriadoEscalado(regime, vinculo.data_inicio, diasDentro, datasFeriados)
    }
    diasDoPeriodo.forEach(data => {
      const dia = getDiaEfetivo(vinculo, regime, data)
      if (!dia) return // fora do vínculo e sem lançamento: não existe
      const dentro = dentroDoVinculo(data, vinculo)
      const status = statusEfetivo(vinculo, dia.status, data)

      // Dias que saem da conta do titular quando há substituição: férias,
      // afastamento e folga com substituição. A folga pareada do 12×36 é
      // calculada no fechamento por contarDiasTransferidos.
      if (status === 'ferias' || status === 'afastado' || status === 'folga_substituicao') {
        const lista = diasTransferiveisPorVinculo.get(vinculo.id) ?? []
        lista.push({ data, substitutoId: dia.substituto_colaborador_id ?? null, dentro })
        diasTransferiveisPorVinculo.set(vinculo.id, lista)
      }

      // Colunas do titular: só dias dentro do vínculo (02/10/2026)
      if (dentro) {
        if (status === 'trabalhou') {
          registro.dias_trabalhados += 1
          if (contrato?.adicionais?.noturno) registro.dias_noturno += 1
          if (contrato?.adicionais?.periculosidade) registro.dias_periculosidade += 1
          if (contrato?.adicionais?.insalubridade) registro.dias_insalubridade += 1
          if (diaIntrajornada(contrato, data)) registro.dias_intrajornada += 1
        } else if (status === 'folga' || status === 'folga_substituicao') {
          registro.folgas += 1
        } else if (status === 'falta') {
          registro.faltas += 1
        } else if (status === 'ferias') {
          registro.ferias += 1
        } else if (status === 'afastado') {
          registro.afastados += 1
        }
      }

      // Se há substituto em dia de ausência, conta como trabalhado para o
      // substituto — dentro OU fora do vínculo do titular (a vaga foi
      // coberta). Exceção (decisão da gestão, 27/08/2026): substituição
      // "sem adicional" (controle interno — substituto pago por fora) não
      // gera linha nem dias para o substituto; o dia sai do titular e não
      // é pago a ninguém (a transferência do titular acima não muda).
      const temSubstituto = substituicaoGeraAdicional(dia) &&
        (status === 'falta' || status === 'ferias' || status === 'afastado' || status === 'folga_substituicao')

      if (temSubstituto) {
        const substitutoId = dia.substituto_colaborador_id!
        const chaveSubst = `${substitutoId}|${vinculo.contrato_id}`
        let registroSubst = contagem.get(chaveSubst)

        if (!registroSubst) {
          registroSubst = registroVazio({
            colaborador_id: substitutoId,
            colaborador_nome: nomeColaborador(substitutoId) || dia.substituto_colaborador_nome || '—',
            contrato_id: vinculo.contrato_id,
            contrato_nome: contrato?.nome || vinculo.contrato_nome || '—',
            departamento: dept,
          })
          contagem.set(chaveSubst, registroSubst)
          // Linha criada só por cobertura (sem vínculo próprio no contrato):
          // no fechamento ela segue a regra do substituto, não a do titular.
          if (!chavesVinculos.has(chaveSubst)) chavesSubstitutoPuro.add(chaveSubst)
        }

        registroSubst.dias_trabalhados += 1
        if (contrato?.adicionais?.noturno) registroSubst.dias_noturno += 1
        if (diaIntrajornada(contrato, data)) registroSubst.dias_intrajornada += 1
        // Insalubridade/periculosidade do substituto são calculadas no
        // fechamento (regra 01/08/2026); aqui só marcamos a cobertura de
        // FALTA. Férias, afastado e folga com substituição entram via
        // diasTransferiveisPorVinculo. Cada dia coberto conta UMA vez
        // (decisão da gestão, 02/10/2026): antes a folga com substituição
        // entrava aqui E nos transferíveis — 13 dias cobertos viravam 26
        // (caso Marcelo Ramos Rufino).
        if (status === 'falta') {
          cobertosFaltaPorChave.set(chaveSubst, (cobertosFaltaPorChave.get(chaveSubst) ?? 0) + 1)
        }
      }
    })
  })

  const resultado = Array.from(contagem.values())

  // Fechamento de insalubridade/periculosidade (regra da gestão, 01/08/2026;
  // proporcional ao vínculo em 02/10/2026):
  // - TITULAR (qualquer escala): min(30, dias do vínculo no período) −
  //   faltas − dias transferidos ao substituto (só dias dentro do vínculo).
  //   No 12×36, cada dia de escala coberto transfere também a folga pareada
  //   (trabalhado + folga); nas demais, só os dias cobertos. Férias/afastado
  //   SEM substituto não transferem. Substituição "sem adicional"
  //   (27/08/2026) transfere do titular da mesma forma — ninguém recebe.
  //   Vínculo que cobre o período inteiro vale 30 (mesmo em período de 28 ou
  //   31 dias). Dois vínculos do mesmo colaborador no mesmo contrato (linha
  //   fundida): somam os dias de cada vínculo, com teto de 30.
  // - SUBSTITUTO PURO: insalubridade = dias transferidos (férias/afastado/
  //   folga com substituição, com a folga pareada do 12×36) + faltas
  //   cobertas, cada dia uma só vez (02/10/2026); periculosidade = apenas os
  //   dias transferidos (cobertura de falta NÃO gera periculosidade; a folga
  //   com substituição gera, como já gerava).
  //   Inclui coberturas fora do vínculo do titular (inalterado).
  resultado.forEach(registro => {
    const contrato = mapContrato.get(registro.contrato_id)
    if (!contrato) return
    const chave = `${registro.colaborador_id}|${registro.contrato_id}`
    const regime = contrato.regime_trabalho
    if (chavesSubstitutoPuro.has(chave)) {
      // Soma o que ESTE substituto cobriu em cada vínculo deste contrato
      let feriasAfast = 0
      diasTransferiveisPorVinculo.forEach((lista, vinculoId) => {
        const vinc = vinculos.find(v => v.id === vinculoId)
        if (vinc?.contrato_id !== registro.contrato_id) return
        feriasAfast += contarDiasTransferidos(regime, vinc?.data_inicio, lista.map(d => ({
          data: d.data,
          comSubstituto: d.substitutoId === registro.colaborador_id,
        })))
      })
      const faltasCobertas = cobertosFaltaPorChave.get(chave) ?? 0
      registro.dias_insalubridade = contrato.adicionais?.insalubridade
        ? insalubridadeSubstituto(feriasAfast, faltasCobertas)
        : 0
      registro.dias_periculosidade = contrato.adicionais?.periculosidade
        ? periculosidadeSubstituto(feriasAfast)
        : 0
      return
    }
    const vincs = vinculos.filter(v => `${v.colaborador_id}|${v.contrato_id}` === chave)
    let transferidos = 0
    let diasBase = 0
    vincs.forEach(vinc => {
      const lista = (diasTransferiveisPorVinculo.get(vinc.id) ?? []).filter(d => d.dentro)
      transferidos += contarDiasTransferidos(regime, vinc.data_inicio, lista.map(d => ({
        data: d.data,
        comSubstituto: !!d.substitutoId,
      })))
      diasBase += diasBaseAdicional(vinc.data_inicio, vinc.data_fim, inicio, fim)
    })
    if (contrato.adicionais?.insalubridade) {
      registro.dias_insalubridade = adicionalTitular30(registro.faltas, transferidos, diasBase)
    }
    if (contrato.adicionais?.periculosidade) {
      registro.dias_periculosidade = adicionalTitular30(registro.faltas, transferidos, diasBase)
    }
  })

  return resultado
}
