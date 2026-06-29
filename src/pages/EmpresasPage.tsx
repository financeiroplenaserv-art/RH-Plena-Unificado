import { useEffect, useState } from 'react'
import { Building2, Edit, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { toast } from 'sonner'
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!form.nome.trim()) return

    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      codigo_alterdata: form.codigo_alterdata.trim() || null,
    }

    try {
      if (editandoId) {
        await atualizar(editandoId, payload)
      } else {
        await criar(payload)
      }
      setForm(emptyForm)
      setEditandoId(null)
    } catch (err) {
      console.error('Erro ao salvar empresa:', err)
      toast.error('Erro ao salvar empresa. Tente novamente.')
    }
  }

  const handleEditar = (empresa: Empresa) => {
    setEditandoId(empresa.id)
    setForm({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      codigo_alterdata: empresa.codigo_alterdata || '',
    })
  }

  const handleCancelar = () => {
    setForm(emptyForm)
    setEditandoId(null)
  }

  const handleRemover = async (id: string) => {
    await remover(id)
    setRemoverId(null)
  }

  return (
    <div className="min-h-full bg-[#F8FAFC] space-y-6">
      <PageHeader title="Empresas" description="Cadastro global de empresas do sistema" />

      {podeEditar && (
      <Card className="border-none shadow-sm rounded-[12px]">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#1F2937]">
            {editandoId ? 'Editar empresa' : 'Nova empresa'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Razão social / Nome *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                  className="rounded-lg border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                  className="rounded-lg border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo_alterdata">Código Alterdata</Label>
                <Input
                  id="codigo_alterdata"
                  value={form.codigo_alterdata}
                  onChange={(e) => setForm((f) => ({ ...f, codigo_alterdata: e.target.value }))}
                  placeholder="Código no Alterdata"
                  className="rounded-lg border-slate-300"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={!form.nome.trim()}
                onClick={handleSubmit}
                className="bg-[#1F2937] hover:bg-[#111827]"
              >
                {editandoId ? (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Atualizar
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar
                  </>
                )}
              </Button>
              {editandoId && (
                <Button type="button" variant="outline" onClick={handleCancelar}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="border-none shadow-sm rounded-[12px]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold text-[#1F2937]">
              Lista de empresas ({empresasFiltradas.length})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nome, CNPJ ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 rounded-lg border-slate-300"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingScreen className="h-64" />
          ) : (
            <div className="border rounded-lg overflow-hidden border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Código Alterdata</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        Nenhuma empresa encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    empresasFiltradas.map((empresa) => (
                      <TableRow key={empresa.id}>
                        <TableCell className="font-medium text-[#1F2937]">{empresa.nome}</TableCell>
                        <TableCell>{formatarCNPJ(empresa.cnpj) || '—'}</TableCell>
                        <TableCell>{empresa.codigo_alterdata || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {podeEditar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditar(empresa)}
                                className="h-8 w-8 text-slate-500 hover:text-[#1F2937]"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {podeExcluir && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemoverId(empresa.id)}
                                className="h-8 w-8 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!removerId} onOpenChange={(open) => !open && setRemoverId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover empresa?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A empresa será removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoverId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => removerId && handleRemover(removerId)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
