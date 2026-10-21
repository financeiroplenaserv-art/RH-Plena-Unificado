import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet, PackageSearch, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { SeletorMes, Selo } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useMateriaisCompras } from '@/hooks/useMateriaisCompras'
import { useMateriaisFornecedores } from '@/hooks/useMateriaisFornecedores'
import { podeComprarMateriais } from '@/lib/permissoes'
import { formatarData, hojeBrasil, mascaraMoeda } from '@/lib/utils'
import { competenciaDoMes } from '@/lib/materiais/painel'
import {
  agruparPorItem,
  avisoJanelaCompra,
  compraDoGrupo,
  montarPayloadReposicao,
  diasDesdeContagem,
  doMesAnterior,
  erroDestino,
  montarPayloadCompra,
  resumoPorFornecedor,
  sugerirDestinos,
  tipoDestino,
  totalDestino,
  type DestinoLinha,
  type GrupoItemCompra,
  type LinhaPrevia,
} from '@/lib/materiais/compra'
import { ROTULO_STATUS_COMPRA, ROTULO_TIPO_COMPRA } from './comprasRotulos'
import { rotuloMultiplo } from '@/lib/materiais/multiploCompra'
import { toast } from 'sonner'
import { CartasLiderBotoes } from '@/components/materiais/CartasLiderBotoes'

// Aba Compras (docs/PLANO_MATERIAIS_FASE2.md §4): "Preparar a compra do mês" —
// tudo o que foi aprovado e ainda não tem destino (kit e extras juntos, mais o
// que sobrou de meses anteriores), agrupado por item; sugestão estoque × fornecedor
// (estoque primeiro); fornecedor padrão do item com troca pontual; dividir ou não
// atender com motivo; "Gerar pedidos aos fornecedores" cria um RASCUNHO por
// fornecedor. NADA é automático: quem gera e envia é o comprador (gestor ou
// mesa), clicando. Antes do dia de início da compra só há AVISO (sem trava).
// Financeiro e inspetoria veem a página só para consulta.

