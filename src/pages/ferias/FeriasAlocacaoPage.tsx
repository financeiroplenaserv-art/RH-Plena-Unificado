import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeftRight, CalendarDays, Play, Undo2, UserCheck } from 'lucide-react'
import { formatarData, hojeBrasil, parseDataLocal } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useFerias, type SugestaoParaGravar } from '@/hooks/useFerias'
import { supabase } from '@/lib/supabase'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import {
  sugerirAlocacoes,
  elegiveisParaVaga,
  type ResultadoAlocacao,
} from '@/lib/ferias/alocacaoFeristas'
import type {
  FeriasAlocacaoComSolicitacao,
  FeriasFerista,
  FeriasFuncao,
  FeriasSolicitacao,
} from '@/types/ferias'
import { FeriasShell } from './FeriasShell'

function diasAte(inicioISO: string, hojeISO: string): number {
  return Math.round((parseDataLocal(inicioISO).getTime() - parseDataLocal(hojeISO).getTime()) / (24 * 60 * 60 * 1000))
}

/** dd/mm de uma data ISO (para o badge "extra em ..."). */
function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

interface LocalRecente {
  colaborador_id: string
  data: string
  local_trabalho: { id: string; nome: string; nome_curto: string | null } | null
}

interface ExtraMarcado {
  substituto_id: string | null
  data_ocorrencia: string
}

/** Contexto de disponibilidade do ferista para uma vaga (só leitura, RN informativa). */
interface ContextoFerista {
  /** Local de trabalho mais frequente nos últimos 30 dias */
  local: string | null
  /** Datas (dd/mm) com extra marcado dentro do período da vaga — conflito potencial, não bloqueia */
  extras: string[]
}

