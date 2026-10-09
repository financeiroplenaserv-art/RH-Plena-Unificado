import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquarePlus, PackageCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
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
import { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { useMateriaisKit } from '@/hooks/useMateriaisKit'
import { podeEditarKitMateriais, podeSolicitarAlteracaoKit } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { jaNoKit, lerNumero, montarLinhasKit, type LinhaKit } from '@/lib/materiais/cadastro'
import { mediasReferencia } from '@/lib/materiais/media'
import { limiteContrato } from '@/lib/materiais/precos'
import { hojeBrasil, mascaraMoeda } from '@/lib/utils'

type ModoForm = 'editar' | 'solicitar'

interface FormKit {
  modo: ModoForm
  id: string | null
  item_id: string
  variacao_id: string
  quantidade: string
  periodicidade: string
  observacao: string
  retirar: boolean
  motivo: string
}

const FORM_VAZIO: Omit<FormKit, 'modo'> = {
  id: null,
  item_id: '',
  variacao_id: '',
  quantidade: '',
  periodicidade: '1',
  observacao: '',
  retirar: false,
  motivo: '',
}

const formatarQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export function MateriaisKitPage() {
  const { user } = useAuth()
  const podeEditar = user ? podeEditarKitMateriais(user.nivel_acesso) : false
  const podeSolicitar = user ? podeSolicitarAlteracaoKit(user.nivel_acesso) : false
  const [params, setParams] = useSearchParams()
  const contratoId = params.get('contrato') ?? ''

  const contratosHook = useMateriaisContratos()
  const catalogo = useMateriaisCatalogo()
  const kitHook = useMateriaisKit()
  const { kit, consumos, carregar: carregarKit } = kitHook
  const hoje = hojeBrasil()

  const [form, setForm] = useState<FormKit | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [remover, setRemover] = useState<LinhaKit | null>(null)

  const { carregar: carregarContratos } = contratosHook
  const { carregar: carregarCatalogo } = catalogo
  useEffect(() => {
    carregarContratos()
    carregarCatalogo()
  }, [carregarContratos, carregarCatalogo])

  useEffect(() => {
    if (contratoId) carregarKit(contratoId)
  }, [contratoId, carregarKit])

  const estruturaPendente = contratosHook.estruturaPendente || catalogo.estruturaPendente || kitHook.estruturaPendente
  const contratosAtivos = useMemo(
    () => contratosHook.contratos.filter((c) => c.ativo || c.id === contratoId),
    [contratosHook.contratos, contratoId]
  )
  const contrato = contratosHook.contratos.find((c) => c.id === contratoId) ?? null

  const linhas = useMemo(
    () => montarLinhasKit(kit, catalogo.itens, catalogo.variacoes, catalogo.precos, hoje, consumos),
    [kit, catalogo.itens, catalogo.variacoes, catalogo.precos, hoje, consumos]
  )
  const limite = useMemo(() => limiteContrato(kit, catalogo.precos, hoje), [kit, catalogo.precos, hoje])
  const medias = useMemo(() => mediasReferencia(consumos, catalogo.precos, hoje), [consumos, catalogo.precos, hoje])

  const itensAtivos = catalogo.itens.filter((i) => i.ativo || i.id === form?.item_id)
  const variacoesDoItem = form ? catalogo.variacoes.filter((v) => v.item_id === form.item_id && (v.ativo || v.id === form.variacao_id)) : []

  const abrir = (modo: ModoForm, linha?: LinhaKit) =>
    setForm(
      linha
        ? {
            modo,
            id: linha.kit.id,
            item_id: linha.kit.item_id,
            variacao_id: linha.kit.variacao_id ?? '',
            quantidade: String(linha.kit.quantidade).replace('.', ','),
            periodicidade: String(linha.kit.periodicidade_meses ?? 1),
            observacao: linha.kit.observacao ?? '',
            retirar: false,
            motivo: '',
          }
        : { modo, ...FORM_VAZIO }
    )

  const quantidade = form ? lerNumero(form.quantidade) : null
  const periodicidade = form ? lerNumero(form.periodicidade) : null
  const duplicado = !!form && !!form.item_id && jaNoKit(kit, form.item_id, form.variacao_id || null, form.id)
  const qtdInvalida = !!form && !form.retirar && (quantidade == null || quantidade < 0)
  const periodoInvalido = !!form && form.modo === 'editar' && (periodicidade == null || periodicidade < 1 || !Number.isInteger(periodicidade))
  const formValido =
    !!form &&
    !!form.item_id &&
    !qtdInvalida &&
    (form.modo === 'solicitar' ? !!form.motivo.trim() && (form.id ? true : !duplicado) : !duplicado && !periodoInvalido)

  const handleSalvar = async () => {
    if (!form || !formValido || !contratoId) return
    setSalvando(true)
    let ok: boolean
    if (form.modo === 'editar') {
      ok = await kitHook.salvarLinha(
        contratoId,
        {
          item_id: form.item_id,
          variacao_id: form.variacao_id || null,
          quantidade: quantidade as number,
          periodicidade_meses: periodicidade as number,
          observacao: form.observacao.trim() || null,
        },
        form.id
      )
    } else {
      ok = await kitHook.solicitarAlteracao({
        contrato_id: contratoId,
        item_id: form.item_id,
        variacao_id: form.variacao_id || null,
        quantidade_nova: form.retirar ? 0 : (quantidade as number),
        motivo: form.motivo.trim(),
      })
    }
    setSalvando(false)
    if (ok) {
      setForm(null)
      if (form.modo === 'editar') carregarKit(contratoId)
    }
  }

  const confirmarRemocao = async () => {
    if (!remover) return
    if (await kitHook.removerLinha(remover.kit.id)) carregarKit(contratoId)
    setRemover(null)
  }

  const carregando = contratosHook.loading || catalogo.loading || kitHook.loading

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Kit Mensal"
        description="Quantidades que o contrato recebe por mês. O limite em R$ é o kit × preço vigente."
      >
        {contrato && !estruturaPendente && podeEditar && (
          <Button onClick={() => abrir('editar')}>
            <Plus className="size-4" /> Incluir item
          </Button>
        )}
        {contrato && !estruturaPendente && !podeEditar && podeSolicitar && (
          <Button onClick={() => abrir('solicitar')}>
            <MessageSquarePlus className="size-4" /> Solicitar inclusão
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Label htmlFor="kit-contrato">Contrato</Label>
            <select
              id="kit-contrato"
              className={`${CLASSE_SELECT} mt-1.5 sm:max-w-md`}
              value={contratoId}
              onChange={(e) => setParams(e.target.value ? { contrato: e.target.value } : {}, { replace: true })}
            >
              <option value="">Escolha um contrato…</option>
              {contratosAtivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {contrato && (
              <p className="mt-2 text-xs text-muted-foreground">
                Departamento: {nomeCurtoDepartamentoFuzzy(contratosHook.departamentos, contrato.departamento_id) || '—'}
                {contrato.rota ? ` · Rota ${contrato.rota}` : ''}
                {!contrato.recebe_limpeza ? ' · não recebe limpeza' : ''}
              </p>
            )}
          </div>

          {!contrato ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <EmptyState icon={<PackageCheck className="size-6" />} title="Escolha um contrato" description="Selecione acima o contrato para ver e ajustar o Kit Mensal." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Resumo titulo="Limite mensal (kit × preço)" valor={mascaraMoeda(limite.total)} destaque />
                <Resumo titulo="Média dos últimos 6 meses" valor={consumos.length ? mascaraMoeda(medias.media6.valorMedio) : 'sem histórico'} />
                <Resumo titulo="Média de 12 meses (referência)" valor={consumos.length ? mascaraMoeda(medias.media12.valorMedio) : 'sem histórico'} />
              </div>
              {limite.itensSemPreco.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {limite.itensSemPreco.length} {limite.itensSemPreco.length === 1 ? 'item do kit está' : 'itens do kit estão'} sem preço vigente e
                  ficam fora do limite. Cadastre o preço no Catálogo.
                </p>
              )}

              <DataTable title="Itens do kit" count={linhas.length}>
                {carregando ? (
                  <LoadingScreen className="h-48" />
                ) : linhas.length === 0 ? (
                  <EmptyState
                    icon={<PackageCheck className="size-6" />}
                    title="Kit vazio"
                    description={podeEditar ? 'Inclua os itens que este contrato recebe por mês.' : 'Este contrato ainda não tem itens no kit.'}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Variação</TableHead>
                        <TableHead className="text-right">Qtd./mês</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Média 6m</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l) => (
                        <TableRow key={l.kit.id} className="hover:bg-accent/40">
                          <TableCell>
                            <span className="font-medium">{l.itemNome}</span>
                            <span className="block text-xs text-muted-foreground">
                              {l.unidade}
                              {l.kit.periodicidade_meses > 1 ? ` · a cada ${l.kit.periodicidade_meses} meses` : ''}
                              {l.kit.observacao ? ` · ${l.kit.observacao}` : ''}
                            </span>
                          </TableCell>
                          <TableCell>{l.variacaoRotulo ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatarQtd(Number(l.kit.quantidade))}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.precoUnitario == null ? <span className="text-amber-700">sem preço</span> : mascaraMoeda(l.precoUnitario)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{l.subtotal == null ? '—' : mascaraMoeda(l.subtotal)}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.media6 == null ? '—' : formatarQtd(l.media6)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {podeEditar ? (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => abrir('editar', l)} aria-label={`Editar ${l.itemNome}`} title="Editar">
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setRemover(l)} aria-label={`Retirar ${l.itemNome}`} title="Retirar do kit">
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              ) : (
                                podeSolicitar && (
                                  <Button variant="outline" size="sm" onClick={() => abrir('solicitar', l)}>
                                    Solicitar alteração
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
            </>
          )}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form?.modo === 'solicitar' ? 'Solicitar alteração do kit' : form?.id ? 'Editar item do kit' : 'Incluir item no kit'}
            </DialogTitle>
            <DialogDescription>
              {form?.modo === 'solicitar'
                ? 'A mudança só vale depois que o gestor aprovar.'
                : 'A mudança vale a partir do próximo pedido.'}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="kit-item">Item *</Label>
                <select
                  id="kit-item"
                  className={CLASSE_SELECT}
                  value={form.item_id}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, item_id: e.target.value, variacao_id: '' })}
                >
                  <option value="">Escolha o item…</option>
                  {itensAtivos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} ({i.unidade_pedido})
                    </option>
                  ))}
                </select>
              </div>
              {variacoesDoItem.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="kit-variacao">Variação</Label>
                  <select
                    id="kit-variacao"
                    className={CLASSE_SELECT}
                    value={form.variacao_id}
                    disabled={!!form.id}
                    onChange={(e) => setForm({ ...form, variacao_id: e.target.value })}
                  >
                    <option value="">Sem variação específica</option>
                    {variacoesDoItem.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {duplicado && (
                <p className="text-xs text-red-600 sm:col-span-2">Este item (com essa variação) já está no kit — edite a linha existente.</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="kit-qtd">{form.modo === 'solicitar' ? 'Nova quantidade por mês *' : 'Quantidade por mês *'}</Label>
                <Input
                  id="kit-qtd"
                  inputMode="decimal"
                  value={form.retirar ? '0' : form.quantidade}
                  disabled={form.retirar}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                />
                {qtdInvalida && form.quantidade.trim() !== '' && <p className="text-xs text-red-600">Informe uma quantidade válida.</p>}
              </div>
              {form.modo === 'editar' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="kit-periodo">A cada quantos meses</Label>
                  <Input id="kit-periodo" inputMode="numeric" value={form.periodicidade} onChange={(e) => setForm({ ...form, periodicidade: e.target.value })} />
                  {periodoInvalido && <p className="text-xs text-red-600">Use um número inteiro a partir de 1.</p>}
                </div>
              ) : (
                form.id && (
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={form.retirar} onChange={(e) => setForm({ ...form, retirar: e.target.checked })} />
                    Retirar este item do kit
                  </label>
                )
              )}
              {form.modo === 'editar' ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="kit-obs">Observação</Label>
                  <Input id="kit-obs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="kit-motivo">Motivo *</Label>
                  <Textarea
                    id="kit-motivo"
                    rows={3}
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                    placeholder="Ex.: o posto ganhou mais um andar para limpar"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvando} disabled={!formValido}>
              {form?.modo === 'solicitar' ? 'Enviar solicitação' : 'Salvar no kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!remover}
        onOpenChange={(aberto) => !aberto && setRemover(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Retirar item do kit?"
        description={remover ? `${remover.itemNome}${remover.variacaoRotulo ? ` (${remover.variacaoRotulo})` : ''} deixa de fazer parte do Kit Mensal deste contrato.` : ''}
        confirmLabel="Retirar"
        destructive
        onConfirm={confirmarRemocao}
      />
    </MateriaisShell>
  )
}

function Resumo({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 tabular-nums ${destaque ? 'text-xl font-semibold text-primary' : 'text-lg font-medium'}`}>{valor}</p>
    </div>
  )
}
