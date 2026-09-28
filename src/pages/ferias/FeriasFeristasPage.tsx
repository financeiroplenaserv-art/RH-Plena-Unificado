import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Pencil, Plus, Power, Trash2, UserCheck, Users } from 'lucide-react'
import { agoraBrasil, formatarData, hojeBrasil } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { useAuth } from '@/hooks/useAuth'
import { useFerias, type EdicaoFuncao, type NovaFuncao } from '@/hooks/useFerias'
import { useColaboradores } from '@/hooks/useColaboradores'
import { supabase } from '@/lib/supabase'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import { calcularSituacaoFerista, type SituacaoFerista } from '@/lib/ferias/statusFerista'
import { calcularFillRate, faixaMetaFillRate } from '@/lib/ferias/fillRate'
import type { Colaborador } from '@/types/database'
import type { FeriasAlocacaoComSolicitacao, FeriasFerista, FeriasFuncao, FeriasSolicitacao } from '@/types/ferias'
import { FeriasShell } from './FeriasShell'

type Secao = 'carteira' | 'funcoes'

const VARIANTE_SITUACAO_FERISTA = {
  alocado: 'info',
  de_ferias: 'neutral',
  disponivel: 'success',
} as const

const ROTULO_SITUACAO_FERISTA = {
  alocado: 'Alocado',
  de_ferias: 'De férias',
  disponivel: 'Disponível',
} as const

/** Separa aliases digitados um por linha ou por vírgula/ponto e vírgula. */
function parseAliases(texto: string): string[] {
  return texto
    .split(/[\n,;]+/)
    .map((a) => a.trim())
    .filter(Boolean)
}

