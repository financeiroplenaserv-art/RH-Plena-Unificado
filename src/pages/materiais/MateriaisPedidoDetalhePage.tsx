import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CornerUpLeft, MessageSquare, PackageSearch, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { Selo, StatusCeuBadge, StatusProdutosBadge } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { usePedidoMaterial } from '@/hooks/useMateriaisPedidos'
import { podeAprovarMateriais, podeValidarMateriais } from '@/lib/permissoes'
import { formatarData, formatarDataHora, hojeBrasil, mascaraMoeda } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import {
  ehLinhaKit,
  kitAprovadoAutomatico,
  montarAjusteKit,
  montarAprovacao,
  montarValidacao,
  origemDaLinha,
  qtdEfetiva,
  rotulosExcecao,
  temExcecao,
  type DecisaoRepeticao,
  type EdicaoKit,
  type EdicaoLinha,
} from '@/lib/materiais/filas'
import { rotaEfetiva } from '@/lib/materiais/pedidos'
import { antesDoPrazo, ultimaEntregaDoItem } from '@/lib/materiais/ultimaEntrega'
import { toast } from 'sonner'
import type { MatComentario, MatPedidoItem } from '@/types/materiais'

// Detalhe do pedido (docs/PLANO_MATERIAIS_FASE1.md §5.1): linhas pedido × kit
// × validado × aprovado, origem de cada linha (envio original/complemento,
// data e "Seu nome"), exceções com a justificativa do líder, avisos de
// repetição (só aviso: somar, descartar ou ignorar) e comentários por item.
// Inspetor valida/corta/devolve; gestor aprova tudo ou ajusta item a item.
//
// Kit confirmável + pedido extra (decisão da gestão, 16/10/2026 — migration
// 135): as linhas aparecem em duas tabelas, "Kit do mês" (o que o posto vai
// receber — com a configuração ligada já sai aprovado) e "Pedido extra" (o
// que passa do kit — é isso que o inspetor valida e o gestor aprova).
// Inspetor e gestor podem AJUSTAR qualquer linha do kit (diminuir, tirar,
// trocar o item), sempre com motivo, pelo botão "Ajustar" (RPC
// ajustar_linha_kit_materiais).

type Modo = 'validar' | 'aprovar' | 'ler'

export function MateriaisPedidoDetalhePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const nivel = user?.nivel_acesso
  const det = usePedidoMaterial()
  const catalogo = useMateriaisCatalogo()
  const contratosHook = useMateriaisContratos()

  const [edicoes, setEdicoes] = useState<Record<string, EdicaoLinha>>({})
  const [comentarioGeral, setComentarioGeral] = useState('')
  const [comentarioLinha, setComentarioLinha] = useState<{ linha: MatPedidoItem; texto: string } | null>(null)
  const [devolucao, setDevolucao] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<'validar' | 'aprovar_tudo' | 'aprovar_ajustes' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [ajuste, setAjuste] = useState<{ linha: MatPedidoItem; edicao: EdicaoKit } | null>(null)

  const { carregar } = det
  const { carregar: carregarCatalogo } = catalogo
  const { carregar: carregarContratos } = contratosHook
  useEffect(() => {
    carregar(id)
    setEdicoes({})
  }, [carregar, id])
  useEffect(() => {
    carregarCatalogo()
    carregarContratos()
  }, [carregarCatalogo, carregarContratos])

  const p = det.pedido
  const contrato = p ? contratosHook.contratos.find((c) => c.id === p.contrato_id) ?? null : null
  const modo: Modo =
    p?.status_produtos === 'em_validacao' && nivel && podeValidarMateriais(nivel)
      ? 'validar'
      : p?.status_produtos === 'validado' && nivel && podeAprovarMateriais(nivel)
        ? 'aprovar'
        : 'ler'

  const nomeItem = useMemo(() => new Map(catalogo.itens.map((i) => [i.id, i])), [catalogo.itens])
  const nomeVariacao = useMemo(() => new Map(catalogo.variacoes.map((v) => [v.id, v.rotulo])), [catalogo.variacoes])
  const comentariosPorLinha = useMemo(() => {
    const m = new Map<string, MatComentario[]>()
    for (const c of det.comentarios) {
      if (!c.linha_id) continue
      m.set(c.linha_id, [...(m.get(c.linha_id) ?? []), c])
    }
    return m
  }, [det.comentarios])
  const comentariosGerais = det.comentarios.filter((c) => !c.linha_id)

  const valorTotal = det.itens.reduce((s, l) => s + qtdEfetiva(l) * (l.preco_unitario ?? 0), 0)
  const excecoes = det.itens.filter(temExcecao).length
  const itensKit = det.itens.filter(ehLinhaKit)
  const itensExtra = det.itens.filter((l) => !ehLinhaKit(l))
  const valorKit = itensKit.reduce((s, l) => s + qtdEfetiva(l) * (l.preco_unitario ?? 0), 0)
  const kitAuto = itensKit.some(kitAprovadoAutomatico)
  const podeAjustarKit =
    !!p && !!nivel && (podeValidarMateriais(nivel) || podeAprovarMateriais(nivel)) && ['em_validacao', 'validado', 'aprovado'].includes(p.status_produtos)
  const itensAtivos = useMemo(() => catalogo.itens.filter((i) => i.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [catalogo.itens])

  // Última entrega dos itens EXTRAS (fora do kit ou a mais): data, quanto foi e
  // selo "antes do prazo" quando a validade do item ainda não passou. Só aqui,
  // nas telas internas — o link do líder nunca mostra isso.
  const hoje = hojeBrasil()
  const ultimaDoExtra = (l: MatPedidoItem) => {
    if (!l.item_id || !p) return null
    const ult = ultimaEntregaDoItem(l.item_id, det.entregasAnteriores, det.vinculos, p.competencia)
    if (!ult) return { ult: null, antes: false }
    return { ult, antes: antesDoPrazo(ult.data, nomeItem.get(l.item_id)?.validade_meses, hoje) }
  }

  const descrever = (l: MatPedidoItem) => {
    if (!l.item_id) return l.descricao_livre ?? 'Outro material'
    const it = nomeItem.get(l.item_id)
    return `${it?.nome ?? 'Item'}${l.variacao_id ? ` — ${nomeVariacao.get(l.variacao_id) ?? ''}` : ''}`
  }

  const editar = (linhaId: string, patch: Partial<EdicaoLinha>) =>
    setEdicoes((e) => ({ ...e, [linhaId]: { qtd: null, motivo: '', decisao: null, ...e[linhaId], ...patch } }))

  const recarregar = () => {
    setEdicoes({})
    return carregar(id)
  }

  const executar = async () => {
    if (!p || !confirmar) return
    setEnviando(true)
    let ok = false
    if (confirmar === 'validar') {
      const { itens, erros } = montarValidacao(det.itens, edicoes)
      if (erros.length) toast.error(erros.join(' · '))
      else ok = await det.validar(p.id, itens, comentarioGeral.trim() || null)
    } else if (confirmar === 'aprovar_tudo') {
      ok = await det.aprovar(p.id, [])
    } else {
      const { itens, erros } = montarAprovacao(det.itens, edicoes)
      if (erros.length) toast.error(erros.join(' · '))
      else ok = await det.aprovar(p.id, itens)
    }
    setEnviando(false)
    setConfirmar(null)
    if (ok) {
      setComentarioGeral('')
      recarregar()
    }
  }

  const salvarAjuste = async () => {
    if (!ajuste) return
    const itemTroca = ajuste.edicao.itemId
    const temVariacoes = !!itemTroca && catalogo.variacoes.some((v) => v.item_id === itemTroca && v.ativo)
    const { payload, erro } = montarAjusteKit(ajuste.linha, ajuste.edicao, temVariacoes)
    if (erro || !payload) return toast.error(erro ?? 'Confira o ajuste')
    setEnviando(true)
    const ok = await det.ajustarKit(payload)
    setEnviando(false)
    if (ok) {
      setAjuste(null)
      recarregar()
    }
  }

  const devolver = async () => {
    if (!p || devolucao == null) return
    if (!devolucao.trim()) return toast.error('Escreva o que o líder precisa corrigir')
    const ok = await det.comentar({ pedidoId: p.id, texto: `Devolvido ao líder: ${devolucao.trim()}`, autorNome: user?.nome ?? null })
    if (ok) {
      setDevolucao(null)
      recarregar()
    }
  }

  const comentar = async (texto: string, linha?: MatPedidoItem) => {
    if (!p) return false
    const ok = await det.comentar({
      pedidoId: p.id,
      texto,
      autorNome: user?.nome ?? null,
      linhaTabela: linha ? 'mat_pedido_itens' : null,
      linhaId: linha?.id ?? null,
    })
    if (ok) await carregar(id)
    return ok
  }

  /** Tabela de linhas de produto (kit do mês ou pedido extra). */
  const tabelaLinhas = (linhas: MatPedidoItem[], ehKit: boolean) => {
    const colunaEdicao = modo !== 'ler' || (ehKit && podeAjustarKit)
    return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Kit</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Validado</TableHead>
                    <TableHead className="text-right">Aprovado</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    {colunaEdicao && <TableHead className="w-64">{modo === 'validar' ? 'Validação' : modo === 'aprovar' ? 'Ajuste' : 'Kit'}</TableHead>}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => {
                    const origem = origemDaLinha(l, det.envios)
                    const exc = rotulosExcecao(l)
                    const ed = edicoes[l.id]
                    const coms = comentariosPorLinha.get(l.id) ?? []
                    const destacada = (!ehKit && exc.length > 0) || l.possivel_repeticao
                    const auto = kitAprovadoAutomatico(l)
                    const editavel = modo !== 'ler' && !auto
                    const original = l.item_original_id ? nomeItem.get(l.item_original_id)?.nome : null
                    return (
                      <TableRow key={l.id} className={`align-top hover:bg-accent/40 ${destacada ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                        <TableCell className="max-w-xs">
                          <p className="font-medium">{descrever(l)}</p>
                          {l.item_id && <p className="text-xs text-muted-foreground">{nomeItem.get(l.item_id)?.unidade_pedido}</p>}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {auto && <Selo tom="verde">kit aprovado</Selo>}
                            {ehKit && l.qtd_kit != null && Number(l.qtd_pedida) === 0 && <Selo tom="cinza">líder tirou este mês</Selo>}
                            {ehKit && l.qtd_kit != null && Number(l.qtd_pedida) > 0 && Number(l.qtd_pedida) < Number(l.qtd_kit) && (
                              <Selo tom="cinza">líder diminuiu</Selo>
                            )}
                            {exc.map((x) => (
                              <Selo key={x} tom={ehKit ? 'cinza' : undefined} title={ehKit ? 'Aviso interno — não exige motivo' : undefined}>
                                {x}
                              </Selo>
                            ))}
                            {l.possivel_repeticao && <Selo tom="vermelho" title="Mesmo item já pedido em outro envio deste pedido">possível repetição</Selo>}
                            {l.decisao_repeticao && <Selo tom="cinza">{l.decisao_repeticao === 'somar' ? 'somado' : 'descartado'}</Selo>}
                          </div>
                          {original && <p className="mt-1 text-xs text-muted-foreground">Trocado de: {original}</p>}
                          {l.justificativa && <p className="mt-1 text-xs">Motivo do líder: “{l.justificativa}”</p>}
                          {!ehKit && !l.justificativa && (l.excecao_acima_kit || l.excecao_fora_kit) && (
                            <p className="mt-1 text-xs text-muted-foreground">O líder não contou o motivo.</p>
                          )}
                          {!ehKit && l.item_id && (() => {
                            const u = ultimaDoExtra(l)
                            if (!u) return null
                            if (!u.ult) return <p className="text-xs text-muted-foreground">Nenhuma entrega anterior registrada para este posto.</p>
                            return (
                              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                Última entrega: {formatarData(u.ult.data)} ({u.ult.quantidade}
                                {nomeItem.get(l.item_id)?.unidade_pedido ? ` ${nomeItem.get(l.item_id)?.unidade_pedido}` : ''})
                                {u.antes && <Selo tom="vermelho" title="A última entrega foi há menos tempo que a validade do item">antes do prazo</Selo>}
                              </p>
                            )
                          })()}
                          {ehKit && l.excecao_validade && l.ultima_entrega_em && (
                            <p className="text-xs text-muted-foreground">Última entrega: {formatarData(l.ultima_entrega_em)}</p>
                          )}
                          {l.motivo_ajuste && <p className="text-xs text-muted-foreground">Motivo do ajuste: {l.motivo_ajuste}</p>}
                          {coms.map((c) => (
                            <p key={c.id} className="mt-1 rounded bg-muted px-2 py-1 text-xs">
                              <span className="font-medium">{c.autor_nome ?? 'Usuário'}</span> ({formatarDataHora(c.created_at)}): {c.texto}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {origem ? (
                            <>
                              <p>{origem.origem === 'original' ? 'Original' : 'Complemento'}</p>
                              <p className="tabular-nums text-muted-foreground">{formatarDataHora(origem.enviadoEm)}</p>
                              <p className="text-muted-foreground">{origem.seuNome}</p>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.qtd_kit ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{l.qtd_pedida}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.qtd_validada ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.qtd_aprovada ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.preco_unitario != null ? mascaraMoeda(l.preco_unitario) : '—'}</TableCell>
                        {colunaEdicao && (
                          <TableCell className="space-y-1.5">
                            {ehKit && podeAjustarKit && (auto || modo === 'ler') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAjuste({ linha: l, edicao: { qtd: null, motivo: '', itemId: null, variacaoId: null } })}
                              >
                                <SlidersHorizontal className="size-4" /> Ajustar
                              </Button>
                            )}
                            {editavel && modo === 'validar' && l.possivel_repeticao && (
                              <select
                                aria-label={`Repetição de ${descrever(l)}`}
                                className={CLASSE_SELECT}
                                value={ed?.decisao ?? ''}
                                onChange={(e) => editar(l.id, { decisao: (e.target.value || null) as DecisaoRepeticao })}
                              >
                                <option value="">Ignorar aviso</option>
                                <option value="somar">Somar (conta a quantidade)</option>
                                <option value="descartar">Descartar (zera a linha)</option>
                              </select>
                            )}
                            {editavel && ed?.decisao !== 'descartar' && (
                              <Input
                                aria-label={`${modo === 'validar' ? 'Quantidade validada' : 'Quantidade aprovada'} de ${descrever(l)}`}
                                inputMode="decimal"
                                className="tabular-nums"
                                placeholder={`Manter ${modo === 'validar' ? l.qtd_pedida : (l.qtd_validada ?? l.qtd_pedida)}`}
                                value={ed?.qtd ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value.replace(',', '.')
                                  editar(l.id, { qtd: v === '' ? null : Number(v) })
                                }}
                              />
                            )}
                            {editavel && (ed?.qtd != null || ed?.decisao === 'descartar') && (
                              <Input
                                aria-label={`Motivo para ${descrever(l)}`}
                                placeholder={ed?.decisao === 'descartar' ? 'Motivo (padrão: repetição)' : 'Motivo do ajuste'}
                                value={ed?.motivo ?? ''}
                                onChange={(e) => editar(l.id, { motivo: e.target.value })}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Comentar ${descrever(l)}`} onClick={() => setComentarioLinha({ linha: l, texto: '' })}>
                            <MessageSquare className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
    )
  }

  if (det.estruturaPendente) {
    return (
      <MateriaisShell>
        <PageHeader title="Pedido" backTo="/materiais/pedidos" />
        <EstruturaPendente />
      </MateriaisShell>
    )
  }
  if (det.loading && !p) {
    return (
      <MateriaisShell>
        <LoadingScreen className="h-64" />
      </MateriaisShell>
    )
  }
  if (!p) {
    return (
      <MateriaisShell>
        <PageHeader title="Pedido" backTo="/materiais/pedidos" />
        <EmptyState icon={<PackageSearch className="size-6" />} title="Pedido não encontrado" description="Ele pode ter sido cancelado ou você não tem acesso." />
      </MateriaisShell>
    )
  }

  const rota = contrato ? rotaEfetiva(p, contrato) : p.rota_override
  const ceuAbertas = det.ceuItens.filter((l) => l.status !== 'atendido' && l.status !== 'cancelado').length

  return (
    <MateriaisShell>
      <PageHeader
        title={contrato?.nome ?? 'Pedido'}
        backTo="/materiais/pedidos"
        description={`${p.tipo === 'extra' ? 'Pedido extra' : 'Pedido mensal'} de ${rotuloCompetencia(p.competencia)}${
          contrato ? ` · ${nomeCurtoDepartamentoFuzzy(contratosHook.departamentos, contrato.departamento_id)}` : ''
        }`}
      />

      <div className="space-y-4">
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Produtos</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <StatusProdutosBadge status={p.status_produtos} />
              {excecoes > 0 && <Selo>{excecoes} com exceção</Selo>}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uniforme / EPI / crachá</p>
            <div className="mt-1">
              <StatusCeuBadge status={p.status_ceu} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rota</p>
            <p className="mt-1 tabular-nums">
              {rota ?? '—'} {p.rota_override && <Selo tom="azul" title={p.rota_override_motivo ?? undefined}>rota do dia</Selo>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor ({p.status_produtos === 'aprovado' ? 'aprovado' : 'pedido'})</p>
            <p className="mt-1 font-semibold tabular-nums">{mascaraMoeda(valorTotal)}</p>
            {itensKit.length > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Kit {mascaraMoeda(valorKit)} · extra {mascaraMoeda(valorTotal - valorKit)}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-muted-foreground">Envios</p>
            <ul className="mt-1 space-y-0.5">
              {det.envios.map((e) => (
                <li key={e.id} className="tabular-nums">
                  {e.origem === 'original' ? 'Original' : `Complemento ${e.sequencia - 1}`} — {formatarDataHora(e.enviado_em)} — por {e.seu_nome}
                </li>
              ))}
              {det.envios.length === 0 && <li className="text-muted-foreground">Ainda não enviado</li>}
            </ul>
            {p.preenchido_pelo_escritorio && <p className="mt-1"><Selo tom="cinza">preenchido pelo escritório</Selo></p>}
            {p.observacao && <p className="mt-2 text-muted-foreground">Observação: {p.observacao}</p>}
          </div>
        </section>

        {modo === 'validar' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {kitAuto ? 'O kit do mês já está aprovado. Confira o pedido extra' : 'Este pedido tem exceção. Confira as linhas destacadas'}: valide
            como está, altere a quantidade (com motivo, para mais ou para menos) ou devolva ao líder com um comentário. O motivo do
            líder é opcional. Avisos de repetição não travam — some, descarte ou ignore.
          </p>
        )}
        {modo === 'aprovar' && (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            {kitAuto ? 'Pedido extra validado.' : 'Pedido validado.'} Aprove tudo ou ajuste item a item (motivo obrigatório ao alterar a
            quantidade, para mais ou para menos).
          </p>
        )}

        {itensKit.length > 0 && (
          <DataTable
            title={`Kit do mês${kitAuto ? ' — aprovado automaticamente' : ''}`}
            count={itensKit.length}
            minWidth={980}
          >
            {tabelaLinhas(itensKit, true)}
          </DataTable>
        )}
        <DataTable title={itensKit.length > 0 ? 'Pedido extra' : 'Produtos'} count={itensExtra.length} minWidth={980}>
          {itensExtra.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-6" />}
              title={itensKit.length > 0 ? 'Sem pedido extra' : 'Sem produtos'}
              description={itensKit.length > 0 ? 'O líder só confirmou o kit do mês.' : 'Este pedido não tem linhas de produtos.'}
            />
          ) : (
            tabelaLinhas(itensExtra, false)
          )}
        </DataTable>

        {modo !== 'ler' && det.itens.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {modo === 'validar' ? (
              <>
                <Button variant="outline" onClick={() => setDevolucao('')}>
                  <CornerUpLeft className="size-4" /> Devolver ao líder
                </Button>
                <Button onClick={() => setConfirmar('validar')}>
                  <Check className="size-4" /> Validar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmar('aprovar_ajustes')} disabled={!Object.values(edicoes).some((e) => e.qtd != null)}>
                  Aprovar com ajustes
                </Button>
                <Button onClick={() => setConfirmar('aprovar_tudo')}>
                  <Check className="size-4" /> Aprovar tudo
                </Button>
              </>
            )}
          </div>
        )}

        {det.ceuItens.length > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
            <span>
              {det.ceuItens.length} linha(s) de uniforme/EPI/crachá
              {ceuAbertas > 0 ? ` — ${ceuAbertas} em aberto` : ' — todas concluídas'}.
            </span>
            <Link to="/ceu/pedidos" className="font-medium text-primary underline">
              Abrir no CEU → Pedidos
            </Link>
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Comentários do pedido</h2>
          {comentariosGerais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {comentariosGerais.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted px-3 py-2">
                  <span className="font-medium">{c.autor_nome ?? 'Usuário'}</span>{' '}
                  <span className="text-xs text-muted-foreground tabular-nums">{formatarDataHora(c.created_at)}</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{c.texto}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ped-comentario">{modo === 'validar' ? 'Comentário (vai junto com a validação, ou registre agora)' : 'Novo comentário'}</Label>
            <Textarea id="ped-comentario" rows={2} value={comentarioGeral} onChange={(e) => setComentarioGeral(e.target.value)} maxLength={1000} />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={!comentarioGeral.trim()}
                onClick={async () => {
                  if (await comentar(comentarioGeral)) setComentarioGeral('')
                }}
              >
                Comentar
              </Button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={!!confirmar}
        onOpenChange={(a) => !a && setConfirmar(null)}
        icon={<Check className="size-6 text-emerald-600" />}
        iconClassName="bg-emerald-50"
        title={confirmar === 'validar' ? 'Validar pedido?' : 'Aprovar pedido?'}
        description={
          confirmar === 'validar'
            ? 'As linhas sem ajuste ficam validadas pela quantidade pedida. O pedido segue para o gestor.'
            : confirmar === 'aprovar_tudo'
              ? 'Todas as linhas serão aprovadas pela quantidade validada.'
              : 'As linhas ajustadas usam a nova quantidade; as demais ficam como validadas.'
        }
        confirmLabel={enviando ? 'Enviando…' : confirmar === 'validar' ? 'Validar' : 'Aprovar'}
        confirmDisabled={enviando}
        onConfirm={executar}
      />

      <ConfirmDialog
        open={!!ajuste}
        onOpenChange={(a) => !a && setAjuste(null)}
        icon={<SlidersHorizontal className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Ajustar linha do kit"
        description={
          ajuste
            ? `${descrever(ajuste.linha)} — kit ${ajuste.linha.qtd_kit ?? '—'}, líder confirmou ${ajuste.linha.qtd_pedida}. O kit só diminui; para dar mais, use o pedido extra.`
            : ''
        }
        confirmLabel={enviando ? 'Salvando…' : 'Salvar ajuste'}
        confirmDisabled={enviando || !ajuste?.edicao.motivo.trim()}
        onConfirm={salvarAjuste}
      >
        {ajuste && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ajuste-qtd">Quantidade</Label>
              <Input
                id="ajuste-qtd"
                inputMode="decimal"
                className="tabular-nums"
                placeholder={`Manter ${ajuste.linha.qtd_validada ?? ajuste.linha.qtd_pedida}`}
                value={ajuste.edicao.qtd ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.')
                  setAjuste((a) => (a ? { ...a, edicao: { ...a.edicao, qtd: v === '' ? null : Number(v) } } : a))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ajuste-item">Trocar o item (opcional)</Label>
              <select
                id="ajuste-item"
                className={CLASSE_SELECT}
                value={ajuste.edicao.itemId ?? ''}
                onChange={(e) =>
                  setAjuste((a) => (a ? { ...a, edicao: { ...a.edicao, itemId: e.target.value || null, variacaoId: null } } : a))
                }
              >
                <option value="">Manter o item</option>
                {itensAtivos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </div>
            {ajuste.edicao.itemId && catalogo.variacoes.some((v) => v.item_id === ajuste.edicao.itemId && v.ativo) && (
              <div className="space-y-1.5">
                <Label htmlFor="ajuste-variacao">Opção</Label>
                <select
                  id="ajuste-variacao"
                  className={CLASSE_SELECT}
                  value={ajuste.edicao.variacaoId ?? ''}
                  onChange={(e) => setAjuste((a) => (a ? { ...a, edicao: { ...a.edicao, variacaoId: e.target.value || null } } : a))}
                >
                  <option value="">Escolha</option>
                  {catalogo.variacoes
                    .filter((v) => v.item_id === ajuste.edicao.itemId && v.ativo)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.rotulo}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ajuste-motivo">Motivo (obrigatório)</Label>
              <Textarea
                id="ajuste-motivo"
                rows={2}
                maxLength={500}
                value={ajuste.edicao.motivo}
                onChange={(e) => setAjuste((a) => (a ? { ...a, edicao: { ...a.edicao, motivo: e.target.value } } : a))}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={devolucao != null}
        onOpenChange={(a) => !a && setDevolucao(null)}
        icon={<CornerUpLeft className="size-6 text-amber-600" />}
        iconClassName="bg-amber-50"
        title="Devolver ao líder"
        description="O link não recebe devolução: ligue para o líder e registre aqui o que ele precisa corrigir. O pedido continua com o inspetor até o complemento chegar ou você validar."
        confirmLabel="Registrar devolução"
        confirmDisabled={!devolucao?.trim()}
        onConfirm={devolver}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ped-devolucao">O que precisa ser corrigido</Label>
          <Textarea id="ped-devolucao" rows={3} value={devolucao ?? ''} onChange={(e) => setDevolucao(e.target.value)} maxLength={1000} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!comentarioLinha}
        onOpenChange={(a) => !a && setComentarioLinha(null)}
        icon={<MessageSquare className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Comentário no item"
        description={comentarioLinha ? descrever(comentarioLinha.linha) : ''}
        confirmLabel="Comentar"
        confirmDisabled={!comentarioLinha?.texto.trim()}
        onConfirm={async () => {
          if (comentarioLinha && (await comentar(comentarioLinha.texto, comentarioLinha.linha))) setComentarioLinha(null)
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ped-comentario-linha">Comentário</Label>
          <Textarea
            id="ped-comentario-linha"
            rows={3}
            value={comentarioLinha?.texto ?? ''}
            onChange={(e) => setComentarioLinha((c) => (c ? { ...c, texto: e.target.value } : c))}
            maxLength={1000}
          />
        </div>
      </ConfirmDialog>
    </MateriaisShell>
  )
}
