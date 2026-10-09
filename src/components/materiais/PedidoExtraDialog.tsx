import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/corh/Button'
import { CLASSE_SELECT } from './estilos'
import { SeletorColaborador } from './SeletorColaborador'
import { Selo } from './filas'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { calcularExcecoes } from '@/lib/materiais/excecoes'
import { analisarTamanho, idsEquipeDoContrato, tipoPedidoDoItem } from '@/lib/materiais/filas'
import { MOTIVOS_CRACHA, TAMANHOS_SUGERIDOS } from '@/lib/materiais/pedidoLider'
import { precoVigente } from '@/lib/materiais/precos'
import { carregarApoioCeu } from '@/hooks/useCeuPedidos'
import { criarPedidoExtra, type LinhaCeuExtra, type LinhaProdutoExtra } from '@/hooks/useMateriaisPedidos'
import { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import type { MatKitItem } from '@/types/materiais'

// Pedido extra interno (inspetoria/mesa — docs/PLANO_MATERIAIS_FASE1.md §5.1):
// urgência, ferista (no contrato onde trabalha) e faltista sem posto (no
// contrato ADM PLENA). Aqui o escritório escolhe o colaborador direto do
// cadastro, então as linhas de uniforme/EPI/crachá já nascem identificadas.

type Apoio = Awaited<ReturnType<typeof carregarApoioCeu>>

interface LinhaProduto {
  chave: number
  itemId: string // '' = outro material
  variacaoId: string
  descricao: string
  qtd: string
}

interface LinhaCeu {
  chave: number
  tipo: 'uniforme' | 'epi' | 'cracha'
  colaborador: { id: string; nome: string } | null
  itemId: string
  tamanho: string
  qtd: string
  crachaMotivo: string
  cordao: boolean
}

let seq = 0
const novaLinhaProduto = (): LinhaProduto => ({ chave: ++seq, itemId: '', variacaoId: '', descricao: '', qtd: '1' })
const novaLinhaCeu = (): LinhaCeu => ({ chave: ++seq, tipo: 'uniforme', colaborador: null, itemId: '', tamanho: '', qtd: '1', crachaMotivo: MOTIVOS_CRACHA[0], cordao: false })

interface PedidoExtraDialogProps {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  userId: string
  onCriado: (pedidoId: string) => void
}

export function PedidoExtraDialog({ open, onOpenChange, userId, onCriado }: PedidoExtraDialogProps) {
  const catalogo = useMateriaisCatalogo()
  const [apoio, setApoio] = useState<Apoio | null>(null)
  const [contratoId, setContratoId] = useState('')
  const [kit, setKit] = useState<MatKitItem[]>([])
  const [motivo, setMotivo] = useState('')
  const [produtos, setProdutos] = useState<LinhaProduto[]>([])
  const [ceu, setCeu] = useState<LinhaCeu[]>([])
  const [salvando, setSalvando] = useState(false)

  const { carregar: carregarCatalogo } = catalogo
  useEffect(() => {
    if (!open) return
    carregarCatalogo()
    void carregarApoioCeu().then(setApoio)
  }, [open, carregarCatalogo])

  useEffect(() => {
    if (!contratoId) {
      setKit([])
      return
    }
    void supabase
      .from('mat_kit_itens')
      .select('id, contrato_id, item_id, variacao_id, quantidade, periodicidade_meses, observacao')
      .eq('contrato_id', contratoId)
      .then(({ data }) => setKit(((data as MatKitItem[]) ?? []).map((k) => ({ ...k, quantidade: Number(k.quantidade) }))))
  }, [contratoId])

  const contratos = useMemo(() => (apoio?.contratos ?? []).filter((c) => c.ativo), [apoio])
  const contrato = contratos.find((c) => c.id === contratoId) ?? null
  const equipe = useMemo(
    () => (apoio && contrato ? idsEquipeDoContrato(apoio.departamentos, apoio.colaboradores, contrato.departamento_id) : new Set<string>()),
    [apoio, contrato]
  )
  const tamanhos = useMemo(() => new Map((apoio?.tamanhos ?? []).map((t) => [t.colaborador_id, t])), [apoio])
  const itensAtivos = useMemo(() => catalogo.itens.filter((i) => i.ativo), [catalogo.itens])
  const pecas = apoio?.itens ?? []
  const hoje = hojeBrasil()

  const limpar = () => {
    setContratoId('')
    setMotivo('')
    setProdutos([])
    setCeu([])
  }

  const fechar = (aberto: boolean) => {
    if (!aberto) limpar()
    onOpenChange(aberto)
  }

  const atualizarProduto = (chave: number, patch: Partial<LinhaProduto>) =>
    setProdutos((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))
  const atualizarCeu = (chave: number, patch: Partial<LinhaCeu>) => setCeu((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))

  const enviar = async () => {
    if (!contrato) return toast.error('Escolha o contrato')
    if (!motivo.trim()) return toast.error('Informe o motivo do pedido extra')
    const linhasProdutos: LinhaProdutoExtra[] = []
    for (const [i, l] of produtos.entries()) {
      const qtd = Number(l.qtd.replace(',', '.'))
      if (!Number.isFinite(qtd) || qtd <= 0) return toast.error(`Produto ${i + 1}: informe a quantidade`)
      if (!l.itemId && !l.descricao.trim()) return toast.error(`Produto ${i + 1}: escolha o item ou descreva o material`)
      const item = itensAtivos.find((x) => x.id === l.itemId)
      if (item?.tem_variacao && !l.variacaoId) return toast.error(`Produto ${i + 1}: escolha a variação`)
      const variacaoId = l.variacaoId || null
      const exc = calcularExcecoes({
        linha: { item_id: item?.id ?? null, variacao_id: variacaoId, quantidade: qtd },
        kit,
        validadeMeses: null,
        ultimaEntrega: null,
        hoje,
      })
      linhasProdutos.push({
        item_id: item?.id ?? null,
        variacao_id: variacaoId,
        descricao_livre: item ? null : l.descricao.trim(),
        qtd_kit: item ? exc.qtdKit : null,
        qtd_pedida: qtd,
        preco_unitario: item ? precoVigente(catalogo.precos, item.id, variacaoId, hoje) : null,
        justificativa: exc.exigeJustificativa ? motivo.trim() : null,
        excecao_acima_kit: exc.acimaKit,
        excecao_validade: false,
        excecao_fora_kit: exc.foraKit,
      })
    }
    const linhasCeu: LinhaCeuExtra[] = []
    for (const [i, l] of ceu.entries()) {
      if (!l.colaborador) return toast.error(`Uniforme/EPI/crachá ${i + 1}: escolha o colaborador`)
      const qtd = Number(l.qtd)
      if (!Number.isInteger(qtd) || qtd <= 0) return toast.error(`Uniforme/EPI/crachá ${i + 1}: informe a quantidade`)
      const peca = pecas.find((p) => p.id === l.itemId)
      if (l.tipo !== 'cracha' && !peca) return toast.error(`Uniforme/EPI/crachá ${i + 1}: escolha a peça`)
      const tam = l.tipo === 'cracha' ? null : analisarTamanho(peca?.nome ?? null, l.tamanho || null, tamanhos.get(l.colaborador.id))
      linhasCeu.push({
        tipo: l.tipo,
        colaborador_id: l.colaborador.id,
        nome_digitado: l.colaborador.nome,
        item_id: l.tipo === 'cracha' ? null : l.itemId,
        tamanho: l.tipo === 'cracha' ? null : l.tamanho.trim() || null,
        tamanho_cadastro: tam?.tamanhoCadastro ?? null,
        alerta_tamanho: tam?.diverge ?? false,
        fora_da_equipe: !equipe.has(l.colaborador.id),
        qtd_pedida: qtd,
        cracha_nome: l.tipo === 'cracha' ? l.colaborador.nome : null,
        cracha_motivo: l.tipo === 'cracha' ? l.crachaMotivo : null,
        cracha_cordao: l.tipo === 'cracha' ? l.cordao : null,
      })
    }
    setSalvando(true)
    const id = await criarPedidoExtra({
      contratoId: contrato.id,
      competencia: hoje,
      observacao: motivo.trim(),
      userId,
      produtos: linhasProdutos,
      ceu: linhasCeu,
    })
    setSalvando(false)
    if (id) {
      limpar()
      onCriado(id)
    }
  }

  const candidatos = apoio?.colaboradores ?? []

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pedido extra</DialogTitle>
          <DialogDescription>
            Para urgências, ferista (no contrato onde está trabalhando) e faltista sem posto (contrato ADM PLENA). Produtos fora do
            kit passam pela validação; uniforme, EPI e crachá vão para a conferência do CEU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="extra-contrato">Contrato</Label>
              <select id="extra-contrato" className={CLASSE_SELECT} value={contratoId} onChange={(e) => setContratoId(e.target.value)}>
                <option value="">Escolha…</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {apoio ? ` — ${nomeCurtoDepartamentoFuzzy(apoio.departamentos, c.departamento_id)}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Faltista sem posto: use o contrato ADM PLENA.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-motivo">Motivo do pedido extra</Label>
              <Textarea id="extra-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Produtos</h3>
              <Button variant="outline" size="sm" onClick={() => setProdutos((ls) => [...ls, novaLinhaProduto()])}>
                <Plus className="size-4" /> Produto
              </Button>
            </div>
            {produtos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto.</p>}
            {produtos.map((l, i) => {
              const item = itensAtivos.find((x) => x.id === l.itemId)
              const variacoes = catalogo.variacoes.filter((v) => v.item_id === l.itemId && v.ativo)
              return (
                <div key={l.chave} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_10rem_6rem_auto]">
                  <select
                    aria-label={`Item do produto ${i + 1}`}
                    className={CLASSE_SELECT}
                    value={l.itemId}
                    onChange={(e) => atualizarProduto(l.chave, { itemId: e.target.value, variacaoId: '' })}
                  >
                    <option value="">Outro material (descrever)</option>
                    {itensAtivos.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nome} ({it.unidade_pedido})
                      </option>
                    ))}
                  </select>
                  {item?.tem_variacao ? (
                    <select
                      aria-label={`Variação do produto ${i + 1}`}
                      className={CLASSE_SELECT}
                      value={l.variacaoId}
                      onChange={(e) => atualizarProduto(l.chave, { variacaoId: e.target.value })}
                    >
                      <option value="">Variação…</option>
                      {variacoes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : item ? (
                    <span className="self-center text-xs text-muted-foreground">sem variação</span>
                  ) : (
                    <Input aria-label={`Descrição do produto ${i + 1}`} placeholder="Qual material?" value={l.descricao} onChange={(e) => atualizarProduto(l.chave, { descricao: e.target.value })} />
                  )}
                  <Input
                    aria-label={`Quantidade do produto ${i + 1}`}
                    inputMode="decimal"
                    className="tabular-nums"
                    value={l.qtd}
                    onChange={(e) => atualizarProduto(l.chave, { qtd: e.target.value })}
                  />
                  <Button variant="ghost" size="icon" aria-label={`Remover produto ${i + 1}`} onClick={() => setProdutos((ls) => ls.filter((x) => x.chave !== l.chave))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Uniforme, EPI e crachá</h3>
              <Button variant="outline" size="sm" onClick={() => setCeu((ls) => [...ls, novaLinhaCeu()])}>
                <Plus className="size-4" /> Linha
              </Button>
            </div>
            {ceu.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma linha.</p>}
            {ceu.map((l, i) => {
              const pecasDoTipo = pecas.filter((p) => tipoPedidoDoItem(p.tipo) === l.tipo)
              const peca = pecas.find((p) => p.id === l.itemId)
              const tam = l.colaborador && peca ? analisarTamanho(peca.nome, l.tamanho || null, tamanhos.get(l.colaborador.id)) : null
              return (
                <div key={l.chave} className="space-y-2 rounded-lg border border-border p-2">
                  <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                    <select
                      aria-label={`Tipo da linha ${i + 1}`}
                      className={CLASSE_SELECT}
                      value={l.tipo}
                      onChange={(e) => atualizarCeu(l.chave, { tipo: e.target.value as LinhaCeu['tipo'], itemId: '' })}
                    >
                      <option value="uniforme">Uniforme</option>
                      <option value="epi">EPI</option>
                      <option value="cracha">Crachá</option>
                    </select>
                    {l.colaborador ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{l.colaborador.nome}</span>
                        {contrato && !equipe.has(l.colaborador.id) && <Selo tom="azul">fora da equipe</Selo>}
                        <button type="button" className="text-xs text-primary underline" onClick={() => atualizarCeu(l.chave, { colaborador: null })}>
                          trocar
                        </button>
                      </div>
                    ) : (
                      <SeletorColaborador
                        id={`extra-colab-${l.chave}`}
                        rotulo={`Colaborador da linha ${i + 1}`}
                        candidatos={candidatos}
                        onEscolher={(c) => atualizarCeu(l.chave, { colaborador: c })}
                      />
                    )}
                    <Button variant="ghost" size="icon" aria-label={`Remover linha ${i + 1}`} onClick={() => setCeu((ls) => ls.filter((x) => x.chave !== l.chave))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {l.tipo === 'cracha' ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select aria-label={`Motivo do crachá ${i + 1}`} className={CLASSE_SELECT} value={l.crachaMotivo} onChange={(e) => atualizarCeu(l.chave, { crachaMotivo: e.target.value })}>
                        {MOTIVOS_CRACHA.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={l.cordao} onChange={(e) => atualizarCeu(l.chave, { cordao: e.target.checked })} /> Cordão novo
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-[1fr_7rem_5rem]">
                      <select aria-label={`Peça da linha ${i + 1}`} className={CLASSE_SELECT} value={l.itemId} onChange={(e) => atualizarCeu(l.chave, { itemId: e.target.value })}>
                        <option value="">Peça…</option>
                        {pecasDoTipo.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label={`Tamanho da linha ${i + 1}`}
                        list="extra-tamanhos"
                        placeholder="Tam."
                        value={l.tamanho}
                        onChange={(e) => atualizarCeu(l.chave, { tamanho: e.target.value })}
                      />
                      <Input
                        aria-label={`Quantidade da linha ${i + 1}`}
                        inputMode="numeric"
                        className="tabular-nums"
                        value={l.qtd}
                        onChange={(e) => atualizarCeu(l.chave, { qtd: e.target.value })}
                      />
                    </div>
                  )}
                  {tam?.tamanhoCadastro && (
                    <p className={`text-xs ${tam.diverge ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                      Cadastro: {tam.tamanhoCadastro}
                      {tam.diverge ? ' — diferente do pedido' : ''}
                    </p>
                  )}
                </div>
              )
            })}
            <datalist id="extra-tamanhos">
              {TAMANHOS_SUGERIDOS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => fechar(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={enviar} loading={salvando}>
            Enviar pedido extra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
