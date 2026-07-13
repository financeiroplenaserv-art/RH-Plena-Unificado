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
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { PageHeader } from '@/components/PageHeader'
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
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return
    await removerCategoria(id)
  }

  return (
    <ExtrasShell>
      <PageHeader backTo="/extras/lancamentos" title="Categorias de valor" description="Gerencie os valores padrão para pagamento de extras" />

      <ModuleCard>
        {podeEditar && (
          <div className="flex justify-end mb-4">
            {editando !== 'novo' && (
              <ModuleButton onClick={handleNovo}>
                <Plus className="w-4 h-4 mr-2" />
                Nova categoria
              </ModuleButton>
            )}
          </div>
        )}

        {podeEditar && editando && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="space-y-2 md:col-span-2">
              <Label style={{ color: '#1F2937' }}>Nome</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: ASG 7:20 hs"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Valor padrão (R$)</Label>
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
                className="rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={e => setForm(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Ativa
              </label>
            </div>
            <div className="flex items-end gap-2 md:col-span-4">
              <ModuleButton onClick={handleSalvar}>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </ModuleButton>
              <ModuleButton variant="outline" onClick={handleCancelar}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </ModuleButton>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : categorias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma categoria cadastrada</TableCell>
                </TableRow>
              ) : (
                categorias.map(categoria => (
                  <TableRow key={categoria.id}>
                    <TableCell>{categoria.nome}</TableCell>
                    <TableCell>{mascaraMoeda(categoria.valor_padrao)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        categoria.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {categoria.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {podeEditar && (
                          <ModuleButton variant="outline" size="sm" onClick={() => handleEditar(categoria)}>
                            <Pencil className="w-3 h-3" />
                          </ModuleButton>
                        )}
                        {podeExcluir && (
                          <ModuleButton variant="danger" size="sm" onClick={() => handleExcluir(categoria.id)}>
                            <Trash2 className="w-3 h-3" />
                          </ModuleButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ModuleCard>
    </ExtrasShell>
  )
}
