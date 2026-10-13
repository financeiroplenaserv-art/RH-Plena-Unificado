import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CalendarPlus, UserCheck, Wand2 } from 'lucide-react'
import { agoraBrasil, formatarData } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useFerias } from '@/hooks/useFerias'
import { supabase } from '@/lib/supabase'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import { calcularFillRate, faixaMetaFillRate } from '@/lib/ferias/fillRate'
import { gerarPlanoAutomatico, type ResultadoPlano } from '@/lib/ferias/planejamentoAutomatico'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { FeriasAlocacaoComSolicitacao, FeriasFerista, FeriasFuncao, FeriasSolicitacao } from '@/types/ferias'
import { FeriasShell } from './FeriasShell'
import { ProgramarFeriasDialog } from './ProgramarFeriasDialog'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const SEM_CONTRATO = 'sem_contrato'

type CorChip = 'azul' | 'verde' | 'amarelo' | 'vermelho'

const CLASSE_CHIP: Record<CorChip, string> = {
  azul: 'bg-blue-100 text-blue-800',
  verde: 'bg-green-100 text-green-800',
  amarelo: 'bg-amber-100 text-amber-800',
  vermelho: 'bg-red-100 text-red-800',
}

function primeiroNome(nome: string | undefined): string {
  if (!nome) return '?'
  return nome.trim().split(' ')[0]
}