const num = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function MateriaisComprasPage() {
  const { user } = useAuth()
  const podeComprar = user ? podeComprarMateriais(user.nivel_acesso) : false
  const { previa, compras, loading, estruturaPendente, carregar, gerar } = useMateriaisCompras()
  const forn = useMateriaisFornecedores()
  const [mes, setMes] = useState(hojeBrasil().slice(0, 7))
  const competencia = competenciaDoMes(mes)
  const [destinos, setDestinos] = useState<Record<string, DestinoLinha>>({})
  const [fora, setFora] = useState<Set<string>>(new Set()) // grupos (chave) deixados de fora desta geração
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [confirmar, setConfirmar] = useState(false)
  const [tipo, setTipo] = useState<'mensal' | 'avulsa'>('mensal')
  const [observacao, setObservacao] = useState('')
  const [gerando, setGerando] = useState(false)
  // 152: "comprar a mais para o estoque", por item (chave do grupo → quantidade).
  const [aMais, setAMais] = useState<Record<string, number>>({})

  const { carregar: carregarForn } = forn
  useEffect(() => {
    carregarForn()
  }, [carregarForn])
  useEffect(() => {
    carregar(competencia, true)
  }, [carregar, competencia])
  useEffect(() => {
    setDestinos(previa ? sugerirDestinos(previa.linhas) : {})
    setFora(new Set())
    setAMais({})
  }, [previa])

  const linhas = useMemo(() => previa?.linhas ?? [], [previa])
  const grupos = useMemo(() => agruparPorItem(linhas, destinos), [linhas, destinos])
  const nomeForn = useMemo(() => new Map(forn.fornecedores.map((f) => [f.id, f.nome])), [forn.fornecedores])
  const fornAtivos = useMemo(() => forn.fornecedores.filter((f) => f.ativo !== false), [forn.fornecedores])
  const selecionadas = useMemo(() => {
    const s = new Set<string>()
    for (const g of grupos) if (!fora.has(g.chave)) for (const l of g.linhas) s.add(l.linha_id)
    return s
  }, [grupos, fora])
  const errosPorLinha = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of linhas) {
      if (!selecionadas.has(l.linha_id)) continue
      const e = erroDestino(l, destinos[l.linha_id])
      if (e) m.set(l.linha_id, e)
    }
    return m
  }, [linhas, destinos, selecionadas])

  const contratosOrigem = previa?.contratos ?? []
  const remanejados = useMemo(() => {
    let linhasR = 0
    let qtd = 0
    for (const l of linhas) {
      const q = destinos[l.linha_id]?.qtdRemanejada ?? 0
      if (!selecionadas.has(l.linha_id) || q <= 0 || destinos[l.linha_id]?.naoAtender) continue
      linhasR++
      qtd += q
    }
    return { linhas: linhasR, qtd }
  }, [linhas, destinos, selecionadas])

  const extrasPendentes = previa?.pendentes.length ?? 0
  const aviso = previa ? avisoJanelaCompra(previa.hoje, competencia, previa.dia_inicio_compra, previa.dia_limite_aprovacao, extrasPendentes) : null
  const diasContagem = previa ? diasDesdeContagem(previa.ultima_contagem, previa.hoje) : null

  const editar = (linhaId: string, patch: Partial<DestinoLinha>) =>
    setDestinos((d) => ({
      ...d,
      [linhaId]: { qtdEstoque: 0, qtdCompra: 0, fornecedorId: null, naoAtender: false, motivo: '', ...d[linhaId], ...patch },
    }))

  /** Troca o fornecedor do item SÓ nesta compra (o padrão do catálogo não muda — decisão 12). */
  const trocarFornecedorDoItem = (g: GrupoItemCompra, fornecedorId: string) =>
    setDestinos((d) => {
      const novo = { ...d }
      for (const l of g.linhas) if (novo[l.linha_id]) novo[l.linha_id] = { ...novo[l.linha_id], fornecedorId: fornecedorId || null }
      return novo
    })

  const fornecedorDoGrupo = (g: GrupoItemCompra) => {
    const ids = new Set(g.linhas.map((l) => destinos[l.linha_id]?.fornecedorId ?? null))
    return ids.size === 1 ? [...ids][0] : null
  }
  const reposicao = montarPayloadReposicao(grupos, aMais, fornecedorDoGrupo, fora)
  const resumo = resumoPorFornecedor(linhas, destinos, selecionadas, reposicao.payload)

  const abrirConfirmacao = () => {
    const { erros, payload } = montarPayloadCompra(linhas, destinos, selecionadas)
    if (erros.length) {
      toast.error(`${erros.length} linha(s) com pendência — veja os avisos em vermelho na tabela.`)
      setAbertos(new Set(grupos.filter((g) => g.linhas.some((l) => errosPorLinha.has(l.linha_id))).map((g) => g.chave)))
      return
    }
    if (reposicao.erros.length) {
      toast.error(reposicao.erros[0].erro)
      return
    }
    if (payload.length === 0 && reposicao.payload.length === 0) return toast.error('Nenhuma linha selecionada.')
    setConfirmar(true)
  }

  const executar = async () => {
    const { payload } = montarPayloadCompra(linhas, destinos, selecionadas)
    setGerando(true)
    const r = await gerar(competencia, tipo, payload, observacao.trim() || null, reposicao.payload)
    setGerando(false)
    setConfirmar(false)
    if (r) {
      setObservacao('')
      carregar(competencia, true)
    }
  }

  if (estruturaPendente) {
    return (
      <MateriaisShell>
        <PageHeader title="Compras" />
        <EstruturaPendente />
      </MateriaisShell>
    )
  }

  const celulaLinha = (l: LinhaPrevia) => {
    const d = destinos[l.linha_id]
    const t = tipoDestino(l, d)
    const erro = errosPorLinha.get(l.linha_id)
    return (
      <TableRow key={l.linha_id} className="bg-muted/30 align-top hover:bg-accent/40">
        <TableCell className="pl-10 text-sm">
          <p>{l.contrato_nome}</p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Selo tom={l.parte === 'kit' ? 'verde' : 'azul'}>{l.parte === 'kit' ? 'kit' : 'extra'}</Selo>
            {l.pedido_tipo === 'extra' && <Selo tom="cinza">pedido extra</Selo>}
            {l.implantacao && <Selo tom="roxo">implantação</Selo>}
            {doMesAnterior(l, competencia) && <Selo tom="ambar">do mês anterior ({rotuloCompetencia(l.competencia)})</Selo>}
          </div>
          {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
        </TableCell>
        <TableCell className="text-sm tabular-nums">{l.rota ?? '—'}</TableCell>
        <TableCell className="text-right tabular-nums">{l.qtd_aprovada}</TableCell>
        <TableCell className="text-right">
          {t === 'escritorio' || t === 'texto_livre' || !podeComprar ? (
            <span className="tabular-nums">{t === 'escritorio' ? '—' : (d?.qtdEstoque ?? 0)}</span>
          ) : (
            <Input
              aria-label={`Do estoque — ${l.contrato_nome}`}
              inputMode="decimal"
              className="h-8 w-20 text-right tabular-nums"
              disabled={d?.naoAtender}
              value={String(d?.qtdEstoque ?? 0)}
              onChange={(e) => editar(l.linha_id, { qtdEstoque: num(e.target.value) })}
            />
          )}
        </TableCell>
        <TableCell className="text-right">
          {t === 'escritorio' || t === 'texto_livre' || !podeComprar ? (
            <span className="tabular-nums">{t === 'escritorio' ? '—' : (d?.qtdCompra ?? 0)}</span>
          ) : (
            <Input
              aria-label={`Do fornecedor — ${l.contrato_nome}`}
              inputMode="decimal"
              className="h-8 w-20 text-right tabular-nums"
              disabled={d?.naoAtender}
              value={String(d?.qtdCompra ?? 0)}
              onChange={(e) => editar(l.linha_id, { qtdCompra: num(e.target.value) })}
            />
          )}
        </TableCell>
        <TableCell className="text-right">
          {t === 'escritorio' || t === 'texto_livre' || !podeComprar ? (
            <span className="tabular-nums">{t === 'escritorio' ? '—' : (d?.qtdRemanejada ?? 0)}</span>
          ) : (
            <Input
              aria-label={`Remanejado de outro posto — ${l.contrato_nome}`}
              inputMode="decimal"
              className="h-8 w-20 text-right tabular-nums"
              disabled={d?.naoAtender}
              value={String(d?.qtdRemanejada ?? 0)}
              onChange={(e) => editar(l.linha_id, { qtdRemanejada: num(e.target.value) })}
            />
          )}
        </TableCell>
        <TableCell colSpan={3} className="space-y-1">
          {(d?.qtdRemanejada ?? 0) > 0 && !d?.naoAtender && (
            <div className="space-y-1 rounded-lg border border-violet-200 bg-violet-50/60 p-2 dark:border-violet-900 dark:bg-violet-950/30">
              {podeComprar ? (
                <>
                  <select
                    aria-label={`Remanejado de qual posto — ${l.contrato_nome}`}
                    className={CLASSE_SELECT}
                    value={d?.remanejadoDe ?? ''}
                    onChange={(e) => editar(l.linha_id, { remanejadoDe: e.target.value || null })}
                  >
                    <option value="">De qual posto vem?</option>
                    {contratosOrigem
                      .filter((c) => c.id !== l.contrato_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                          {c.rota ? ` (rota ${c.rota})` : ''}
                        </option>
                      ))}
                  </select>
                  <Input
                    aria-label={`Observação do remanejamento — ${l.contrato_nome}`}
                    placeholder="Observação do remanejamento (opcional)"
                    className="h-8 text-xs"
                    maxLength={200}
                    value={d?.obsRemanejamento ?? ''}
                    onChange={(e) => editar(l.linha_id, { obsRemanejamento: e.target.value })}
                  />
                </>
              ) : (
                <p className="text-xs">remanejado de {contratosOrigem.find((c) => c.id === d?.remanejadoDe)?.nome ?? 'outro posto'}</p>
              )}
            </div>
          )}
          {podeComprar && t !== 'escritorio' && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!d?.naoAtender}
                onChange={(e) => editar(l.linha_id, { naoAtender: e.target.checked })}
              />
              Não atender
            </label>
          )}
          {podeComprar && (d?.naoAtender || (d && totalDestino(d) < l.qtd_aprovada) || t === 'texto_livre') && (
            <Input
              aria-label={`Motivo — ${l.contrato_nome}`}
              placeholder="Motivo (vai na carta ao líder)"
              className="h-8 text-xs"
              value={d?.motivo ?? ''}
              onChange={(e) => editar(l.linha_id, { motivo: e.target.value })}
            />
          )}
          {t === 'texto_livre' && (
            <Link to={`/materiais/pedidos/${l.pedido_id}`} className="block text-xs text-primary underline">
              Ligar ao catálogo no pedido
            </Link>
          )}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <MateriaisShell>
      <PageHeader
        title="Compras"
        description="Preparar a compra do mês (kit e extras aprovados, numa compra só) e acompanhar os pedidos aos fornecedores."
      >
        {/* A carta lê pedidos e catálogo (RLS do módulo): o financeiro, só com a aba Compras, não a gera. */}
        {podeComprar && <CartasLiderBotoes competencia={competencia} />}
      </PageHeader>

      <div className="space-y-4">
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="w-44">
            <SeletorMes id="compras-mes" valor={mes} onChange={setMes} rotulo="Competência" />
          </div>
          <p className="pb-2 text-sm text-muted-foreground">
            Compra entre os dias {previa?.dia_inicio_compra ?? 20} e {previa?.dia_fim_compra ?? 25}. O botão funciona o mês todo — antes do dia{' '}
            {previa?.dia_inicio_compra ?? 20} ele só avisa.
          </p>
        </section>

        {loading && !previa ? (
          <LoadingScreen className="h-48" />
        ) : (
          <>
            {(aviso || extrasPendentes > 0 || (previa?.contratos_sem_rota ?? 0) > 0 || diasContagem == null || diasContagem > 10) && (
              <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {aviso && (
                  <p className="flex items-start gap-2 font-medium">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {aviso}
                  </p>
                )}
                {extrasPendentes > 0 && (
                  <details>
                    <summary className="cursor-pointer">
                      {extrasPendentes} contrato(s) com extras aguardando inspetor/gestor — o kit deles vai nesta compra; o extra pendente fica para
                      o mês seguinte ou para uma compra avulsa.
                    </summary>
                    <ul className="mt-1 list-disc pl-6">
                      {previa?.pendentes.map((p) => (
                        <li key={p.pedido_id}>
                          <Link className="underline" to={`/materiais/pedidos/${p.pedido_id}`}>
                            {p.contrato_nome}
                          </Link>{' '}
                          — {p.linhas_pendentes} linha(s), {p.status_pedido === 'validado' ? 'com o gestor' : 'com o inspetor'}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {(previa?.contratos_sem_rota ?? 0) > 0 && <p>{previa?.contratos_sem_rota} contrato(s) ativo(s) sem rota: no Excel saem em “Sem rota”.</p>}
                {diasContagem == null ? (
                  <p>O estoque ainda não foi contado (a 1ª contagem é em novembro): tudo sai do fornecedor.</p>
                ) : (
                  diasContagem > 10 && <p>Estoque contado há {diasContagem} dias — confira antes de usar o saldo.</p>
                )}
              </section>
            )}

            <DataTable title="Preparar a compra — aprovado e ainda sem destino" count={grupos.length} minWidth={1180}>
              {grupos.length === 0 ? (
                <EmptyState
                  icon={<PackageSearch className="size-6" />}
                  title="Nada aprovado sem destino"
                  description="Quando o gestor aprovar os pedidos (o kit sai aprovado na hora), as linhas aparecem aqui."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead className="text-right">Aprovado</TableHead>
                      <TableHead className="text-right">Do estoque</TableHead>
                      <TableHead className="text-right">Do fornecedor</TableHead>
                      <TableHead className="text-right" title="Levado de outro posto: não é comprado nem sai do estoque">
                        Remanejado
                      </TableHead>
                      <TableHead className="text-right" title="Compra além do que os postos pediram; vai para o estoque (célula de reposição na mesma compra)">
                        A mais p/ estoque
                      </TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((g) => {
                      const aberto = abertos.has(g.chave)
                      const comErro = g.linhas.some((l) => errosPorLinha.has(l.linha_id))
                      const fid = fornecedorDoGrupo(g)
                      return (
                        <Fragment key={g.chave}>
                          <TableRow className={`align-top hover:bg-accent/40 ${fora.has(g.chave) ? 'opacity-50' : ''}`}>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                {podeComprar && (
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    aria-label={`Incluir ${g.descricao} nesta compra`}
                                    checked={!fora.has(g.chave)}
                                    onChange={(e) =>
                                      setFora((f) => {
                                        const n = new Set(f)
                                        if (e.target.checked) n.delete(g.chave)
                                        else n.add(g.chave)
                                        return n
                                      })
                                    }
                                  />
                                )}
                                <button
                                  type="button"
                                  className="flex items-start gap-1 text-left"
                                  onClick={() =>
                                    setAbertos((a) => {
                                      const n = new Set(a)
                                      if (n.has(g.chave)) n.delete(g.chave)
                                      else n.add(g.chave)
                                      return n
                                    })
                                  }
                                >
                                  {aberto ? <ChevronDown className="mt-0.5 size-4" /> : <ChevronRight className="mt-0.5 size-4" />}
                                  <span>
                                    <span className="font-medium">{g.descricao}</span>
                                    <span className="block text-xs text-muted-foreground">
                                      {g.linhas.length} contrato(s){g.unidade ? ` · ${g.unidade}` : ''}
                                    </span>
                                  </span>
                                </button>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1 pl-6">
                                {g.preparoEscritorio && <Selo tom="cinza">preparado no escritório — não vai ao fornecedor</Selo>}
                                {!g.preparoEscritorio && rotuloMultiplo(g.fatorCompra, g.unidadeCompra) && (
                                  <Selo tom="azul">{rotuloMultiplo(g.fatorCompra, g.unidadeCompra)}</Selo>
                                )}
                                {g.fracionado && <Selo tom="cinza">fracionado no escritório — os postos recebem do estoque</Selo>}
                                {g.textoLivre && <Selo tom="vermelho">texto livre — ligue ao catálogo</Selo>}
                                {comErro && <Selo tom="vermelho">pendência</Selo>}
                              </div>
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right tabular-nums font-medium">{g.totalAprovado}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {g.preparoEscritorio ? '—' : g.totalEstoque}
                              {!g.preparoEscritorio && g.saldo != null && (
                                <span className={`block text-[11px] ${g.saldo < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>saldo {g.saldo}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {g.preparoEscritorio ? '—' : g.totalCompra}
                              {!g.preparoEscritorio && !g.textoLivre && <CompraDoItem g={g} aMais={aMais[g.chave] ?? 0} />}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{g.preparoEscritorio ? '—' : g.totalRemanejado || ''}</TableCell>
                            <TableCell className="text-right">
                              {g.preparoEscritorio || g.textoLivre ? (
                                '—'
                              ) : podeComprar ? (
                                <Input
                                  aria-label={`A mais para o estoque — ${g.descricao}`}
                                  inputMode="decimal"
                                  className="ml-auto h-8 w-20 text-right tabular-nums"
                                  disabled={fora.has(g.chave)}
                                  value={String(aMais[g.chave] ?? 0)}
                                  onChange={(e) => setAMais((a) => ({ ...a, [g.chave]: num(e.target.value) }))}
                                />
                              ) : (
                                <span className="tabular-nums">{aMais[g.chave] || ''}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {g.preparoEscritorio || g.textoLivre ? (
                                '—'
                              ) : podeComprar ? (
                                <select
                                  aria-label={`Fornecedor de ${g.descricao}`}
                                  className={CLASSE_SELECT}
                                  value={fid ?? ''}
                                  onChange={(e) => trocarFornecedorDoItem(g, e.target.value)}
                                >
                                  <option value="">{fid === null && g.linhas.length > 1 ? 'Vários / escolher' : 'Escolher'}</option>
                                  {fornAtivos.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nome}
                                      {f.id === g.fornecedorPadraoId ? ' (padrão)' : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                (fid && nomeForn.get(fid)) ?? g.fornecedorPadraoNome ?? '—'
                              )}
                              {fid && g.fornecedorPadraoId && fid !== g.fornecedorPadraoId && (
                                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                                  Fornecedor trocado só nesta compra. O preço é o vigente do catálogo — atualize-o se for outro.
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {g.precoVigente != null ? mascaraMoeda(g.precoVigente) : <span className="text-muted-foreground">sem preço</span>}
                            </TableCell>
                          </TableRow>
                          {aberto && g.linhas.map(celulaLinha)}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>

            {podeComprar && grupos.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-sm text-muted-foreground">
                  {resumo.length} fornecedor(es) · {selecionadas.size} linha(s) selecionada(s)
                </p>
                <Button onClick={abrirConfirmacao}>
                  <ShoppingCart className="size-4" /> Gerar pedidos aos fornecedores
                </Button>
              </div>
            )}

            {(previa?.escritorio.length ?? 0) > 0 && (
              <DataTable title="Lista do escritório — preparar e encapar (não vai ao fornecedor)" count={previa?.escritorio.length}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Aprovado no mês</TableHead>
                      <TableHead className="text-right">Aguardando aprovação</TableHead>
                      <TableHead className="text-right">Contratos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previa?.escritorio.map((e) => (
                      <TableRow key={e.item_id} className="hover:bg-accent/40">
                        <TableCell>{e.item_nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.total_aprovado}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.total_pendente || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.contratos}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataTable>
            )}

            <DataTable title={`Compras de ${rotuloCompetencia(competencia)}`} count={compras.length}>
              {compras.length === 0 ? (
                <EmptyState icon={<FileSpreadsheet className="size-6" />} title="Nenhuma compra gerada" description="Os pedidos aos fornecedores aparecem aqui." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compra</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Enviada em</TableHead>
                      <TableHead>Entrega prevista</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compras.map((c) => (
                      <TableRow key={c.id} className="hover:bg-accent/40">
                        <TableCell>
                          <Link to={`/materiais/compras/${c.id}`} className="font-medium text-primary underline tabular-nums">
                            {c.numero}
                          </Link>
                          {c.antes_da_janela && (
                            <span className="ml-2">
                              <Selo tom="ambar">gerada antes do dia da compra</Selo>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{nomeForn.get(c.fornecedor_id) ?? '—'}</TableCell>
                        <TableCell>{ROTULO_TIPO_COMPRA[c.tipo]}</TableCell>
                        <TableCell>
                          <StatusBadge variant={ROTULO_STATUS_COMPRA[c.status].variante}>{ROTULO_STATUS_COMPRA[c.status].texto}</StatusBadge>
                        </TableCell>
                        <TableCell className="tabular-nums">{c.enviada_em ? formatarData(c.enviada_em.slice(0, 10)) : '—'}</TableCell>
                        <TableCell className="tabular-nums">{c.entrega_prevista ? formatarData(c.entrega_prevista) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={(a) => !a && setConfirmar(false)}
        icon={<ShoppingCart className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Gerar pedidos aos fornecedores?"
        description="Cada linha ganha o destino escolhido e é criado um RASCUNHO por fornecedor. Você confere a matriz, baixa o Excel, envia ao fornecedor e só então marca como enviada."
        confirmLabel={gerando ? 'Gerando…' : 'Gerar rascunhos'}
        confirmDisabled={gerando}
        onConfirm={executar}
      >
        <div className="space-y-3 text-sm">
          {aviso && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {aviso}
            </p>
          )}
          <ul className="space-y-1">
            {resumo.map((r) => (
              <li key={r.fornecedorId} className="flex justify-between gap-2 tabular-nums">
                <span>{nomeForn.get(r.fornecedorId) ?? 'Fornecedor'}</span>
                <span>
                  {r.itens} item(ns) · {r.quantidade} un · {mascaraMoeda(r.valor)}
                  {r.semPreco > 0 ? ` (+${r.semPreco} sem preço)` : ''}
                  {r.sobra > 0 && <span className="block text-xs text-muted-foreground">{r.sobra} un a mais para o estoque (múltiplo de compra)</span>}
                </span>
              </li>
            ))}
            {resumo.length === 0 && (
              <li className="text-muted-foreground">Nenhuma linha vai a fornecedor (só estoque, escritório, remanejado ou não atendidas).</li>
            )}
          </ul>
          {remanejados.linhas > 0 && (
            <p className="rounded-lg bg-violet-50 p-2 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              {remanejados.linhas} linha(s) remanejada(s) de outro posto ({remanejados.qtd} un): não vão ao fornecedor nem saem do estoque.
              Confirme o “remanejamento feito” na aba Chegadas quando o produto for levado.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="compra-tipo">Tipo</Label>
            <select id="compra-tipo" className={CLASSE_SELECT} value={tipo} onChange={(e) => setTipo(e.target.value as 'mensal' | 'avulsa')}>
              <option value="mensal">Compra do mês</option>
              <option value="avulsa">Compra avulsa (fora da compra do mês)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compra-obs">Observação (opcional)</Label>
            <Input id="compra-obs" value={observacao} maxLength={300} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>
    </MateriaisShell>
  )
}

/**
 * Prévia do múltiplo de compra e do a mais para o estoque (migration 152): o
 * que vai de fato ao fornecedor depois de arredondar. Só aparece quando muda
 * alguma coisa (fator > 1, a mais ou fracionado). Quem grava é o banco.
 */
function CompraDoItem({ g, aMais }: { g: GrupoItemCompra; aMais: number }) {
  const c = compraDoGrupo(g, aMais)
  if (c.total === 0 || (g.fatorCompra === 1 && c.aMais === 0 && !g.fracionado)) return null
  return (
    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
      {c.aMais > 0 && <span className="block">+ {c.aMais} a mais p/ estoque</span>}
      <span className="block font-medium text-foreground">
        compra {c.total}
        {c.embalagem ? ` = ${c.embalagem}` : ''}
      </span>
      {c.sobra > 0 && <span className="block">sobra {c.sobra} → estoque</span>}
      {g.fracionado && <span className="block">entrega no escritório</span>}
    </span>
  )
}
