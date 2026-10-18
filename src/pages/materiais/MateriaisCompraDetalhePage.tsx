import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ban, Download, FileSpreadsheet, PackageSearch, Send } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { Selo } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useCompraMaterial } from '@/hooks/useMateriaisCompras'
import { useMateriaisFornecedores } from '@/hooks/useMateriaisFornecedores'
import { podeComprarMateriais, podeVerComprasMateriais } from '@/lib/permissoes'
import { formatarData, formatarDataHora, mascaraMoeda } from '@/lib/utils'
import { montarMatrizCompra, rotuloRota, tituloColuna } from '@/lib/materiais/excelCompra'
import { baixarExcelCompra } from '@/lib/materiais/excelCompraArquivo'
import { ROTULO_STATUS_COMPRA, ROTULO_TIPO_COMPRA } from './comprasRotulos'
import { toast } from 'sonner'

// Detalhe de uma compra (docs/PLANO_MATERIAIS_FASE2.md §4/§6): a mesma matriz
// do Excel — itens × contratos agrupados por rota, total por item e por
// contrato. "Baixar Excel" (sem preço, para o fornecedor) e "Baixar com
// valores" (interno — o financeiro confere a nota). "Marcar como enviada"
// congela a compra; depois dela o pedido não muda (o que surgir é compra avulsa).

const CHAVE_AGRUPAR = 'corh:materiais:compra.agruparPorRota'

// Preferência por usuário/aparelho (localStorage; falha em silêncio). Ligada por padrão.
function useAgruparPorRota(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHAVE_AGRUPAR) !== '0'
    } catch {
      return true
    }
  })
  const definir = (novo: boolean) => {
    setV(novo)
    try {
      localStorage.setItem(CHAVE_AGRUPAR, novo ? '1' : '0')
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }
  return [v, definir]
}

export function MateriaisCompraDetalhePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const nivel = user?.nivel_acesso
  const podeComprar = nivel ? podeComprarMateriais(nivel) : false
  const podeVerValores = nivel ? podeComprar || podeVerComprasMateriais(nivel) : false
  const det = useCompraMaterial()
  const forn = useMateriaisFornecedores()
  const [envio, setEnvio] = useState<{ entrega: string } | null>(null)
  const [cancelamento, setCancelamento] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [agrupar, setAgrupar] = useAgruparPorRota()

  const { carregar } = det
  const { carregar: carregarForn } = forn
  useEffect(() => {
    carregar(id)
  }, [carregar, id])
  useEffect(() => {
    carregarForn()
  }, [carregarForn])

  const c = det.compra
  const m = useMemo(() => montarMatrizCompra(det.itens, agrupar), [det.itens, agrupar])
  const fornecedor = c ? forn.fornecedores.find((f) => f.id === c.fornecedor_id)?.nome ?? 'Fornecedor' : ''
  const gruposRota = useMemo(() => {
    if (!agrupar) return []
    const g: { rotulo: string; n: number }[] = []
    for (const col of m.colunas) {
      const r = rotuloRota(col.rota)
      if (g.length && g[g.length - 1].rotulo === r) g[g.length - 1].n++
      else g.push({ rotulo: r, n: 1 })
    }
    return g
  }, [m.colunas, agrupar])

  if (det.estruturaPendente) {
    return (
      <MateriaisShell>
        <PageHeader title="Compra" backTo="/materiais/compras" />
        <EstruturaPendente />
      </MateriaisShell>
    )
  }
  if (det.loading && !c) {
    return (
      <MateriaisShell>
        <LoadingScreen className="h-64" />
      </MateriaisShell>
    )
  }
  if (!c) {
    return (
      <MateriaisShell>
        <PageHeader title="Compra" backTo="/materiais/compras" />
        <EmptyState icon={<PackageSearch className="size-6" />} title="Compra não encontrada" description="Ela pode não existir ou você não tem acesso." />
      </MateriaisShell>
    )
  }

  const baixar = async (comValores: boolean) => {
    try {
      await baixarExcelCompra(c, det.itens, fornecedor, comValores, agrupar)
    } catch (e) {
      toast.error(`Não foi possível gerar o Excel: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    }
  }

  const enviar = async () => {
    if (!envio) return
    setSalvando(true)
    const ok = await det.enviar(c.id, envio.entrega || null)
    setSalvando(false)
    if (ok) {
      setEnvio(null)
      carregar(id)
    }
  }
  const cancelar = async () => {
    if (cancelamento == null || !cancelamento.trim()) return
    setSalvando(true)
    const ok = await det.cancelar(c.id, cancelamento.trim())
    setSalvando(false)
    if (ok) {
      setCancelamento(null)
      carregar(id)
    }
  }
  const status = ROTULO_STATUS_COMPRA[c.status]
  const podeCancelar = podeComprar && (c.status === 'rascunho' || (c.status === 'enviada' && !det.itens.some((i) => i.qtd_recebida != null)))

  return (
    <MateriaisShell>
      <PageHeader title={`Compra ${c.numero}`} backTo="/materiais/compras" description={`${fornecedor} · ${rotuloCompetencia(c.competencia)}`}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => baixar(false)} disabled={det.itens.length === 0}>
            <Download className="size-4" /> Baixar Excel
          </Button>
          {podeVerValores && (
            <Button variant="outline" onClick={() => baixar(true)} disabled={det.itens.length === 0}>
              <FileSpreadsheet className="size-4" /> Baixar com valores
            </Button>
          )}
          {podeComprar && c.status === 'rascunho' && (
            <Button onClick={() => setEnvio({ entrega: c.entrega_prevista ?? '' })} disabled={det.itens.length === 0}>
              <Send className="size-4" /> Marcar como enviada
            </Button>
          )}
          {podeCancelar && (
            <Button variant="outline" onClick={() => setCancelamento('')}>
              <Ban className="size-4" /> Cancelar
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="space-y-4">
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Situação</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <StatusBadge variant={status.variante}>{status.texto}</StatusBadge>
              {c.antes_da_janela && <Selo tom="ambar">gerada antes do dia da compra</Selo>}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="mt-1">{ROTULO_TIPO_COMPRA[c.tipo]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Enviada</p>
            <p className="mt-1 tabular-nums">{c.enviada_em ? formatarDataHora(c.enviada_em) : '—'}</p>
            {c.entrega_prevista && <p className="text-xs text-muted-foreground tabular-nums">Entrega prevista {formatarData(c.entrega_prevista)}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 font-semibold tabular-nums">{m.totalGeral} un</p>
            {podeVerValores && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {mascaraMoeda(m.valorGeral)}
                {m.itensSemPreco > 0 ? ` · ${m.itensSemPreco} item(ns) sem preço` : ''}
              </p>
            )}
          </div>
          {c.status === 'rascunho' && (
            <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
              Rascunho: confira a matriz, baixe o Excel e envie ao fornecedor (e-mail/WhatsApp). Depois marque como enviada — a partir daí a
              compra e os pedidos não mudam mais; o que surgir vira compra avulsa.
            </p>
          )}
          {c.cancelada_motivo && <p className="text-red-700 sm:col-span-2 lg:col-span-4">Cancelada: {c.cancelada_motivo}</p>}
          {c.observacao && <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">Observação: {c.observacao}</p>}
        </section>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[#0F6CBD]"
            checked={agrupar}
            onChange={(e) => setAgrupar(e.target.checked)}
          />
          Agrupar contratos por rota
          <span className="text-xs text-muted-foreground">(vale para a tela e para o Excel)</span>
        </label>

        <DataTable title={agrupar ? 'Pedido por cliente (itens × contratos, por rota)' : 'Pedido por cliente (itens × contratos)'} count={m.linhas.length} minWidth={Math.max(720, 320 + m.colunas.length * 90)}>
          {m.linhas.length === 0 ? (
            <EmptyState icon={<PackageSearch className="size-6" />} title="Compra sem itens" description="Esta compra não tem células." />
          ) : (
            <Table>
              <TableHeader>
                {agrupar && (
                  <TableRow>
                    <TableHead />
                    {gruposRota.map((g, i) => (
                      <TableHead key={i} colSpan={g.n} className="border-l border-border text-center">
                        {g.rotulo}
                      </TableHead>
                    ))}
                    {m.temEstoque && <TableHead />}
                    <TableHead />
                    {podeVerValores && <TableHead colSpan={2} />}
                  </TableRow>
                )}
                <TableRow>
                  <TableHead>Item</TableHead>
                  {m.colunas.map((col) => (
                    <TableHead key={col.contratoId} className="text-right">
                      {tituloColuna(col, agrupar)}
                    </TableHead>
                  ))}
                  {m.temEstoque && <TableHead className="text-right">Estoque</TableHead>}
                  <TableHead className="text-right">Total</TableHead>
                  {podeVerValores && (
                    <Fragment>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </Fragment>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.linhas.map((l) => (
                  <TableRow key={l.chave} className="hover:bg-accent/40">
                    <TableCell className="font-medium">{l.descricao}</TableCell>
                    {m.colunas.map((col) => (
                      <TableCell key={col.contratoId} className="text-right tabular-nums">
                        {l.porContrato[col.contratoId] ?? ''}
                      </TableCell>
                    ))}
                    {m.temEstoque && <TableCell className="text-right tabular-nums">{l.estoque || ''}</TableCell>}
                    <TableCell className="text-right font-semibold tabular-nums">{l.total}</TableCell>
                    {podeVerValores && (
                      <Fragment>
                        <TableCell className="text-right tabular-nums">{l.preco != null ? mascaraMoeda(l.preco) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.valor != null ? mascaraMoeda(l.valor) : '—'}</TableCell>
                      </Fragment>
                    )}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  {m.colunas.map((col) => (
                    <TableCell key={col.contratoId} className="text-right tabular-nums">
                      {m.totalPorContrato[col.contratoId] ?? 0}
                    </TableCell>
                  ))}
                  {m.temEstoque && <TableCell className="text-right tabular-nums">{m.totalEstoque}</TableCell>}
                  <TableCell className="text-right tabular-nums">{m.totalGeral}</TableCell>
                  {podeVerValores && (
                    <Fragment>
                      <TableCell />
                      <TableCell className="text-right tabular-nums">{mascaraMoeda(m.valorGeral)}</TableCell>
                    </Fragment>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DataTable>
      </div>

      <ConfirmDialog
        open={!!envio}
        onOpenChange={(a) => !a && setEnvio(null)}
        icon={<Send className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Marcar a compra como enviada?"
        description="Confirme que o Excel já foi enviado ao fornecedor. A compra fica congelada (o Excel desta compra será sempre o mesmo) e os pedidos passam para “Em compra”."
        confirmLabel={salvando ? 'Enviando…' : 'Marcar como enviada'}
        confirmDisabled={salvando}
        onConfirm={enviar}
      >
        <div className="space-y-1.5">
          <Label htmlFor="compra-entrega">Entrega prevista (opcional)</Label>
          <Input
            id="compra-entrega"
            type="date"
            className="tabular-nums"
            value={envio?.entrega ?? ''}
            onChange={(e) => setEnvio((v) => (v ? { entrega: e.target.value } : v))}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelamento != null}
        onOpenChange={(a) => !a && setCancelamento(null)}
        icon={<Ban className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Cancelar a compra?"
        description="As linhas desta compra voltam para “sem destino” e reaparecem em Preparar a compra. Só é possível antes de registrar qualquer chegada."
        confirmLabel={salvando ? 'Cancelando…' : 'Cancelar compra'}
        confirmDisabled={salvando || !cancelamento?.trim()}
        onConfirm={cancelar}
      >
        <div className="space-y-1.5">
          <Label htmlFor="compra-cancel">Motivo (obrigatório)</Label>
          <Textarea id="compra-cancel" rows={2} maxLength={300} value={cancelamento ?? ''} onChange={(e) => setCancelamento(e.target.value)} />
        </div>
      </ConfirmDialog>
    </MateriaisShell>
  )
}
