import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Pencil, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useAuth } from '@/hooks/useAuth'
import { ExtrasShell } from './ExtrasShell'
import { podeEditarExtra } from '@/lib/permissoes'
import type { StatusExtra, CategoriaOcorrencia } from '@/types/extras'

const CATEGORIAS: CategoriaOcorrencia[] = ['Limpeza', 'Portaria', 'Operacional', 'Zelador', 'Jardinagem', 'Medidas disciplinares', 'Outros']
const STATUS: StatusExtra[] = ['Pendente', 'Pago', 'Cancelado']

function formatarDataBR(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ExtrasLancamentosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarExtra(perfil) : false

  const { extras, loading, listar, listarCategorias, remover } = useExtras()
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()

  const hoje = new Date()
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)

  useEffect(() => {
    listarCategorias()
    listarColaboradores({ status: 'Ativo' })
  }, [listarCategorias, listarColaboradores])

  useEffect(() => {
    listar({
      dataInicio,
      dataFim,
      categoria: categoriaFiltro === 'todas' ? undefined : (categoriaFiltro as CategoriaOcorrencia),
      status: statusFiltro === 'todos' ? undefined : (statusFiltro as StatusExtra),
      colaboradorId: colaboradorFiltro === 'todos' ? undefined : colaboradorFiltro,
    })
  }, [listar, dataInicio, dataFim, categoriaFiltro, statusFiltro, colaboradorFiltro])

  const extrasFiltrados = useMemo(() => {
    let lista = extras
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(e =>
        e.posto.toLowerCase().includes(termo) ||
        (e.colaborador_ausente_nome || '').toLowerCase().includes(termo) ||
        (e.substituto_nome || '').toLowerCase().includes(termo) ||
        e.motivo.toLowerCase().includes(termo)
      )
    }
    return lista
  }, [extras, busca])

  const handleExcluir = async (id: string) => {
    await remover(id)
    setConfirmarExclusao(null)
  }

  const totalPendente = useMemo(() =>
    extrasFiltrados
      .filter(e => e.status === 'Pendente')
      .reduce((acc, e) => acc + (e.valor || 0), 0),
    [extrasFiltrados]
  )

  const limparFiltros = () => {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    setDataInicio(`${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`)
    setDataFim(`${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`)
    setCategoriaFiltro('todas')
    setStatusFiltro('todos')
    setColaboradorFiltro('todos')
    setBusca('')
  }

  return (
    <ExtrasShell>
      <PageHeader
        backTo="/"
        title="Extras"
        description="Controle de faltas, coberturas e pagamentos em cash"
      >
        {podeEditar && (
          <Button onClick={() => navigate('/extras/novo')}>
            <Plus className="size-4" />
            Novo extra
          </Button>
        )}
      </PageHeader>

      <Filters onApply={() => {}} onClear={limparFiltros} loading={loading}>
        <div className="space-y-2">
          <Label>Data início</Label>
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Data fim</Label>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Colaborador</Label>
          <Select value={colaboradorFiltro} onValueChange={setColaboradorFiltro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Posto, colaborador, motivo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </Filters>

      <DataTable title="Resultados" count={extrasFiltrados.length}>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : extrasFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Banknote className="size-6" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] text-muted-foreground">Nenhum registro encontrado.</p>
            {podeEditar && (
              <Button onClick={() => navigate('/extras/novo')}>
                <Plus className="size-4" />
                Novo extra
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Ausente</TableHead>
                <TableHead>Substituto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrasFiltrados.map(extra => (
                <TableRow key={extra.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{formatarDataBR(extra.data_ocorrencia)}</TableCell>
                  <TableCell className="break-words">{extra.departamento_nome || '—'}</TableCell>
                  <TableCell className="break-words">{extra.colaborador_ausente_nome || '—'}</TableCell>
                  <TableCell className="break-words">{extra.substituto_nome || '—'}</TableCell>
                  <TableCell className="break-words">{extra.motivo}</TableCell>
                  <TableCell className="tabular-nums">{formatarMoeda(extra.valor)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        extra.status === 'Pago' ? 'success' :
                        extra.status === 'Cancelado' ? 'danger' : 'warning'
                      }
                    >
                      {extra.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {podeEditar && (
                        <>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-foreground hover:bg-accent"
                            onClick={() => navigate(`/extras/${extra.id}/editar`)}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                            onClick={() => setConfirmarExclusao(extra.id)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && extrasFiltrados.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[13px] text-muted-foreground">Total pendente no período:</span>
            <span className="text-lg font-bold tabular-nums">{formatarMoeda(totalPendente)}</span>
          </div>
        )}
      </DataTable>

      <ConfirmDialog
        open={!!confirmarExclusao}
        onOpenChange={() => setConfirmarExclusao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir extra?"
        description="O registro será removido permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => confirmarExclusao && handleExcluir(confirmarExclusao)}
        destructive
      />
    </ExtrasShell>
  )
}
