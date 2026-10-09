import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSignature, PackageCheck, Pencil, Plus } from 'lucide-react'
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
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { podeEditarCatalogoMateriais, podeEditarRotaMateriais } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { nomeDuplicado } from '@/lib/materiais/cadastro'
import { normalizarTexto } from '@/lib/materiais/normalizar'
import type { MatContrato, RotaMaterial } from '@/types/materiais'

interface FiltroContratos {
  busca: string
  rota: string
  ativo: 'todos' | 'ativos' | 'inativos'
}

const FILTRO_PADRAO: FiltroContratos = { busca: '', rota: 'todas', ativo: 'ativos' }

interface FormContrato {
  id: string | null
  departamento_id: string
  nome: string
  rota: string
  recebe_limpeza: boolean
  ativo: boolean
  observacao: string
}

const FORM_VAZIO: FormContrato = { id: null, departamento_id: '', nome: '', rota: '', recebe_limpeza: true, ativo: true, observacao: '' }

function lerRota(valor: string): RotaMaterial | null {
  return valor === '1' || valor === '2' || valor === '3' ? (Number(valor) as RotaMaterial) : null
}

export function MateriaisContratosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const podeEditar = user ? podeEditarCatalogoMateriais(user.nivel_acesso) : false
  const podeRota = user ? podeEditarRotaMateriais(user.nivel_acesso) : false
  const { contratos, itensNoKit, departamentos, loading, estruturaPendente, carregar, salvar, definirRota } = useMateriaisContratos()

  const [filtro, setFiltro] = useFiltroPersistente<FiltroContratos>('materiais.contratos', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroContratos>(filtro)
  const [form, setForm] = useState<FormContrato | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
  }, [carregar])

  const nomeDep = (id: string) => nomeCurtoDepartamentoFuzzy(departamentos, id) || '—'

  const filtrosAtivos =
    (filtro.busca.trim() ? 1 : 0) + (filtro.rota !== FILTRO_PADRAO.rota ? 1 : 0) + (filtro.ativo !== FILTRO_PADRAO.ativo ? 1 : 0)

  const lista = useMemo(() => {
    const termo = normalizarTexto(filtro.busca)
    return contratos.filter((c) => {
      if (filtro.ativo === 'ativos' && !c.ativo) return false
      if (filtro.ativo === 'inativos' && c.ativo) return false
      if (filtro.rota === 'sem' && c.rota != null) return false
      if (filtro.rota !== 'todas' && filtro.rota !== 'sem' && String(c.rota) !== filtro.rota) return false
      if (!termo) return true
      return (
        normalizarTexto(c.nome).includes(termo) ||
        normalizarTexto(nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id)).includes(termo)
      )
    })
  }, [contratos, filtro, departamentos])

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const abrir = (c?: MatContrato) =>
    setForm(
      c
        ? {
            id: c.id,
            departamento_id: c.departamento_id,
            nome: c.nome,
            rota: c.rota == null ? '' : String(c.rota),
            recebe_limpeza: c.recebe_limpeza,
            ativo: c.ativo,
            observacao: c.observacao ?? '',
          }
        : FORM_VAZIO
    )

  const escolherDepartamento = (id: string) => {
    if (!form) return
    // Nome padrão do contrato = nome_curto do departamento (editável)
    const sugestao = id ? nomeCurtoDepartamentoFuzzy(departamentos, id) : ''
    setForm({ ...form, departamento_id: id, nome: form.nome.trim() ? form.nome : sugestao })
  }

  const duplicado = form ? nomeDuplicado(form.nome, contratos, form.id) : false
  const outrosDoDepartamento = form?.departamento_id
    ? contratos.filter((c) => c.departamento_id === form.departamento_id && c.id !== form.id)
    : []
  const formValido = !!form && !!form.departamento_id && !!form.nome.trim() && !duplicado

  const handleSalvar = async () => {
    if (!form || !formValido) return
    setSalvando(true)
    const ok = await salvar(
      {
        departamento_id: form.departamento_id,
        nome: form.nome.trim(),
        rota: lerRota(form.rota),
        recebe_limpeza: form.recebe_limpeza,
        ativo: form.ativo,
        observacao: form.observacao.trim() || null,
      },
      form.id
    )
    setSalvando(false)
    if (ok) {
      setForm(null)
      carregar()
    }
  }

  const trocarRota = async (c: MatContrato, valor: string) => {
    if (await definirRota(c.id, lerRota(valor))) carregar()
  }

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Contratos de pedido"
        description="Cada contrato tem kit, link e pedido mensal próprios. Um departamento pode ter mais de um contrato."
      >
        {podeEditar && !estruturaPendente && (
          <Button onClick={() => abrir()}>
            <Plus className="size-4" /> Novo contrato
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="ctr-busca">Buscar</Label>
              <Input
                id="ctr-busca"
                value={rascunho.busca}
                onChange={(e) => setRascunho((r) => ({ ...r, busca: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && setFiltro(rascunho)}
                placeholder="Contrato ou departamento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctr-rota">Rota</Label>
              <select id="ctr-rota" className={CLASSE_SELECT} value={rascunho.rota} onChange={(e) => setRascunho((r) => ({ ...r, rota: e.target.value }))}>
                <option value="todas">Todas</option>
                <option value="1">Rota 1</option>
                <option value="2">Rota 2</option>
                <option value="3">Rota 3</option>
                <option value="sem">Sem rota</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctr-ativo">Situação</Label>
              <select
                id="ctr-ativo"
                className={CLASSE_SELECT}
                value={rascunho.ativo}
                onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.value as FiltroContratos['ativo'] }))}
              >
                <option value="ativos">Só ativos</option>
                <option value="inativos">Só inativos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </Filters>

          <DataTable title="Contratos" count={lista.length}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState
                icon={<FileSignature className="size-6" />}
                title="Nenhum contrato encontrado"
                description={contratos.length === 0 ? 'Cadastre o primeiro contrato de pedido.' : 'Ajuste os filtros para ver outros contratos.'}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Limpeza</TableHead>
                    <TableHead className="text-right">Itens no kit</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((c) => (
                    <TableRow key={c.id} className="hover:bg-accent/40">
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>{nomeDep(c.departamento_id)}</TableCell>
                      <TableCell>
                        {podeRota ? (
                          <select
                            className={`${CLASSE_SELECT} h-8 w-28`}
                            value={c.rota == null ? '' : String(c.rota)}
                            onChange={(e) => trocarRota(c, e.target.value)}
                            aria-label={`Rota de ${c.nome}`}
                          >
                            <option value="">Sem rota</option>
                            <option value="1">Rota 1</option>
                            <option value="2">Rota 2</option>
                            <option value="3">Rota 3</option>
                          </select>
                        ) : c.rota ? (
                          `Rota ${c.rota}`
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{c.recebe_limpeza ? 'Sim' : 'Não'}</TableCell>
                      <TableCell className="text-right tabular-nums">{itensNoKit[c.id] ?? 0}</TableCell>
                      <TableCell>
                        <StatusBadge variant={c.ativo ? 'success' : 'neutral'}>{c.ativo ? 'Ativo' : 'Inativo'}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/materiais/kit?contrato=${c.id}`)}
                            aria-label={`Kit Mensal de ${c.nome}`}
                            title="Kit Mensal"
                          >
                            <PackageCheck className="size-4" />
                          </Button>
                          {podeEditar && (
                            <Button variant="ghost" size="icon" onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`} title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
            <DialogTitle>{form?.id ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
            <DialogDescription>O nome aparece para o líder no link de pedido. Por padrão, é o nome do departamento.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Departamento *</Label>
                <DepartamentoAutocomplete
                  value={form.departamento_id}
                  onChange={escolherDepartamento}
                  clearValue=""
                  clearLabel="Nenhum departamento"
                  placeholder="Buscar departamento..."
                />
                {outrosDoDepartamento.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Este departamento já tem {outrosDoDepartamento.length === 1 ? 'o contrato' : 'os contratos'}{' '}
                    {outrosDoDepartamento.map((c) => c.nome).join(', ')}. Tudo bem ter mais de um — use um nome que diferencie.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ctr-nome">Nome do contrato *</Label>
                <Input id="ctr-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                {duplicado && <p className="text-xs text-red-600">Já existe um contrato com esse nome.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctr-form-rota">Rota padrão</Label>
                <select id="ctr-form-rota" className={CLASSE_SELECT} value={form.rota} onChange={(e) => setForm({ ...form, rota: e.target.value })}>
                  <option value="">Sem rota</option>
                  <option value="1">Rota 1</option>
                  <option value="2">Rota 2</option>
                  <option value="3">Rota 3</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.recebe_limpeza} onChange={(e) => setForm({ ...form, recebe_limpeza: e.target.checked })} />
                  Recebe material de limpeza
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                  Contrato ativo
                </label>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ctr-obs">Observação</Label>
                <Textarea id="ctr-obs" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvando} disabled={!formValido}>
              Salvar contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MateriaisShell>
  )
}
