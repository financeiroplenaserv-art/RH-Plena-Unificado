import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CornerUpLeft, MessageSquare, PackageSearch } from 'lucide-react'
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
import { formatarData, formatarDataHora, mascaraMoeda } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import {
  montarAprovacao,
  montarValidacao,
  origemDaLinha,
  qtdEfetiva,
  rotulosExcecao,
  temExcecao,
  type DecisaoRepeticao,
  type EdicaoLinha,
} from '@/lib/materiais/filas'
import { rotaEfetiva } from '@/lib/materiais/pedidos'
import { toast } from 'sonner'
import type { MatComentario, MatPedidoItem } from '@/types/materiais'

// Detalhe do pedido (docs/PLANO_MATERIAIS_FASE1.md §5.1): linhas pedido × kit
// × validado × aprovado, origem de cada linha (envio original/complemento,
// data e "Seu nome"), exceções com a justificativa do líder, avisos de
// repetição (só aviso: somar, descartar ou ignorar) e comentários por item.
// Inspetor valida/corta/devolve; gestor aprova tudo ou ajusta item a item.

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
            Este pedido tem exceção. Confira as linhas destacadas: valide como está, corte a quantidade (com motivo) ou devolva ao
            líder com um comentário. Avisos de repetição não travam — some, descarte ou ignore.
          </p>
        )}
        {modo === 'aprovar' && (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            Pedido validado. Aprove tudo ou ajuste item a item (motivo obrigatório quando aprovar menos que o pedido).
          </p>
        )}

        <DataTable title="Produtos" count={det.itens.length} minWidth={980}>
          {det.itens.length === 0 ? (
            <EmptyState icon={<PackageSearch className="size-6" />} title="Sem produtos" description="Este pedido não tem linhas de produtos." />
          ) : (
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
                  {modo !== 'ler' && <TableHead className="w-64">{modo === 'validar' ? 'Validação' : 'Ajuste'}</TableHead>}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {det.itens.map((l) => {
                  const origem = origemDaLinha(l, det.envios)
                  const exc = rotulosExcecao(l)
                  const ed = edicoes[l.id]
                  const coms = comentariosPorLinha.get(l.id) ?? []
                  const destacada = exc.length > 0 || l.possivel_repeticao
                  return (
                    <TableRow key={l.id} className={`align-top hover:bg-accent/40 ${destacada ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
                      <TableCell className="max-w-xs">
                        <p className="font-medium">{descrever(l)}</p>
                        {l.item_id && <p className="text-xs text-muted-foreground">{nomeItem.get(l.item_id)?.unidade_pedido}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {exc.map((x) => (
                            <Selo key={x}>{x}</Selo>
                          ))}
                          {l.possivel_repeticao && <Selo tom="vermelho" title="Mesmo item já pedido em outro envio deste pedido">possível repetição</Selo>}
                          {l.decisao_repeticao && <Selo tom="cinza">{l.decisao_repeticao === 'somar' ? 'somado' : 'descartado'}</Selo>}
                        </div>
                        {l.justificativa && <p className="mt-1 text-xs">Justificativa do líder: “{l.justificativa}”</p>}
                        {l.excecao_validade && l.ultima_entrega_em && (
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
                      {modo !== 'ler' && (
                        <TableCell className="space-y-1.5">
                          {modo === 'validar' && l.possivel_repeticao && (
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
                          {ed?.decisao !== 'descartar' && (
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
                          {(ed?.qtd != null || ed?.decisao === 'descartar') && (
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
