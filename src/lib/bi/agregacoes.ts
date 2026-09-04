// Lógica pura do módulo BI PerformanceLab — portada do template
// template_dashboard.html, adaptada para datas ISO 8601 (timestamptz).
// Sem React, sem supabase: apenas funções testáveis sobre os tipos de `types/bi`.

import type { BiAnalise, BiChecklist, BiChecklistQa, BiColeta, BiEvento, BiQas } from '@/types/bi'

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface FiltrosBi {
  /** Data inicial (YYYY-MM-DD) — vazio = sem limite */
  di: string
  /** Data final (YYYY-MM-DD) — vazio = sem limite */
  df: string
  /** Pessoa (responsável/inspetor) — vazio = todas */
  pessoa: string
  /** Local (site_nome) — vazio = todos */
  local: string
}

export function dataNoPeriodo(dia: string, di: string, df: string): boolean {
  return (!di || dia >= di) && (!df || dia <= df)
}

export function filtrarChecklists(lista: BiChecklist[], f: FiltrosBi): BiChecklist[] {
  return lista.filter(
    (c) =>
      dataNoPeriodo(diaDe(c.data_planejada || c.data_inicio), f.di, f.df) &&
      (!f.pessoa || c.responsavel_nome === f.pessoa) &&
      (!f.local || c.site_nome === f.local)
  )
}

export function filtrarColetas(lista: BiColeta[], f: FiltrosBi): BiColeta[] {
  return lista.filter(
    (v) =>
      dataNoPeriodo(diaDe(v.data_local), f.di, f.df) &&
      (!f.pessoa || v.funcionario === f.pessoa) &&
      (!f.local || v.site_nome === f.local)
  )
}

export function filtrarEventos(lista: BiEvento[], f: FiltrosBi): BiEvento[] {
  return lista.filter(
    (e) =>
      dataNoPeriodo(diaDe(e.data_evento), f.di, f.df) &&
      (!f.pessoa || respEv(e) === f.pessoa || e.usuario_nome === f.pessoa) &&
      (!f.local || e.site_nome === f.local)
  )
}

/** Opções do filtro "Pessoa": responsável do checklist + inspetor da coleta + responsável/autor do evento */
export function opcoesPessoas(cks: BiChecklist[], vis: BiColeta[], evs: BiEvento[]): string[] {
  const pessoas = new Set<string>()
  cks.forEach((c) => c.responsavel_nome && pessoas.add(c.responsavel_nome))
  vis.forEach((v) => v.funcionario && pessoas.add(v.funcionario))
  evs.forEach((e) => {
    const resp = respEv(e)
    if (resp !== '—') pessoas.add(resp)
  })
  return [...pessoas].sort()
}

/** Opções do filtro "Local": site_nome das três fontes */
export function opcoesLocais(cks: BiChecklist[], vis: BiColeta[], evs: BiEvento[]): string[] {
  const locais = new Set<string>()
  cks.forEach((c) => c.site_nome && locais.add(c.site_nome))
  vis.forEach((v) => v.site_nome && locais.add(v.site_nome))
  evs.forEach((e) => e.site_nome && locais.add(e.site_nome))
  return [...locais].sort()
}

// ---------------------------------------------------------------------------
// Helpers de data/hora (timestamptz chega como ISO 8601)
// ---------------------------------------------------------------------------

// O módulo BI é todo da operação Brasil: datas/horas são SEMPRE exibidas e
// agrupadas no fuso de Brasília, independente do fuso do dispositivo — um
// navegador fora do BRT chegou a exibir visitas com horário errado (24/08/2026).
const TZ_BR = 'America/Sao_Paulo'
const FMT_DIA_BR = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_BR, year: 'numeric', month: '2-digit', day: '2-digit',
})
const FMT_HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ_BR, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** Dia civil de Brasília (YYYY-MM-DD) de uma data ISO; '' quando ausente */
export function diaDe(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Fallback para o recorte da string quando a data não parseia
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  // Não recortar o ISO nem usar o fuso do navegador: o dia é o de Brasília
  // (visita de 22h BRT é 01h UTC do dia seguinte; dispositivo fora do BRT
  // deslocava o dia/hora exibidos)
  return FMT_DIA_BR.format(d)
}

