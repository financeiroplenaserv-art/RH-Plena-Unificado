import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, CalendarPlus, Download, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
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
import { useFerias } from '@/hooks/useFerias'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { podeExportarFerias, podeGerenciarFerias } from '@/lib/permissoes'
import { normalizarTexto } from '@/lib/escalas/normalizarTexto'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import {
  resumirFerias,
  DIAS_ALERTA_VENCIMENTO,
  type SituacaoFerias,
  type ResumoFerias,
} from '@/lib/ferias/calculoFerias'
import type { Colaborador, FeriasPeriodo } from '@/types/database'
import { FeriasShell } from './FeriasShell'
import { NovaPrevisaoDialog } from './NovaPrevisaoDialog'
import { NotificacaoFeriasDialog } from './NotificacaoFeriasDialog'

interface LinhaFerias {
  colaborador: Colaborador
  resumo: ResumoFerias
  /** Nome curto do departamento para exibição (padrão da aba Colaboradores) */
  departamentoExibido: string
  /** Linha da previsão manual mais próxima (para excluir/vincular notificação) */
  previsaoPeriodo: FeriasPeriodo | null
  /** Linha do próximo período confirmado (agendado), para vincular notificação */
  agendadoPeriodo: FeriasPeriodo | null
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

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

function formatarPeriodo(periodo: { inicio: string; fim: string } | null): string {
  if (!periodo) return '-'
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

  const { loading, listarPeriodos, adicionarPrevisao, excluirPeriodo, registrarNotificacao } = useFerias()
  const { colaboradores, listarResumido } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()
  const [periodos, setPeriodos] = useState<FeriasPeriodo[]>([])
  const [carregando, setCarregando] = useState(true)

  const [input, setInput] = useState({ busca: '', departamento: 'todos', situacao: 'todas' })
  const [aplicado, setAplicado] = useState(input)

  const [modalPrevisao, setModalPrevisao] = useState(false)
  const [notificacaoLinha, setNotificacaoLinha] = useState<LinhaFerias | null>(null)
  const [excluirPrevisao, setExcluirPrevisao] = useState<LinhaFerias | null>(null)

  const carregar = async () => {
    setCarregando(true)
    const [, listaPeriodos] = await Promise.all([listarResumido(), listarPeriodos(), listarDepartamentos()])
    setPeriodos(listaPeriodos)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Monta uma linha por colaborador ativo, juntando seus períodos
  const linhas = useMemo<LinhaFerias[]>(() => {
    const periodosPorColaborador = new Map<string, FeriasPeriodo[]>()
    for (const periodo of periodos) {
      const lista = periodosPorColaborador.get(periodo.colaborador_id) ?? []
      lista.push(periodo)
      periodosPorColaborador.set(periodo.colaborador_id, lista)
    }

    const hoje = new Date()
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    return colaboradores
      .filter((c) => c.status === 'Ativo')
      .map((colaborador) => {
        const doColaborador = periodosPorColaborador.get(colaborador.id) ?? []
        const previsoes = doColaborador
          .filter((p) => p.tipo === 'previsto' && p.data_fim >= hojeISO)
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
        const agendados = doColaborador
          .filter((p) => p.tipo === 'agendado' && p.data_fim >= hojeISO)
          .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))

        return {
          colaborador,
          resumo: resumirFerias(
            colaborador.data_admissao,
            doColaborador.map((p) => ({ tipo: p.tipo, data_inicio: p.data_inicio, data_fim: p.data_fim })),
            hoje
          ),
          departamentoExibido: nomeCurtoDepartamentoFuzzy(
            departamentos,
            colaborador.departamento_id,
            colaborador.departamento,
            colaborador.empresa_id
          ),
          previsaoPeriodo: previsoes[0] ?? null,
          agendadoPeriodo: agendados[0] ?? null,
        }
      })
  }, [colaboradores, periodos, departamentos])

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

  const aplicarFiltros = () => setAplicado(input)
  const limparFiltros = () => {
    const vazio = { busca: '', departamento: 'todos', situacao: 'todas' }
    setInput(vazio)
    setAplicado(vazio)
  }

  const handleExcluirPrevisao = async () => {
    if (!excluirPrevisao?.previsaoPeriodo) return
    const ok = await excluirPeriodo(excluirPrevisao.previsaoPeriodo.id)
    if (ok) {
      setExcluirPrevisao(null)
      await carregar()
    }
  }

  const exportarExcel = async () => {
    if (linhasFiltradas.length === 0) {
      toast.info('Nenhum registro para exportar. Aplique um filtro primeiro.')
      return
    }
    try {
      const XLSX = await import('@e965/xlsx')
      const dados = linhasFiltradas.map((linha) => ({
        Colaborador: linha.colaborador.nome_completo,
        Matrícula: linha.colaborador.matricula,
        Departamento: linha.departamentoExibido,
        Admissão: formatarData(linha.colaborador.data_admissao),
        'Último gozo': formatarPeriodo(linha.resumo.ultimoGozo),
        'Previsão RH': formatarPeriodo(linha.resumo.proximaPrevisao),
        'Próximo agendado': formatarPeriodo(linha.resumo.proximoAgendado),
        'Limite concessivo': formatarData(linha.resumo.limiteConcessivo),
        Situação: linha.resumo.situacao,
      }))
      const worksheet = XLSX.utils.json_to_sheet(dados)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Férias')
      XLSX.writeFile(workbook, `ferias_${new Date().toISOString().slice(0, 10)}.xlsx`)
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
          <Button variant="primary" size="sm" onClick={() => setModalPrevisao(true)}>
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
              periodos.length === 0
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
                <TableHead>Último gozo</TableHead>
                <TableHead>Previsão RH</TableHead>
                <TableHead>Próximo agendado</TableHead>
                <TableHead>Limite concessivo</TableHead>
                <TableHead>Situação</TableHead>
                {podeGerenciar && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasFiltradas.map((linha) => (
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
                      <span className="line-clamp-2 break-words sm:line-clamp-1">{linha.colaborador.nome_completo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{linha.departamentoExibido}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatarData(linha.colaborador.data_admissao)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.ultimoGozo)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.proximaPrevisao)}</TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">{formatarPeriodo(linha.resumo.proximoAgendado)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatarData(linha.resumo.limiteConcessivo)}</TableCell>
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
                        {linha.previsaoPeriodo && (
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

      <NovaPrevisaoDialog
        open={modalPrevisao}
        onOpenChange={setModalPrevisao}
        loading={loading}
        onSalvar={async (previsao) => {
          const ok = await adicionarPrevisao(previsao)
          if (ok) await carregar()
          return ok
        }}
      />

      <NotificacaoFeriasDialog
        open={notificacaoLinha !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setNotificacaoLinha(null)
        }}
        colaboradorInicial={notificacaoLinha?.colaborador ?? null}
        periodoId={notificacaoLinha?.agendadoPeriodo?.id ?? notificacaoLinha?.previsaoPeriodo?.id ?? null}
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
