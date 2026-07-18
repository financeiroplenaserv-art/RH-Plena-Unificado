import { useEffect, useState } from 'react'
import { Building2, Edit, Plus, Search, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { Button } from '@/components/corh/Button'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'
import { formatarCNPJ } from '@/lib/utils'
import { podeEditarEmpresa, podeExcluirEmpresa } from '@/lib/permissoes'
import type { Empresa } from '@/types/database'

const emptyForm = {
  nome: '',
  cnpj: '',
  codigo_alterdata: '',
}

export function EmpresasPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarEmpresa(perfil) : false
  const podeExcluir = perfil ? podeExcluirEmpresa(perfil) : false

  const { empresas, loading, listar, criar, atualizar, remover } = useEmpresas()
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [removerId, setRemoverId] = useState<string | null>(null)

  useEffect(() => {
    listar()
  }, [listar])

  const empresasFiltradas = empresas.filter((e) => {
    const termo = busca.toLowerCase()
    return (
      e.nome.toLowerCase().includes(termo) ||
      (e.cnpj || '').toLowerCase().includes(termo) ||
      (e.codigo_alterdata || '').toLowerCase().includes(termo)
    )
  })

  const handleNovo = () => {
    setEditandoId(null)
    setForm(emptyForm)
    setMostrarForm(true)
  }

  const handleSubmit = async () => {
    if (!form.nome.trim()) return

    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      codigo_alterdata: form.codigo_alterdata.trim() || null,
    }

    const sucesso = editandoId
      ? await atualizar(editandoId, payload)
      : await criar(payload)

    if (sucesso) {
      setForm(emptyForm)
      setEditandoId(null)
      setMostrarForm(false)
    }
  }

  const handleEditar = (empresa: Empresa) => {
    setEditandoId(empresa.id)
    setForm({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      codigo_alterdata: empresa.codigo_alterdata || '',
    })
    setMostrarForm(true)
  }

  const handleCancelar = () => {
    setForm(emptyForm)
    setEditandoId(null)
    setMostrarForm(false)
  }

  const handleRemover = async (id: string) => {
    await remover(id)
    setRemoverId(null)
  }

  return (
    <div className="min-h-full space-y-5">
      <PageHeader backTo="/" title="Empresas" description="Cadastro global de empresas do sistema">
        {podeEditar && (
          <Button onClick={handleNovo}>
            <Plus className="size-4" />
            Cadastrar
          </Button>
        )}
      </PageHeader>

      <Filters onApply={() => {}} onClear={() => setBusca('')} loading={loading}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </Filters>

      <DataTable title="Lista de empresas" count={empresasFiltradas.length}>
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : empresasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Building2 className="mb-2 size-8 text-muted-foreground/40" />
            Nenhuma empresa encontrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">CNPJ</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-muted-foreground">Código Alterdata</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresasFiltradas.map((empresa) => (
                <TableRow key={empresa.id} className="hover:bg-accent/40">
                  <TableCell className="font-medium">{empresa.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{formatarCNPJ(empresa.cnpj) || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{empresa.codigo_alterdata || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {podeEditar && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-foreground hover:bg-accent"
                          onClick={() => handleEditar(empresa)}
                        >
                          <Edit className="size-4" />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => setRemoverId(empresa.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Dialog open={mostrarForm} onOpenChange={setMostrarForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa. O nome é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome">Razão social / Nome *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo_alterdata">Código Alterdata</Label>
                <Input
                  id="codigo_alterdata"
                  value={form.codigo_alterdata}
                  onChange={(e) => setForm((f) => ({ ...f, codigo_alterdata: e.target.value }))}
                  placeholder="Código no Alterdata"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelar}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!form.nome.trim()} loading={loading}>
              <Edit className="size-4" />
              {editandoId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removerId}
        onOpenChange={() => setRemoverId(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover empresa?"
        description="Esta ação não pode ser desfeita. A empresa será removida permanentemente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => removerId && handleRemover(removerId)}
        destructive
      />
    </div>
  )
}
