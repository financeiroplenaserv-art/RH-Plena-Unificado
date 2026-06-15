import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, RotateCcw, Package, Receipt, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { LoadingScreen } from '@/components/LoadingScreen'
import { CeuPage } from '@/components/ceu/CeuPage'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { CeuDialog } from '@/components/ceu/CeuDialog'
import { registrarLogExclusao } from '@/lib/ceuLogs'
import { formatarData } from '@/lib/utils'
import { CeuReciboModal, type DadosEntrega } from '@/components/ceu/CeuReciboModal'
import {
  gerarReciboEPIColorido,
  gerarReciboUniformeColorido,
  gerarNumeroRecibo,
  type ReciboData,
} from '@/lib/ceuRecibos'
import type { EntregaCEU } from '@/types/database'
import { toast } from 'sonner'

export function CeuEntregasPage() {
  const navigate = useNavigate()
  const { entregas, loading, listar, devolver, remover, marcarReciboEmitido, marcarLoteReciboEmitido } = useCEUEntregas()
  const { itens, listar: listarItens } = useCEUItens()
  const [busca, setBusca] = useState('')
  const [filtroItem, setFiltroItem] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_aberto' | 'devolvido'>('todos')
  const [removerId, setRemoverId] = useState<string | null>(null)
  const [devolverId, setDevolverId] = useState<string | null>(null)
  const [dataDevolucao, setDataDevolucao] = useState(new Date().toISOString().split('T')[0])
  const [modalRecibo, setModalRecibo] = useState(false)
  const [dadosRecibo, setDadosRecibo] = useState<DadosEntrega | null>(null)

  const [modalLote, setModalLote] = useState(false)
  const [dataInicioLote, setDataInicioLote] = useState('')
  const [dataFimLote, setDataFimLote] = useState('')
  const [gerandoLote, setGerandoLote] = useState(false)

  useEffect(() => {
    listarItens()
  }, [listarItens])

  useEffect(() => {
    listar({
      itemId: filtroItem !== 'todos' ? filtroItem : undefined,
      emAberto: filtroStatus === 'em_aberto' ? true : undefined,
    })
  }, [filtroItem, filtroStatus, listar])

  useEffect(() => {
    // Carrega empresas e colaboradores no início
  }, [])

  const entregasFiltradas = entregas.filter((e) => {
    const termo = busca.toLowerCase()
    const colab = (e as unknown as { colaborador?: { nome_completo: string; matricula: string } }).colaborador
    const matchBusca =
      !termo ||
      colab?.nome_completo?.toLowerCase().includes(termo) ||
      colab?.matricula?.toLowerCase().includes(termo)
    const matchDevolvido =
      filtroStatus === 'devolvido'
        ? !!e.data_devolucao
        : filtroStatus === 'em_aberto'
          ? !e.data_devolucao
          : true
    return matchBusca && matchDevolvido
  })

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

    const nomeEmpresa = 'PLENA EA SERVICOS COMERCIAIS LTDA'
    const cnpjEmpresa = '00.378.476/0001-60'

    const recibosHTML: string[] = []
    const idsProcessados: string[] = []

    grupos.forEach(({ colaborador, entregas }) => {
      if (!colaborador) return

      const isEPI = entregas.some((e) => {
        const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
        return tipo === 'EPI'
      })

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
              numero_ca: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || null,
              grupo_macro: tipo,
              subgrupo: e.item?.subgrupo || (e.snapshot_item as { subgrupo?: string })?.subgrupo || '—',
            },
            quantidade: e.quantidade,
            situacao: 'Novo',
          }
        }),
        dataEntrega: entregas[0].data_entrega,
        numeroRecibo: gerarNumeroRecibo(),
        nomeEmpresa,
        cnpjEmpresa,
      }

      const html = isEPI ? gerarReciboEPIColorido(data) : gerarReciboUniformeColorido(data)
      recibosHTML.push(`<div class="recibo-page">${html}</div>`)
      idsProcessados.push(...entregas.map((e) => e.id))
    })

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

    await marcarLoteReciboEmitido(idsProcessados)
    listar()

    toast.success(`${recibosHTML.length} recibo(s) gerado(s)`)
    setGerandoLote(false)
    setModalLote(false)
  }

  return (
    <CeuPage>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Entregas CEU</h2>
          <p className="text-sm text-slate-500">Registro de entregas e devoluções</p>
        </div>
        <div className="flex items-center gap-2">
          <CeuButton variant="outline" onClick={() => setModalLote(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Emitir recibos em lote
          </CeuButton>
          <CeuButton onClick={() => navigate('/ceu/entregas/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova entrega
          </CeuButton>
        </div>
      </div>

      <CeuCard title="Filtros" icon={<Search className="w-4 h-4" />} gradient="blue">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <CeuInput
              placeholder="Colaborador ou matrícula..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filtroItem} onValueChange={setFiltroItem}>
            <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os itens</SelectItem>
              {itens.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
            <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="em_aberto">Em aberto</SelectItem>
              <SelectItem value="devolvido">Devolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CeuCard>

      <CeuCard title={`Lista de entregas (${entregasFiltradas.length})`} gradient="blue">
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : (
          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Recibo</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      Nenhuma entrega encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  entregasFiltradas.map((e) => {
                    const colab = e.colaborador
                    const item = e.item
                    const emAberto = !e.data_devolucao
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{colab?.nome_completo || '—'}</p>
                            <p className="text-xs text-slate-500">{colab?.matricula || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{item?.nome || '—'}</p>
                            <p className="text-xs text-slate-500">{item?.tipo || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{e.quantidade}</TableCell>
                        <TableCell>{formatarData(e.data_entrega)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            emAberto ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'
                          }`}>
                            {emAberto ? 'Em aberto' : 'Devolvido'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const colab = e.colaborador
                            setDadosRecibo({
                              colaborador: {
                                nome: colab?.nome_completo || '—',
                                matricula: colab?.matricula || '—',
                                cargo: colab?.cargo || '—',
                                departamento: colab?.departamento || '—',
                                cpf: colab?.cpf || '00000000000',
                              },
                              itens: [{
                                nome: e.item?.nome || '—',
                                grupo: e.item?.tipo || 'Uniforme',
                                subgrupo: e.item?.subgrupo || '—',
                                quantidade: e.quantidade || 1,
                              }],
                              dataEntrega: e.data_entrega || new Date().toISOString(),
                            })
                            marcarReciboEmitido(e.id)
                            setModalRecibo(true)
                          }}>
                            <Receipt className="w-4 h-4 mr-1" /> {e.recibo_emitido ? 'Reemitir' : 'Emitir'}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {emAberto && (
                              <CeuButton variant="ghost" size="icon" onClick={() => setDevolverId(e.id)} className="h-8 w-8" title="Registrar devolução">
                                <RotateCcw className="w-4 h-4" />
                              </CeuButton>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemoverId(e.id)}
                              disabled={e.recibo_emitido}
                              title={e.recibo_emitido ? 'Exclusão bloqueada: recibo já emitido' : 'Excluir entrega'}
                              className="h-8 w-8 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CeuCard>

      <CeuDialog open={!!devolverId} onOpenChange={(open) => !open && setDevolverId(null)} title="Registrar devolução" description="Informe a data de devolução do item.">
        <div className="bg-white rounded-lg">
          <CeuInput type="date" value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
          <CeuButton variant="outline" size="sm" onClick={() => setDevolverId(null)}>Cancelar</CeuButton>
          <CeuButton size="sm" onClick={() => devolverId && handleDevolver(devolverId)}>Confirmar</CeuButton>
          </div>
        </div>
      </CeuDialog>

      <CeuDialog open={!!removerId} onOpenChange={(open) => !open && setRemoverId(null)} title="Remover entrega?" description="Esta ação não pode ser desfeita." className="bg-white" footer={
        <>
          <CeuButton variant="outline" size="sm" onClick={() => setRemoverId(null)}>Cancelar</CeuButton>
          <Button variant="destructive" size="sm" onClick={() => removerId && handleRemover(removerId)}>Excluir</Button>
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
              <CeuInput type="date" value={dataInicioLote} onChange={(e) => setDataInicioLote(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Data fim</label>
              <CeuInput type="date" value={dataFimLote} onChange={(e) => setDataFimLote(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <CeuButton variant="outline" size="sm" onClick={() => setModalLote(false)}>Cancelar</CeuButton>
            <CeuButton size="sm" onClick={handleEmitirLote} disabled={gerandoLote || !dataInicioLote || !dataFimLote}>
              {gerandoLote ? 'Gerando...' : 'Gerar recibos'}
            </CeuButton>
          </div>
        </div>
        </div>
      </CeuDialog>

      <CeuReciboModal isOpen={modalRecibo} onClose={() => setModalRecibo(false)} dadosEntrega={dadosRecibo} />
    </CeuPage>
  )
}