export function FeriasAlocacaoPage() {
  const { user } = useAuth()
  const podeGerenciar = user?.nivel_acesso ? podeGerenciarFerias(user.nivel_acesso) : false

  const {
    loading,
    listarSolicitacoes,
    listarFeristas,
    listarFuncoes,
    listarAlocacoes,
    confirmarAlocacoes,
    alocarManual,
    desfazerAlocacao,
    trocarFerista,
  } = useFerias()

  const [solicitacoes, setSolicitacoes] = useState<FeriasSolicitacao[]>([])
  const [feristas, setFeristas] = useState<FeriasFerista[]>([])
  const [funcoes, setFuncoes] = useState<FeriasFuncao[]>([])
  const [alocacoes, setAlocacoes] = useState<FeriasAlocacaoComSolicitacao[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [locaisRecentes, setLocaisRecentes] = useState<LocalRecente[]>([])
  const [extrasMarcados, setExtrasMarcados] = useState<ExtraMarcado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [resultado, setResultado] = useState<ResultadoAlocacao | null>(null)
  const [desfazendo, setDesfazendo] = useState<FeriasSolicitacao | null>(null)
  const [trocaLoteAberta, setTrocaLoteAberta] = useState(false)
  const [trocaLoteDe, setTrocaLoteDe] = useState('')
  const [trocaLotePara, setTrocaLotePara] = useState('')
  const [periodoDe, setPeriodoDe] = useState('')
  const [periodoAte, setPeriodoAte] = useState('')

  const hojeISO = hojeBrasil()

  const carregar = useCallback(async () => {
    setCarregando(true)
    // Lista completa de departamentos (sem filtro de nome_curto) para a
    // resolução fuzzy — useDepartamentos.listar() não serve (ver AGENTS.md §11).
    const [listaSolicitacoes, listaFeristas, listaFuncoes, listaAlocacoes, { data: deptData }] = await Promise.all([
      listarSolicitacoes(),
      listarFeristas(),
      listarFuncoes(),
      listarAlocacoes(),
      supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    ])
    setSolicitacoes(listaSolicitacoes)
    setFeristas(listaFeristas)
    setFuncoes(listaFuncoes)
    setAlocacoes(listaAlocacoes)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])

    // Contexto de disponibilidade (só leitura): local de trabalho mais
    // frequente nos últimos 30 dias e extras marcados até o fim da última
    // vaga — restrito aos feristas ativos, como manda o briefing.
    const idsFeristas = listaFeristas.filter((f) => f.ativo).map((f) => f.colaborador_id)
    if (idsFeristas.length > 0) {
      const inicio30 = new Date(parseDataLocal(hojeBrasil()).getTime() - 30 * 24 * 60 * 60 * 1000)
      const inicio30ISO = `${inicio30.getFullYear()}-${String(inicio30.getMonth() + 1).padStart(2, '0')}-${String(inicio30.getDate()).padStart(2, '0')}`
      const fimMaximo = listaSolicitacoes
        .filter((s) => (s.status === 'aprovada' || s.status === 'em_andamento') && !s.ferista_alocado_id)
        .map((s) => s.data_fim)
        .sort()
        .pop()
      const [locaisResp, extrasResp] = await Promise.all([
        supabase
          .from('locais_trabalho_diario')
          .select('colaborador_id, data, local_trabalho:locais_trabalho(id, nome, nome_curto)')
          .in('colaborador_id', idsFeristas)
          .gte('data', inicio30ISO)
          .range(0, 999),
        fimMaximo
          ? supabase
              .from('extras')
              .select('substituto_id, data_ocorrencia')
              .in('substituto_id', idsFeristas)
              .gte('data_ocorrencia', hojeBrasil())
              .lte('data_ocorrencia', fimMaximo)
              .range(0, 999)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (locaisResp.error) console.error('Erro ao carregar locais recentes dos feristas:', locaisResp.error)
      if (extrasResp.error) console.error('Erro ao carregar extras dos feristas:', extrasResp.error)
      setLocaisRecentes((locaisResp.data || []) as unknown as LocalRecente[])
      setExtrasMarcados((extrasResp.data || []) as ExtraMarcado[])
    } else {
      setLocaisRecentes([])
      setExtrasMarcados([])
    }
    setCarregando(false)
  }, [listarSolicitacoes, listarFeristas, listarFuncoes, listarAlocacoes])

  useEffect(() => {
    carregar()
  }, [carregar])

  const funcaoPorId = useMemo(() => new Map(funcoes.map((f) => [f.id, f])), [funcoes])

  // Local de trabalho mais frequente por ferista (últimos 30 dias)
  const localFrequentePorColaborador = useMemo(() => {
    const contagens = new Map<string, Map<string, number>>()
    for (const l of locaisRecentes) {
      const nome = l.local_trabalho?.nome_curto ?? l.local_trabalho?.nome
      if (!nome) continue
      const mapa = contagens.get(l.colaborador_id) ?? new Map<string, number>()
      mapa.set(nome, (mapa.get(nome) ?? 0) + 1)
      contagens.set(l.colaborador_id, mapa)
    }
    const resultado = new Map<string, string>()
    for (const [colaboradorId, mapa] of contagens) {
      const maisFrequente = Array.from(mapa.entries()).sort((a, b) => b[1] - a[1])[0]
      if (maisFrequente) resultado.set(colaboradorId, maisFrequente[0])
    }
    return resultado
  }, [locaisRecentes])

  const extrasPorColaborador = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const e of extrasMarcados) {
      if (!e.substituto_id) continue
      const lista = mapa.get(e.substituto_id) ?? []
      lista.push(e.data_ocorrencia)
      mapa.set(e.substituto_id, lista)
    }
    return mapa
  }, [extrasMarcados])

  const contextoFerista = useCallback(
    (ferista: FeriasFerista, vaga: FeriasSolicitacao): ContextoFerista => ({
      local: localFrequentePorColaborador.get(ferista.colaborador_id) ?? null,
      extras: (extrasPorColaborador.get(ferista.colaborador_id) ?? [])
        .filter((d) => d >= vaga.data_inicio && d <= vaga.data_fim)
        .map(diaMes),
    }),
    [localFrequentePorColaborador, extrasPorColaborador]
  )

  const temAlocacaoConfirmada = useCallback(
    (solicitacaoId: string) => alocacoes.some((a) => a.solicitacao_id === solicitacaoId && a.status === 'confirmada'),
    [alocacoes]
  )

  // Vagas: aprovadas/em andamento, correntes ou futuras, sem ferista nem
  // alocação confirmada — dentro do período escolhido para rodar (vazio = todas)
  const vagasSemCobertura = useMemo(
    () =>
      solicitacoes
        .filter(
          (s) =>
            (s.status === 'aprovada' || s.status === 'em_andamento') &&
            s.data_fim >= hojeISO &&
            !s.ferista_alocado_id &&
            !temAlocacaoConfirmada(s.id) &&
            (!periodoDe || s.data_fim >= periodoDe) &&
            (!periodoAte || s.data_inicio <= periodoAte)
        )
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)),
    [solicitacoes, hojeISO, temAlocacaoConfirmada, periodoDe, periodoAte]
  )

  const vagasCobertas = useMemo(
    () =>
      solicitacoes
        .filter((s) => s.ferista_alocado_id && s.data_fim >= hojeISO && s.status !== 'cancelada')
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)),
    [solicitacoes, hojeISO]
  )

  const nomeContrato = useCallback(
    (departamentoId: string | null) =>
      departamentoId ? nomeCurtoDepartamentoFuzzy(departamentos, departamentoId, null) : 'Sem contrato',
    [departamentos]
  )

  const nomeFuncao = (funcaoId: string | null) => (funcaoId ? (funcaoPorId.get(funcaoId)?.nome ?? '—') : '—')

  const rodarAlocacao = () => {
    if (vagasSemCobertura.length === 0) {
      toast.info('Não há férias aprovadas aguardando cobertura. Programe e aprove férias na Visão geral primeiro.')
      return
    }
    setResultado(
      sugerirAlocacoes({
        vagas: vagasSemCobertura,
        feristas,
        funcoes,
        alocacoes,
        feriasFeristas: solicitacoes,
        hoje: hojeISO,
      })
    )
  }

  const confirmar = async () => {
    if (!resultado) return
    const lote: SugestaoParaGravar[] = resultado.sugestoes.map((s) => ({
      solicitacaoId: s.vaga.id,
      feristaId: s.ferista.id,
      feristaColaboradorId: s.ferista.colaborador_id,
      departamentoId: s.vaga.departamento_id,
      funcaoId: s.vaga.funcao_id,
      dataInicio: s.vaga.data_inicio,
      dataFim: s.vaga.data_fim,
      score: s.score,
      motivo: s.motivo,
      origem: 'automatica',
    }))
    const ok = await confirmarAlocacoes(lote)
    if (ok) {
      setResultado(null)
      await carregar()
    }
  }

  const handleAlocarManual = async (vaga: FeriasSolicitacao, feristaId: string) => {
    const ferista = feristas.find((f) => f.id === feristaId)
    if (!ferista) return
    const ok = await alocarManual(vaga, ferista)
    if (ok) await carregar()
  }

  const handleDesfazer = async () => {
    if (!desfazendo) return
    const ok = await desfazerAlocacao(desfazendo.id)
    if (ok) {
      setDesfazendo(null)
      await carregar()
    }
  }

  const elegiveisDaVaga = (vaga: FeriasSolicitacao) =>
    elegiveisParaVaga({
      vaga,
      feristas,
      funcoes,
      alocacoes,
      feriasFeristas: solicitacoes,
      hoje: hojeISO,
    })

  /** Troca o ferista de uma vaga coberta (troca simples, pela linha). */
  const handleTrocar = async (vaga: FeriasSolicitacao, novoFeristaId: string) => {
    const novo = feristas.find((f) => f.id === novoFeristaId)
    if (!novo) return
    const ok = await trocarFerista(vaga, novo)
    if (ok) {
      toast.success(`Cobertura trocada para ${novo.colaborador?.nome_completo ?? 'novo ferista'}.`)
      await carregar()
    }
  }

  /** Troca em lote: todas as vagas cobertas futuras do ferista A passam para o B (pulando as sem elegibilidade). */
  const confirmarTrocaLote = async () => {
    const de = feristas.find((f) => f.id === trocaLoteDe)
    const para = feristas.find((f) => f.id === trocaLotePara)
    if (!de || !para) return
    const afetadas = vagasCobertas.filter((s) => s.ferista_alocado_id === de.colaborador_id)
    let trocadas = 0
    let puladas = 0
    for (const vaga of afetadas) {
      const elegivel = elegiveisDaVaga(vaga).elegiveis.some((e) => e.ferista.id === para.id)
      if (!elegivel) {
        puladas++
        continue
      }
      if (await trocarFerista(vaga, para)) trocadas++
    }
    setTrocaLoteAberta(false)
    setTrocaLoteDe('')
    setTrocaLotePara('')
    if (trocadas > 0) {
      toast.success(`${trocadas} cobertura(s) trocadas para ${para.colaborador?.nome_completo ?? 'novo ferista'}${puladas > 0 ? ` · ${puladas} pulada(s) por falta de elegibilidade` : ''}.`)
    } else {
      toast.info(puladas > 0 ? 'Nenhuma troca feita — o ferista escolhido não é elegível para essas vagas.' : 'Nenhuma vaga para trocar.')
    }
    if (trocadas > 0) await carregar()
  }

  const feristaDeLote = feristas.find((f) => f.id === trocaLoteDe) ?? null
  const feristaParaLote = feristas.find((f) => f.id === trocaLotePara) ?? null
  const feristasComCobertura = feristas.filter((f) =>
    vagasCobertas.some((s) => s.ferista_alocado_id === f.colaborador_id)
  )
  const afetadasLote = feristaDeLote
    ? vagasCobertas.filter((s) => s.ferista_alocado_id === feristaDeLote.colaborador_id)
    : []

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Alocação de feristas" description="Cobertura das férias aprovadas pelos feristas da carteira">
        {podeGerenciar && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setTrocaLoteAberta(true)} disabled={carregando || vagasCobertas.length === 0}>
              <ArrowLeftRight className="size-4" />
              Trocar ferista em lote
            </Button>
            <Button variant="primary" size="sm" onClick={rodarAlocacao} disabled={carregando}>
              <Play className="size-4" />
              Rodar alocação automática
            </Button>
          </div>
        )}
      </PageHeader>

      {resultado && (
        <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-foreground">
              Prévia da alocação automática
              <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-primary">
                {resultado.sugestoes.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setResultado(null)} disabled={loading}>
                Descartar
              </Button>
              <Button variant="primary" size="sm" onClick={confirmar} loading={loading} disabled={resultado.sugestoes.length === 0}>
                <UserCheck className="size-4" />
                Confirmar alocações
              </Button>
            </div>
          </div>
          {resultado.sugestoes.length > 0 && (
            <ul className="divide-y divide-border/60">
              {resultado.sugestoes.map((s) => {
                const ctx = contextoFerista(s.ferista, s.vaga)
                return (
                  <li key={s.vaga.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">
                        {s.vaga.colaborador?.nome_completo ?? 'Colaborador'}
                        <span className="ml-2 text-[12px] font-normal tabular-nums text-muted-foreground">
                          {formatarData(s.vaga.data_inicio)} a {formatarData(s.vaga.data_fim)} · {nomeContrato(s.vaga.departamento_id)}
                        </span>
                      </p>
                      <p className="text-[12px] text-muted-foreground">{s.motivo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-primary">{s.ferista.colaborador?.nome_completo}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        score {s.score}
                        {ctx.local ? ` · posto recente: ${ctx.local}` : ''}
                      </p>
                      {ctx.extras.length > 0 && (
                        <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          extra em {ctx.extras.join(', ')}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {resultado.criticas.length > 0 && (
            <div className="border-t border-red-200 bg-red-50 px-5 py-3.5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-red-700">
                <AlertTriangle className="size-4" />
                Coberturas críticas — sem ferista disponível (RN-08)
              </p>
              <ul className="mt-1 list-inside list-disc text-[13px] text-red-700">
                {resultado.criticas.map((c) => (
                  <li key={c.vaga.id}>
                    {c.vaga.colaborador?.nome_completo ?? 'Colaborador'} ({nomeContrato(c.vaga.departamento_id)},{' '}
                    {formatarData(c.vaga.data_inicio)} a {formatarData(c.vaga.data_fim)}): {c.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <Label>Rodar o período de</Label>
          <Input type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label>até</Label>
          <Input type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className="w-44" />
        </div>
        {(periodoDe || periodoAte) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPeriodoDe('')
              setPeriodoAte('')
            }}
          >
            Limpar período
          </Button>
        )}
        <p className="pb-1 text-[11px] text-muted-foreground">
          Vazio = todas as vagas futuras. Ex.: 01/01/2027 a 30/06/2027 para rodar o 1º semestre de 2027.
        </p>
      </div>

      <DataTable title="Vagas sem cobertura" count={vagasSemCobertura.length} className="mb-4">
        {vagasSemCobertura.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Nenhuma vaga sem cobertura"
            description="Todas as férias aprovadas têm ferista alocado."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Início em</TableHead>
                {podeGerenciar && <TableHead>Troca manual</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vagasSemCobertura.map((vaga) => {
                const dias = diasAte(vaga.data_inicio, hojeISO)
                const resultadoElegiveis = podeGerenciar ? elegiveisDaVaga(vaga) : null
                const elegiveis = resultadoElegiveis?.elegiveis ?? []
                return (
                  <TableRow key={vaga.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link to={`/ferias/colaborador/${vaga.colaborador_id}`} className="text-primary hover:underline">
                        {vaga.colaborador?.nome_completo ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{nomeContrato(vaga.departamento_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{nomeFuncao(vaga.funcao_id)}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                      {formatarData(vaga.data_inicio)} a {formatarData(vaga.data_fim)}
                    </TableCell>
                    <TableCell className={`tabular-nums whitespace-nowrap ${dias <= 15 ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                      {dias < 0 ? 'em andamento' : dias === 0 ? 'hoje' : `${dias}d`}
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell>
                        <Select value="" onValueChange={(v) => handleAlocarManual(vaga, v)}>
                          <SelectTrigger className="h-8 w-52 text-[12px]">
                            <SelectValue placeholder={elegiveis.length > 0 ? 'Escolher ferista...' : (resultadoElegiveis?.motivoSemElegiveis ?? 'Nenhum ferista elegível')} />
                          </SelectTrigger>
                          <SelectContent>
                            {elegiveis.map((e) => {
                              const ctx = contextoFerista(e.ferista, vaga)
                              return (
                                <SelectItem key={e.ferista.id} value={e.ferista.id}>
                                  {e.ferista.colaborador?.nome_completo} — {e.motivo}
                                  {ctx.local ? ` · posto: ${ctx.local}` : ''}
                                  {ctx.extras.length > 0 ? ` · extra em ${ctx.extras.join(', ')}` : ''}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <DataTable title="Vagas cobertas" count={vagasCobertas.length}>
        {vagasCobertas.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="size-6" />}
            title="Nenhuma vaga coberta ainda"
            description="Rode a alocação automática ou aloque manualmente nas vagas acima."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Ferista</TableHead>
                <TableHead>Origem</TableHead>
                {podeGerenciar && <TableHead>Trocar por</TableHead>}
                {podeGerenciar && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vagasCobertas.map((s) => {
                const elegiveisTroca = podeGerenciar
                  ? elegiveisDaVaga(s).elegiveis.filter((e) => e.ferista.colaborador_id !== s.ferista_alocado_id)
                  : []
                return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link to={`/ferias/colaborador/${s.colaborador_id}`} className="text-primary hover:underline">
                      {s.colaborador?.nome_completo ?? '—'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{nomeContrato(s.departamento_id)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                    {formatarData(s.data_inicio)} a {formatarData(s.data_fim)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.ferista?.nome_completo ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge variant={s.origem_alocacao === 'automatica' ? 'info' : 'neutral'}>
                      {s.origem_alocacao === 'automatica' ? 'Automática' : s.origem_alocacao === 'manual' ? 'Manual' : '—'}
                    </StatusBadge>
                  </TableCell>
                  {podeGerenciar && (
                    <TableCell>
                      <Select value="" onValueChange={(v) => handleTrocar(s, v)}>
                        <SelectTrigger className="h-8 w-48 text-[12px]">
                          <SelectValue placeholder={elegiveisTroca.length > 0 ? 'Trocar ferista...' : 'Sem substituto elegível'} />
                        </SelectTrigger>
                        <SelectContent>
                          {elegiveisTroca.map((e) => (
                            <SelectItem key={e.ferista.id} value={e.ferista.id}>
                              {e.ferista.colaborador?.nome_completo} — {e.motivo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  {podeGerenciar && (
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          title="Desfazer cobertura"
                          onClick={() => setDesfazendo(s)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        >
                          <Undo2 className="size-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <ConfirmDialog
        open={desfazendo !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setDesfazendo(null)
        }}
        icon={<Undo2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Desfazer cobertura"
        description={
          desfazendo
            ? `Desfazer a cobertura de ${desfazendo.ferista?.nome_completo ?? 'ferista'} nas férias de ${desfazendo.colaborador?.nome_completo ?? 'colaborador'} (${formatarData(desfazendo.data_inicio)} a ${formatarData(desfazendo.data_fim)})? A vaga volta para a lista de sem cobertura.`
            : ''
        }
        confirmLabel="Desfazer"
        destructive
        onConfirm={handleDesfazer}
      />

      <Dialog open={trocaLoteAberta} onOpenChange={setTrocaLoteAberta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar ferista em lote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Ferista atual</Label>
              <Select value={trocaLoteDe} onValueChange={setTrocaLoteDe}>
                <SelectTrigger>
                  <SelectValue placeholder="Quem sai das coberturas..." />
                </SelectTrigger>
                <SelectContent>
                  {feristasComCobertura.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.colaborador?.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Trocar por</Label>
              <Select value={trocaLotePara} onValueChange={setTrocaLotePara}>
                <SelectTrigger>
                  <SelectValue placeholder="Quem assume..." />
                </SelectTrigger>
                <SelectContent>
                  {feristas
                    .filter((f) => f.ativo && f.id !== trocaLoteDe)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.colaborador?.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {feristaDeLote && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                {afetadasLote.length === 0
                  ? 'Este ferista não tem coberturas futuras.'
                  : `${afetadasLote.length} cobertura(s) futura(s) de ${feristaDeLote.colaborador?.nome_completo ?? 'ferista'} serão avaliadas. Vagas em que o novo ferista não for elegível (função, conflito de datas ou limite de carga) são puladas e avisadas ao final.`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrocaLoteAberta(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmarTrocaLote}
              loading={loading}
              disabled={!feristaDeLote || !feristaParaLote || afetadasLote.length === 0}
            >
              Trocar coberturas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeriasShell>
  )
}
