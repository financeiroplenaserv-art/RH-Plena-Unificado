/**
 * Horário do turno da escala Flit (locais_trabalho_diario.turno) para a revisão
 * de rota do VT: a rota é calculada pelo horário real da pessoa, para justificar
 * o valor se ela questionar. Nunca inventa horário: texto ilegível devolve null.
 */

export interface HorarioTurno {
  /** HH:MM */
  entrada: string
  /** HH:MM */
  saida: string
  /** Saída menor ou igual à entrada (ex.: 19:00 → 07:00): a volta é no dia seguinte. */
  noturno: boolean
}

export interface HorarioAlternativo extends HorarioTurno {
  motivo: 'sabado' | 'outro_turno'
  ocorrencias: number
}

export interface HorarioReferenciaTurno extends HorarioTurno {
  /** "07:00 às 15:20" */
  texto: string
  /** Quantos dias (nos últimos 60) o turno principal apareceu. */
  ocorrencias: number
  alternativos: HorarioAlternativo[]
}

export interface RegistroTurno {
  data: string
  turno: string | null
}

const DIAS_JANELA = 60

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function hhmm(h: string, m?: string): string | null {
  const hora = Number(h)
  const min = m === undefined || m === '' ? 0 : Number(m)
  if (!Number.isInteger(hora) || !Number.isInteger(min) || hora > 23 || min > 59) return null
  return `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function minutos(valor: string): number {
  const [h, m] = valor.split(':').map(Number)
  return h * 60 + m
}

function montar(entrada: string | null, saida: string | null): HorarioTurno | null {
  if (!entrada || !saida) return null
  return { entrada, saida, noturno: minutos(saida) <= minutos(entrada) }
}

const FAIXA = '(\\d{1,2})(?::(\\d{2}))?\\s*(?:horas|hs|h)?\\s+as\\s+(\\d{1,2})(?::(\\d{2}))?(?![\\d:])'

/**
 * Lê "X às Y" do turno. Devolve o horário principal e, quando o turno cita
 * sábado ("e sáb 7 às 11hs"), o horário de sábado à parte. Sem "X às Y" → null.
 */
export function lerHorarioDoTurno(turno: string | null | undefined): { principal: HorarioTurno; sabado: HorarioTurno | null } | null {
  const s = semAcento((turno ?? '').replace(/\s+/g, ' ').trim())
  if (!s) return null
  const m = new RegExp(FAIXA).exec(s)
  if (!m) return null
  const principal = montar(hhmm(m[1], m[2]), hhmm(m[3], m[4]))
  if (!principal) return null
  const resto = s.slice(m.index + m[0].length)
  const ms = new RegExp(`\\bsab\\w*\\.?\\s*${FAIXA}`).exec(resto)
  const sabado = ms ? montar(hhmm(ms[1], ms[2]), hhmm(ms[3], ms[4])) : null
  return { principal, sabado }
}

function textoFaixa(h: HorarioTurno): string {
  return `${h.entrada} às ${h.saida}`
}

function diasAtras(data: string, dias: number): string {
  const [a, mes, d] = data.split('-').map(Number)
  const dt = new Date(a, mes - 1, d - dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/**
 * Escolhe o turno mais frequente dentro dos últimos 60 dias (a partir de `hoje`,
 * AAAA-MM-DD). Empate → o mais recente. Os registros devem ser só os do POSTO do
 * trajeto. Sem nenhum turno legível → null (a tela cai no horário manual).
 */
export function escolherHorarioDoTurno(registros: readonly RegistroTurno[], hoje: string): HorarioReferenciaTurno | null {
  const limite = diasAtras(hoje, DIAS_JANELA)
  const grupos = new Map<string, { h: HorarioTurno; n: number; recente: string; sabados: Map<string, { h: HorarioTurno; n: number }> }>()
  for (const r of registros) {
    if (!r.data || r.data < limite || r.data > hoje) continue
    const lido = lerHorarioDoTurno(r.turno)
    if (!lido) continue
    const chave = `${lido.principal.entrada}|${lido.principal.saida}`
    const g = grupos.get(chave) ?? { h: lido.principal, n: 0, recente: '', sabados: new Map() }
    g.n += 1
    if (r.data > g.recente) g.recente = r.data
    if (lido.sabado) {
      const ks = `${lido.sabado.entrada}|${lido.sabado.saida}`
      const atual = g.sabados.get(ks) ?? { h: lido.sabado, n: 0 }
      atual.n += 1
      g.sabados.set(ks, atual)
    }
    grupos.set(chave, g)
  }
  if (grupos.size === 0) return null
  const ordenados = [...grupos.values()].sort((a, b) => b.n - a.n || (a.recente < b.recente ? 1 : a.recente > b.recente ? -1 : 0))
  const [vencedor, ...outros] = ordenados
  const alternativos: HorarioAlternativo[] = [
    ...[...vencedor.sabados.values()].map((s) => ({ ...s.h, motivo: 'sabado' as const, ocorrencias: s.n })),
    ...outros.map((o) => ({ ...o.h, motivo: 'outro_turno' as const, ocorrencias: o.n })),
  ]
  return {
    ...vencedor.h,
    texto: textoFaixa(vencedor.h),
    ocorrencias: vencedor.n,
    alternativos,
  }
}

/** Texto curto para a tela: "07:00 às 15:20 (visto em 18 dias)". */
export function descreverHorarioDoTurno(h: HorarioReferenciaTurno): string {
  return `${h.texto} (visto em ${h.ocorrencias} ${h.ocorrencias === 1 ? 'dia' : 'dias'})`
}

export function descreverAlternativo(a: HorarioAlternativo): string {
  const faixa = textoFaixa(a)
  return a.motivo === 'sabado' ? `sábado ${faixa}` : `${faixa} (${a.ocorrencias} ${a.ocorrencias === 1 ? 'dia' : 'dias'})`
}
