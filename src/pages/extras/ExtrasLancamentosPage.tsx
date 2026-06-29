import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
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
import { ExtrasPageWrapper, ExtrasCard, ExtrasButton } from './ExtrasPageWrapper'
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
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

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
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    await remover(id)
  }

  const totalPendente = useMemo(() =>
    extrasFiltrados
      .filter(e => e.status === 'Pendente')
      .reduce((acc, e) => acc + (e.valor || 0), 0),
    [extrasFiltrados]
  )

  return (
    <ExtrasPageWrapper>
      <PageHeader
        title="Extras"
        description="Controle de faltas, coberturas e pagamentos em cash"
      >
        {podeEditar && (
          <ExtrasButton onClick={() => navigate('/extras/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo extra
          </ExtrasButton>
        )}
      </PageHeader>

      <ExtrasCard title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Categoria</Label>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label style={{ color: '#1F2937' }}>Colaborador</Label>
            <Select value={colaboradorFiltro} onValueChange={setColaboradorFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label style={{ color: '#1F2937' }}>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Posto, colaborador, motivo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="rounded-lg pl-9"
              />
            </div>
          </div>
        </div>
      </ExtrasCard>

      <ExtrasCard title={`Resultados (${extrasFiltrados.length})`}>
        <div className="overflow-x-auto">
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : extrasFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8" style={{ color: '#94A3B8' }}>
                    <div className="flex flex-col items-center gap-3">
                      <span>Nenhum registro encontrado</span>
                      {podeEditar && (
                        <ExtrasButton size="sm" onClick={() => navigate('/extras/novo')}>
                          <Plus className="w-4 h-4 mr-2" />
                          Novo extra
                        </ExtrasButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                extrasFiltrados.map(extra => (
                  <TableRow key={extra.id}>
                    <TableCell>{formatarDataBR(extra.data_ocorrencia)}</TableCell>
                    <TableCell className="break-words">{extra.departamento_nome || '—'}</TableCell>
                    <TableCell className="break-words">{extra.colaborador_ausente_nome || '—'}</TableCell>
                    <TableCell className="break-words">{extra.substituto_nome || '—'}</TableCell>
                    <TableCell className="break-words">{extra.motivo}</TableCell>
                    <TableCell>{formatarMoeda(extra.valor)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        extra.status === 'Pago' ? 'bg-green-100 text-green-800' :
                        extra.status === 'Cancelado' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {extra.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {podeEditar && (
                          <>
                            <ExtrasButton variant="outline" size="sm" onClick={() => navigate(`/extras/${extra.id}/editar`)}>
                              <Pencil className="w-3 h-3" />
                            </ExtrasButton>
                            <ExtrasButton variant="danger" size="sm" onClick={() => handleExcluir(extra.id)}>
                              <Trash2 className="w-3 h-3" />
                            </ExtrasButton>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: '#F1F5F9' }}>
          <span className="text-sm" style={{ color: '#64748B' }}>Total pendente no período:</span>
          <span className="text-lg font-bold" style={{ color: '#1F2937' }}>{formatarMoeda(totalPendente)}</span>
        </div>
      </ExtrasCard>
    </ExtrasPageWrapper>
  )
}
