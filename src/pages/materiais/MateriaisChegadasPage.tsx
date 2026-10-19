import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, CheckCheck, PackageCheck, PackageSearch, Save } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { SeletorMes, Selo, StatusProdutosBadge } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useChegadasMateriais } from '@/hooks/useMateriaisCompras'
import { useMateriaisFornecedores } from '@/hooks/useMateriaisFornecedores'
import { podeRegistrarChegadaMateriais } from '@/lib/permissoes'
import { formatarData, hojeBrasil } from '@/lib/utils'
import { competenciaDoMes } from '@/lib/materiais/painel'
import { descricaoItemCompra } from '@/lib/materiais/compra'
import { quantidadeComUnidade } from '@/lib/materiais/unidades'
import {
  agruparCelulasPorContrato,
  celulaPendente,
  descricaoRemanejamento,
  edicaoInicialCelula,
  edicaoInicialRemanejamento,
  erroChegada,
  erroRemanejamento,
  montarPayloadChegada,
  montarPayloadRemanejamento,
  type EdicaoChegada,
  type RemanejamentoChegada,
} from '@/lib/materiais/chegadas'
import type { MatCompraItem, StatusProdutos } from '@/types/materiais'
import { ROTULO_STATUS_COMPRA } from './comprasRotulos'
import { toast } from 'sonner'

// Aba Chegadas (Marco B — docs/PLANO_MATERIAIS_FASE2.md §4, §5 passo 7; migration 151).
// 1) Compras ENVIADAS da competência: a mesa escolhe a compra e registra, por
//    contrato, o que o fornecedor entregou — padrão = o comprado, menor com motivo,
//    maior recusado (a RPC mat_registrar_chegada confere tudo de novo). Atalho
//    "Chegou tudo" por contrato.
// 2) Remanejamentos (produto levado de outro posto): "Remanejamento feito" —
//    sem a confirmação o pedido não fecha como entregue.
// O status dos pedidos (entregue / entregue parcial) aparece por contrato.
// Quem registra: mesa e gestor (admin sempre). Financeiro e inspetoria só leem.

