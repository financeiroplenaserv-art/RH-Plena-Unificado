import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, CalendarDays, CalendarPlus, Check, Download, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { hojeBrasil, agoraBrasil, formatarData } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useFerias } from '@/hooks/useFerias'
import { useColaboradores } from '@/hooks/useColaboradores'
import { supabase } from '@/lib/supabase'
import { podeExportarFerias, podeGerenciarFerias } from '@/lib/permissoes'
import { normalizarTexto } from '@/lib/escalas/normalizarTexto'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import {
  resumirFerias,
  DIAS_ALERTA_VENCIMENTO,
  type SituacaoFerias,
  type ResumoFerias,
} from '@/lib/ferias/calculoFerias'
import type { Colaborador } from '@/types/database'
import type { FeriasSolicitacao } from '@/types/ferias'
import { FeriasShell } from './FeriasShell'
import { ProgramarFeriasDialog } from './ProgramarFeriasDialog'
import { NotificacaoFeriasDialog } from './NotificacaoFeriasDialog'

interface LinhaFerias {
  colaborador: Colaborador
  resumo: ResumoFerias
  /** Nome curto do departamento para exibição (padrão da aba Colaboradores) */
  departamentoExibido: string
  /** Previsão manual mais próxima (para excluir/vincular notificação) */
  previsaoSolicitacao: FeriasSolicitacao | null
  /** Próximo período confirmado (agendado), para vincular notificação e ferista */
  agendadoSolicitacao: FeriasSolicitacao | null
  /** Nome do ferista alocado na solicitação confirmada, quando houver */
  feristaNome: string | null
}

/** Colunas da tabela com ordenação crescente/decrescente (setinha no cabeçalho) */
type ColunaOrdenacao = 'ultimoGozo' | 'previsao' | 'agendado' | 'limite'

/** Data ISO (YYYY-MM-DD) usada como chave de ordenação da coluna; null = sem dados */
function valorOrdenacao(linha: LinhaFerias, coluna: ColunaOrdenacao): string | null {
  switch (coluna) {
    case 'ultimoGozo':
      return linha.resumo.ultimoGozo?.inicio ?? null
    case 'previsao':
      return linha.resumo.proximaPrevisao?.inicio ?? null
    case 'agendado':
      return linha.resumo.proximoAgendado?.inicio ?? null
    case 'limite':
      return linha.resumo.limiteConcessivo
  }
}

const SITUACOES: SituacaoFerias[] = ['Em gozo', 'Agendado', 'Previsto', 'A vencer', 'Vencido', 'Em dia', 'Sem dados']

const VARIANTE_SITUACAO: Record<SituacaoFerias, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  'Em gozo': 'info',
  Agendado: 'info',
  Previsto: 'neutral',
  'A vencer': 'warning',
  Vencido: 'danger',
  'Em dia': 'success',
  'Sem dados': 'neutral',
}

function exibirData(iso: string | null | undefined): string {
  return formatarData(iso) || '—'
}

