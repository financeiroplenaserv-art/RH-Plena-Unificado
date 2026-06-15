import { useEffect, useState } from 'react'
import { Search, Trash2, Edit, Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCEUFornecedores } from '@/hooks/useCEUFornecedores'
import { LoadingScreen } from '@/components/LoadingScreen'
import { CeuPageWrapper } from './CeuPageWrapper'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { CeuDialog } from '@/components/ceu/CeuDialog'
import { registrarLogExclusao } from '@/lib/ceuLogs'

export function CeuFornecedoresPage() {
  const { fornecedores, loading, listar, criar, atualizar, remover } = useCEUFornecedores()
  const [busca, setBusca] = useState('')
  const [removerId, setRemoverId] = useState<string | null>(null)
  const [editando, setEditando] = useState<{
    id: string | null
    nome: string
    cnpj: string
    telefone: string
    email: string
  }>({ id: null, nome: '', cnpj: '', telefone: '', email: '' })

  useEffect(() => {
    listar(busca || undefined)
  }, [busca, listar])

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando.nome.trim()) return

    const payload = {
      nome: editando.nome.trim(),
      cnpj: editando.cnpj.trim() || null,
      telefone: editando.telefone.trim() || null,
      email: editando.email.trim() || null,
    }

    if (editando.id) {
      await atualizar(editando.id, payload)
    } else {
      await criar(payload)
    }
    setEditando({ id: null, nome: '', cnpj: '', telefone: '', email: '' })
    listar(busca || undefined)
  }

  const handleRemover = async (id: string) => {
    const f = fornecedores.find((item) => item.id === id)
    await remover(id)
    if (f) {
      registrarLogExclusao('Fornecedor CEU', `Excluído fornecedor "${f.nome}"`)
    }
    setRemoverId(null)
    listar(busca || undefined)
  }

  return (
    <CeuPageWrapper>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fornecedores CEU</h2>
          <p className="text-sm text-slate-500">Cadastro de fornecedores de itens</p>
        </div>
      </div>

      <CeuCard
        title={editando.id ? 'Editar fornecedor' : 'Novo fornecedor'}
        icon={<Plus className="w-4 h-4" />}
        gradient="blue"
      >
        <form onSubmit={handleSalvar} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <CeuInput
                id="nome"
                value={editando.nome}
                onChange={(e) => setEditando((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Razão social ou nome fantasia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <CeuInput
                id="cnpj"
                value={editando.cnpj}
                onChange={(e) => setEditando((f) => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <CeuInput
                id="telefone"
                value={editando.telefone}
                onChange={(e) => setEditando((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <CeuInput
                id="email"
                type="email"
                value={editando.email}
                onChange={(e) => setEditando((f) => ({ ...f, email: e.target.value }))}
                placeholder="contato@fornecedor.com"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <CeuButton type="submit" disabled={!editando.nome.trim()}>
              {editando.id ? 'Atualizar' : 'Cadastrar'}
            </CeuButton>
            {editando.id && (
              <CeuButton
                variant="outline"
                onClick={() => setEditando({ id: null, nome: '', cnpj: '', telefone: '', email: '' })}
              >
                Cancelar
              </CeuButton>
            )}
          </div>
        </form>
      </CeuCard>

      <CeuCard title={`Lista de fornecedores (${fornecedores.length})`} icon={<Search className="w-4 h-4" />} gradient="blue">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <CeuInput
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <LoadingScreen className="h-64" />
        ) : (
          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      Nenhum fornecedor encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{f.cnpj || '—'}</TableCell>
                      <TableCell>{f.telefone || '—'}</TableCell>
                      <TableCell>{f.email || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <CeuButton
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setEditando({
                                id: f.id,
                                nome: f.nome,
                                cnpj: f.cnpj || '',
                                telefone: f.telefone || '',
                                email: f.email || '',
                              })
                            }
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </CeuButton>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoverId(f.id)}
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
        title="Remover fornecedor?"
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
    </CeuPageWrapper>
  )
}
