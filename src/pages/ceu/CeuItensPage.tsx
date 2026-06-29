import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit, Package, Hash } from 'lucide-react'
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
import { CeuPage } from '@/components/ceu/CeuPage'
import { PageHeader } from '@/components/PageHeader'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import { CeuDialog } from '@/components/ceu/CeuDialog'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { LoadingScreen } from '@/components/LoadingScreen'
import { registrarLogExclusao } from '@/lib/ceuLogs'

const TIPOS = ['Crachá', 'Uniforme', 'EPI']

function badgeType(tipo: string) {
  switch (tipo) {
    case 'EPI':
    case 'Equipamento':
      return 'epi'
    case 'Uniforme':
      return 'uniforme'
    case 'Crachá':
      return 'cracha'
    default:
      return 'outros'
  }
}

function formatarValorCentavos(valor?: number | null): string {
  if (valor == null) return '—'
  return (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CeuItensPage() {
  const navigate = useNavigate()
  const { itens, loading, listar, remover } = useCEUItens()
  const { fornecedores, listar: listarFornecedores } = useCEUFornecedores()
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroFornecedor, setFiltroFornecedor] = useState('todos')
  const [removerId, setRemoverId] = useState<string | null>(null)

  useEffect(() => {
    listarFornecedores()
  }, [listarFornecedores])

  useEffect(() => {
    listar({
      busca: busca || undefined,
      tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
      fornecedorId: filtroFornecedor !== 'todos' ? filtroFornecedor : undefined,
    })
  }, [busca, filtroTipo, filtroFornecedor, listar])

  const handleRemover = async (id: string) => {
    const item = itens.find((i) => i.id === id)
    await remover(id)
    if (item) {
      registrarLogExclusao('Item CEU', `Excluído item "${item.nome}" (${item.tipo})`)
    }
    setRemoverId(null)
    listar()
  }

  return (
    <CeuPage>
      <PageHeader backTo="/ceu/dashboard" title="Itens CEU" description="Crachás, uniformes, equipamentos e EPIs">
        <CeuButton onClick={() => navigate('/ceu/itens/novo')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo item
        </CeuButton>
      </PageHeader>

      <CeuCard title="Filtros" icon={<Search className="w-4 h-4" />} gradient="blue">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <CeuInput
              placeholder="Nome, código ou CA..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
            <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CeuCard>

      <CeuCard title={`Lista de itens (${itens.length})`} gradient="blue">
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : (
          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      Nenhum item encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>
                        {item.codigo ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
                            <Hash className="w-3 h-3" />
                            {item.codigo}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                      </TableCell>
                      <TableCell>{item.ca || '—'}</TableCell>
                      <TableCell>
                        {item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell>{formatarValorCentavos(item.valor)}</TableCell>
                      <TableCell>{item.fornecedor?.nome || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <CeuButton
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/ceu/itens/${item.id}/editar`)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </CeuButton>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoverId(item.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CeuCard>

      <CeuDialog
        open={!!removerId}
        onOpenChange={(open) => !open && setRemoverId(null)}
        title="Remover item?"
        description="Esta ação não pode ser desfeita."
        footer={
          <>
            <CeuButton variant="outline" size="sm" onClick={() => setRemoverId(null)}>
              Cancelar
            </CeuButton>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removerId && handleRemover(removerId)}
            >
              Excluir
            </Button>
          </>
        }
      />
    </CeuPage>
  )
}