function formatarPeriodo(periodo: { inicio: string; fim: string } | null): string {
  if (!periodo) return '—'
  return `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function FeriasPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeExportar = perfil ? podeExportarFerias(perfil) : false
  const podeGerenciar = perfil ? podeGerenciarFerias(perfil) : false

  const { loading, listarSolicitacoes, excluirPeriodo, aprovarSolicitacao, registrarNotificacao } = useFerias()
  const { colaboradores, listarResumido } = useColaboradores()
  const [solicitacoes, setSolicitacoes] = useState<FeriasSolicitacao[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [carregando, setCarregando] = useState(true)

  const [input, setInput] = useFiltroPersistente('ferias.lista.draft', { busca: '', departamento: 'todos', situacao: 'todas' })
  const [aplicado, setAplicado] = useFiltroPersistente('ferias.lista.aplicado', { busca: '', departamento: 'todos', situacao: 'todas' })

  const [modalProgramar, setModalProgramar] = useState(false)
  const [programarSolicitacao, setProgramarSolicitacao] = useState<FeriasSolicitacao | null>(null)
  const [notificacaoLinha, setNotificacaoLinha] = useState<LinhaFerias | null>(null)
  const [excluirPrevisao, setExcluirPrevisao] = useState<LinhaFerias | null>(null)

  const carregar = async () => {
    setCarregando(true)
    // Lista completa de departamentos (sem filtro de nome_curto) para a
    // resolução fuzzy funcionar — useDepartamentos.listar() filtra nome_curto
    // NOT NULL e não serve para resolução (ver AGENTS.md §11).
    const [, lista, { data: deptData, error: erroDept }] = await Promise.all([
      listarResumido(),
      listarSolicitacoes(),
      supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    ])
    if (erroDept) console.error('Erro ao carregar departamentos:', erroDept)
    setSolicitacoes(lista)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Solicitações pendentes de aprovação: primeiro os pedidos do próprio
  // colaborador (prioridade — decisão da gestão 25/09/2026), depois por
  // antiguidade de admissão (RN-01).
  const pendencias = useMemo(() => {
    return solicitacoes
      .filter((s) => s.status === 'pendente')
      .sort((a, b) => {
        const pedidoA = a.pedido_colaborador ? 0 : 1
        const pedidoB = b.pedido_colaborador ? 0 : 1
        if (pedidoA !== pedidoB) return pedidoA - pedidoB
        const admA = a.colaborador?.data_admissao ?? '9999-12-31'
        const admB = b.colaborador?.data_admissao ?? '9999-12-31'
        if (admA !== admB) return admA.localeCompare(admB)
        return a.data_inicio.localeCompare(b.data_inicio)
      })
  }, [solicitacoes])

  // Monta uma linha por colaborador ativo, juntando suas solicitações
  const linhas = useMemo<LinhaFerias[]>(() => {
    const porColaborador = new Map<string, FeriasSolicitacao[]>()
    for (const s of solicitacoes) {
      if (s.status === 'cancelada') continue
      const lista = porColaborador.get(s.colaborador_id) ?? []
      lista.push(s)
      porColaborador.set(s.colaborador_id, lista)
    }

    const hoje = agoraBrasil()
    const hojeISO = hojeBrasil()

    return colaboradores
      .filter((c) => c.status === 'Ativo')
      .map((colaborador) => {
        const doColaborador = porColaborador.get(colaborador.id) ?? []
        const previsoes = doColaborador
          .filter((s) => s.tipo === 'previsto' && s.data_fim >= hojeISO)
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
        const confirmadas = doColaborador
          .filter((s) => s.tipo === 'agendado' && s.data_fim >= hojeISO)
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
        const agendadoSolicitacao = confirmadas[0] ?? null
        const comFerista = doColaborador
          .filter((s) => s.ferista && (s.status === 'aprovada' || s.status === 'em_andamento') && s.data_fim >= hojeISO)
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0]

        return {
          colaborador,
          resumo: resumirFerias(
            colaborador.data_admissao,
            doColaborador.map((s) => ({ tipo: s.tipo, data_inicio: s.data_inicio, data_fim: s.data_fim, status: s.status })),
            hoje
          ),
          departamentoExibido: nomeCurtoDepartamentoFuzzy(
            departamentos,
            colaborador.departamento_id,
            colaborador.departamento,
            colaborador.empresa_id
          ),
          previsaoSolicitacao: previsoes[0] ?? null,
          agendadoSolicitacao,
          feristaNome: comFerista?.ferista?.nome_completo ?? null,
        }
      })
  }, [colaboradores, solicitacoes, departamentos])

  const opcoesDepartamento = useMemo(() => {
    const nomes = new Set<string>()
    for (const linha of linhas) {
      if (linha.departamentoExibido !== '—') nomes.add(linha.departamentoExibido)
    }
    return Array.from(nomes).sort()
  }, [linhas])

  const contadores = useMemo(() => {
    const contagem: Record<SituacaoFerias, number> = {
      'Em gozo': 0,
      Agendado: 0,
      Previsto: 0,
      'A vencer': 0,
      Vencido: 0,
      'Em dia': 0,
      'Sem dados': 0,
    }
    for (const linha of linhas) contagem[linha.resumo.situacao] += 1
    return contagem
  }, [linhas])

  const linhasFiltradas = useMemo(() => {
    const busca = normalizarTexto(aplicado.busca)
    return linhas.filter((linha) => {
      if (aplicado.departamento !== 'todos' && linha.departamentoExibido !== aplicado.departamento) return false
      if (aplicado.situacao !== 'todas' && linha.resumo.situacao !== aplicado.situacao) return false
      if (busca && !normalizarTexto(linha.colaborador.nome_completo).includes(busca)) return false
      return true
    })
  }, [linhas, aplicado])

  const totalFiltrosAtivos =
    (aplicado.busca.trim() ? 1 : 0) + (aplicado.departamento !== 'todos' ? 1 : 0) + (aplicado.situacao !== 'todas' ? 1 : 0)

  const [ordenacao, setOrdenacao] = useFiltroPersistente<{ coluna: ColunaOrdenacao; direcao: 'asc' | 'desc' } | null>('ferias.lista.ordenacao', null)

  // Linhas ordenadas pela coluna clicada; linhas sem data ficam sempre por último
  const linhasOrdenadas = useMemo(() => {
    if (!ordenacao) return linhasFiltradas
    const fator = ordenacao.direcao === 'asc' ? 1 : -1
    return [...linhasFiltradas].sort((a, b) => {
      const va = valorOrdenacao(a, ordenacao.coluna)
      const vb = valorOrdenacao(b, ordenacao.coluna)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return va.localeCompare(vb) * fator
    })
  }, [linhasFiltradas, ordenacao])

  const alternarOrdenacao = (coluna: ColunaOrdenacao) => {
    setOrdenacao((atual) => {
      if (!atual || atual.coluna !== coluna) return { coluna, direcao: 'asc' }
      return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
    })
  }

  const cabecalhoOrdenavel = (coluna: ColunaOrdenacao, rotulo: string) => {
    const ativa = ordenacao?.coluna === coluna
    const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => alternarOrdenacao(coluna)}
          title={`Ordenar por ${rotulo}`}
          className={`flex items-center gap-1 uppercase tracking-wide hover:text-foreground ${ativa ? 'text-foreground' : ''}`}
        >
          {rotulo}
          <Icone className="size-3.5" />
        </button>
      </TableHead>
    )
  }

  const aplicarFiltros = () => setAplicado(input)
  const limparFiltros = () => {
    const vazio = { busca: '', departamento: 'todos', situacao: 'todas' }
    setInput(vazio)
    setAplicado(vazio)
  }

  const handleExcluirPrevisao = async () => {
    if (!excluirPrevisao?.previsaoSolicitacao) return
    const ok = await excluirPeriodo(excluirPrevisao.previsaoSolicitacao.id)
    if (ok) {
      setExcluirPrevisao(null)
      await carregar()
    }
  }

  const handleAprovar = async (id: string) => {
    const ok = await aprovarSolicitacao(id)
    if (ok) await carregar()
  }

  const exportarExcel = async () => {
    if (linhasFiltradas.length === 0) {
      toast.info('Nenhum registro para exportar. Aplique um filtro primeiro.')
      return
    }
    try {
      const XLSX = await import('@e965/xlsx')
      const dados = linhasOrdenadas.map((linha) => ({
        Colaborador: linha.colaborador.nome_completo,
        Matrícula: linha.colaborador.matricula,
        Departamento: linha.departamentoExibido,
        Admissão: formatarData(linha.colaborador.data_admissao),
        'Último gozo': formatarPeriodo(linha.resumo.ultimoGozo),
        'Previsão RH': formatarPeriodo(linha.resumo.proximaPrevisao),
        'Próximo agendado': formatarPeriodo(linha.resumo.proximoAgendado),
        'Ferista alocado': linha.feristaNome ?? '',
        'Limite concessivo': formatarData(linha.resumo.limiteConcessivo),
        Situação: linha.resumo.situacao,
      }))
      const worksheet = XLSX.utils.json_to_sheet(dados)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Férias')
      XLSX.writeFile(workbook, `ferias_${hojeBrasil()}.xlsx`)
      toast.success(`${dados.length} registro(s) exportado(s) para Excel.`)
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      toast.error('Erro ao exportar Excel')
    }
  }

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Férias">
        {podeGerenciar && (
          <Button variant="primary" size="sm" onClick={() => setModalProgramar(true)}>
            <CalendarPlus className="size-4" />
            Nova previsão
          </Button>
        )}
        {podeExportar && (
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <Download className="size-4" />
            Exportar Excel
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Em gozo hoje</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-blue-700">{contadores['Em gozo']}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Agendados</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-foreground">{contadores['Agendado']}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Previstos (RH)</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-foreground">{contadores['Previsto']}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">A vencer (≤ {DIAS_ALERTA_VENCIMENTO}d)</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-amber-600">{contadores['A vencer']}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[12px] font-medium text-muted-foreground">Vencidos</p>
          <p className="mt-1 text-[24px] font-bold tabular-nums text-red-600">{contadores['Vencido']}</p>
        </div>
      </div>

      {podeGerenciar && pendencias.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/60 shadow-sm">
          <div className="border-b border-amber-200 px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-foreground">
              Pendências de aprovação
              <span className="ml-1.5 rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {pendencias.length}
              </span>
            </h2>
            <p className="text-[12px] text-muted-foreground">Pedidos do próprio colaborador primeiro; depois por antiguidade (admissão mais antiga).</p>
          </div>
          <ul className="divide-y divide-amber-200/60">
            {pendencias.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/ferias/colaborador/${s.colaborador_id}`}
                    className="block truncate text-[13px] font-medium text-primary hover:underline"
                  >
                    {s.colaborador?.nome_completo ?? 'Colaborador'}
                  </Link>
                  {s.pedido_colaborador && (
                    <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      pedido do colaborador
                    </span>
                  )}
                  <p className="text-[12px] tabular-nums text-muted-foreground">
                    {formatarData(s.data_inicio)} a {formatarData(s.data_fim)}
                    {s.colaborador?.data_admissao ? ` · admissão ${formatarData(s.colaborador.data_admissao)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setProgramarSolicitacao(s)}>
                    <CalendarDays className="size-4" />
                    Programar
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleAprovar(s.id)} loading={loading}>
                    <Check className="size-4" />
                    Aprovar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-2 flex items-center justify-end">
        <FiltrosAtivosBadge total={totalFiltrosAtivos} onLimpar={limparFiltros} />
      </div>

      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={carregando} className="mb-4">
        <div>
          <Label>Buscar</Label>
          <Input
            placeholder="Nome do colaborador"
            value={input.busca}
            onChange={(e) => setInput((v) => ({ ...v, busca: e.target.value }))}
          />
        </div>
        <div>
          <Label>Departamento</Label>
          <Select value={input.departamento} onValueChange={(v) => setInput((prev) => ({ ...prev, departamento: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {opcoesDepartamento.map((dep) => (
                <SelectItem key={dep} value={dep}>
                  {dep}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Situação</Label>
          <Select value={input.situacao} onValueChange={(v) => setInput((prev) => ({ ...prev, situacao: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {SITUACOES.map((situacao) => (
                <SelectItem key={situacao} value={situacao}>
                  {situacao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Filters>

      <DataTable title="Colaboradores" count={linhasFiltradas.length}>
        {linhasFiltradas.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Nenhum colaborador encontrado"
            description={
              solicitacoes.length === 0
                ? 'Importe a planilha de férias do Flit na aba Importar para começar.'
                : 'Ajuste os filtros e clique em Aplicar.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Admissão</TableHead>
                {cabecalhoOrdenavel('ultimoGozo', 'Último gozo')}
                {cabecalhoOrdenavel('previsao', 'Previsão RH')}
                {cabecalhoOrdenavel('agendado', 'Próximo agendado')}
                <TableHead>Ferista alocado</TableHead>
                {cabecalhoOrdenavel('limite', 'Limite concessivo')}
                <TableHead>Situação</TableHead>
                {podeGerenciar && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasOrdenadas.map((linha) => (
                <TableRow key={linha.colaborador.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {linha.colaborador.nome_completo ? (
                          <span>{iniciais(linha.colaborador.nome_completo)}</span>
                        ) : (
                          <User className="size-4" />
                        )}
                      </div>
                      <Link
                        to={`/ferias/colaborador/${linha.colaborador.id}`}
                        className="line-clamp-2 break-words text-primary hover:underline sm:line-clamp-1"
                      >
                        {linha.colaborador.nome_completo}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{linha.departamentoExibido}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{exibirData(linha.colaborador.data_admissao)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.ultimoGozo)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.proximaPrevisao)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.proximoAgendado)}</TableCell>
                  <TableCell className="text-muted-foreground">{linha.feristaNome ?? '—'}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{exibirData(linha.resumo.limiteConcessivo)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={VARIANTE_SITUACAO[linha.resumo.situacao]}>
                      {linha.resumo.situacao}
                    </StatusBadge>
                  </TableCell>
                  {podeGerenciar && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Registrar notificação"
                          onClick={() => setNotificacaoLinha(linha)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                        >
                          <Bell className="size-4" />
                        </button>
                        {linha.previsaoSolicitacao && (
                          <button
                            type="button"
                            title="Excluir previsão"
                            onClick={() => setExcluirPrevisao(linha)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <ProgramarFeriasDialog
        open={modalProgramar}
        onOpenChange={setModalProgramar}
        onSalvo={carregar}
      />

      <ProgramarFeriasDialog
        open={programarSolicitacao !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setProgramarSolicitacao(null)
        }}
        solicitacao={programarSolicitacao}
        onSalvo={carregar}
      />

      <NotificacaoFeriasDialog
        open={notificacaoLinha !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setNotificacaoLinha(null)
        }}
        colaboradorInicial={notificacaoLinha?.colaborador ?? null}
        solicitacaoId={notificacaoLinha?.agendadoSolicitacao?.id ?? notificacaoLinha?.previsaoSolicitacao?.id ?? null}
        loading={loading}
        onSalvar={registrarNotificacao}
      />

      <ConfirmDialog
        open={excluirPrevisao !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setExcluirPrevisao(null)
        }}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir previsão de férias"
        description={
          excluirPrevisao
            ? `Excluir a previsão de ${excluirPrevisao.colaborador.nome_completo} (${formatarPeriodo(excluirPrevisao.resumo.proximaPrevisao)})?`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={handleExcluirPrevisao}
      />
    </FeriasShell>
  )
}
