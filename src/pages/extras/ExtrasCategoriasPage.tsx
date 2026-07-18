import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
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
import { toast } from 'sonner'
import { useExtras } from '@/hooks/useExtras'
import { useAuth } from '@/hooks/useAuth'
import { ExtrasShell } from './ExtrasShell'
import { ModuleCard } from '@/components/layout/ModuleShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { mascaraMoeda, parseMoeda, mascaraMoedaInput } from '@/lib/utils'
import { podeEditarCategoriaExtra, podeExcluirCategoriaExtra } from '@/lib/permissoes'
import type { CategoriaExtra } from '@/types/extras'

interface FormCategoria {
  nome: string
  valor_padrao: number
  ativo: boolean
}

const categoriaVazia = (): FormCategoria => ({
  nome: '',
  valor_padrao: 0,
  ativo: true,
})

export function ExtrasCategoriasPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarCategoriaExtra(perfil) : false
  const podeExcluir = perfil ? podeExcluirCategoriaExtra(perfil) : false

  const { categorias, loading, listarCategorias, criarCategoria, atualizarCategoria, removerCategoria } = useExtras()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<FormCategoria>(categoriaVazia())
  const [valorInput, setValorInput] = useState(mascaraMoedaInput(String(form.valor_padrao)))
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)

  useEffect(() => {
    listarCategorias()
  }, [listarCategorias])

  useEffect(() => {
    setValorInput(mascaraMoedaInput(String(form.valor_padrao)))
  }, [form.valor_padrao])

  const handleEditar = (categoria: CategoriaExtra) => {
    setEditando(categoria.id)
    setForm({
      nome: categoria.nome,
      valor_padrao: categoria.valor_padrao,
      ativo: categoria.ativo,
    })
  }

  const handleNovo = () => {
    setEditando('novo')
    setForm(categoriaVazia())
  }

  const handleCancelar = () => {
    setEditando(null)
    setForm(categoriaVazia())
  }

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da categoria')
      return
    }

    const payload = {
      nome: form.nome.trim(),
      valor_padrao: form.valor_padrao,
      ativo: form.ativo,
    }

    const sucesso = editando === 'novo'
      ? await criarCategoria(payload)
      : await atualizarCategoria(editando!, payload)

    if (sucesso) {
      setEditando(null)
      setForm(categoriaVazia())
    }
  }

  const handleExcluir = async (id: string) => {
    await removerCategoria(id)
    setConfirmarExclusao(null)
  }

  return (
    <ExtrasShell>
      <PageHeader backTo="/extras/lancamentos" title="Categorias de valor" description="Gerencie os valores padrão para pagamento de extras">
        {podeEditar && editando !== 'novo' && (
          <Button onClick={handleNovo}>
            <Plus className="size-4" />
            Nova categoria
          </Button>
        )}
      </PageHeader>

      {podeEditar && editando && (
        <ModuleCard title={editando === 'novo' ? 'Nova categoria' : 'Editar categoria'}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: ASG 7:20 hs"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor padrão (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valorInput}
                onChange={e => {
                  const formatado = mascaraMoedaInput(e.target.value)
                  setValorInput(formatado)
                  setForm(prev => ({ ...prev, valor_padrao: parseMoeda(formatado) }))
                }}
                onBlur={() => setValorInput(mascaraMoedaInput(valorInput))}
                placeholder="R$ 0,00"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={e => setForm(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-input"
                />
                Ativa
              </label>
            </div>
            <div className="flex items-end gap-2 md:col-span-4">
              <Button onClick={handleSalvar}>
                <Save className="size-4" />
                Salvar
              </Button>
              <Button variant="ghost" onClick={handleCancelar}>
                <X className="size-4" />
                Cancelar
              </Button>
            </div>
          </div>
        </ModuleCard>
      )}

      <DataTable title="Categorias cadastradas" count={categorias.length}>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : categorias.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor padrão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map(categoria => (
                <TableRow key={categoria.id}>
                  <TableCell className="font-medium">{categoria.nome}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{mascaraMoeda(categoria.valor_padrao)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={categoria.ativo ? 'success' : 'neutral'}>
                      {categoria.ativo ? 'Ativa' : 'Inativa'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {podeEditar && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-foreground hover:bg-accent"
                          onClick={() => handleEditar(categoria)}
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => setConfirmarExclusao(categoria.id)}
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

      <ConfirmDialog
        open={!!confirmarExclusao}
        onOpenChange={() => setConfirmarExclusao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir categoria?"
        description="A categoria será removida permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => confirmarExclusao && handleExcluir(confirmarExclusao)}
        destructive
      />
    </ExtrasShell>
  )
}
