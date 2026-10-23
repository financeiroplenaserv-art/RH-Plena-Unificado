// Escolha do espelho de ponto sugerido para o fechamento do VT. O "último
// enviado" não serve: depois do espelho completo 20→19, qualquer espelho
// parcial enviado (ex.: 12 a 19/10, para os Adicionais) vira o "mais recente"
// e a conferência perdia a maior parte dos dias (simulação de 23/10/2026:
// 3.185 dias "não conferidos" em vez de 1.679 só por causa disso). Vale o
// arquivo que cobre MAIS dias do período; empate → o mais recente.

import type { PontoEspelhoArquivo } from '@/lib/adicionais/pontoEspelhoArquivos'

type ArquivoPeriodo = Pick<PontoEspelhoArquivo, 'periodo_inicio' | 'periodo_fim' | 'ponto_ate' | 'created_at'>

function diaSerial(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

/** Dias do período [inicio, fim] que o arquivo realmente cobre (até `ponto_ate`, quando existe). */
export function diasCobertosPeloArquivo(arquivo: ArquivoPeriodo, inicio: string, fim: string): number {
  if (!arquivo.periodo_inicio || !arquivo.periodo_fim) return 0
  const ate = arquivo.ponto_ate && arquivo.ponto_ate < arquivo.periodo_fim ? arquivo.ponto_ate : arquivo.periodo_fim
  const de = arquivo.periodo_inicio > inicio ? arquivo.periodo_inicio : inicio
  const ateReal = ate < fim ? ate : fim
  return Math.max(0, diaSerial(ateReal) - diaSerial(de) + 1)
}

export function escolherMelhorArquivoDoPeriodo<T extends ArquivoPeriodo>(
  arquivos: T[],
  inicio: string,
  fim: string,
): T | null {
  let melhor: T | null = null
  let melhorDias = 0
  for (const a of arquivos) {
    const dias = diasCobertosPeloArquivo(a, inicio, fim)
    if (dias === 0) continue
    if (!melhor || dias > melhorDias || (dias === melhorDias && a.created_at > melhor.created_at)) {
      melhor = a
      melhorDias = dias
    }
  }
  return melhor
}

// ---------------------------------------------------------------------------
// Vários espelhos por período (23/10/2026): na prática o ponto do período
// 20→19 chega em pedaços (outubro/2026: 20/09–07/10, 07–13/10, 12–19/10). O
// fechamento aceita um CONJUNTO de arquivos por período e mescla os dias.
// Regra do dia repetido (determinística): quando dois arquivos trazem o MESMO
// dia, vale o arquivo ENVIADO MAIS RECENTEMENTE (created_at maior; empate →
// id maior). Ordem de mescla = ordenarParaMescla (mais antigo primeiro, o mais
// recente sobrescreve). Dia ausente num arquivo nunca apaga o dia de outro.

function serialParaIso(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10)
}

/** Intervalo [de, ate] (serial de dia) que o arquivo cobre dentro do período, ou null. */
function intervaloNoPeriodo(arquivo: ArquivoPeriodo, inicio: string, fim: string): [number, number] | null {
  if (!arquivo.periodo_inicio || !arquivo.periodo_fim) return null
  const ate = arquivo.ponto_ate && arquivo.ponto_ate < arquivo.periodo_fim ? arquivo.ponto_ate : arquivo.periodo_fim
  const de = arquivo.periodo_inicio > inicio ? arquivo.periodo_inicio : inicio
  const ateReal = ate < fim ? ate : fim
  if (ateReal < de) return null
  return [diaSerial(de), diaSerial(ateReal)]
}

export interface CoberturaPeriodo {
  /** Dias do período cobertos por ao menos um arquivo. */
  diasCobertos: number
  diasDoPeriodo: number
  completo: boolean
  /** Trechos do período sem nenhum arquivo ('AAAA-MM-DD'). */
  faltando: { de: string; ate: string }[]
}

/** Cobertura resultante de um conjunto de arquivos sobre o período [inicio, fim]. */
export function coberturaDoConjunto(arquivos: ArquivoPeriodo[], inicio: string, fim: string): CoberturaPeriodo {
  const ini = diaSerial(inicio)
  const fimS = diaSerial(fim)
  const coberto = new Set<number>()
  for (const a of arquivos) {
    const iv = intervaloNoPeriodo(a, inicio, fim)
    if (!iv) continue
    for (let d = iv[0]; d <= iv[1]; d++) coberto.add(d)
  }
  const faltando: { de: string; ate: string }[] = []
  let inicioBuraco: number | null = null
  for (let d = ini; d <= fimS; d++) {
    if (!coberto.has(d)) {
      if (inicioBuraco === null) inicioBuraco = d
    } else if (inicioBuraco !== null) {
      faltando.push({ de: serialParaIso(inicioBuraco), ate: serialParaIso(d - 1) })
      inicioBuraco = null
    }
  }
  if (inicioBuraco !== null) faltando.push({ de: serialParaIso(inicioBuraco), ate: serialParaIso(fimS) })
  const diasDoPeriodo = fimS - ini + 1
  return { diasCobertos: coberto.size, diasDoPeriodo, completo: coberto.size === diasDoPeriodo, faltando }
}

/**
 * Sugestão automática: o menor conjunto (guloso) que cobre o período — a
 * cada passo, o arquivo que acrescenta MAIS dias ainda não cobertos (empate →
 * o mais recente). Para quando nenhum arquivo acrescenta dia novo.
 */
export function escolherConjuntoDoPeriodo<T extends ArquivoPeriodo>(arquivos: T[], inicio: string, fim: string): T[] {
  const coberto = new Set<number>()
  const restantes = arquivos.filter((a) => intervaloNoPeriodo(a, inicio, fim))
  const escolhidos: T[] = []
  for (;;) {
    let melhor: T | null = null
    let melhorGanho = 0
    for (const a of restantes) {
      if (escolhidos.includes(a)) continue
      const iv = intervaloNoPeriodo(a, inicio, fim)!
      let ganho = 0
      for (let d = iv[0]; d <= iv[1]; d++) if (!coberto.has(d)) ganho++
      if (ganho > melhorGanho || (ganho === melhorGanho && ganho > 0 && melhor && a.created_at > melhor.created_at)) {
        melhor = a
        melhorGanho = ganho
      }
    }
    if (!melhor || melhorGanho === 0) break
    escolhidos.push(melhor)
    const iv = intervaloNoPeriodo(melhor, inicio, fim)!
    for (let d = iv[0]; d <= iv[1]; d++) coberto.add(d)
  }
  return escolhidos
}

/** Ordem de mescla: mais antigo primeiro → o enviado mais recentemente vence o dia repetido. */
export function ordenarParaMescla<T extends Pick<PontoEspelhoArquivo, 'created_at' | 'id'>>(arquivos: T[]): T[] {
  return [...arquivos].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at < b.created_at ? -1 : 1
  )
}
