import { useEffect, useMemo, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, Trash2, RotateCcw, Package, Receipt, FileText, Upload, Filter } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useAuth } from '@/hooks/useAuth'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Paginacao } from '@/components/Paginacao'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { Input } from '@/components/ui/input'
import { CeuDialog } from '@/components/ceu/CeuDialog'
import { registrarLogExclusao } from '@/lib/ceuLogs'
import { formatarData, hojeBrasil } from '@/lib/utils'
import {
  podeRegistrarEntregaCEU,
  podeDevolverCEU,
  podeExcluirEntregaCEU,
  podeEmitirReciboCEU,
  podeImportarCEU,
} from '@/lib/permissoes'
import { CeuReciboModal, type DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { prepararGruposRecibo, gerarRecibosLoteHTML } from '@/lib/ceu/emissaoRecibos'
import type { EntregaCEU } from '@/types/database'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function corPorTipo(tipo: string | undefined) {
  switch (tipo) {
    case 'EPI':
      return 'bg-orange-500'
    case 'Uniforme':
      return 'bg-green-500'
    case 'Crachá':
      return 'bg-yellow-500'
    case 'Equipamento':
      return 'bg-blue-500'
    default:
      return 'bg-slate-400'
  }
}

export function CeuMovimentacoesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeRegistrar = perfil ? podeRegistrarEntregaCEU(perfil) : false
  const podeDevolver = perfil ? podeDevolverCEU(perfil) : false
  const podeExcluir = perfil ? podeExcluirEntregaCEU(perfil) : false
  const podeRecibo = perfil ? podeEmitirReciboCEU(perfil) : false
  const podeImportar = perfil ? podeImportarCEU(perfil) : false
  const { entregas, loading, paginacao, listar, listarPaginado, devolver, remover, proximoNumeroRecibo, registrarEmissaoRecibo } = useCEUEntregas()
  const { itens, listar: listarItens } = useCEUItens()
  // Filtros APLICADOS (alimentam a consulta) — as chaves sem ".draft" já
  // existiam na sessão dos usuários; não renomear para não perder o estado.
  const [busca, setBusca] = useFiltroPersistente('ceu.movimentacoes.busca', '')
  const [filtroItem, setFiltroItem] = useFiltroPersistente('ceu.movimentacoes.item', 'todos')
  const [filtroStatus, setFiltroStatus] = useFiltroPersistente<'todos' | 'em_aberto' | 'devolvido'>('ceu.movimentacoes.status', 'todos')
  const [filtroDataInicio, setFiltroDataInicio] = useFiltroPersistente('ceu.movimentacoes.data_inicio', '')
  const [filtroDataFim, setFiltroDataFim] = useFiltroPersistente('ceu.movimentacoes.data_fim', '')
  const [filtroDepartamento, setFiltroDepartamento] = useFiltroPersistente('ceu.movimentacoes.departamento', 'todos')
  // Rascunhos dos inputs: só viram filtro ao clicar "Aplicar" (padrão das
  // telas de Itens e Relatórios). O valor inicial é o aplicado atual, para
  // a primeira visita após esta mudança não descasar rascunho e lista.
  const [buscaInput, setBuscaInput] = useFiltroPersistente('ceu.movimentacoes.draft.busca', () => busca)
  const [filtroItemInput, setFiltroItemInput] = useFiltroPersistente('ceu.movimentacoes.draft.item', () => filtroItem)
  const [filtroStatusInput, setFiltroStatusInput] = useFiltroPersistente<'todos' | 'em_aberto' | 'devolvido'>('ceu.movimentacoes.draft.status', () => filtroStatus)
  const [filtroDataInicioInput, setFiltroDataInicioInput] = useFiltroPersistente('ceu.movimentacoes.draft.data_inicio', () => filtroDataInicio)
  const [filtroDataFimInput, setFiltroDataFimInput] = useFiltroPersistente('ceu.movimentacoes.draft.data_fim', () => filtroDataFim)
  const [filtroDepartamentoInput, setFiltroDepartamentoInput] = useFiltroPersistente('ceu.movimentacoes.draft.departamento', () => filtroDepartamento)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [ordem, setOrdem] = useFiltroPersistente<{ coluna: 'data' | 'colaborador' | 'itens' | 'qtdTotal'; direcao: 'asc' | 'desc' }>(
    'ceu.movimentacoes.ordem',
    {
      coluna: 'data',
      direcao: 'desc',
    }
  )
  const [removerId, setRemoverId] = useState<string | null>(null)
  const [devolverItens, setDevolverItens] = useState<EntregaCEU[] | null>(null)
  const [selecionadosDevolver, setSelecionadosDevolver] = useState<string[]>([])
  const [dataDevolucao, setDataDevolucao] = useState(hojeBrasil())
  const [modalRecibo, setModalRecibo] = useState(false)
  const [dadosRecibo, setDadosRecibo] = useState<DadosEntrega | DadosEntrega[] | null>(null)

  const [modalLote, setModalLote] = useState(false)
  const [dataInicioLote, setDataInicioLote] = useState('')
  const [dataFimLote, setDataFimLote] = useState('')
  const [gerandoLote, setGerandoLote] = useState(false)
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    listarItens()
  }, [listarItens])

  const aplicarFiltros = () => {
    setBusca(buscaInput)
    setFiltroItem(filtroItemInput)
    setFiltroStatus(filtroStatusInput)
    setFiltroDataInicio(filtroDataInicioInput)
    setFiltroDataFim(filtroDataFimInput)
    setFiltroDepartamento(filtroDepartamentoInput)
    setPagina(0)
  }

  const limparFiltros = () => {
    setBuscaInput('')
    setFiltroItemInput('todos')
    setFiltroStatusInput('todos')
    setFiltroDataInicioInput('')
    setFiltroDataFimInput('')
    setFiltroDepartamentoInput('todos')
    setBusca('')
    setFiltroItem('todos')
    setFiltroStatus('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroDepartamento('todos')
    setPagina(0)
  }

  // Vindo da criação de entregas (Nova Entrega ou Lançamento Rápido): limpa
  // os filtros persistidos para a entrega recém-criada aparecer na listagem —
  // um filtro esquecido (ex.: período antigo) a esconderia e pareceria que
  // não salvou. Declarado ANTES do effect de listagem para limpar primeiro.
  useEffect(() => {
    if ((location.state as { entregaCriada?: boolean } | null)?.entregaCriada) {
      limparFiltros()
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildFiltrosPaginacao = () => ({
    itemId: filtroItem !== 'todos' ? filtroItem : undefined,
    emAberto: filtroStatus === 'em_aberto' ? true : undefined,
    devolvido: filtroStatus === 'devolvido' ? true : undefined,
    dataInicio: filtroDataInicio || undefined,
    dataFim: filtroDataFim || undefined,
    buscaColaborador: busca.trim() || undefined,
    departamento: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
  })

  useEffect(() => {
    setPagina(0)
    listarPaginado(buildFiltrosPaginacao(), { pagina: 0, tamanho: 50 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, filtroItem, filtroStatus, filtroDataInicio, filtroDataFim, filtroDepartamento, listarPaginado])

  const totalFiltrosAtivos =
    (busca.trim() !== '' ? 1 : 0) +
    (filtroItem !== 'todos' ? 1 : 0) +
    (filtroStatus !== 'todos' ? 1 : 0) +
    (filtroDataInicio !== '' ? 1 : 0) +
    (filtroDataFim !== '' ? 1 : 0) +
    (filtroDepartamento !== 'todos' ? 1 : 0)

  const temRascunhoPendente =
    buscaInput !== busca ||
    filtroItemInput !== filtroItem ||
    filtroStatusInput !== filtroStatus ||
    filtroDataInicioInput !== filtroDataInicio ||
    filtroDataFimInput !== filtroDataFim ||
    filtroDepartamentoInput !== filtroDepartamento

  const movimentacoesAgrupadas = useMemo(() => {
    const grupos = new Map<string, EntregaCEU[]>()
    entregas.forEach((e) => {
      const chave = `${e.data_entrega}|${e.colaborador_id}`
      if (!grupos.has(chave)) grupos.set(chave, [])
      grupos.get(chave)!.push(e)
    })
    const lista = Array.from(grupos.values()).map((grupo) => ({
      data: grupo[0].data_entrega,
      colaborador: grupo[0].colaborador,
      colaborador_id: grupo[0].colaborador_id,
      entregas: grupo,
      qtdTotal: grupo.reduce((acc, e) => acc + e.quantidade, 0),
    }))

    lista.sort((a, b) => {
      let comparacao = 0
      switch (ordem.coluna) {
        case 'data':
          comparacao = new Date(a.data).getTime() - new Date(b.data).getTime()
          break
        case 'colaborador':
          comparacao = (a.colaborador?.nome_completo || '').localeCompare(b.colaborador?.nome_completo || '')
          break
        case 'itens': {
          const nomeA = a.entregas[0]?.item?.nome || ''
          const nomeB = b.entregas[0]?.item?.nome || ''
          comparacao = nomeA.localeCompare(nomeB)
          break
        }
        case 'qtdTotal':
          comparacao = a.qtdTotal - b.qtdTotal
          break
      }
      return ordem.direcao === 'asc' ? comparacao : -comparacao
    })

    return lista
  }, [entregas, ordem])

  const handleOrdenar = (coluna: 'data' | 'colaborador' | 'itens' | 'qtdTotal') => {
    setOrdem((atual) => ({
      coluna,
      direcao: atual.coluna === coluna && atual.direcao === 'desc' ? 'asc' : 'desc',
    }))
  }

  const renderSetaOrdenacao = (coluna: 'data' | 'colaborador' | 'itens' | 'qtdTotal') => {
    if (ordem.coluna !== coluna) return <span className="inline-block w-3 h-3 text-slate-300 ml-1">↕</span>
    return <span className="inline-block w-3 h-3 text-[#3B82F6] ml-1">{ordem.direcao === 'desc' ? '↓' : '↑'}</span>
  }

  const handleDevolver = async () => {
    if (selecionadosDevolver.length === 0) return
    for (const id of selecionadosDevolver) {
      await devolver(id, dataDevolucao)
    }
    setDevolverItens(null)
    setSelecionadosDevolver([])
    listar()
  }

  const toggleSelecionadoDevolver = (id: string) => {
    setSelecionadosDevolver((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  const handleRemover = async (id: string) => {
    const entrega = entregas.find((e) => e.id === id)
    await remover(id)
    if (entrega) {
      const colab = entrega.colaborador?.nome_completo || entrega.colaborador_id
      const item = entrega.item?.nome || 'item'
      registrarLogExclusao('Entrega CEU', `Excluída entrega de "${item}" para ${colab}`)
    }
    setRemoverId(null)
    listar()
  }

  const handleEmitirRecibo = async (entregasDoGrupo: EntregaCEU[]) => {
    const grupos = await prepararGruposRecibo(entregasDoGrupo, { proximoNumeroRecibo, registrarEmissaoRecibo })
    setDadosRecibo(grupos.length === 1 ? grupos[0] : grupos)
    setModalRecibo(true)
  }

  const handleEmitirLote = async () => {
    if (!dataInicioLote || !dataFimLote) {
      toast.error('Informe o período')
      return
    }

    setGerandoLote(true)

    // Busca TODAS as entregas do período direto no banco. Não usar o estado
    // `entregas` aqui: a tela lista paginada (50 por página), então filtrar
    // em memória perdia entregas do período ou não encontrava nenhuma.
    const entregasNoPeriodo = await listar({ dataInicio: dataInicioLote, dataFim: dataFimLote })

    if (entregasNoPeriodo.length === 0) {
      toast.error('Nenhuma entrega no período selecionado')
      setGerandoLote(false)
      return
    }

    const { html, total } = await gerarRecibosLoteHTML(entregasNoPeriodo, { proximoNumeroRecibo, registrarEmissaoRecibo })

    if (total === 0) {
      toast.error('Nenhum recibo pôde ser gerado')
      setGerandoLote(false)
      return
    }

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recibos_lote_${dataInicioLote}_${dataFimLote}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    listar()

    toast.success(`${total} recibo(s) gerado(s)`)
    setGerandoLote(false)
    setModalLote(false)
  }

  return (
    <CeuShell>
      <PageHeader title="Movimentações" description="Registro de entregas e devoluções">
        {podeRecibo && (
          <ModuleButton variant="outline" onClick={() => setModalLote(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Emitir recibos em lote
          </ModuleButton>
        )}
        {podeImportar && (
          <ModuleButton variant="outline" onClick={() => navigate('/ceu/importar')}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Planilha
          </ModuleButton>
        )}
        <ModuleButton variant="outline" onClick={() => setMostrarFiltros((v) => !v)}>
          <Filter className="w-4 h-4 mr-2" />
          Filtros
          {totalFiltrosAtivos > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-[#0F6CBD] px-1.5 min-w-5 h-5 text-[11px] font-semibold text-white">
              {totalFiltrosAtivos}
            </span>
          )}
        </ModuleButton>
        {podeRegistrar && (
          <ModuleButton onClick={() => navigate('/ceu/movimentacoes/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Entrega
          </ModuleButton>
        )}
      </PageHeader>

      {mostrarFiltros && (
        <ModuleCard title="Filtros" icon={<Search className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Colaborador ou matrícula..."
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                className="pl-10"
              />
            </div>
            <Input
              type="date"
              value={filtroDataInicioInput}
              onChange={(e) => setFiltroDataInicioInput(e.target.value)}
              placeholder="Data inicial"
            />
            <Input
              type="date"
              value={filtroDataFimInput}
              onChange={(e) => setFiltroDataFimInput(e.target.value)}
              placeholder="Data final"
            />
            <Select value={filtroItemInput} onValueChange={setFiltroItemInput}>
              <SelectTrigger>
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os itens</SelectItem>
                {itens.filter((i) => i.situacao !== 'I').map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DepartamentoAutocomplete
              value={filtroDepartamentoInput}
              onChange={setFiltroDepartamentoInput}
              mode="nome_curto"
              placeholder="Departamento..."
            />
            <Select value={filtroStatusInput} onValueChange={(v) => setFiltroStatusInput(v as typeof filtroStatusInput)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="em_aberto">Em aberto</SelectItem>
                <SelectItem value="devolvido">Devolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <ModuleButton size="sm" onClick={limparFiltros}>
              Limpar
            </ModuleButton>
            <ModuleButton size="sm" onClick={aplicarFiltros}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Aplicar
            </ModuleButton>
            {temRascunhoPendente && (
              <span className="text-xs text-amber-600">Alterações não aplicadas</span>
            )}
            <FiltrosAtivosBadge total={totalFiltrosAtivos} onLimpar={limparFiltros} />
          </div>
        </ModuleCard>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-[12px] text-muted-foreground shadow-sm">
        <span className="font-semibold text-foreground">Legenda:</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange-500" /> EPI</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-green-500" /> Uniforme</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-yellow-500" /> Crachá</span>
        <span className="inline-flex items-center gap-1.5"><span className="line-through">Item (1)</span> ↩ devolvido</span>
      </div>

      <ModuleCard title={`Lista de movimentações (${paginacao?.total ?? movimentacoesAgrupadas.length})`}>
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : (
          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>
                    <button onClick={() => handleOrdenar('data')} className="flex items-center font-medium text-slate-700 hover:text-[#3B82F6]">
                      DATA {renderSetaOrdenacao('data')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleOrdenar('colaborador')} className="flex items-center font-medium text-slate-700 hover:text-[#3B82F6]">
                      COLABORADOR {renderSetaOrdenacao('colaborador')}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleOrdenar('itens')} className="flex items-center font-medium text-slate-700 hover:text-[#3B82F6]">
                      ITENS {renderSetaOrdenacao('itens')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => handleOrdenar('qtdTotal')} className="flex items-center justify-end w-full font-medium text-slate-700 hover:text-[#3B82F6]">
                      QTD TOTAL {renderSetaOrdenacao('qtdTotal')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-40">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesAgrupadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      Nenhuma movimentação encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoesAgrupadas.map((mov) => {
                    const emAberto = mov.entregas.some((e) => !e.data_devolucao)
                    return (
                      <TableRow key={`${mov.data}|${mov.colaborador_id}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatarData(mov.data)}
                          {!emAberto && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Devolvido
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="break-words max-w-[220px]">
                          <div>
                            <p className="font-medium">{mov.colaborador?.nome_completo || '—'}</p>
                            <p className="text-xs text-slate-500">{mov.colaborador?.matricula || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="break-words max-w-[260px]">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {mov.entregas.map((e) => {
                              const nome = e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'
                              const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
                              const devolvido = !!e.data_devolucao
                              return (
                                <span
                                  key={e.id}
                                  className="inline-flex items-center gap-1.5 text-sm"
                                  title={devolvido ? `Devolvido em ${formatarData(e.data_devolucao!)}` : undefined}
                                >
                                  <span className={cn('w-2 h-2 rounded-full', corPorTipo(tipo), devolvido && 'opacity-40')} />
                                  <span className={devolvido ? 'line-through text-slate-400' : undefined}>
                                    {nome} ({e.quantidade})
                                  </span>
                                  {devolvido && (
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                      ↩ {formatarData(e.data_devolucao!)}
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{mov.qtdTotal}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {podeRecibo && (
                              <ModuleButton variant="ghost" size="sm" onClick={() => handleEmitirRecibo(mov.entregas)}>
                                <Receipt className="w-4 h-4 mr-1" /> Recibo
                              </ModuleButton>
                            )}
                            {emAberto && podeDevolver && (
                              <ModuleButton
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDevolverItens(mov.entregas.filter((e) => !e.data_devolucao))
                                  setSelecionadosDevolver([])
                                }}
                                className="h-8 w-8"
                                title="Registrar devolução"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </ModuleButton>
                            )}
                            {podeExcluir && (
                              <ModuleButton
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemoverId(mov.entregas[0].id)}
                                disabled={mov.entregas.some((e) => e.recibo_emitido)}
                                title={mov.entregas.some((e) => e.recibo_emitido) ? 'Exclusão bloqueada: recibo já emitido' : 'Excluir entrega'}
                                className="h-8 w-8 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </ModuleButton>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            {paginacao && paginacao.totalPaginas > 1 && (
              <Paginacao
                pagina={pagina}
                totalPaginas={paginacao.totalPaginas}
                totalRegistros={paginacao.total}
                tamanho={paginacao.tamanho}
                onPaginaAnterior={() => {
                  const nova = pagina - 1
                  setPagina(nova)
                  listarPaginado(buildFiltrosPaginacao(), { pagina: nova, tamanho: 50 })
                }}
                onPaginaProxima={() => {
                  const nova = pagina + 1
                  setPagina(nova)
                  listarPaginado(buildFiltrosPaginacao(), { pagina: nova, tamanho: 50 })
                }}
                carregando={loading}
              />
            )}
          </div>
        )}
      </ModuleCard>

      <CeuDialog
        open={!!devolverItens}
        onOpenChange={(open) => {
          if (!open) {
            setDevolverItens(null)
            setSelecionadosDevolver([])
          }
        }}
        title="Registrar devolução"
        description="Marque os itens devolvidos e informe a data da devolução."
      >
        <div className="bg-white rounded-lg">
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {(devolverItens ?? []).map((e) => {
              const nome = e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'
              const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
              const marcado = selecionadosDevolver.includes(e.id)
              return (
                <label key={e.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggleSelecionadoDevolver(e.id)}
                    className="h-4 w-4 accent-[#0F6CBD]"
                  />
                  <span className={cn('w-2 h-2 rounded-full shrink-0', corPorTipo(tipo))} />
                  <span className="text-sm">
                    {nome} <span className="text-slate-500">({e.quantidade})</span>
                  </span>
                </label>
              )
            })}
          </div>
          <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <ModuleButton
              variant="outline"
              size="sm"
              onClick={() => {
                setDevolverItens(null)
                setSelecionadosDevolver([])
              }}
            >
              Cancelar
            </ModuleButton>
            <ModuleButton size="sm" onClick={handleDevolver} disabled={selecionadosDevolver.length === 0}>
              Confirmar ({selecionadosDevolver.length})
            </ModuleButton>
          </div>
        </div>
      </CeuDialog>

      <CeuDialog open={!!removerId} onOpenChange={(open) => !open && setRemoverId(null)} title="Remover entrega?" description="Esta ação não pode ser desfeita." className="bg-white" footer={
        <>
          <ModuleButton variant="outline" size="sm" onClick={() => setRemoverId(null)}>Cancelar</ModuleButton>
          <ModuleButton variant="danger" size="sm" onClick={() => removerId && handleRemover(removerId)}>Excluir</ModuleButton>
        </>
      } />

      <CeuDialog
        open={modalLote}
        onOpenChange={(open) => !open && setModalLote(false)}
        title="Emitir recibos em lote"
        description="Selecione o período para gerar os recibos agrupados por colaborador."
      >
        <div className="bg-white rounded-lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data início</label>
                <Input type="date" value={dataInicioLote} onChange={(e) => setDataInicioLote(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data fim</label>
                <Input type="date" value={dataFimLote} onChange={(e) => setDataFimLote(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <ModuleButton variant="outline" size="sm" onClick={() => setModalLote(false)}>Cancelar</ModuleButton>
              <ModuleButton size="sm" onClick={handleEmitirLote} disabled={gerandoLote || !dataInicioLote || !dataFimLote}>
                {gerandoLote ? 'Gerando...' : 'Gerar recibos'}
              </ModuleButton>
            </div>
          </div>
        </div>
      </CeuDialog>

      <CeuReciboModal isOpen={modalRecibo} onClose={() => setModalRecibo(false)} dadosEntrega={dadosRecibo} />
    </CeuShell>
  )
}
