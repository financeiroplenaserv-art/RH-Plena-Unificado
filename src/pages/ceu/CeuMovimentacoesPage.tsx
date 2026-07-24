import { useEffect, useMemo, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate } from 'react-router-dom'
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
import { Input } from '@/components/ui/input'
import { CeuDialog } from '@/components/ceu/CeuDialog'
import { registrarLogExclusao } from '@/lib/ceuLogs'
import { formatarData } from '@/lib/utils'
import {
  podeRegistrarEntregaCEU,
  podeDevolverCEU,
  podeExcluirEntregaCEU,
  podeEmitirReciboCEU,
  podeImportarCEU,
} from '@/lib/permissoes'
import { CeuReciboModal, type DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { buscarEmpresaPorId } from '@/lib/empresas'
import {
  gerarReciboEPIColorido,
  gerarReciboUniformeColorido,
  type ReciboData,
} from '@/lib/ceuRecibos'
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
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeRegistrar = perfil ? podeRegistrarEntregaCEU(perfil) : false
  const podeDevolver = perfil ? podeDevolverCEU(perfil) : false
  const podeExcluir = perfil ? podeExcluirEntregaCEU(perfil) : false
  const podeRecibo = perfil ? podeEmitirReciboCEU(perfil) : false
  const podeImportar = perfil ? podeImportarCEU(perfil) : false
  const { entregas, loading, paginacao, listar, listarPaginado, devolver, remover, proximoNumeroRecibo, registrarEmissaoRecibo } = useCEUEntregas()
  const { itens, listar: listarItens } = useCEUItens()
  const [busca, setBusca] = useState('')
  const [filtroItem, setFiltroItem] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_aberto' | 'devolvido'>('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [chaveFiltro, setChaveFiltro] = useState(0)
  const [ordem, setOrdem] = useState<{ coluna: 'data' | 'colaborador' | 'itens' | 'qtdTotal'; direcao: 'asc' | 'desc' }>({
    coluna: 'data',
    direcao: 'desc',
  })
  const [removerId, setRemoverId] = useState<string | null>(null)
  const [devolverId, setDevolverId] = useState<string | null>(null)
  const [dataDevolucao, setDataDevolucao] = useState(new Date().toISOString().split('T')[0])
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
  }, [chaveFiltro, filtroItem, filtroStatus, filtroDataInicio, filtroDataFim, listarPaginado])

  const entregasFiltradas = entregas

  const movimentacoesAgrupadas = useMemo(() => {
    const grupos = new Map<string, EntregaCEU[]>()
    entregasFiltradas.forEach((e) => {
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
  }, [entregasFiltradas, ordem])

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

  const aplicarFiltros = () => {
    setPagina(0)
    setChaveFiltro((k) => k + 1)
  }

  const limparFiltros = () => {
    setBusca('')
    setFiltroItem('todos')
    setFiltroStatus('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroDepartamento('todos')
    setPagina(0)
    setChaveFiltro((k) => k + 1)
  }

  const handleDevolver = async (id: string) => {
    await devolver(id, dataDevolucao)
    setDevolverId(null)
    listar()
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
    const entregaBase = entregasDoGrupo[0]
    const colab = entregaBase.colaborador

    const entregasEPI = entregasDoGrupo.filter((e) => {
      const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
      return tipo === 'EPI'
    })
    const entregasNaoEPI = entregasDoGrupo.filter((e) => {
      const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
      return tipo !== 'EPI'
    })

    const grupos: DadosEntrega[] = []
    for (const lista of [entregasEPI, entregasNaoEPI]) {
      if (lista.length === 0) continue

      // Reemissão reutiliza o número gravado; primeira emissão recebe o
      // próximo sequencial e o número fica gravado nas entregas.
      let numero = lista.find((e) => e.numero_recibo)?.numero_recibo || null
      if (!numero) {
        numero = await proximoNumeroRecibo()
        await registrarEmissaoRecibo(lista.map((e) => e.id), numero)
      } else {
        // Garante a marcação de recibo_emitido nas entregas sem número
        // (entregas antigas, anteriores à migration 073).
        const semNumero = lista.filter((e) => !e.numero_recibo).map((e) => e.id)
        if (semNumero.length > 0) await registrarEmissaoRecibo(semNumero, numero)
      }

      grupos.push({
        colaborador: {
          nome: colab?.nome_completo || '—',
          matricula: colab?.matricula || '—',
          cargo: colab?.cargo || '—',
          departamento: colab?.departamento || '—',
          cpf: colab?.cpf || '00000000000',
          data_admissao: colab?.data_admissao,
          empresa_id: colab?.empresa_id,
        },
        itens: lista.map((e) => ({
          nome: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
          grupo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || 'Uniforme',
          subgrupo: e.item?.subgrupo || (e.snapshot_item as { subgrupo?: string })?.subgrupo || '—',
          quantidade: e.quantidade || 1,
          // CA da época da entrega (snapshot) — trocar o CA no cadastro do
          // item não altera recibos já emitidos.
          ca: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || null,
          situacao: e.situacao || 'Novo',
        })),
        dataEntrega: lista[0].data_entrega || new Date().toISOString(),
        numeroRecibo: numero,
      })
    }

    setDadosRecibo(grupos.length === 1 ? grupos[0] : grupos)
    setModalRecibo(true)
  }

  const handleEmitirLote = async () => {
    if (!dataInicioLote || !dataFimLote) {
      toast.error('Informe o período')
      return
    }

    setGerandoLote(true)

    const entregasNoPeriodo = entregas.filter((e) => {
      if (e.data_entrega < dataInicioLote || e.data_entrega > dataFimLote) return false
      return true
    })

    if (entregasNoPeriodo.length === 0) {
      toast.error('Nenhuma entrega no período selecionado')
      setGerandoLote(false)
      return
    }

    const grupos = new Map<string, { colaborador: EntregaCEU['colaborador']; entregas: EntregaCEU[] }>()
    entregasNoPeriodo.forEach((e) => {
      if (!grupos.has(e.colaborador_id)) {
        grupos.set(e.colaborador_id, { colaborador: e.colaborador, entregas: [] })
      }
      grupos.get(e.colaborador_id)!.entregas.push(e)
    })

    const recibosHTML: string[] = []

    for (const { colaborador, entregas } of grupos.values()) {
      if (!colaborador) continue

      const isEPI = entregas.some((e) => {
        const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
        return tipo === 'EPI'
      })

      // Empresa real do colaborador (sem valor fixo no código).
      const empresa = await buscarEmpresaPorId(colaborador.empresa_id)

      // Reutiliza o número já gravado; se não houver, pega o próximo
      // sequencial e grava nas entregas ainda sem número (migration 073).
      let numeroRecibo = entregas.find((e) => e.numero_recibo)?.numero_recibo || null
      if (!numeroRecibo) numeroRecibo = await proximoNumeroRecibo()
      const semNumero = entregas.filter((e) => !e.numero_recibo).map((e) => e.id)
      if (semNumero.length > 0) await registrarEmissaoRecibo(semNumero, numeroRecibo)

      const data: ReciboData = {
        colaborador: {
          nome: colaborador.nome_completo || '—',
          matricula: colaborador.matricula || '—',
          funcao: colaborador.cargo || '—',
          departamento: colaborador.departamento || '—',
          cpf: (colaborador.cpf || '').replace(/\D/g, ''),
          data_admissao: colaborador.data_admissao || null,
        },
        entregas: entregas.map((e) => {
          const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || 'Uniforme'
          return {
            item: {
              descricao: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
              // CA da época da entrega (snapshot) — recibos antigos não
              // mudam quando o CA do item é atualizado no cadastro.
              numero_ca: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || null,
              grupo_macro: tipo,
              subgrupo: e.item?.subgrupo || (e.snapshot_item as { subgrupo?: string })?.subgrupo || '—',
            },
            quantidade: e.quantidade,
            situacao: e.situacao || 'Novo',
          }
        }),
        dataEntrega: entregas[0].data_entrega,
        numeroRecibo,
        nomeEmpresa: empresa.nome,
        cnpjEmpresa: empresa.cnpj,
      }

      const html = isEPI ? gerarReciboEPIColorido(data) : gerarReciboUniformeColorido(data)
      recibosHTML.push(`<div class="recibo-page">${html}</div>`)
    }

    if (recibosHTML.length === 0) {
      toast.error('Nenhum recibo pôde ser gerado')
      setGerandoLote(false)
      return
    }

    const htmlFinal = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibos em lote</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .recibo-page { page-break-after: always; }
    .recibo-page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${recibosHTML.join('')}
</body>
</html>`

    const blob = new Blob([htmlFinal], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recibos_lote_${dataInicioLote}_${dataFimLote}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    listar()

    toast.success(`${recibosHTML.length} recibo(s) gerado(s)`)
    setGerandoLote(false)
    setModalLote(false)
  }

  return (
    <CeuShell>
      <PageHeader backTo="/ceu/movimentacoes" title="Movimentações" description="Registro de entregas e devoluções">
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
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                className="pl-10"
              />
            </div>
            <Input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              placeholder="Data inicial"
            />
            <Input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              placeholder="Data final"
            />
            <Select value={filtroItem} onValueChange={setFiltroItem}>
              <SelectTrigger>
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os itens</SelectItem>
                {itens.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DepartamentoAutocomplete
              value={filtroDepartamento}
              onChange={setFiltroDepartamento}
              mode="nome_curto"
              placeholder="Departamento..."
            />
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
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
          <div className="flex flex-wrap gap-2 mt-4">
            <ModuleButton variant="outline" size="sm" onClick={limparFiltros}>
              Limpar
            </ModuleButton>
            <ModuleButton size="sm" onClick={aplicarFiltros}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Aplicar
            </ModuleButton>
          </div>
        </ModuleCard>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-[12px] text-muted-foreground shadow-sm">
        <span className="font-semibold text-foreground">Legenda:</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange-500" /> EPI</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-green-500" /> Uniforme</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-yellow-500" /> Crachá</span>
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
                        <TableCell className="whitespace-nowrap">{formatarData(mov.data)}</TableCell>
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
                              return (
                                <span key={e.id} className="inline-flex items-center gap-1.5 text-sm">
                                  <span className={cn('w-2 h-2 rounded-full', corPorTipo(tipo))} />
                                  {nome} ({e.quantidade})
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
                              <ModuleButton variant="ghost" size="icon" onClick={() => setDevolverId(mov.entregas.find((e) => !e.data_devolucao)!.id)} className="h-8 w-8" title="Registrar devolução">
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

      <CeuDialog open={!!devolverId} onOpenChange={(open) => !open && setDevolverId(null)} title="Registrar devolução" description="Informe a data de devolução do item.">
        <div className="bg-white rounded-lg">
          <Input type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <ModuleButton variant="outline" size="sm" onClick={() => setDevolverId(null)}>Cancelar</ModuleButton>
            <ModuleButton size="sm" onClick={() => devolverId && handleDevolver(devolverId)}>Confirmar</ModuleButton>
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