export function FeriasFeristasPage() {
  const { user } = useAuth()
  const podeGerenciar = user?.nivel_acesso ? podeGerenciarFerias(user.nivel_acesso) : false

  const {
    loading,
    listarFeristas,
    listarFuncoes,
    listarAlocacoes,
    listarSolicitacoes,
    adicionarFerista,
    atualizarFerista,
    removerFerista,
    criarFuncao,
    atualizarFuncao,
  } = useFerias()
  const { listarResumido } = useColaboradores()

  const [secao, setSecao] = useState<Secao>('carteira')
  const [feristas, setFeristas] = useState<FeriasFerista[]>([])
  const [funcoes, setFuncoes] = useState<FeriasFuncao[]>([])
  const [alocacoes, setAlocacoes] = useState<FeriasAlocacaoComSolicitacao[]>([])
  const [solicitacoes, setSolicitacoes] = useState<FeriasSolicitacao[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalFerista, setModalFerista] = useState(false)
  const [editandoFerista, setEditandoFerista] = useState<FeriasFerista | null>(null)
  const [excluindoFerista, setExcluindoFerista] = useState<FeriasFerista | null>(null)
  const [modalFuncao, setModalFuncao] = useState(false)
  const [editandoFuncao, setEditandoFuncao] = useState<FeriasFuncao | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    // Lista completa de departamentos (sem filtro de nome_curto) para a
    // resolução fuzzy — useDepartamentos.listar() não serve (ver AGENTS.md §11).
    const [listaFeristas, listaFuncoes, listaAlocacoes, listaSolicitacoes, listaColaboradores, { data: deptData }] =
      await Promise.all([
        listarFeristas(),
        listarFuncoes(),
        listarAlocacoes(),
        listarSolicitacoes(),
        listarResumido(),
        supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
      ])
    setFeristas(listaFeristas)
    setFuncoes(listaFuncoes)
    setAlocacoes(listaAlocacoes)
    setSolicitacoes(listaSolicitacoes)
    setColaboradores(listaColaboradores)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])
    setCarregando(false)
  }, [listarFeristas, listarFuncoes, listarAlocacoes, listarSolicitacoes, listarResumido])

  useEffect(() => {
    carregar()
  }, [carregar])

  const anoAtual = agoraBrasil().getFullYear()
  const hojeISO = hojeBrasil()

  // Situação calculada de cada ferista (alocado / de férias / disponível)
  const situacaoPorFerista = useMemo(() => {
    const mapa = new Map<string, SituacaoFerista>()
    for (const ferista of feristas) {
      mapa.set(
        ferista.id,
        calcularSituacaoFerista({
          alocacoes: alocacoes.filter((a) => a.ferista_id === ferista.id),
          ferias: solicitacoes.filter((s) => s.colaborador_id === ferista.colaborador_id),
          hoje: hojeISO,
        })
      )
    }
    return mapa
  }, [feristas, alocacoes, solicitacoes, hojeISO])

  const coberturasAnoPorFerista = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const a of alocacoes) {
      if (a.status !== 'confirmada' || !a.data_inicio.startsWith(String(anoAtual))) continue
      mapa.set(a.ferista_id, (mapa.get(a.ferista_id) ?? 0) + 1)
    }
    return mapa
  }, [alocacoes, anoAtual])

  const fillRate = useMemo(() => calcularFillRate(solicitacoes, anoAtual), [solicitacoes, anoAtual])
  const faixaFillRate = fillRate.taxa !== null ? faixaMetaFillRate(fillRate.taxa) : null

  const totalAtivos = feristas.filter((f) => f.ativo).length
  const totalDisponiveis = feristas.filter((f) => f.ativo && situacaoPorFerista.get(f.id)?.status === 'disponivel').length

  // Quantos colaboradores ativos resolvem para cada função (validação do catálogo)
  const colaboradoresPorFuncao = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const c of colaboradores) {
      if (c.status !== 'Ativo') continue
      const funcao = resolverFuncao(c.cargo, funcoes)
      if (funcao) mapa.set(funcao.id, (mapa.get(funcao.id) ?? 0) + 1)
    }
    return mapa
  }, [colaboradores, funcoes])

  const alocacaoPorId = useMemo(() => new Map(alocacoes.map((a) => [a.id, a])), [alocacoes])

  const nomeFuncaoPorId = useMemo(() => new Map(funcoes.map((f) => [f.id, f.nome])), [funcoes])

  const descricaoSituacao = (ferista: FeriasFerista): string => {
    const situacao = situacaoPorFerista.get(ferista.id)
    if (!situacao) return ''
    if (situacao.status === 'alocado' && situacao.alocacaoAtual) {
      const alocacao = alocacaoPorId.get(situacao.alocacaoAtual.id)
      const onde = alocacao?.solicitacao?.departamento_id
        ? nomeCurtoDepartamentoFuzzy(departamentos, alocacao.solicitacao.departamento_id, null)
        : null
      return onde ? `cobrindo ${onde}` : 'em cobertura'
    }
    if (situacao.status === 'de_ferias') return 'férias próprias'
    if (situacao.proximoCompromisso) return `próximo compromisso em ${formatarData(situacao.proximoCompromisso.inicio)}`
    return ''
  }

  const handleToggleFerista = async (ferista: FeriasFerista) => {
    const ok = await atualizarFerista(ferista.id, { ativo: !ferista.ativo })
    if (ok) await carregar()
  }

  const handleExcluirFerista = async () => {
    if (!excluindoFerista) return
    const ok = await removerFerista(excluindoFerista.id)
    if (ok) {
      setExcluindoFerista(null)
      await carregar()
    }
  }

  const handleToggleFuncao = async (funcao: FeriasFuncao) => {
    const ok = await atualizarFuncao(funcao.id, { ativo: !funcao.ativo })
    if (ok) await carregar()
  }

  const abrirNovoFerista = () => {
    setEditandoFerista(null)
    setModalFerista(true)
  }

  const abrirEdicaoFerista = (ferista: FeriasFerista) => {
    setEditandoFerista(ferista)
    setModalFerista(true)
  }

  const abrirNovaFuncao = () => {
    setEditandoFuncao(null)
    setModalFuncao(true)
  }

  const abrirEdicaoFuncao = (funcao: FeriasFuncao) => {
    setEditandoFuncao(funcao)
    setModalFuncao(true)
  }

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Feristas" description="Carteira de quem cobre férias e catálogo de funções operacionais">
        {podeGerenciar && (
          secao === 'carteira' ? (
            <Button variant="primary" size="sm" onClick={abrirNovoFerista}>
              <Plus className="size-4" />
              Adicionar ferista
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={abrirNovaFuncao}>
              <Plus className="size-4" />
              Nova função
            </Button>
          )
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setSecao('carteira')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
            secao === 'carteira'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
          }`}
        >
          <Users className="size-4" strokeWidth={1.8} />
          Carteira de feristas
        </button>
        <button
          type="button"
          onClick={() => setSecao('funcoes')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
            secao === 'funcoes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
          }`}
        >
          <Briefcase className="size-4" strokeWidth={1.8} />
          Catálogo de funções
        </button>
      </div>

      {carregando && <p className="mb-3 text-[12px] text-muted-foreground">Carregando dados da carteira...</p>}

      {secao === 'carteira' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground">Fill rate do ano (meta 85–92%)</p>
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
                {fillRate.taxa !== null ? `${Math.round(fillRate.taxa * 100)}%` : '—'}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {fillRate.total > 0
                  ? `${fillRate.alocadas} de ${fillRate.total} solicitações com ferista alocado`
                  : 'Sem solicitações efetivas no ano'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground">Feristas ativos</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-foreground">{totalAtivos}</p>
              <p className="text-[12px] text-muted-foreground">{feristas.length} na carteira</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground">Disponíveis agora</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-green-600">{totalDisponiveis}</p>
              <p className="text-[12px] text-muted-foreground">sem cobertura nem férias hoje</p>
            </div>
          </div>

          <DataTable title="Carteira de feristas" count={feristas.length}>
            {feristas.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="size-6" />}
                title="Nenhum ferista na carteira"
                description="Adicione colaboradores móveis que cobrem férias nos contratos."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ferista</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Situação agora</TableHead>
                    <TableHead>Disponível em</TableHead>
                    <TableHead>Coberturas no ano</TableHead>
                    <TableHead>Limites de carga</TableHead>
                    <TableHead>Ativo</TableHead>
                    {podeGerenciar && <TableHead className="w-28"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feristas.map((ferista) => {
                    const situacao = situacaoPorFerista.get(ferista.id)
                    const status = situacao?.status ?? 'disponivel'
                    return (
                      <TableRow key={ferista.id}>
                        <TableCell className="font-medium text-foreground">
                          {ferista.colaborador ? (
                            <Link to={`/ferias/colaborador/${ferista.colaborador_id}`} className="text-primary hover:underline">
                              {ferista.colaborador.nome_completo}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ferista.funcao ? `${ferista.funcao.nome} (nível ${ferista.funcao.nivel})` : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={VARIANTE_SITUACAO_FERISTA[status]}>
                            {ROTULO_SITUACAO_FERISTA[status]}
                          </StatusBadge>
                          {descricaoSituacao(ferista) && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{descricaoSituacao(ferista)}</p>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                          {status === 'disponivel' ? 'Agora' : situacao?.disponivelEm ? formatarData(situacao.disponivelEm) : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {coberturasAnoPorFerista.get(ferista.id) ?? 0}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          até {ferista.max_dias_consecutivos} dias seguidos · {ferista.max_coberturas_mes} coberturas/mês
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={ferista.ativo ? 'success' : 'neutral'}>
                            {ferista.ativo ? 'Ativo' : 'Inativo'}
                          </StatusBadge>
                        </TableCell>
                        {podeGerenciar && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Editar ferista"
                                onClick={() => abrirEdicaoFerista(ferista)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                title={ferista.ativo ? 'Desativar' : 'Ativar'}
                                onClick={() => handleToggleFerista(ferista)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                              >
                                <Power className="size-4" />
                              </button>
                              <button
                                type="button"
                                title="Remover da carteira"
                                onClick={() => setExcluindoFerista(ferista)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
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
        </>
      )}

      {secao === 'funcoes' && (
        <DataTable title="Catálogo de funções" count={funcoes.length}>
          {funcoes.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-6" />}
              title="Nenhuma função cadastrada"
              description="Cadastre as funções operacionais com a matriz de cobertura (quem cobre quem)."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Cobre</TableHead>
                  <TableHead>Aliases (grafias do cadastro)</TableHead>
                  <TableHead>Colaboradores ativos</TableHead>
                  <TableHead>Ativa</TableHead>
                  {podeGerenciar && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcoes.map((funcao) => (
                  <TableRow key={funcao.id}>
                    <TableCell className="font-medium text-foreground">{funcao.nome}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{funcao.nivel}</TableCell>
                    <TableCell>
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {(funcao.cobre_funcoes ?? []).length === 0 ? (
                          <span className="text-muted-foreground">só ela mesma</span>
                        ) : (
                          (funcao.cobre_funcoes ?? []).map((id) => (
                            <span key={id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              {nomeFuncaoPorId.get(id) ?? '?'}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {funcao.aliases.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          funcao.aliases.map((alias) => (
                            <span key={alias} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {alias}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {colaboradoresPorFuncao.get(funcao.id) ?? 0}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={funcao.ativo ? 'success' : 'neutral'}>
                        {funcao.ativo ? 'Ativa' : 'Inativa'}
                      </StatusBadge>
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Editar função"
                            onClick={() => abrirEdicaoFuncao(funcao)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            title={funcao.ativo ? 'Desativar' : 'Ativar'}
                            onClick={() => handleToggleFuncao(funcao)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                          >
                            <Power className="size-4" />
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>
      )}

      <FeristaDialog
        open={modalFerista}
        onOpenChange={setModalFerista}
        ferista={editandoFerista}
        funcoes={funcoes}
        colaboradoresNaCarteira={new Set(feristas.map((f) => f.colaborador_id))}
        loading={loading}
        onSalvar={async (dados) => {
          const ok = editandoFerista
            ? await atualizarFerista(editandoFerista.id, dados)
            : await adicionarFerista({ ...dados, colaborador_id: dados.colaborador_id! })
          if (ok) await carregar()
          return ok
        }}
      />

      <FuncaoDialog
        open={modalFuncao}
        onOpenChange={setModalFuncao}
        funcao={editandoFuncao}
        funcoes={funcoes}
        loading={loading}
        onSalvar={async (dados) => {
          const ok = editandoFuncao ? await atualizarFuncao(editandoFuncao.id, dados) : await criarFuncao(dados as NovaFuncao)
          if (ok) await carregar()
          return ok
        }}
      />

      <ConfirmDialog
        open={excluindoFerista !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setExcluindoFerista(null)
        }}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover ferista da carteira"
        description={
          excluindoFerista
            ? `Remover ${excluindoFerista.colaborador?.nome_completo ?? 'este ferista'} da carteira? Só é possível excluir quem nunca teve cobertura registrada — caso contrário, desative.`
            : ''
        }
        confirmLabel="Remover"
        destructive
        onConfirm={handleExcluirFerista}
      />
    </FeriasShell>
  )
}

// ============================================================
// Dialog de ferista (adicionar/editar)
// ============================================================

interface FeristaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ferista em edição; null = adicionar */
  ferista: FeriasFerista | null
  funcoes: FeriasFuncao[]
  /** colaborador_id de quem já está na carteira (não pode duplicar) */
  colaboradoresNaCarteira: Set<string>
  loading: boolean
  onSalvar: (dados: {
    colaborador_id?: string
    funcao_id: string | null
    max_dias_consecutivos: number
    max_coberturas_mes: number
    observacao: string | null
  }) => Promise<boolean>
}

function FeristaDialog({ open, onOpenChange, ferista, funcoes, colaboradoresNaCarteira, loading, onSalvar }: FeristaDialogProps) {
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [funcaoId, setFuncaoId] = useState('sem_funcao')
  const [maxDias, setMaxDias] = useState('30')
  const [maxCoberturas, setMaxCoberturas] = useState('2')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const modoEdicao = ferista !== null

  useEffect(() => {
    if (open) {
      setColaborador(null)
      setFuncaoId(ferista?.funcao_id ?? 'sem_funcao')
      setMaxDias(String(ferista?.max_dias_consecutivos ?? 30))
      setMaxCoberturas(String(ferista?.max_coberturas_mes ?? 2))
      setObservacao(ferista?.observacao ?? '')
      setErro(null)
    }
  }, [open, ferista])

  const handleSelecionarColaborador = (c: Colaborador | null) => {
    setColaborador(c)
    // Função automática: resolve o cargo do colaborador no catálogo (editável)
    if (c) {
      const sugerida = resolverFuncao(c.cargo, funcoes)
      if (sugerida) setFuncaoId(sugerida.id)
    }
    if (c && colaboradoresNaCarteira.has(c.id)) {
      setErro('Este colaborador já está na carteira de feristas.')
    } else {
      setErro(null)
    }
  }

  const handleSalvar = async () => {
    if (!modoEdicao && !colaborador) {
      setErro('Selecione o colaborador.')
      return
    }
    if (!modoEdicao && colaborador && colaboradoresNaCarteira.has(colaborador.id)) {
      setErro('Este colaborador já está na carteira de feristas.')
      return
    }
    const dias = Number(maxDias)
    const coberturas = Number(maxCoberturas)
    if (!Number.isInteger(dias) || dias < 1) {
      setErro('Informe o limite de dias consecutivos (mínimo 1).')
      return
    }
    if (!Number.isInteger(coberturas) || coberturas < 1) {
      setErro('Informe o limite de coberturas por mês (mínimo 1).')
      return
    }
    setErro(null)
    const ok = await onSalvar({
      colaborador_id: colaborador?.id,
      funcao_id: funcaoId === 'sem_funcao' ? null : funcaoId,
      max_dias_consecutivos: dias,
      max_coberturas_mes: coberturas,
      observacao: observacao.trim() || null,
    })
    if (ok) onOpenChange(false)
  }

  const funcoesAtivas = funcoes.filter((f) => f.ativo || f.id === ferista?.funcao_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modoEdicao ? 'Editar ferista' : 'Adicionar ferista'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {modoEdicao ? (
            <div>
              <Label>Colaborador</Label>
              <p className="mt-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium">
                {ferista.colaborador?.nome_completo ?? '—'}
              </p>
            </div>
          ) : (
            <AutocompleteColaborador label="Colaborador" onChange={handleSelecionarColaborador} somenteAtivos />
          )}

          <div>
            <Label>Função principal</Label>
            <Select value={funcaoId} onValueChange={setFuncaoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_funcao">Sem função definida</SelectItem>
                {funcoesAtivas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} (nível {f.nivel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Máx. dias consecutivos</Label>
              <Input type="number" min={1} value={maxDias} onChange={(e) => setMaxDias(e.target.value)} />
            </div>
            <div>
              <Label>Máx. coberturas/mês</Label>
              <Input type="number" min={1} value={maxCoberturas} onChange={(e) => setMaxCoberturas(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: preferência por contratos da zona sul"
              rows={2}
            />
          </div>

          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSalvar} loading={loading}>
            {modoEdicao ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Dialog de função (criar/editar)
// ============================================================

interface FuncaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Função em edição; null = criar */
  funcao: FeriasFuncao | null
  /** Catálogo completo — alimenta os checkboxes de "Cobre quais funções" */
  funcoes: FeriasFuncao[]
  loading: boolean
  onSalvar: (dados: NovaFuncao | EdicaoFuncao) => Promise<boolean>
}

function FuncaoDialog({ open, onOpenChange, funcao, funcoes, loading, onSalvar }: FuncaoDialogProps) {
  const [nome, setNome] = useState('')
  const [nivel, setNivel] = useState('1')
  const [aliases, setAliases] = useState('')
  const [cobreIds, setCobreIds] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const modoEdicao = funcao !== null

  useEffect(() => {
    if (open) {
      setNome(funcao?.nome ?? '')
      setNivel(String(funcao?.nivel ?? 1))
      setAliases((funcao?.aliases ?? []).join('\n'))
      setCobreIds(funcao?.cobre_funcoes ?? [])
      setErro(null)
    }
  }, [open, funcao])

  const handleSalvar = async () => {
    if (!nome.trim()) {
      setErro('Informe o nome da função.')
      return
    }
    const nivelNum = Number(nivel)
    if (!Number.isInteger(nivelNum) || nivelNum < 1) {
      setErro('Informe um nível inteiro maior ou igual a 1.')
      return
    }
    setErro(null)
    const ok = await onSalvar({ nome: nome.trim(), nivel: nivelNum, aliases: parseAliases(aliases), cobre_funcoes: cobreIds })
    if (ok) onOpenChange(false)
  }

  const toggleCobre = (id: string) => {
    setCobreIds((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  // Cobrir a própria função é implícito — os checkboxes são só das OUTRAS
  const outrasFuncoes = funcoes.filter((f) => f.ativo && f.id !== funcao?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modoEdicao ? 'Editar função' : 'Nova função'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Porteiro" />
          </div>

          <div>
            <Label>Cobre quais funções</Label>
            <div className="mt-1 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
              {outrasFuncoes.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Nenhuma outra função ativa no catálogo.</p>
              ) : (
                outrasFuncoes.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={cobreIds.includes(f.id)}
                      onChange={() => toggleCobre(f.id)}
                      className="size-4 accent-primary"
                    />
                    {f.nome}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              É a matriz de cobertura: quem tem esta função pode cobrir férias das funções marcadas. Cobrir a própria função é sempre permitido.
            </p>
          </div>

          <div>
            <Label>Nível</Label>
            <Input type="number" min={1} value={nivel} onChange={(e) => setNivel(e.target.value)} />
            <p className="mt-1 text-[12px] text-muted-foreground">
              O nível serve apenas para desempate nas sugestões — quem cobre quem é definido em "Cobre quais funções".
            </p>
          </div>

          <div>
            <Label>Aliases (um por linha ou separados por vírgula)</Label>
            <Textarea
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder={'Grafias encontradas no cadastro, ex.:\nPORTEIRO (a)\nPORTEIRO'}
              rows={4}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              São as grafias reais de colaboradores.cargo que devem resolver para esta função.
            </p>
          </div>

          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSalvar} loading={loading}>
            {modoEdicao ? 'Salvar alterações' : 'Criar função'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