export function FeriasProgramacaoPage() {
  const { user } = useAuth()
  const podeGerenciar = user?.nivel_acesso ? podeGerenciarFerias(user.nivel_acesso) : false

  const { listarSolicitacoes, listarAlocacoes, listarFeristas, listarFuncoes, listarRegras, listarColaboradoresResumo, criarPrevisoesEmLote, loading } = useFerias()

  const anoCorrente = agoraBrasil().getFullYear()
  const [ano, setAno] = useState(String(anoCorrente))
  const [contrato, setContrato] = useState('todos')
  const [funcaoFiltro, setFuncaoFiltro] = useState('todas')
  const [planoAberto, setPlanoAberto] = useState(false)
  const [planoDe, setPlanoDe] = useState('')
  const [planoAte, setPlanoAte] = useState('')
  const [planoResultado, setPlanoResultado] = useState<ResultadoPlano | null>(null)
  const [gerandoPlano, setGerandoPlano] = useState(false)

  const [solicitacoes, setSolicitacoes] = useState<FeriasSolicitacao[]>([])
  const [alocacoes, setAlocacoes] = useState<FeriasAlocacaoComSolicitacao[]>([])
  const [feristas, setFeristas] = useState<FeriasFerista[]>([])
  const [funcoes, setFuncoes] = useState<FeriasFuncao[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [carregando, setCarregando] = useState(true)
  const [planejarContrato, setPlanejarContrato] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    // Lista completa de departamentos (sem filtro de nome_curto) para a
    // resolução fuzzy — useDepartamentos.listar() não serve (ver AGENTS.md §11).
    const [listaSolicitacoes, listaAlocacoes, listaFeristas, listaFuncoes, { data: deptData }] = await Promise.all([
      listarSolicitacoes(),
      listarAlocacoes(),
      listarFeristas(),
      listarFuncoes(),
      supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    ])
    setSolicitacoes(listaSolicitacoes)
    setAlocacoes(listaAlocacoes)
    setFeristas(listaFeristas)
    setFuncoes(listaFuncoes)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])
    setCarregando(false)
  }, [listarSolicitacoes, listarAlocacoes, listarFeristas, listarFuncoes])

  useEffect(() => {
    carregar()
  }, [carregar])

  const inicioAno = `${ano}-01-01`
  const fimAno = `${ano}-12-31`

  // Solicitações do ano (não canceladas, com qualquer dia dentro do ano),
  // com o filtro de função aplicado (RN visual: filtrar por função facilita
  // enxergar quem cobre quem na grade)
  const doAno = useMemo(
    () =>
      solicitacoes.filter(
        (s) =>
          s.status !== 'cancelada' &&
          s.data_inicio <= fimAno &&
          s.data_fim >= inicioAno &&
          (funcaoFiltro === 'todas' || s.funcao_id === funcaoFiltro)
      ),
    [solicitacoes, inicioAno, fimAno, funcaoFiltro]
  )

  const feristaPorColaborador = useMemo(
    () => new Map(feristas.map((f) => [f.colaborador_id, f])),
    [feristas]
  )

  const coberturaDe = useCallback(
    (s: FeriasSolicitacao): { cor: CorChip; descricao: string } => {
      const temCobertura =
        s.ferista_alocado_id !== null || alocacoes.some((a) => a.solicitacao_id === s.id && a.status === 'confirmada')
      if (temCobertura) {
        // Verde = ferista cujo contrato de origem (cadastro) é o da vaga; amarelo = de outro contrato
        const ferista = s.ferista_alocado_id ? feristaPorColaborador.get(s.ferista_alocado_id) : undefined
        const mesmoContrato =
          ferista?.colaborador?.departamento_id != null && ferista.colaborador.departamento_id === s.departamento_id
        return {
          cor: mesmoContrato ? 'verde' : 'amarelo',
          descricao: mesmoContrato ? 'coberto por ferista do mesmo contrato' : 'coberto por ferista de outro contrato',
        }
      }
      if (s.status === 'aprovada' || s.status === 'em_andamento') {
        return { cor: 'vermelho', descricao: 'sem cobertura' }
      }
      return { cor: 'azul', descricao: 'férias (planejamento ou gozo)' }
    },
    [alocacoes, feristaPorColaborador]
  )

  // Linhas da grade: contratos (departamentos) com solicitações no ano
  const linhas = useMemo(() => {
    const grupos = new Map<string, FeriasSolicitacao[]>()
    for (const s of doAno) {
      const chave = s.departamento_id ?? SEM_CONTRATO
      const lista = grupos.get(chave) ?? []
      lista.push(s)
      grupos.set(chave, lista)
    }
    return Array.from(grupos.entries())
      .map(([departamentoId, lista]) => ({
        departamentoId,
        nome:
          departamentoId === SEM_CONTRATO
            ? 'Sem contrato'
            : nomeCurtoDepartamentoFuzzy(departamentos, departamentoId, null),
        solicitacoes: lista,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [doAno, departamentos])

  const linhasFiltradas = useMemo(
    () => (contrato === 'todos' ? linhas : linhas.filter((l) => l.departamentoId === contrato)),
    [linhas, contrato]
  )

  const solicitacoesNoMes = useCallback(
    (lista: FeriasSolicitacao[], mes: number): FeriasSolicitacao[] => {
      const mm = String(mes).padStart(2, '0')
      const ultimoDia = new Date(Number(ano), mes, 0).getDate()
      const inicioMes = `${ano}-${mm}-01`
      const fimMes = `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}`
      return lista
        .filter((s) => s.data_inicio <= fimMes && s.data_fim >= inicioMes)
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    },
    [ano]
  )

  // KPIs do ano
  const kpis = useMemo(() => {
    const efetivas = doAno.filter((s) => s.status === 'aprovada' || s.status === 'em_andamento' || s.status === 'concluida')
    const cobertas = doAno.filter((s) => coberturaDe(s).cor === 'verde' || coberturaDe(s).cor === 'amarelo').length
    const semCobertura = doAno.filter((s) => coberturaDe(s).cor === 'vermelho').length
    const fillRate = calcularFillRate(solicitacoes, Number(ano))
    return { total: doAno.length, efetivas: efetivas.length, cobertas, semCobertura, fillRate }
  }, [doAno, solicitacoes, ano, coberturaDe])

  const faixaFillRate = kpis.fillRate.taxa !== null ? faixaMetaFillRate(kpis.fillRate.taxa) : null

  // ---- Plano automático (decisão da gestão: quem não pede nada entra na
  // ordem do que é melhor para a empresa — urgência CLT + encadeamento) ----

  const abrirPlano = () => {
    // Padrão: 1º semestre do ano selecionado na grade
    setPlanoDe(`${ano}-01-01`)
    setPlanoAte(`${ano}-06-30`)
    setPlanoResultado(null)
    setPlanoAberto(true)
  }

  const gerarPreviaPlano = async () => {
    if (!planoDe || !planoAte || planoAte < planoDe) return
    setGerandoPlano(true)
    const [colaboradores, regras] = await Promise.all([listarColaboradoresResumo(), listarRegras()])
    const enriquecidos = colaboradores.map((c) => ({
      ...c,
      funcao_id: resolverFuncao(c.cargo, funcoes)?.id ?? null,
    }))
    setPlanoResultado(
      gerarPlanoAutomatico({
        colaboradores: enriquecidos,
        solicitacoes,
        regras,
        periodoInicio: planoDe,
        periodoFim: planoAte,
      })
    )
    setGerandoPlano(false)
  }

  const confirmarPlano = async () => {
    if (!planoResultado) return
    const ok = await criarPrevisoesEmLote(
      planoResultado.propostas.map((p) => ({
        colaborador_id: p.colaborador.id,
        departamento_id: p.colaborador.departamento_id ?? null,
        funcao_id: p.colaborador.funcao_id ?? null,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        motivo: p.motivo,
      }))
    )
    if (ok) {
      setPlanoAberto(false)
      setPlanoResultado(null)
      await carregar()
    }
  }

  const nomeContratoPlano = (departamentoId: string | null | undefined) =>
    departamentoId ? nomeCurtoDepartamentoFuzzy(departamentos, departamentoId, null) : 'Sem contrato'

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Programação anual de férias" description="Quem sai de férias em cada mês, por contrato (RN-09)">
        <div className="flex items-center gap-2">
          {podeGerenciar && (
            <>
              <Button variant="outline" size="sm" onClick={abrirPlano}>
                <Wand2 className="size-4" />
                Gerar plano automático
              </Button>
              <Button variant="primary" size="sm" onClick={() => setPlanejarContrato('')}>
                <CalendarPlus className="size-4" />
                Planejar férias
              </Button>
            </>
          )}
          <Link to="/ferias/alocacao">
            <Button variant="outline" size="sm">
              <UserCheck className="size-4" />
              Rodar alocação
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Solicitações no ano</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-foreground">{kpis.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Cobertas por ferista</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-green-600">{kpis.cobertas}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Sem cobertura</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-red-600">{kpis.semCobertura}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Fill rate (meta 85–92%)</p>
          <p
            className={`mt-1 text-[24px] font-bold tabular-nums ${
              faixaFillRate === 'verde'
                ? 'text-green-600'
                : faixaFillRate === 'ambar'
                  ? 'text-amber-600'
                  : faixaFillRate === 'vermelho'
                    ? 'text-red-600'
                    : 'text-muted-foreground'
            }`}
          >
            {kpis.fillRate.taxa !== null ? `${Math.round(kpis.fillRate.taxa * 100)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="w-36">
          <Label>Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[anoCorrente - 1, anoCorrente, anoCorrente + 1, anoCorrente + 2].map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Label>Contrato</Label>
          <Select value={contrato} onValueChange={setContrato}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {linhas.map((l) => (
                <SelectItem key={l.departamentoId} value={l.departamentoId}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <Label>Função</Label>
          <Select value={funcaoFiltro} onValueChange={setFuncaoFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {funcoes
                .filter((f) => f.ativo)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-blue-400" /> férias (planejamento/gozo)</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-green-500" /> coberto (mesmo contrato)</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-amber-400" /> coberto (outro contrato)</span>
          <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-red-500" /> sem cobertura</span>
        </div>
      </div>

      {carregando ? (
        <p className="text-[13px] text-muted-foreground">Carregando...</p>
      ) : linhasFiltradas.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title="Nenhuma solicitação no ano"
          description='Use o botão "Planejar férias" acima (qualquer contrato), a Visão geral ou a importação do Flit.'
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 bg-card px-4 py-3">Contrato</th>
                  {MESES.map((mes) => (
                    <th key={mes} className="px-2 py-3 text-center">
                      {mes}
                    </th>
                  ))}
                  {podeGerenciar && <th className="px-3 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map((linha) => (
                  <tr key={linha.departamentoId} className="border-b border-border/60 align-top hover:bg-accent/40">
                    <td className="sticky left-0 bg-card px-4 py-3 font-medium text-foreground">{linha.nome}</td>
                    {MESES.map((_, indice) => {
                      const mes = indice + 1
                      const doContrato = solicitacoesNoMes(linha.solicitacoes, mes)
                      return (
                        <td key={mes} className="px-2 py-2">
                          <div className="flex min-h-6 flex-col gap-1">
                            {doContrato.map((s) => {
                              const { cor, descricao } = coberturaDe(s)
                              return (
                                <span
                                  key={s.id}
                                  title={`${s.colaborador?.nome_completo ?? 'Colaborador'} · ${formatarData(s.data_inicio)} a ${formatarData(s.data_fim)} · ${descricao}`}
                                  className={`inline-block max-w-24 truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${CLASSE_CHIP[cor]}`}
                                >
                                  {primeiroNome(s.colaborador?.nome_completo)}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                      )
                    })}
                    {podeGerenciar && (
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPlanejarContrato(linha.departamentoId === SEM_CONTRATO ? '' : linha.departamentoId)}
                        >
                          <CalendarPlus className="size-4" />
                          Planejar
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Dialog open={planoAberto} onOpenChange={setPlanoAberto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar plano automático de férias</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Para quem não pediu data, o sistema propõe as férias na ordem que é melhor para a empresa: primeiro quem tem o limite concessivo mais antigo (ou já vencido), encadeado por contrato+função. Quem pediu data ou já tem plano no período não é mexido.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>De</Label>
                <Input type="date" value={planoDe} onChange={(e) => setPlanoDe(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label>Até</Label>
                <Input type="date" value={planoAte} onChange={(e) => setPlanoAte(e.target.value)} className="w-44" />
              </div>
              <Button variant="outline" size="sm" onClick={gerarPreviaPlano} loading={gerandoPlano} disabled={!planoDe || !planoAte || planoAte < planoDe}>
                Gerar prévia
              </Button>
            </div>

            {planoResultado && (
              <>
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                  {planoResultado.resumo.avaliados} ativos avaliados · {planoResultado.resumo.jaComPlano} já com plano no período (incl. pedidos) · {planoResultado.resumo.semNecessidade} sem necessidade (limite depois do período)
                  {planoResultado.resumo.semAdmissao > 0 ? ` · ${planoResultado.resumo.semAdmissao} sem data de admissão` : ''}
                </p>

                {planoResultado.propostas.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Ninguém para planejar neste período.</p>
                ) : (
                  <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
                    {planoResultado.propostas.map((p) => (
                      <li key={p.colaborador.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                          {p.colaborador.nome_completo}
                          <span className="ml-2 text-[12px] font-normal text-muted-foreground">{nomeContratoPlano(p.colaborador.departamento_id)}</span>
                        </span>
                        <span className="text-[12px] tabular-nums text-muted-foreground">
                          {formatarData(p.data_inicio)} a {formatarData(p.data_fim)}
                        </span>
                        <span className={`text-[11px] ${p.motivo.includes('vencido') ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                          {p.motivo}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {planoResultado.naoCouberam.length > 0 && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    {planoResultado.naoCouberam.length} não couberam no período dentro do grupo contrato+função — amplie o período ou ajuste o teto para incluí-los.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanoAberto(false)} disabled={loading}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={confirmarPlano}
              loading={loading}
              disabled={!planoResultado || planoResultado.propostas.length === 0}
            >
              Criar {planoResultado ? planoResultado.propostas.length : 0} previsões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgramarFeriasDialog
        open={planejarContrato !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPlanejarContrato(null)
        }}
        departamentoId={planejarContrato || null}
        onSalvo={carregar}
      />
    </FeriasShell>
  )
}