export function MateriaisChegadasPage() {
  const { user } = useAuth()
  const podeRegistrar = user ? podeRegistrarChegadaMateriais(user.nivel_acesso) : false
  const [params, setParams] = useSearchParams()
  const ch = useChegadasMateriais()
  const forn = useMateriaisFornecedores()
  // ?mes=AAAA-MM&compra=<id> (link "Registrar chegada" do detalhe da compra)
  const [mes, setMes] = useState(() => {
    const m = params.get('mes') ?? ''
    return /^\d{4}-\d{2}$/.test(m) ? m : hojeBrasil().slice(0, 7)
  })
  const competencia = competenciaDoMes(mes)
  const [dataChegada, setDataChegada] = useState(hojeBrasil())
  const compraId = params.get('compra') ?? ''
  const [itens, setItens] = useState<MatCompraItem[]>([])
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoChegada>>({})
  const [edRem, setEdRem] = useState<Record<string, EdicaoChegada>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  const { carregar, carregarItens } = ch
  const { carregar: carregarForn } = forn
  useEffect(() => {
    carregarForn()
  }, [carregarForn])
  useEffect(() => {
    carregar(competencia)
  }, [carregar, competencia])

  const recarregarItens = useCallback(async () => {
    if (!compraId) {
      setItens([])
      return
    }
    setCarregandoItens(true)
    setItens(await carregarItens(compraId))
    setEdicoes({})
    setCarregandoItens(false)
  }, [carregarItens, compraId])
  useEffect(() => {
    recarregarItens()
  }, [recarregarItens])

  const compraSel = ch.compras.find((c) => c.id === compraId) ?? null
  const nomeForn = useMemo(() => new Map(forn.fornecedores.map((f) => [f.id, f.nome])), [forn.fornecedores])
  const grupos = useMemo(() => agruparCelulasPorContrato(itens), [itens])
  const statusPorContrato = useMemo(() => {
    const m = new Map<string, { status: StatusProdutos; implantacao: boolean }[]>()
    for (const p of ch.dados?.pedidos ?? []) m.set(p.contrato_id, [...(m.get(p.contrato_id) ?? []), { status: p.status_produtos, implantacao: p.implantacao }])
    return m
  }, [ch.dados])
  const remanejamentos = ch.dados?.remanejamentos ?? []
  const remPendentes = remanejamentos.filter((r) => r.qtd_entregue_remanejada == null)

  const escolherCompra = (id: string) => {
    const p = new URLSearchParams(params)
    if (id) p.set('compra', id)
    else p.delete('compra')
    setParams(p, { replace: true })
  }

  const recarregarTudo = async () => {
    await Promise.all([carregar(competencia), recarregarItens()])
  }

  const salvarGrupo = async (celulas: MatCompraItem[], chegouTudo: boolean, chave: string) => {
    if (!compraSel) return
    const { payload, erros } = montarPayloadChegada(celulas, edicoes, chegouTudo)
    if (erros.length) return toast.error(`${erros.length} item(ns) com pendência — veja os avisos em vermelho.`)
    setSalvando(chave)
    const ok = await ch.registrarChegada(compraSel.id, payload, dataChegada || null)
    setSalvando(null)
    if (ok) await recarregarTudo()
  }

  const confirmarRem = async (linhas: RemanejamentoChegada[], chave: string) => {
    const { payload, erros } = montarPayloadRemanejamento(linhas, edRem)
    if (erros.length) return toast.error(`${erros.length} remanejamento(s) com pendência — veja os avisos em vermelho.`)
    setSalvando(chave)
    const ok = await ch.confirmarRemanejamento(payload, dataChegada || null)
    setSalvando(null)
    if (ok) {
      setEdRem({})
      await recarregarTudo()
    }
  }

  if (ch.estruturaPendente) {
    return (
      <MateriaisShell>
        <PageHeader title="Chegadas" />
        <EstruturaPendente />
      </MateriaisShell>
    )
  }

  const statusContrato = (contratoId: string | null) =>
    contratoId ? (
      <span className="flex flex-wrap gap-1">
        {(statusPorContrato.get(contratoId) ?? []).map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <StatusProdutosBadge status={s.status} />
            {s.implantacao && <Selo tom="roxo">implantação</Selo>}
          </span>
        ))}
      </span>
    ) : null

  return (
    <MateriaisShell>
      <PageHeader
        title="Chegadas"
        description="Registre o que o fornecedor entregou em cada posto e confirme os remanejamentos entre postos. O pedido fica “Entregue” ou “Entregue parcial” sozinho."
      />

      <div className="space-y-4">
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="w-44">
            <SeletorMes id="chegadas-mes" valor={mes} onChange={(m) => {
                setMes(m)
                escolherCompra('')
              }} rotulo="Competência" />
          </div>
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="chegadas-compra">Compra</Label>
            <select id="chegadas-compra" className={CLASSE_SELECT} value={compraId} onChange={(e) => escolherCompra(e.target.value)}>
              <option value="">{ch.compras.length ? 'Escolha a compra' : 'Nenhuma compra enviada nesta competência'}</option>
              {ch.compras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {nomeForn.get(c.fornecedor_id) ?? 'Fornecedor'} ({ROTULO_STATUS_COMPRA[c.status].texto})
                </option>
              ))}
            </select>
          </div>
          {podeRegistrar && (
            <div className="w-44 space-y-1.5">
              <Label htmlFor="chegadas-data">Data da chegada</Label>
              <Input id="chegadas-data" type="date" className="tabular-nums" value={dataChegada} onChange={(e) => setDataChegada(e.target.value)} />
            </div>
          )}
        </section>

        {ch.loading && ch.compras.length === 0 ? (
          <LoadingScreen className="h-48" />
        ) : (
          <>
            {compraId && !compraSel && !ch.loading && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Esta compra não está entre as enviadas de {rotuloCompetencia(competencia)}. Troque a competência ou{' '}
                <Link className="underline" to={`/materiais/compras/${compraId}`}>
                  abra a compra
                </Link>
                .
              </p>
            )}

            {compraSel && (
              <DataTable
                title={`Compra ${compraSel.numero} — ${nomeForn.get(compraSel.fornecedor_id) ?? 'Fornecedor'}`}
                count={grupos.length}
                minWidth={760}
              >
                <div className="flex flex-wrap items-center gap-2 px-4 pb-2 text-sm">
                  <StatusBadge variant={ROTULO_STATUS_COMPRA[compraSel.status].variante}>{ROTULO_STATUS_COMPRA[compraSel.status].texto}</StatusBadge>
                  {compraSel.entrega_prevista && <span className="text-muted-foreground tabular-nums">entrega prevista {formatarData(compraSel.entrega_prevista)}</span>}
                  <Link className="text-primary underline" to={`/materiais/compras/${compraSel.id}`}>
                    ver a compra
                  </Link>
                </div>
                {carregandoItens ? (
                  <LoadingScreen className="h-32" />
                ) : grupos.length === 0 ? (
                  <EmptyState icon={<PackageSearch className="size-6" />} title="Compra sem itens" description="Esta compra não tem células." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Comprado</TableHead>
                        <TableHead className="text-right">Chegou</TableHead>
                        <TableHead>Motivo (se chegou menos)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupos.map((g) => {
                        const chave = g.contratoId ?? 'estoque'
                        const pendentes = g.celulas.filter((c) => celulaPendente(c, edicoes[c.id])).length
                        return [
                          <TableRow key={`h-${chave}`} className="bg-muted/40">
                            <TableCell colSpan={4}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{g.contratoNome}</span>
                                  {g.rota && <Selo tom="cinza">rota {g.rota}</Selo>}
                                  {g.registrado ? <Selo tom="verde">chegada registrada</Selo> : <Selo>aguardando</Selo>}
                                  {statusContrato(g.contratoId)}
                                </div>
                                {podeRegistrar && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={salvando != null || g.celulas.every((c) => c.qtd_recebida === c.quantidade)}
                                      onClick={() => salvarGrupo(g.celulas, true, `tudo-${chave}`)}
                                    >
                                      <CheckCheck className="size-4" /> {salvando === `tudo-${chave}` ? 'Gravando…' : 'Chegou tudo'}
                                    </Button>
                                    <Button size="sm" disabled={salvando != null || pendentes === 0} onClick={() => salvarGrupo(g.celulas, false, `sal-${chave}`)}>
                                      <Save className="size-4" /> {salvando === `sal-${chave}` ? 'Gravando…' : 'Salvar chegada'}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>,
                          ...g.celulas.map((c) => {
                            const e = edicoes[c.id] ?? edicaoInicialCelula(c)
                            const alterada = !!edicoes[c.id]
                            const erro = alterada ? erroChegada(c, e) : null
                            const menor = Number(e.qtd.replace(',', '.')) < c.quantidade
                            return (
                              <TableRow key={c.id} className="align-top hover:bg-accent/40">
                                <TableCell className="pl-6 text-sm">
                                  {descricaoItemCompra(c.item_nome, c.variacao_rotulo)}
                                  {c.qtd_recebida != null && (
                                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                                      registrado {c.qtd_recebida}
                                      {c.recebido_em ? ` em ${formatarData(c.recebido_em)}` : ''}
                                    </span>
                                  )}
                                  {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{quantidadeComUnidade(c.quantidade, c.unidade)}</TableCell>
                                <TableCell className="text-right">
                                  {podeRegistrar ? (
                                    <Input
                                      aria-label={`Chegou — ${descricaoItemCompra(c.item_nome, c.variacao_rotulo)} — ${g.contratoNome}`}
                                      inputMode="decimal"
                                      className="ml-auto h-8 w-20 text-right tabular-nums"
                                      value={e.qtd}
                                      onChange={(ev) => setEdicoes((x) => ({ ...x, [c.id]: { ...e, qtd: ev.target.value } }))}
                                    />
                                  ) : (
                                    <span className="tabular-nums">{c.qtd_recebida ?? '—'}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {podeRegistrar && menor ? (
                                    <Input
                                      aria-label={`Motivo — ${descricaoItemCompra(c.item_nome, c.variacao_rotulo)} — ${g.contratoNome}`}
                                      placeholder="Ex.: faltou no fornecedor"
                                      className="h-8 text-xs"
                                      maxLength={200}
                                      value={e.motivo}
                                      onChange={(ev) => setEdicoes((x) => ({ ...x, [c.id]: { ...e, motivo: ev.target.value } }))}
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{c.motivo_recebimento ?? ''}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          }),
                        ]
                      })}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
            )}

            <DataTable title="Remanejamentos entre postos" count={remanejamentos.length} minWidth={900}>
              {remanejamentos.length === 0 ? (
                <EmptyState
                  icon={<ArrowRightLeft className="size-6" />}
                  title="Nenhum remanejamento"
                  description="Quando a compra marcar uma linha como “remanejado de outro posto”, ela aparece aqui para confirmar que foi levada."
                />
              ) : (
                <>
                  {podeRegistrar && remPendentes.length > 1 && (
                    <div className="flex justify-end px-4 pb-2">
                      <Button size="sm" disabled={salvando != null} onClick={() => confirmarRem(remPendentes, 'rem-todos')}>
                        <PackageCheck className="size-4" /> {salvando === 'rem-todos' ? 'Gravando…' : `Confirmar os ${remPendentes.length} pendentes`}
                      </Button>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Para o posto</TableHead>
                        <TableHead>Vem de</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Remanejado</TableHead>
                        <TableHead className="text-right">Levado</TableHead>
                        <TableHead>Motivo (se levou menos)</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remanejamentos.map((r) => {
                        const e = edRem[r.linha_id] ?? edicaoInicialRemanejamento(r)
                        const erro = edRem[r.linha_id] ? erroRemanejamento(r, e) : null
                        const menor = Number(e.qtd.replace(',', '.')) < r.qtd_remanejada
                        const feito = r.qtd_entregue_remanejada != null
                        return (
                          <TableRow key={r.linha_id} className="align-top hover:bg-accent/40">
                            <TableCell>
                              <Link className="font-medium text-primary underline" to={`/materiais/pedidos/${r.pedido_id}`}>
                                {r.contrato_nome}
                              </Link>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {r.rota && <Selo tom="cinza">rota {r.rota}</Selo>}
                                {r.competencia < competencia && <Selo>de {rotuloCompetencia(r.competencia)}</Selo>}
                                <StatusProdutosBadge status={r.status_pedido} />
                              </div>
                            </TableCell>
                            <TableCell>{r.origem_nome ?? '—'}</TableCell>
                            <TableCell className="text-sm">
                              {descricaoRemanejamento(r)}
                              {r.remanejamento_obs && <span className="block text-[11px] text-muted-foreground">{r.remanejamento_obs}</span>}
                              {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{quantidadeComUnidade(r.qtd_remanejada, r.unidade)}</TableCell>
                            <TableCell className="text-right">
                              {podeRegistrar ? (
                                <Input
                                  aria-label={`Levado — ${descricaoRemanejamento(r)} — ${r.contrato_nome}`}
                                  inputMode="decimal"
                                  className="ml-auto h-8 w-20 text-right tabular-nums"
                                  value={e.qtd}
                                  onChange={(ev) => setEdRem((x) => ({ ...x, [r.linha_id]: { ...e, qtd: ev.target.value } }))}
                                />
                              ) : (
                                <span className="tabular-nums">{r.qtd_entregue_remanejada ?? '—'}</span>
                              )}
                              {feito && r.confirmado_em && (
                                <span className="block text-[11px] text-muted-foreground tabular-nums">feito em {formatarData(r.confirmado_em)}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {podeRegistrar && menor ? (
                                <Input
                                  aria-label={`Motivo do remanejamento — ${r.contrato_nome}`}
                                  className="h-8 text-xs"
                                  maxLength={200}
                                  value={e.motivo}
                                  onChange={(ev) => setEdRem((x) => ({ ...x, [r.linha_id]: { ...e, motivo: ev.target.value } }))}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">{feito && r.qtd_entregue_remanejada! < r.qtd_remanejada ? r.motivo_entrega : ''}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {feito && !edRem[r.linha_id] ? (
                                <Selo tom="verde">remanejamento feito</Selo>
                              ) : (
                                podeRegistrar && (
                                  <Button size="sm" variant="outline" disabled={salvando != null} onClick={() => confirmarRem([r], r.linha_id)}>
                                    {salvando === r.linha_id ? 'Gravando…' : feito ? 'Corrigir' : 'Remanejamento feito'}
                                  </Button>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </DataTable>
          </>
        )}
      </div>
    </MateriaisShell>
  )
}
