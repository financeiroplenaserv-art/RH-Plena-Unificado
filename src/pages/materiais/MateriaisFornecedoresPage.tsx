import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Truck } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useMateriaisFornecedores } from '@/hooks/useMateriaisFornecedores'
import { podeEditarCatalogoMateriais } from '@/lib/permissoes'
import { nomeDuplicado } from '@/lib/materiais/cadastro'
import { normalizarTexto } from '@/lib/materiais/normalizar'
import { formatarCNPJ, mascaraTelefone } from '@/lib/utils'
import type { Fornecedor } from '@/types/database'

interface FiltroFornecedores {
  busca: string
  ativo: 'todos' | 'ativos' | 'inativos'
}

const FILTRO_PADRAO: FiltroFornecedores = { busca: '', ativo: 'ativos' }

interface FormFornecedor {
  id: string | null
  nome: string
  cnpj: string
  telefone: string
  email: string
  contato: string
  observacao: string
  ativo: boolean
}

const FORM_VAZIO: FormFornecedor = { id: null, nome: '', cnpj: '', telefone: '', email: '', contato: '', observacao: '', ativo: true }

export function MateriaisFornecedoresPage() {
  const { user } = useAuth()
  const podeEditar = user ? podeEditarCatalogoMateriais(user.nivel_acesso) : false
  const { fornecedores, loading, estruturaPendente, carregar, salvar } = useMateriaisFornecedores()

  const [filtro, setFiltro] = useFiltroPersistente<FiltroFornecedores>('materiais.fornecedores', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroFornecedores>(filtro)
  const [form, setForm] = useState<FormFornecedor | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtrosAtivos = (filtro.busca.trim() ? 1 : 0) + (filtro.ativo !== FILTRO_PADRAO.ativo ? 1 : 0)

  const lista = useMemo(() => {
    const termo = normalizarTexto(filtro.busca)
    return fornecedores.filter((f) => {
      const ativo = f.ativo !== false
      if (filtro.ativo === 'ativos' && !ativo) return false
      if (filtro.ativo === 'inativos' && ativo) return false
      if (!termo) return true
      return [f.nome, f.cnpj, f.contato, f.email].some((v) => normalizarTexto(v).includes(termo))
    })
  }, [fornecedores, filtro])

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const abrir = (f?: Fornecedor) =>
    setForm(
      f
        ? {
            id: f.id,
            nome: f.nome,
            cnpj: f.cnpj ?? '',
            telefone: f.telefone ?? '',
            email: f.email ?? '',
            contato: f.contato ?? '',
            observacao: f.observacao ?? '',
            ativo: f.ativo !== false,
          }
        : FORM_VAZIO
    )

  const duplicado = form ? nomeDuplicado(form.nome, fornecedores, form.id) : false

  const handleSalvar = async () => {
    if (!form || !form.nome.trim() || duplicado) return
    setSalvando(true)
    const ok = await salvar(
      {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        contato: form.contato.trim() || null,
        observacao: form.observacao.trim() || null,
        ativo: form.ativo,
      },
      form.id
    )
    setSalvando(false)
    if (ok) {
      setForm(null)
      carregar()
    }
  }

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Fornecedores"
        description="Cadastro único de fornecedores — vale para Materiais e para os itens do CEU"
      >
        {podeEditar && !estruturaPendente && (
          <Button onClick={() => abrir()}>
            <Plus className="size-4" /> Novo fornecedor
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          </div>
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="forn-busca">Buscar</Label>
              <Input
                id="forn-busca"
                value={rascunho.busca}
                onChange={(e) => setRascunho((r) => ({ ...r, busca: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && setFiltro(rascunho)}
                placeholder="Nome, CNPJ, contato ou e-mail"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn-ativo">Situação</Label>
              <select
                id="forn-ativo"
                className={CLASSE_SELECT}
                value={rascunho.ativo}
                onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.value as FiltroFornecedores['ativo'] }))}
              >
                <option value="ativos">Só ativos</option>
                <option value="inativos">Só inativos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </Filters>

          <DataTable title="Fornecedores" count={lista.length}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState
                icon={<Truck className="size-6" />}
                title="Nenhum fornecedor encontrado"
                description={fornecedores.length === 0 ? 'Cadastre o primeiro fornecedor.' : 'Ajuste os filtros para ver outros fornecedores.'}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Situação</TableHead>
                    {podeEditar && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((f) => (
                    <TableRow key={f.id} className="hover:bg-accent/40">
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="tabular-nums">{f.cnpj ? formatarCNPJ(f.cnpj) : '—'}</TableCell>
                      <TableCell>{f.contato || '—'}</TableCell>
                      <TableCell className="tabular-nums">{f.telefone ? mascaraTelefone(f.telefone) : '—'}</TableCell>
                      <TableCell>{f.email || '—'}</TableCell>
                      <TableCell>
                        <StatusBadge variant={f.ativo !== false ? 'success' : 'neutral'}>
                          {f.ativo !== false ? 'Ativo' : 'Inativo'}
                        </StatusBadge>
                      </TableCell>
                      {podeEditar && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => abrir(f)} aria-label={`Editar ${f.nome}`}>
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
            <DialogDescription>Para deixar de usar um fornecedor, marque como inativo.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="forn-nome">Nome *</Label>
                <Input id="forn-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                {duplicado && <p className="text-xs text-red-600">Já existe um fornecedor com esse nome.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-cnpj">CNPJ</Label>
                <Input id="forn-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-contato">Pessoa de contato</Label>
                <Input id="forn-contato" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-tel">Telefone</Label>
                <Input
                  id="forn-tel"
                  value={mascaraTelefone(form.telefone)}
                  onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-email">E-mail</Label>
                <Input id="forn-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="forn-obs">Observação</Label>
                <Textarea id="forn-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Fornecedor ativo
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvando} disabled={!form?.nome.trim() || duplicado}>
              Salvar fornecedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MateriaisShell>
  )
}