/** YYYY-MM-DD -> DD/MM/YYYY */
export function fmtD(dia: string | null | undefined): string {
  if (!dia) return '-'
  const p = dia.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dia
}

const SEMANAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** DD/MM/YYYY (dia da semana) */
export function fmtDs(dia: string | null | undefined): string {
  if (!dia) return '-'
  const d = new Date(dia + 'T12:00:00')
  if (isNaN(d.getTime())) return fmtD(dia)
  return `${fmtD(dia)} (${SEMANAS[d.getDay()]})`
}

/** Hora de Brasília HH:MM de uma data ISO; '-' quando ausente/inválida */
export function horaDe(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return FMT_HORA_BR.format(d)
}

/** DD/MM/YYYY HH:MM (hora de Brasília) */
export function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${fmtD(diaDe(iso))} ${horaDe(iso)}`
}

// ---------------------------------------------------------------------------
// Frescor do sync (bi_sync_log — migration 103)
// ---------------------------------------------------------------------------

export type StatusSync = 'ok' | 'atrasado' | 'erro'

/** Sync roda 1x ao dia; acima de 26h sem sucesso os dados são considerados velhos */
export const LIMITE_ATRASO_SYNC_MS = 26 * 3.6e6

/**
 * Estado do sync a partir da última linha do bi_sync_log:
 * null sem registro; 'erro' se a última execução falhou; 'atrasado' se o
 * último sucesso (a própria linha, quando ok) tem mais de 26h; senão 'ok'.
 */
export function statusSync(
  ultima: { executado_em: string; ok: boolean } | null | undefined,
  agora: Date = new Date()
): StatusSync | null {
  if (!ultima) return null
  if (!ultima.ok) return 'erro'
  const t = new Date(ultima.executado_em).getTime()
  if (isNaN(t)) return null
  return agora.getTime() - t > LIMITE_ATRASO_SYNC_MS ? 'atrasado' : 'ok'
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/**
 * Permanência da visita em minutos: `tempo_minutos` quando presente;
 * senão a diferença chegada→saída (datas ISO). null quando não dá para saber.
 */
export function minDe(v: Pick<BiColeta, 'tempo_minutos' | 'data_local' | 'data_termino'>): number | null {
  if (v.tempo_minutos != null && !isNaN(v.tempo_minutos)) return v.tempo_minutos
  if (v.data_termino && v.data_local) {
    const fim = new Date(v.data_termino).getTime()
    const ini = new Date(v.data_local).getTime()
    if (!isNaN(fim) && !isNaN(ini)) return Math.max(0, (fim - ini) / 6e4)
  }
  return null
}

/** 90 -> "1h 30min"; 45 -> "45min"; null -> "-" */
export function fmtMin(m: number | null | undefined): string {
  if (m == null) return '-'
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return (h > 0 ? `${h}h ` : '') + String(mm).padStart(2, '0') + 'min'
}

/** Média ignorando null/NaN; null quando não há valor válido */
export function media(arr: Array<number | null | undefined>): number | null {
  const v = arr.filter((x): x is number => x != null && !isNaN(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Responsável do evento: quem está tratando; fallback para quem abriu */
export function respEv(e: Pick<BiEvento, 'usuario_ultimo_nome' | 'usuario_nome'>): string {
  return e.usuario_ultimo_nome || e.usuario_nome || '—'
}

/** Responsável exibido do evento: a pessoa citada na análise mais recente
 *  (decisão da gestão, 01/09/2026 — ex.: Eliane abriu o evento, mas a análise
 *  designou o Alexandre; quem responde pelo evento é o Alexandre).
 *  Sem análise com responsável, cai para respEv (quem trata / quem abriu). */
export function responsavelEvento(e: BiEvento, analises: BiAnalise[]): string {
  const comResp = analises
    .filter((a) => a.responsavel_nome)
    .sort((a, b) => ((a.data_analise || '') < (b.data_analise || '') ? -1 : 1))
  return comResp[comResp.length - 1]?.responsavel_nome || respEv(e)
}

/** Devolve a lista de eventos com o responsável das análises aplicado em
 *  `usuario_ultimo_nome`, para tabela, filtro "Pessoa" e gráfico por
 *  responsável seguirem todos a mesma regra (responsavelEvento). */
export function aplicarResponsavelAnalise(
  eventos: BiEvento[],
  mapa: Record<number, BiAnalise[]>,
): BiEvento[] {
  return eventos.map((e) => {
    const resp = responsavelEvento(e, mapa[e.id] || [])
    return resp === respEv(e) ? e : { ...e, usuario_ultimo_nome: resp }
  })
}

function contar<T>(arr: T[], fn: (x: T) => string): Record<string, number> {
  const m: Record<string, number> = {}
  arr.forEach((x) => {
    const k = fn(x)
    m[k] = (m[k] || 0) + 1
  })
  return m
}

/** Busca textual livre sobre qualquer campo do registro (como o template) */
export function buscaTextual<T>(lista: T[], termo: string): T[] {
  const t = termo.trim().toLowerCase()
  if (!t) return lista
  return lista.filter((x) => JSON.stringify(x).toLowerCase().includes(t))
}

/** Busca da aba Eventos — restrita aos campos visíveis na tabela
 *  (decisão da gestão, 04/09/2026): a busca genérica (JSON do registro) casava
 *  o termo também em "aberto por" (usuario_nome), observação e ações, então
 *  pesquisar "Maciel" trazia eventos que ele só abriu, sem ser o responsável.
 *  Aqui casam apenas número/ano, assunto, subtipo, local e o responsável exibido. */
export function buscaEventos(lista: BiEvento[], termo: string): BiEvento[] {
  const t = termo.trim().toLowerCase()
  if (!t) return lista
  return lista.filter((e) =>
    [e.numero, e.ano, e.evento_nome, e.subtipo_nome, e.site_nome, e.site_cidade, respEv(e)]
      .some((v) => v != null && String(v).toLowerCase().includes(t))
  )
}

/** Valores distintos (não vazios) de um campo, ordenados — opções de select */
export function opcoesDe<T>(lista: T[], campo: (x: T) => string | null | undefined): string[] {
  return [...new Set(lista.map(campo).filter((v): v is string => !!v))].sort()
}

/** Filtra por igualdade exata no campo; valor vazio = sem filtro */
export function filtrarPor<T>(lista: T[], campo: (x: T) => string | null | undefined, valor: string): T[] {
  return valor ? lista.filter((x) => campo(x) === valor) : lista
}

// ---------------------------------------------------------------------------
// Badges (variantes do StatusBadge do design system)
// ---------------------------------------------------------------------------

export type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Mapa conclusao_nome -> variante do badge (portado do badgeConc do template) */
export const VARIANTES_CONCLUSAO: Record<string, VarianteBadge> = {
  'Aguardando Autorização': 'warning',
  Aprovado: 'success',
  Finalizado: 'success',
  Reprovado: 'danger',
  'Não Realizado': 'danger',
  Cancelado: 'neutral',
}

export function varianteConclusao(conclusao: string | null | undefined): VarianteBadge {
  return (conclusao && VARIANTES_CONCLUSAO[conclusao]) || 'neutral'
}

export function varianteSla(sla: string | null | undefined): VarianteBadge {
  if (sla === 'DENTRO') return 'success'
  if (sla === 'FORA') return 'danger'
  return 'neutral'
}

export function varianteStatusEvento(status: string | null | undefined): VarianteBadge {
  return status === 'Concluído' ? 'success' : 'warning'
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export interface KpisChecklists {
  total: number
  aguardando: number
  aprovados: number
  reprovados: number
}

export function kpisChecklists(lista: BiChecklist[]): KpisChecklists {
  return {
    total: lista.length,
    aguardando: lista.filter((c) => c.conclusao_nome === 'Aguardando Autorização').length,
    aprovados: lista.filter((c) => c.conclusao_nome === 'Aprovado').length,
    reprovados: lista.filter((c) => c.conclusao_nome === 'Reprovado').length,
  }
}

/** Fila de aprovação: checklists aguardando autorização */
export function filaAprovacao(lista: BiChecklist[]): BiChecklist[] {
  return lista.filter((c) => c.conclusao_nome === 'Aguardando Autorização')
}

/** Mapa checklist_id -> respostas (jsonb qas) */
export function mapaQas(lista: BiChecklistQa[]): Record<number, BiQas> {
  const m: Record<number, BiQas> = {}
  lista.forEach((q) => {
    m[q.id] = q.qas || {}
  })
  return m
}

/** Agrupa as respostas por grupo_perguntas (grupo vazio vira "Geral") */
export function agruparQas(qas: BiQas): Array<{ grupo: string; itens: BiQas[string][] }> {
  const grupos: Record<string, BiQas[string][]> = {}
  Object.values(qas).forEach((q) => {
    const g = q.grupo_perguntas || 'Geral'
    ;(grupos[g] = grupos[g] || []).push(q)
  })
  return Object.entries(grupos).map(([grupo, itens]) => ({ grupo, itens }))
}

// ---------------------------------------------------------------------------
// Visitas (coletas)
// ---------------------------------------------------------------------------

export interface KpisVisitas {
  visitas: number
  inspetoresAtivos: number
  locaisVisitados: number
  diasComVisita: number
  minutosTotais: number
}

export function kpisVisitas(lista: BiColeta[]): KpisVisitas {
  const minutos = lista.map(minDe).filter((x): x is number => x != null)
  return {
    visitas: lista.length,
    inspetoresAtivos: new Set(lista.map((v) => v.funcionario)).size,
    locaisVisitados: new Set(lista.map((v) => v.site_nome)).size,
    diasComVisita: new Set(lista.map((v) => diaDe(v.data_local))).size,
    minutosTotais: minutos.reduce((a, b) => a + b, 0),
  }
}

/** Visitas por dia, ordenadas por data — eixo do gráfico de barras */
export function visitasPorDia(lista: BiColeta[]): Array<{ dia: string; qtd: number }> {
  const porDia = contar(lista, (v) => diaDe(v.data_local))
  return Object.entries(porDia)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dia, qtd]) => ({ dia, qtd }))
}

/** Visitas por inspetor, ordenadas da maior para a menor — barras horizontais */
export function visitasPorInspetor(lista: BiColeta[]): Array<{ inspetor: string; qtd: number }> {
  const porI = contar(lista, (v) => v.funcionario || '—')
  return Object.entries(porI)
    .sort((a, b) => b[1] - a[1])
    .map(([inspetor, qtd]) => ({ inspetor, qtd }))
}

export interface ProducaoDiaInspetor {
  dia: string
  inspetor: string
  qtd: number
  minutos: number
  locais: number
  /** Intervalo 1ª chegada → última saída do dia, em minutos (inclui
   *  deslocamentos entre locais); null quando não há horários válidos */
  jornada: number | null
}

/**
 * Produção por dia × inspetor: visitas, locais distintos, soma das
 * permanências e jornada ponta a ponta (1ª chegada → última saída).
 * Ordenado por data desc, depois inspetor asc.
 */
export function producaoPorDiaInspetor(lista: BiColeta[], inspetor = ''): ProducaoDiaInspetor[] {
  const prod: Record<
    string,
    { dia: string; inspetor: string; qtd: number; minutos: number; locais: Set<string>; primeira: number | null; ultima: number | null }
  > = {}
  lista.forEach((v) => {
    const dia = diaDe(v.data_local)
    const insp = v.funcionario || '—'
    const chave = `${dia}|${insp}`
    if (!prod[chave]) prod[chave] = { dia, inspetor: insp, qtd: 0, minutos: 0, locais: new Set(), primeira: null, ultima: null }
    const p = prod[chave]
    p.qtd++
    const m = minDe(v)
    if (m != null) p.minutos += m
    if (v.site_nome) p.locais.add(v.site_nome)
    const ini = v.data_local ? new Date(v.data_local).getTime() : NaN
    if (!isNaN(ini) && (p.primeira == null || ini < p.primeira)) p.primeira = ini
    const fim = v.data_termino ? new Date(v.data_termino).getTime() : NaN
    if (!isNaN(fim) && (p.ultima == null || fim > p.ultima)) p.ultima = fim
  })
  return Object.values(prod)
    .filter((r) => !inspetor || r.inspetor === inspetor)
    .map((r) => ({
      dia: r.dia,
      inspetor: r.inspetor,
      qtd: r.qtd,
      minutos: r.minutos,
      locais: r.locais.size,
      jornada: r.primeira != null && r.ultima != null ? Math.max(0, (r.ultima - r.primeira) / 6e4) : null,
    }))
    .sort((a, b) => (a.dia === b.dia ? (a.inspetor < b.inspetor ? -1 : 1) : a.dia < b.dia ? 1 : -1))
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

/** Evento finalizado: tem data_finalizacao válida */
export function eventoFinalizado(e: Pick<BiEvento, 'data_finalizacao'>): boolean {
  return !!e.data_finalizacao && !isNaN(new Date(e.data_finalizacao).getTime())
}

/** Dias entre abertura e finalização (frações de dia) */
function diasAteFinalizar(e: BiEvento): number | null {
  if (!eventoFinalizado(e) || !e.data_evento || !e.data_finalizacao) return null
  const ini = new Date(e.data_evento).getTime()
  const fim = new Date(e.data_finalizacao).getTime()
  if (isNaN(ini) || isNaN(fim)) return null
  return (fim - ini) / 864e5
}

export interface KpisEventos {
  total: number
  emAberto: number
  finalizados: number
  slaDentro: number
  /** 0-100, arredondado */
  slaPct: number
  /** Tempo médio abertura→finalização em dias; null sem finalizados */
  tempoMedioDias: number | null
}

export function kpisEventos(lista: BiEvento[]): KpisEventos {
  const fin = lista.filter(eventoFinalizado)
  const slaDentro = lista.filter((e) => e.sla === 'DENTRO').length
  return {
    total: lista.length,
    emAberto: lista.length - fin.length,
    finalizados: fin.length,
    slaDentro,
    slaPct: lista.length ? Math.round((100 * slaDentro) / lista.length) : 0,
    tempoMedioDias: media(fin.map(diasAteFinalizar)),
  }
}

/** Fatias do doughnut de SLA */
export function slaEventos(lista: BiEvento[]): { dentro: number; fora: number } {
  const dentro = lista.filter((e) => e.sla === 'DENTRO').length
  return { dentro, fora: lista.length - dentro }
}

/** Eventos por assunto (evento_nome), top N — barras horizontais */
export function eventosPorAssunto(lista: BiEvento[], limite = 12): Array<{ assunto: string; qtd: number }> {
  const porA = contar(lista, (e) => (e.evento_nome || '—').trim() || '—')
  return Object.entries(porA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([assunto, qtd]) => ({ assunto, qtd }))
}

export interface EventosResponsavel {
  nome: string
  total: number
  emAberto: number
  finalizados: number
  slaPct: number
  tempoMedioDias: number | null
}

/** Agregação por responsável atual (respEv), ordenada por total desc */
export function eventosPorResponsavel(lista: BiEvento[]): EventosResponsavel[] {
  const porR: Record<string, BiEvento[]> = {}
  lista.forEach((e) => {
    const k = respEv(e)
    ;(porR[k] = porR[k] || []).push(e)
  })
  return Object.entries(porR)
    .map(([nome, it]) => {
      const fin = it.filter(eventoFinalizado)
      return {
        nome,
        total: it.length,
        emAberto: it.length - fin.length,
        finalizados: fin.length,
        slaPct: it.length ? Math.round((100 * it.filter((e) => e.sla === 'DENTRO').length) / it.length) : 0,
        tempoMedioDias: media(fin.map(diasAteFinalizar)),
      }
    })
    .sort((a, b) => b.total - a.total)
}

/** Mapa evento_id -> análises (andamento do evento) */
export function mapaAnalises(lista: BiAnalise[]): Record<number, BiAnalise[]> {
  const m: Record<number, BiAnalise[]> = {}
  lista.forEach((a) => {
    if (a.evento_id == null) return
    ;(m[a.evento_id] = m[a.evento_id] || []).push(a)
  })
  return m
}

/** Análises de um evento ordenadas por data asc */
export function analisesDoEvento(mapa: Record<number, BiAnalise[]>, eventoId: number): BiAnalise[] {
  return (mapa[eventoId] || [])
    .slice()
    .sort((a, b) => ((a.data_analise || '') < (b.data_analise || '') ? -1 : 1))
}
