import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, ClipboardCheck, ExternalLink, MapPin, Search } from 'lucide-react'
import type { ChartConfiguration } from 'chart.js'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Button } from '@/components/corh/Button'
import { PageLoading } from '@/components/PageLoading'
import { Grafico } from '@/components/bi/Grafico'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  agruparQas,
  analisesDoEvento,
  aplicarResponsavelAnalise,
  buscaEventos,
  buscaTextual,
  diaDe,
  eventoFinalizado,
  eventosPorAssunto,
  eventosPorResponsavel,
  filaAprovacao,
  filtrarChecklists,
  filtrarColetas,
  filtrarEventos,
  filtrarPor,
  fmtD,
  fmtDT,
  fmtDs,
  fmtMin,
  horaDe,
  kpisChecklists,
  kpisEventos,
  kpisVisitas,
  mapaAnalises,
  mapaQas,
  minDe,
  opcoesDe,
  opcoesLocais,
  opcoesPessoas,
  producaoPorDiaInspetor,
  respEv,
  slaEventos,
  statusSync,
  varianteConclusao,
  varianteSla,
  varianteStatusEvento,
  visitasPorDia,
  visitasPorInspetor,
  type FiltrosBi,
} from '@/lib/bi/agregacoes'
import type { BiAnalise, BiChecklist, BiChecklistQa, BiColeta, BiEvento, BiSyncLog } from '@/types/bi'

// Cores da paleta CORH para os gráficos (azul primário + semáforo suave)
const COR_PRIMARIA = '#0F6CBD'
const COR_OK = '#059669'
const COR_RUIM = '#DC2626'

const TODOS = 'todos'
const TAMANHO_PAGINA = 1000

// Opções extras do filtro de status da aba Eventos: agrupam por situação —
// "aberto"/"finalizado" seguem a regra do KPI, ou seja, a existência de
// data_finalizacao (eventoFinalizado), não o nome do status
const STATUS_EM_ABERTO = 'Em aberto (todos)'
const STATUS_FINALIZADOS = 'Finalizados (todos)'

// Abas internas da página (estado local; mesma cara das abas do ModuleShell)
const ABAS = [
  { valor: 'checklists', label: 'Checklists', icon: ClipboardCheck },
  { valor: 'visitas', label: 'Visitas dos Inspetores', icon: MapPin },
  { valor: 'eventos', label: 'Eventos da Equipe', icon: CalendarClock },
]

function periodoPadrao(): { di: string; df: string } {
  // Dia de Brasília (não o do dispositivo) como limite do período
  const df = diaDe(new Date().toISOString())
  const inicio = new Date(`${df}T12:00:00-03:00`)
  // Últimos 5 dias, inclusive hoje; o banco mantém até 90 dias para consultas manuais
  inicio.setUTCDate(inicio.getUTCDate() - 4)
  return { di: diaDe(inicio.toISOString()), df }
}

