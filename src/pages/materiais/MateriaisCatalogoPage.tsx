import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Pencil, Plus, Tags } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT, ROTULO_CATEGORIA } from '@/components/materiais/estilos'
import { MateriaisShell } from './MateriaisShell'
import { ItemMaterialDetalhe } from './ItemMaterialDetalhe'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import { useMateriaisFornecedores } from '@/hooks/useMateriaisFornecedores'
import { podeEditarCatalogoMateriais } from '@/lib/permissoes'
import { lerNumero, nomeDuplicado } from '@/lib/materiais/cadastro'
import { normalizarTexto } from '@/lib/materiais/normalizar'
import { precoVigente } from '@/lib/materiais/precos'
import { hojeBrasil, mascaraMoeda } from '@/lib/utils'
import type { CategoriaMaterial, MatItem } from '@/types/materiais'

interface FiltroCatalogo {
  busca: string
  categoria: string
  fornecedor: string
  ativo: 'todos' | 'ativos' | 'inativos'
}

const FILTRO_PADRAO: FiltroCatalogo = { busca: '', categoria: 'todas', fornecedor: 'todos', ativo: 'ativos' }

interface FormItem {
  id: string | null
  nome: string
  categoria: CategoriaMaterial
  unidade_pedido: string
  fornecedor_id: string
  validade_meses: string
  tem_variacao: boolean
  ativo: boolean
}

const FORM_VAZIO: FormItem = {
  id: null,
  nome: '',
  categoria: 'limpeza',
  unidade_pedido: '',
  fornecedor_id: '',
  validade_meses: '',
  tem_variacao: false,
  ativo: true,
}