/** PostgREST limita a resposta em 1000 linhas — pagina até esgotar */
async function buscarTudo<T>(
  executar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const linhas: T[] = []
  let de = 0
  for (;;) {
    const { data, error } = await executar(de, de + TAMANHO_PAGINA - 1)
    if (error) throw error
    const lote = data ?? []
    linhas.push(...lote)
    if (lote.length < TAMANHO_PAGINA) break
    de += TAMANHO_PAGINA
  }
  return linhas
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Painel({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${className ?? ''}`}>
      <h2 className="mb-3 text-[14px] font-semibold text-foreground">
        {title}
        {hint && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </h2>
      {children}
    </section>
  )
}

function CelulaVazia({ colSpan, texto }: { colSpan: number; texto: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {texto}
      </TableCell>
    </TableRow>
  )
}

function CampoBusca({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

/** Select de filtro por aba: '' (TODOS) = sem filtro. flex-1 para distribuição uniforme na linha */
function FiltroSelect({
  value,
  onChange,
  placeholder,
  opcoes,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  opcoes: string[]
}) {
  return (
    <div className="min-w-[180px] flex-1">
      <Select value={value || TODOS} onValueChange={(v) => onChange(v === TODOS ? '' : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{placeholder}</SelectItem>
          {opcoes.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const thClass = 'font-semibold uppercase tracking-wider text-muted-foreground'

export function BiPerformanceLabPage() {
  const padrao = useMemo(() => periodoPadrao(), [])

  // Período aplicado (dispara o fetch) e rascunho dos inputs de data
  const [periodo, setPeriodo] = useState(padrao)
  const [diInput, setDiInput] = useState(padrao.di)
  const [dfInput, setDfInput] = useState(padrao.df)
  // Pessoa/Local filtram em memória (sem refetch), como no template
  const [pessoa, setPessoa] = useState('')
  const [local, setLocal] = useState('')

  const [checklists, setChecklists] = useState<BiChecklist[]>([])
  const [qas, setQas] = useState<BiChecklistQa[]>([])
  const [coletas, setColetas] = useState<BiColeta[]>([])
  const [eventos, setEventos] = useState<BiEvento[]>([])
  const [analises, setAnalises] = useState<BiAnalise[]>([])
  const [syncLog, setSyncLog] = useState<BiSyncLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [buscaCk, setBuscaCk] = useState('')
  const [buscaVis, setBuscaVis] = useState('')
  const [buscaEv, setBuscaEv] = useState('')
  const [prodInsp, setProdInsp] = useState('')
  // Filtros específicos de cada aba (selects sobre os dados já filtrados)
  const [ckConclusao, setCkConclusao] = useState('')
  const [ckModelo, setCkModelo] = useState('')
  const [visTipo, setVisTipo] = useState('')
  const [visMotivo, setVisMotivo] = useState('')
  const [evStatus, setEvStatus] = useState('')
  const [evSla, setEvSla] = useState('')
  const [evAssunto, setEvAssunto] = useState('')
  const [ckAbertos, setCkAbertos] = useState<Set<number>>(new Set())
  const [evAbertos, setEvAbertos] = useState<Set<number>>(new Set())
  // Aba ativa (a barra segue o padrão visual do ModuleShell, com estado interno)
  const [aba, setAba] = useState('checklists')

  const carregar = useCallback(async (di: string) => {
    setLoading(true)
    setErro(null)
    try {
      // gte na coluna de data de cada tabela (timestamptz); qas não tem data
      const gteIso = new Date(`${di}T00:00:00`).toISOString()
      const [cks, qasRows, vis, evs, ans] = await Promise.all([
        buscarTudo<BiChecklist>((de, ate) =>
          supabase.from('bi_checklists').select('*').gte('data_inicio', gteIso).order('data_inicio', { ascending: false }).range(de, ate)
        ),
        buscarTudo<BiChecklistQa>((de, ate) => supabase.from('bi_checklist_qas').select('*').range(de, ate)),
        buscarTudo<BiColeta>((de, ate) =>
          supabase.from('bi_coletas').select('*').gte('data_local', gteIso).order('data_local', { ascending: false }).range(de, ate)
        ),
        buscarTudo<BiEvento>((de, ate) =>
          supabase.from('bi_eventos').select('*').gte('data_evento', gteIso).order('data_evento', { ascending: false }).range(de, ate)
        ),
        buscarTudo<BiAnalise>((de, ate) =>
          supabase.from('bi_eventos_analises').select('*').gte('data_analise', gteIso).order('data_analise', { ascending: true }).range(de, ate)
        ),
      ])
      setChecklists(cks)
      setQas(qasRows)
      setColetas(vis)
      setEventos(evs)
      setAnalises(ans)

      // Última execução do sync (fora do Promise.all: se a migration 103
      // ainda não foi aplicada, a página segue normal, só sem o selo)
      const { data: logRows, error: erroLog } = await supabase
        .from('bi_sync_log')
        .select('*')
        .order('executado_em', { ascending: false })
        .limit(1)
      if (erroLog) console.warn('bi_sync_log indisponível:', erroLog)
      else setSyncLog(logRows?.[0] ?? null)
    } catch (err) {
      console.error('Erro ao carregar dados do PerformanceLab:', err)
      setErro('Não foi possível carregar os dados do PerformanceLab. Verifique sua permissão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(periodo.di)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aplicarFiltros = () => {
    if (!diInput || !dfInput) return
    if (diInput !== periodo.di || dfInput !== periodo.df) {
      setPeriodo({ di: diInput, df: dfInput })
      carregar(diInput)
    }
  }

  const limparFiltros = () => {
    setDiInput(padrao.di)
    setDfInput(padrao.df)
    setPessoa('')
    setLocal('')
    setBuscaCk('')
    setBuscaVis('')
    setBuscaEv('')
    setProdInsp('')
    setCkConclusao('')
    setCkModelo('')
    setVisTipo('')
    setVisMotivo('')
    setEvStatus('')
    setEvSla('')
    setEvAssunto('')
    if (padrao.di !== periodo.di || padrao.df !== periodo.df) {
      setPeriodo(padrao)
      carregar(padrao.di)
    }
  }

  const filtros: FiltrosBi = useMemo(
    () => ({ di: periodo.di, df: periodo.df, pessoa, local }),
    [periodo, pessoa, local]
  )

  const qasMap = useMemo(() => mapaQas(qas), [qas])
  const anMap = useMemo(() => mapaAnalises(analises), [analises])

  // Eventos com o responsável da análise mais recente aplicado (decisão da
  // gestão, 01/09/2026): a tabela, o filtro "Pessoa" e o gráfico por
  // responsável passam a mostrar quem consta na análise, não quem abriu
  const eventosResp = useMemo(() => aplicarResponsavelAnalise(eventos, anMap), [eventos, anMap])

  // Opções dos selects derivadas dos dados carregados
  const pessoas = useMemo(() => opcoesPessoas(checklists, coletas, eventosResp), [checklists, coletas, eventosResp])
  const locais = useMemo(() => opcoesLocais(checklists, coletas, eventos), [checklists, coletas, eventos])

  // Conjuntos filtrados (período + pessoa + local)
  const cks = useMemo(() => filtrarChecklists(checklists, filtros), [checklists, filtros])
  const vis = useMemo(() => filtrarColetas(coletas, filtros), [coletas, filtros])
  const evs = useMemo(() => filtrarEventos(eventosResp, filtros), [eventosResp, filtros])

  // ---------------- Checklists ----------------
  const kpiCk = useMemo(() => kpisChecklists(cks), [cks])
  const fila = useMemo(() => filaAprovacao(cks), [cks])
  const opcoesConclusao = useMemo(() => opcoesDe(cks, (c) => c.conclusao_nome), [cks])
  const opcoesModelo = useMemo(() => opcoesDe(cks, (c) => c.checklist_nome), [cks])
  const cksBuscados = useMemo(
    () =>
      filtrarPor(
        filtrarPor(buscaTextual(cks, buscaCk), (c) => c.checklist_nome, ckModelo),
        (c) => c.conclusao_nome,
        ckConclusao
      ),
    [cks, buscaCk, ckModelo, ckConclusao]
  )

  // ---------------- Visitas ----------------
  const kpiVis = useMemo(() => kpisVisitas(vis), [vis])
  const visPorDia = useMemo(() => visitasPorDia(vis), [vis])
  const visPorInspetor = useMemo(() => visitasPorInspetor(vis), [vis])
  const producao = useMemo(() => producaoPorDiaInspetor(vis, prodInsp), [vis, prodInsp])
  const opcoesTipo = useMemo(() => opcoesDe(vis, (v) => v.tipo_coleta), [vis])
  const opcoesMotivo = useMemo(() => opcoesDe(vis, (v) => v.motivo_visita), [vis])
  const visBuscadas = useMemo(
    () =>
      filtrarPor(
        filtrarPor(
          filtrarPor(buscaTextual(vis, buscaVis), (v) => v.tipo_coleta, visTipo),
          (v) => v.motivo_visita,
          visMotivo
        ),
        // O inspetor escolhido no card "Produção por dia e inspetor" também
        // restringe o detalhe — senão a lista mostra os demais inspetores
        // e parece que o filtro não funcionou
        (v) => v.funcionario,
        prodInsp
      ),
    [vis, buscaVis, visTipo, visMotivo, prodInsp]
  )

  const cfgVisitasDia = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: visPorDia.map((v) => fmtD(v.dia)),
        datasets: [{ data: visPorDia.map((v) => v.qtd), backgroundColor: COR_PRIMARIA, borderRadius: 4 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }),
    [visPorDia]
  )

  const cfgVisitasInspetor = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: visPorInspetor.map((v) => v.inspetor),
        datasets: [{ data: visPorInspetor.map((v) => v.qtd), backgroundColor: COR_PRIMARIA, borderRadius: 4 }],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }),
    [visPorInspetor]
  )

  // ---------------- Eventos ----------------
  const kpiEv = useMemo(() => kpisEventos(evs), [evs])
  const sla = useMemo(() => slaEventos(evs), [evs])
  const porAssunto = useMemo(() => eventosPorAssunto(evs), [evs])
  const porResponsavel = useMemo(() => eventosPorResponsavel(evs), [evs])
  const opcoesStatusEv = useMemo(() => opcoesDe(evs, (e) => e.status_texto), [evs])
  const opcoesSla = useMemo(() => opcoesDe(evs, (e) => e.sla), [evs])
  const opcoesAssunto = useMemo(() => opcoesDe(evs, (e) => (e.evento_nome || '').trim() || null), [evs])
  const evsBuscados = useMemo(() => {
    const base = buscaEventos(evs, buscaEv)
    const porStatus =
      evStatus === STATUS_EM_ABERTO
        ? base.filter((e) => !eventoFinalizado(e))
        : evStatus === STATUS_FINALIZADOS
          ? base.filter(eventoFinalizado)
          : filtrarPor(base, (e) => e.status_texto, evStatus)
    return filtrarPor(
      filtrarPor(porStatus, (e) => e.sla, evSla),
      (e) => (e.evento_nome || '').trim() || null,
      evAssunto
    )
  }, [evs, buscaEv, evStatus, evSla, evAssunto])

  const cfgSla = useMemo<ChartConfiguration>(
    () => ({
      type: 'doughnut',
      data: {
        labels: ['Dentro do SLA', 'Fora do SLA'],
        datasets: [{ data: [sla.dentro, sla.fora], backgroundColor: [COR_OK, COR_RUIM], borderWidth: 0 }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    }),
    [sla]
  )

  const cfgAssunto = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: porAssunto.map((a) => a.assunto),
        datasets: [{ data: porAssunto.map((a) => a.qtd), backgroundColor: COR_PRIMARIA, borderRadius: 4 }],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }),
    [porAssunto]
  )

  const toggleCk = (id: number) =>
    setCkAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const toggleEv = (id: number) =>
    setEvAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  /** Linha de checklist (fila de aprovação inclui a coluna PDF) */
  const linhaCk = (c: BiChecklist, comPdf: boolean) => {
    const respostas = qasMap[c.id] || {}
    const n = Object.keys(respostas).length
    const aberto = ckAbertos.has(c.id)
    return [
      <TableRow key={c.id} className="hover:bg-accent/40">
        <TableCell className="w-36">
          {n > 0 ? (
            <button type="button" onClick={() => toggleCk(c.id)} className="text-[13px] font-medium text-primary hover:underline">
              {aberto ? '▾' : '▸'} Respostas ({n})
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap tabular-nums">
          {c.numero}/{c.ano}
        </TableCell>
        <TableCell>{c.checklist_nome}</TableCell>
        <TableCell>{c.site_nome}</TableCell>
        <TableCell>{c.responsavel_nome}</TableCell>
        <TableCell className="whitespace-nowrap tabular-nums">{fmtDs(diaDe(c.data_planejada))}</TableCell>
        <TableCell className="whitespace-nowrap tabular-nums">
          {fmtDs(diaDe(c.data_termino))} {horaDe(c.data_termino)}
        </TableCell>
        <TableCell>
          <StatusBadge variant={varianteConclusao(c.conclusao_nome)}>{c.conclusao_nome || '-'}</StatusBadge>
        </TableCell>
        {comPdf && (
          <TableCell>
            {c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                Abrir PDF <ExternalLink className="size-3.5" />
              </a>
            ) : (
              '-'
            )}
          </TableCell>
        )}
      </TableRow>,
      aberto && n > 0 ? (
        <TableRow key={`${c.id}-detalhe`}>
          <TableCell />
          <TableCell colSpan={comPdf ? 8 : 7}>
            <div className="space-y-4 rounded-xl bg-accent/40 p-4">
              {agruparQas(respostas).map(({ grupo, itens }) => (
                <div key={grupo}>
                  <p className="mb-1.5 text-[13px] font-semibold text-primary">{grupo}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={thClass}>Pergunta</TableHead>
                        <TableHead className={thClass}>Resposta</TableHead>
                        <TableHead className={thClass}>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((q, i) => (
                        <TableRow key={i}>
                          <TableCell>{q.pergunta}</TableCell>
                          <TableCell className="font-semibold">{q.respostas}</TableCell>
                          <TableCell className="max-w-96 whitespace-pre-wrap text-xs text-muted-foreground">
                            {q.observacoes || ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      ) : null,
    ]
  }

  const cabecalhoCk = (comPdf: boolean) => (
    <TableHeader>
      <TableRow>
        <TableHead className={thClass}></TableHead>
        <TableHead className={thClass}>Nº/Ano</TableHead>
        <TableHead className={thClass}>Checklist</TableHead>
        <TableHead className={thClass}>Local</TableHead>
        <TableHead className={thClass}>Responsável</TableHead>
        <TableHead className={thClass}>Planejada</TableHead>
        <TableHead className={thClass}>Término</TableHead>
        <TableHead className={thClass}>Conclusão</TableHead>
        {comPdf && <TableHead className={thClass}>PDF</TableHead>}
      </TableRow>
    </TableHeader>
  )

  // Barra de abas no padrão dos demais módulos (ModuleShell): fica ACIMA do
  // PageHeader, com sublinhado primário na aba ativa e ícone — aqui com estado
  // interno porque a página não tem sub-rotas
  const barraAbas = (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {ABAS.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.valor}
            type="button"
            onClick={() => setAba(t.valor)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
              aba === t.valor
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <Icon className="size-4" strokeWidth={1.8} />
            {t.label}
          </button>
        )
      })}
    </div>
  )

  if (loading && checklists.length === 0 && coletas.length === 0 && eventos.length === 0) {
    return (
      <div>
        {barraAbas}
        <PageHeader
          title="PerformanceLab"
          description="Checklists, visitas dos inspetores e eventos da equipe"
          showBackButton={false}
          className="mt-4"
        />
        <PageLoading />
      </div>
    )
  }

  const sync = statusSync(syncLog)

  return (
    <div>
      {barraAbas}

      <PageHeader
        title="PerformanceLab"
        description={`Base: ${fmtD(periodo.di)} a ${fmtD(periodo.df)} · checklists, visitas dos inspetores e eventos da equipe`}
        showBackButton={false}
        className="mt-4"
      />

      {syncLog && (
        <p className="mt-1 text-xs text-muted-foreground">
          Sincronizado com o PerformanceLab em {fmtDT(syncLog.executado_em)}
        </p>
      )}

      {sync === 'erro' && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A última sincronização com o PerformanceLab falhou{syncLog?.erro ? ` (${syncLog.erro})` : ''}.
          Os dados exibidos podem estar desatualizados.
        </div>
      )}
      {sync === 'atrasado' && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A última sincronização com o PerformanceLab foi há mais de 26 horas.
          Os dados exibidos podem estar desatualizados.
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba} className="mt-4">
        <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={loading}>
          <div className="space-y-1.5">
            <Label>Data inicial</Label>
            <Input type="date" value={diInput} onChange={(e) => setDiInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" value={dfInput} onChange={(e) => setDfInput(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pessoa</Label>
            <Select value={pessoa || TODOS} onValueChange={(v) => setPessoa(v === TODOS ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {pessoas.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Select value={local || TODOS} onValueChange={(v) => setLocal(v === TODOS ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {locais.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Filters>

        {erro && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{erro}</span>
            <Button variant="outline" size="sm" onClick={() => carregar(periodo.di)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* ==================== CHECKLISTS ==================== */}
        <TabsContent value="checklists" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Checklists" value={kpiCk.total} />
            <Kpi label="Aguardando autorização" value={kpiCk.aguardando} sub="fila de aprovação" />
            <Kpi label="Aprovados" value={kpiCk.aprovados} />
            <Kpi label="Reprovados" value={kpiCk.reprovados} />
          </div>

          <DataTable title="Fila de aprovação" count={fila.length}>
            <Table>
              {cabecalhoCk(true)}
              <TableBody>
                {fila.length === 0 ? (
                  <CelulaVazia colSpan={9} texto="Nenhum checklist aguardando autorização" />
                ) : (
                  fila.map((c) => linhaCk(c, true))
                )}
              </TableBody>
            </Table>
          </DataTable>

          <DataTable title="Todos os checklists do período" count={cksBuscados.length}>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <CampoBusca
                value={buscaCk}
                onChange={setBuscaCk}
                placeholder="Buscar por responsável, local, checklist..."
              />
              <FiltroSelect
                value={ckModelo}
                onChange={setCkModelo}
                placeholder="Todos os checklists"
                opcoes={opcoesModelo}
              />
              <FiltroSelect
                value={ckConclusao}
                onChange={setCkConclusao}
                placeholder="Todas as conclusões"
                opcoes={opcoesConclusao}
              />
            </div>
            <Table>
              {cabecalhoCk(false)}
              <TableBody>
                {cksBuscados.length === 0 ? (
                  <CelulaVazia colSpan={8} texto="Nenhum checklist encontrado no período." />
                ) : (
                  cksBuscados.map((c) => linhaCk(c, false))
                )}
              </TableBody>
            </Table>
          </DataTable>
        </TabsContent>

        {/* ==================== VISITAS ==================== */}
        <TabsContent value="visitas" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Visitas" value={kpiVis.visitas} />
            <Kpi label="Inspetores ativos" value={kpiVis.inspetoresAtivos} />
            <Kpi label="Locais visitados" value={kpiVis.locaisVisitados} />
            <Kpi label="Dias com visita" value={kpiVis.diasComVisita} />
            <Kpi label="Tempo total em campo" value={fmtMin(kpiVis.minutosTotais)} sub="soma das permanências" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Painel title="Visitas por dia">
              <Grafico config={cfgVisitasDia} />
            </Painel>
            <Painel title="Visitas por inspetor">
              <Grafico config={cfgVisitasInspetor} />
            </Painel>
          </div>

          <DataTable title="Produção por dia e inspetor" count={producao.length}>
            <div className="border-b border-border px-5 py-3">
              <Select value={prodInsp || TODOS} onValueChange={(v) => setProdInsp(v === TODOS ? '' : v)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todos os inspetores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os inspetores</SelectItem>
                  {visPorInspetor.map((i) => (
                    <SelectItem key={i.inspetor} value={i.inspetor}>
                      {i.inspetor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={thClass}>Data</TableHead>
                  <TableHead className={thClass}>Inspetor</TableHead>
                  <TableHead className={thClass}>Visitas</TableHead>
                  <TableHead className={thClass}>Locais</TableHead>
                  <TableHead className={thClass}>Tempo de produção</TableHead>
                  <TableHead className={thClass} title="Intervalo entre a primeira chegada e a última saída do dia (inclui deslocamentos)">
                    Jornada total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producao.length === 0 ? (
                  <CelulaVazia colSpan={6} texto="Nenhuma visita no período." />
                ) : (
                  producao.map((r) => (
                    <TableRow key={`${r.dia}|${r.inspetor}`} className="hover:bg-accent/40">
                      <TableCell className="whitespace-nowrap tabular-nums">{fmtDs(r.dia)}</TableCell>
                      <TableCell>{r.inspetor}</TableCell>
                      <TableCell className="tabular-nums">{r.qtd}</TableCell>
                      <TableCell className="tabular-nums">{r.locais}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{fmtMin(r.minutos)}</TableCell>
                      <TableCell className="tabular-nums">{fmtMin(r.jornada)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTable>

          <DataTable title="Detalhe das visitas" count={visBuscadas.length}>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <CampoBusca
                value={buscaVis}
                onChange={setBuscaVis}
                placeholder="Buscar por local, motivo, área..."
              />
              <FiltroSelect
                value={visTipo}
                onChange={setVisTipo}
                placeholder="Todos os tipos"
                opcoes={opcoesTipo}
              />
              <FiltroSelect
                value={visMotivo}
                onChange={setVisMotivo}
                placeholder="Todos os motivos"
                opcoes={opcoesMotivo}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={thClass}>Data</TableHead>
                  <TableHead className={thClass}>Inspetor</TableHead>
                  <TableHead className={thClass}>Local</TableHead>
                  <TableHead className={thClass}>Área</TableHead>
                  <TableHead className={thClass}>Chegada</TableHead>
                  <TableHead className={thClass}>Saída</TableHead>
                  <TableHead className={thClass}>Permanência</TableHead>
                  <TableHead className={thClass}>Motivo/Obs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visBuscadas.length === 0 ? (
                  <CelulaVazia colSpan={8} texto="Nenhuma visita encontrada no período." />
                ) : (
                  visBuscadas.map((v) => (
                    <TableRow key={v.id} className="hover:bg-accent/40">
                      <TableCell className="whitespace-nowrap tabular-nums">{fmtDs(diaDe(v.data_local))}</TableCell>
                      <TableCell>{v.funcionario}</TableCell>
                      <TableCell>{v.site_nome}</TableCell>
                      <TableCell>{v.area || '-'}</TableCell>
                      <TableCell className="tabular-nums">{horaDe(v.data_local)}</TableCell>
                      <TableCell className="tabular-nums">{horaDe(v.data_termino)}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{fmtMin(minDe(v))}</TableCell>
                      <TableCell className="max-w-80 whitespace-pre-wrap text-xs text-muted-foreground">
                        {v.motivo_visita || v.observacao || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTable>
        </TabsContent>

        {/* ==================== EVENTOS ==================== */}
        <TabsContent value="eventos" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Eventos" value={kpiEv.total} />
            <Kpi label="Em aberto" value={kpiEv.emAberto} sub="delegados e não finalizados" />
            <Kpi label="Finalizados" value={kpiEv.finalizados} />
            <Kpi label="SLA dentro" value={`${kpiEv.slaPct}%`} sub={`${kpiEv.slaDentro} de ${kpiEv.total} (SLA PerformanceLab)`} />
            <Kpi
              label="Tempo médio"
              value={kpiEv.tempoMedioDias == null ? '-' : `${kpiEv.tempoMedioDias.toFixed(1)} d`}
              sub="abertura → finalização"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Painel title="SLA dos eventos">
              <Grafico config={cfgSla} />
            </Painel>
            <Painel title="Eventos por assunto" hint="top 12">
              <Grafico config={cfgAssunto} />
            </Painel>
          </div>

          <DataTable title="Eventos por responsável" count={porResponsavel.length}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={thClass}>Responsável</TableHead>
                  <TableHead className={thClass}>Total</TableHead>
                  <TableHead className={thClass}>Em aberto</TableHead>
                  <TableHead className={thClass}>Finalizados</TableHead>
                  <TableHead className={thClass}>% SLA dentro</TableHead>
                  <TableHead className={thClass}>Tempo médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porResponsavel.length === 0 ? (
                  <CelulaVazia colSpan={6} texto="Nenhum evento no período." />
                ) : (
                  porResponsavel.map((r) => (
                    <TableRow key={r.nome} className="hover:bg-accent/40">
                      <TableCell>{r.nome}</TableCell>
                      <TableCell className="tabular-nums">{r.total}</TableCell>
                      <TableCell className="tabular-nums">{r.emAberto || '-'}</TableCell>
                      <TableCell className="tabular-nums">{r.finalizados}</TableCell>
                      <TableCell className="tabular-nums">{r.slaPct}%</TableCell>
                      <TableCell className="tabular-nums">
                        {r.tempoMedioDias == null ? '-' : `${r.tempoMedioDias.toFixed(1)} d`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DataTable>

          <DataTable title="Todos os eventos do período" count={evsBuscados.length}>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <CampoBusca
                value={buscaEv}
                onChange={setBuscaEv}
                placeholder="Buscar por assunto, responsável, local..."
              />
              <FiltroSelect
                value={evAssunto}
                onChange={setEvAssunto}
                placeholder="Todos os assuntos"
                opcoes={opcoesAssunto}
              />
              <FiltroSelect
                value={evStatus}
                onChange={setEvStatus}
                placeholder="Todos os status"
                opcoes={[STATUS_EM_ABERTO, STATUS_FINALIZADOS, ...opcoesStatusEv]}
              />
              <FiltroSelect
                value={evSla}
                onChange={setEvSla}
                placeholder="SLA: todos"
                opcoes={opcoesSla}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={thClass}></TableHead>
                  <TableHead className={thClass}>Nº/Ano</TableHead>
                  <TableHead className={thClass}>Assunto</TableHead>
                  <TableHead className={thClass}>Local</TableHead>
                  <TableHead className={thClass}>Responsável</TableHead>
                  <TableHead className={thClass}>Abertura</TableHead>
                  <TableHead className={thClass}>Finalização</TableHead>
                  <TableHead className={thClass}>Status</TableHead>
                  <TableHead className={thClass}>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evsBuscados.length === 0 ? (
                  <CelulaVazia colSpan={9} texto="Nenhum evento encontrado no período." />
                ) : (
                  evsBuscados.map((e) => {
                    const ans = analisesDoEvento(anMap, e.id)
                    const aberto = evAbertos.has(e.id)
                    const resp = respEv(e)
                    const obs = (e.observacao || '').trim()
                    const fin = (e.acoes_realizadas_finalizacao || '').trim()
                    return [
                      <TableRow key={e.id} className="hover:bg-accent/40">
                        <TableCell className="w-36">
                          <button
                            type="button"
                            onClick={() => toggleEv(e.id)}
                            className="text-[13px] font-medium text-primary hover:underline"
                          >
                            {aberto ? '▾' : '▸'} Andamento ({ans.length})
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {e.numero}/{e.ano}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{(e.evento_nome || '').trim()}</span>
                          {e.subtipo_nome && (
                            <span className="block text-xs text-muted-foreground">{e.subtipo_nome}</span>
                          )}
                        </TableCell>
                        <TableCell>{e.site_nome}</TableCell>
                        <TableCell>
                          <span className="font-semibold">{resp}</span>
                          {e.usuario_nome && e.usuario_nome !== resp && (
                            <span className="block text-xs text-muted-foreground">aberto por {e.usuario_nome}</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{fmtDT(e.data_evento)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{fmtDT(e.data_finalizacao)}</TableCell>
                        <TableCell>
                          <StatusBadge variant={varianteStatusEvento(e.status_texto)}>
                            {e.status_texto || '-'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={varianteSla(e.sla)}>{e.sla || '-'}</StatusBadge>
                        </TableCell>
                      </TableRow>,
                      aberto ? (
                        <TableRow key={`${e.id}-detalhe`}>
                          <TableCell />
                          <TableCell colSpan={8}>
                            <div className="space-y-4 rounded-xl bg-accent/40 p-4">
                              {obs && (
                                <div>
                                  <p className="mb-1 text-[13px] font-semibold text-primary">Descrição do evento</p>
                                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{obs}</p>
                                </div>
                              )}
                              {fin && (
                                <div>
                                  <p className="mb-1 text-[13px] font-semibold text-emerald-700">Finalização</p>
                                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{fin}</p>
                                </div>
                              )}
                              {ans.length > 0 ? (
                                <div>
                                  <p className="mb-1.5 text-[13px] font-semibold text-primary">Histórico de análises</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className={thClass}>Data</TableHead>
                                        <TableHead className={thClass}>Responsável</TableHead>
                                        <TableHead className={thClass}>Tipo</TableHead>
                                        <TableHead className={thClass}>Descrição</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {ans.map((a) => (
                                        <TableRow key={a.id}>
                                          <TableCell className="whitespace-nowrap tabular-nums">
                                            {fmtDT(a.data_analise)}
                                          </TableCell>
                                          <TableCell>{a.responsavel_nome}</TableCell>
                                          <TableCell>{a.tipo_analise_nome || '-'}</TableCell>
                                          <TableCell className="whitespace-pre-wrap text-xs text-muted-foreground">
                                            {(a.descricao || '').trim()}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                !obs && !fin && (
                                  <p className="text-xs text-muted-foreground">Sem detalhes registrados.</p>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null,
                    ]
                  })
                )}
              </TableBody>
            </Table>
          </DataTable>
        </TabsContent>
      </Tabs>
    </div>
  )
}