export function MateriaisCatalogoPage() {
  const { user } = useAuth()
  const podeEditar = user ? podeEditarCatalogoMateriais(user.nivel_acesso) : false
  const catalogo = useMateriaisCatalogo()
  const { itens, variacoes, precos, loading, estruturaPendente, carregar, salvarItem } = catalogo
  const { fornecedores, carregar: carregarFornecedores } = useMateriaisFornecedores()

  const [filtro, setFiltro] = useFiltroPersistente<FiltroCatalogo>('materiais.catalogo', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroCatalogo>(filtro)
  const [form, setForm] = useState<FormItem | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const hoje = hojeBrasil()

  useEffect(() => {
    carregar()
    carregarFornecedores()
  }, [carregar, carregarFornecedores])

  const nomeFornecedor = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores])
  const fornecedoresAtivos = useMemo(() => fornecedores.filter((f) => f.ativo !== false), [fornecedores])

  const filtrosAtivos =
    (filtro.busca.trim() ? 1 : 0) +
    (filtro.categoria !== FILTRO_PADRAO.categoria ? 1 : 0) +
    (filtro.fornecedor !== FILTRO_PADRAO.fornecedor ? 1 : 0) +
    (filtro.ativo !== FILTRO_PADRAO.ativo ? 1 : 0)

  const lista = useMemo(() => {
    const termo = normalizarTexto(filtro.busca)
    return itens.filter((i) => {
      if (filtro.ativo === 'ativos' && !i.ativo) return false
      if (filtro.ativo === 'inativos' && i.ativo) return false
      if (filtro.categoria !== 'todas' && i.categoria !== filtro.categoria) return false
      if (filtro.fornecedor === 'sem' && i.fornecedor_id) return false
      if (filtro.fornecedor !== 'todos' && filtro.fornecedor !== 'sem' && i.fornecedor_id !== filtro.fornecedor) return false
      return !termo || normalizarTexto(i.nome).includes(termo)
    })
  }, [itens, filtro])

  const qtdVariacoes = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of variacoes) if (v.ativo) m.set(v.item_id, (m.get(v.item_id) ?? 0) + 1)
    return m
  }, [variacoes])

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const abrir = (i?: MatItem) =>
    setForm(
      i
        ? {
            id: i.id,
            nome: i.nome,
            categoria: i.categoria,
            unidade_pedido: i.unidade_pedido,
            fornecedor_id: i.fornecedor_id ?? '',
            validade_meses: i.validade_meses == null ? '' : String(i.validade_meses),
            tem_variacao: i.tem_variacao,
            ativo: i.ativo,
          }
        : FORM_VAZIO
    )

  const duplicado = form ? nomeDuplicado(form.nome, itens, form.id) : false
  const validade = form ? lerNumero(form.validade_meses) : null
  const validadeInvalida = !!form && form.validade_meses.trim() !== '' && (validade == null || validade <= 0 || !Number.isInteger(validade))
  const formValido = !!form && !!form.nome.trim() && !!form.unidade_pedido.trim() && !duplicado && !validadeInvalida

  const handleSalvar = async () => {
    if (!form || !formValido) return
    setSalvando(true)
    const id = await salvarItem(
      {
        nome: form.nome.trim(),
        categoria: form.categoria,
        unidade_pedido: form.unidade_pedido.trim(),
        fornecedor_id: form.fornecedor_id || null,
        validade_meses: form.validade_meses.trim() ? validade : null,
        tem_variacao: form.tem_variacao,
        ativo: form.ativo,
      },
      form.id
    )
    setSalvando(false)
    if (id) {
      setForm(null)
      carregar()
    }
  }

  const itemDetalhe = itens.find((i) => i.id === detalheId) ?? null

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Catálogo de materiais"
        description="Itens de limpeza, portaria e outros, com variações e histórico de preços"
      >
        {podeEditar && !estruturaPendente && (
          <Button onClick={() => abrir()}>
            <Plus className="size-4" /> Novo item
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <div className="space-y-1.5">
              <Label htmlFor="cat-busca">Buscar</Label>
              <Input
                id="cat-busca"
                value={rascunho.busca}
                onChange={(e) => setRascunho((r) => ({ ...r, busca: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && setFiltro(rascunho)}
                placeholder="Nome do item"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-categoria">Categoria</Label>
              <select
                id="cat-categoria"
                className={CLASSE_SELECT}
                value={rascunho.categoria}
                onChange={(e) => setRascunho((r) => ({ ...r, categoria: e.target.value }))}
              >
                <option value="todas">Todas</option>
                {Object.entries(ROTULO_CATEGORIA).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-fornecedor">Fornecedor</Label>
              <select
                id="cat-fornecedor"
                className={CLASSE_SELECT}
                value={rascunho.fornecedor}
                onChange={(e) => setRascunho((r) => ({ ...r, fornecedor: e.target.value }))}
              >
                <option value="todos">Todos</option>
                <option value="sem">Sem fornecedor</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-ativo">Situação</Label>
              <select
                id="cat-ativo"
                className={CLASSE_SELECT}
                value={rascunho.ativo}
                onChange={(e) => setRascunho((r) => ({ ...r, ativo: e.target.value as FiltroCatalogo['ativo'] }))}
              >
                <option value="ativos">Só ativos</option>
                <option value="inativos">Só inativos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </Filters>

          <DataTable title="Itens do catálogo" count={lista.length}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-6" />}
                title="Nenhum item encontrado"
                description={itens.length === 0 ? 'O catálogo está vazio. Cadastre o primeiro item.' : 'Ajuste os filtros para ver outros itens.'}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Validade</TableHead>
                    <TableHead className="text-right">Preço vigente</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((i) => {
                    const preco = precoVigente(precos, i.id, null, hoje)
                    const nVar = qtdVariacoes.get(i.id) ?? 0
                    return (
                      <TableRow key={i.id} className="hover:bg-accent/40">
                        <TableCell className="font-medium">
                          {i.nome}
                          {nVar > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {nVar} {nVar === 1 ? 'variação' : 'variações'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{ROTULO_CATEGORIA[i.categoria] ?? i.categoria}</TableCell>
                        <TableCell>{i.unidade_pedido}</TableCell>
                        <TableCell>{i.fornecedor_id ? (nomeFornecedor.get(i.fornecedor_id) ?? '—') : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {i.validade_meses ? `${i.validade_meses} ${i.validade_meses === 1 ? 'mês' : 'meses'}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {preco == null ? <span className="text-muted-foreground">sem preço</span> : mascaraMoeda(preco)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={i.ativo ? 'success' : 'neutral'}>{i.ativo ? 'Ativo' : 'Inativo'}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetalheId(i.id)}
                              aria-label={`Variações e preços de ${i.nome}`}
                              title="Variações e preços"
                            >
                              <Tags className="size-4" />
                            </Button>
                            {podeEditar && (
                              <Button variant="ghost" size="icon" onClick={() => abrir(i)} aria-label={`Editar ${i.nome}`} title="Editar">
                                <Pencil className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar item' : 'Novo item'}</DialogTitle>
            <DialogDescription>Use o nome padronizado — é ele que aparece para o líder no pedido.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="item-nome">Nome padronizado *</Label>
                <Input id="item-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Detergente neutro 5L" />
                {duplicado && <p className="text-xs text-red-600">Já existe um item com esse nome.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-categoria">Categoria *</Label>
                <select
                  id="item-categoria"
                  className={CLASSE_SELECT}
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaMaterial })}
                >
                  {Object.entries(ROTULO_CATEGORIA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unidade">Unidade de pedido *</Label>
                <Input
                  id="item-unidade"
                  value={form.unidade_pedido}
                  onChange={(e) => setForm({ ...form, unidade_pedido: e.target.value })}
                  placeholder="Ex.: bombona 5L, pacote, unidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-fornecedor">Fornecedor</Label>
                <select
                  id="item-fornecedor"
                  className={CLASSE_SELECT}
                  value={form.fornecedor_id}
                  onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })}
                >
                  <option value="">Sem fornecedor</option>
                  {fornecedoresAtivos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-validade">Validade (meses)</Label>
                <Input
                  id="item-validade"
                  inputMode="numeric"
                  value={form.validade_meses}
                  onChange={(e) => setForm({ ...form, validade_meses: e.target.value })}
                  placeholder="Ex.: 6 (balde)"
                />
                {validadeInvalida && <p className="text-xs text-red-600">Informe um número inteiro de meses.</p>}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.tem_variacao} onChange={(e) => setForm({ ...form, tem_variacao: e.target.checked })} />
                Tem variações (tamanho, cor…)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Item ativo
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvando} disabled={!formValido}>
              Salvar item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {itemDetalhe && (
      <ItemMaterialDetalhe
        key={itemDetalhe.id}
        item={itemDetalhe}
        onFechar={() => setDetalheId(null)}
        podeEditar={podeEditar}
        catalogo={catalogo}
        fornecedores={fornecedoresAtivos}
      />
      )}
    </MateriaisShell>
  )
}
