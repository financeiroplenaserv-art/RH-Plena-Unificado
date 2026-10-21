import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Check } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { SeletorMes, Selo, StatusProdutosBadge } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { lerMateriaisConfig, salvarMateriaisConfig, useMateriaisPainel } from '@/hooks/useMateriaisPedidos'
import { podeAprovarMateriais } from '@/lib/permissoes'
import { hojeBrasil, mascaraMoeda } from '@/lib/utils'
import { competenciaDoMes } from '@/lib/materiais/painel'
import { avisosOrcamentoCeu, lerCustoCracha } from '@/lib/materiais/orcamento'
import { Input } from '@/components/ui/input'

// Painel do gestor (docs/PLANO_MATERIAIS_FASE1.md §5.1): por contrato, valor
// pedido × limite (Kit × preço vigente) × média dos últimos 6 meses fechados
// (12 meses como referência). Aprovar selecionados ou ajustar item a item.
// Kit confirmável (16/10/2026, migration 135): o valor separa kit do mês e
// pedido extra; "Aprovar" aprova os EXTRAS validados (o kit, com a
// configuração ligada, já sai aprovado). A configuração "Aprovação
// automática do kit" fica no topo desta tela (gestor/admin).

interface FiltroPainel {
  mostrar: 'com_pedido' | 'acima' | 'aprovar' | 'todos'
}
const FILTRO_PADRAO: FiltroPainel = { mostrar: 'com_pedido' }

export function MateriaisPainelPage() {
  const { user } = useAuth()
  const podeAprovar = user ? podeAprovarMateriais(user.nivel_acesso) : false
  const { linhas, loading, estruturaPendente, carregar, aprovarLote } = useMateriaisPainel()
  const [mes, setMes] = useFiltroPersistente<string>('materiais.painel.mes', hojeBrasil().slice(0, 7))
  const [filtro, setFiltro] = useFiltroPersistente<FiltroPainel>('materiais.painel.filtro', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroPainel>(filtro)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmar, setConfirmar] = useState(false)
  const competencia = competenciaDoMes(mes)
  const [kitAuto, setKitAuto] = useState<boolean | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [confirmarConfig, setConfirmarConfig] = useState<boolean | null>(null)
  // Custo do crachá (migration 153): texto dos campos, R$ sem e com cordinha.
  const [custoSem, setCustoSem] = useState('')
  const [custoCom, setCustoCom] = useState('')
  const [salvandoCusto, setSalvandoCusto] = useState(false)

  useEffect(() => {
    let vivo = true
    lerMateriaisConfig().then((c) => {
      if (!vivo) return
      setKitAuto(c.kit_aprovacao_automatica)
      const f = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))
      setCustoSem(f(c.custo_cracha_sem_cordinha))
      setCustoCom(f(c.custo_cracha_com_cordinha))
    })
    return () => {
      vivo = false
    }
  }, [])

  const salvarConfig = async () => {
    if (confirmarConfig == null) return
    setSalvandoConfig(true)
    const ok = await salvarMateriaisConfig({ kit_aprovacao_automatica: confirmarConfig })
    setSalvandoConfig(false)
    if (ok) setKitAuto(confirmarConfig)
    setConfirmarConfig(null)
  }

  const lerValor = (t: string) => (t.trim() ? lerCustoCracha(t.replace(/\./g, '').replace(',', '.')) : null)
  const custoInvalido = (t: string) => t.trim() !== '' && lerValor(t) == null
  const salvarCustos = async () => {
    if (custoInvalido(custoSem) || custoInvalido(custoCom)) return
    setSalvandoCusto(true)
    const ok = await salvarMateriaisConfig({ custo_cracha_sem_cordinha: lerValor(custoSem), custo_cracha_com_cordinha: lerValor(custoCom) })
    setSalvandoCusto(false)
    if (ok) carregar(competencia)
  }

  useEffect(() => {
    carregar(competencia)
    setSelecionados(new Set())
  }, [carregar, competencia])

  const lista = useMemo(
    () =>
      linhas.filter((l) => {
        if (filtro.mostrar === 'com_pedido') return l.pedidoIds.length > 0 || l.ceu.temLinhas
        if (filtro.mostrar === 'acima') return l.excedeu || l.ceu.excedeu
        if (filtro.mostrar === 'aprovar') return l.aprovavel
        return true
      }),
    [linhas, filtro]
  )
  const aprovaveis = lista.filter((l) => l.aprovavel)
  const totais = useMemo(
    () => ({
      pedido: lista.reduce((s, l) => s + l.valorPedido, 0),
      limite: lista.reduce((s, l) => s + l.limite, 0),
      acima: lista.filter((l) => l.excedeu).length,
      ceu: lista.reduce((s, l) => s + l.ceu.valor, 0),
      acimaCeu: lista.filter((l) => l.ceu.excedeu).length,
    }),
    [lista]
  )

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const aprovar = async () => {
    const ok = await aprovarLote(competencia, [...selecionados])
    setConfirmar(false)
    if (ok) {
      setSelecionados(new Set())
      carregar(competencia)
    }
  }

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Painel do gestor"
        description="Valor pedido no mês comparado ao limite do contrato (Kit Mensal × preço atual) e à média dos últimos 6 meses fechados."
      >
        {podeAprovar && (
          <Button onClick={() => setConfirmar(true)} disabled={selecionados.size === 0}>
            <Check className="size-4" /> Aprovar selecionados{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          {podeAprovar && kitAuto != null && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold">Aprovação automática do kit</p>
                <p className="text-sm text-muted-foreground">
                  {kitAuto
                    ? 'Ligada: o kit do mês confirmado pelo líder já sai aprovado. Só o pedido extra passa pelo inspetor e por você.'
                    : 'Desligada: o kit do mês passa pela aprovação junto com o pedido extra.'}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  role="switch"
                  className="size-5 accent-primary"
                  checked={kitAuto}
                  disabled={salvandoConfig}
                  onChange={(e) => setConfirmarConfig(e.target.checked)}
                  aria-label="Aprovação automática do kit"
                />
                {kitAuto ? 'Ligada' : 'Desligada'}
              </label>
            </section>
          )}

          {podeAprovar && kitAuto != null && (
            <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="min-w-0 flex-1 basis-64 space-y-0.5">
                <p className="text-sm font-semibold">Custo do crachá</p>
                <p className="text-sm text-muted-foreground">
                  Entra no orçamento de uniforme/EPI/crachá do contrato. Vazio = custo não definido (o crachá não é somado).
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custo-sem">Sem cordinha (R$)</Label>
                <Input id="custo-sem" inputMode="decimal" className="w-32" value={custoSem} onChange={(e) => setCustoSem(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="custo-com">Com cordinha (R$)</Label>
                <Input id="custo-com" inputMode="decimal" className="w-32" value={custoCom} onChange={(e) => setCustoCom(e.target.value)} />
              </div>
              <Button onClick={salvarCustos} disabled={salvandoCusto || custoInvalido(custoSem) || custoInvalido(custoCom)}>
                {salvandoCusto ? 'Salvando…' : 'Salvar custos'}
              </Button>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Resumo titulo="Pedido no mês" valor={mascaraMoeda(totais.pedido)} />
            <Resumo titulo="Soma dos limites" valor={mascaraMoeda(totais.limite)} />
            <Resumo titulo="Material acima do limite" valor={String(totais.acima)} alerta={totais.acima > 0} />
            <Resumo titulo="Uniforme/EPI/crachá no mês" valor={mascaraMoeda(totais.ceu)} />
            <Resumo titulo="Uniforme/EPI/crachá acima do limite" valor={String(totais.acimaCeu)} alerta={totais.acimaCeu > 0} />
          </div>

          <FiltrosAtivosBadge total={filtro.mostrar !== FILTRO_PADRAO.mostrar ? 1 : 0} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <SeletorMes id="painel-mes" valor={mes} onChange={setMes} />
            <div className="space-y-1.5">
              <Label htmlFor="painel-mostrar">Mostrar</Label>
              <select
                id="painel-mostrar"
                className={CLASSE_SELECT}
                value={rascunho.mostrar}
                onChange={(e) => setRascunho({ mostrar: e.target.value as FiltroPainel['mostrar'] })}
              >
                <option value="com_pedido">Contratos com pedido</option>
                <option value="acima">Só acima de algum limite</option>
                <option value="aprovar">Só aguardando aprovação</option>
                <option value="todos">Todos os contratos</option>
              </select>
            </div>
          </Filters>

          <DataTable title={`Contratos — ${rotuloCompetencia(competencia)}`} count={lista.length} minWidth={1180}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState icon={<BarChart3 className="size-6" />} title="Nada por aqui" description="Nenhum contrato com esses filtros neste mês." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {podeAprovar && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os aprováveis"
                          checked={aprovaveis.length > 0 && aprovaveis.every((l) => selecionados.has(l.contratoId))}
                          onChange={(e) => setSelecionados(e.target.checked ? new Set(aprovaveis.map((l) => l.contratoId)) : new Set())}
                        />
                      </TableHead>
                    )}
                    <TableHead>Contrato</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Material — pedido</TableHead>
                    <TableHead className="text-right">Material — limite</TableHead>
                    <TableHead className="text-right">% do limite</TableHead>
                    <TableHead className="text-right">Uniforme/EPI/crachá</TableHead>
                    <TableHead className="text-right">Média 6 meses</TableHead>
                    <TableHead className="text-right">Média 12 meses</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((l) => (
                    <TableRow key={l.contratoId} className={`hover:bg-accent/40 ${l.excedeu || l.ceu.excedeu ? 'bg-red-50/70 dark:bg-red-950/20' : ''}`}>
                      {podeAprovar && (
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${l.nome}`}
                            disabled={!l.aprovavel}
                            checked={selecionados.has(l.contratoId)}
                            onChange={() => alternar(l.contratoId)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <p className="font-medium">{l.nome}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {l.excedeu && <Selo tom="vermelho">material acima do limite</Selo>}
                          {l.ceu.excedeu && <Selo tom="vermelho">uniforme/EPI/crachá acima do limite</Selo>}
                          {l.preenchidoPeloEscritorio && <Selo tom="cinza">preenchido pelo escritório</Selo>}
                          {l.pedidoImplantacaoIds.length > 0 && (
                            <Selo tom="roxo" title="Pedido de implantação de contrato: abertura do posto, fora da média e do limite">
                              Implantação
                            </Selo>
                          )}
                          {l.extrasPendentes > 0 && (
                            <Selo tom="azul">
                              {l.extrasPendentes} extra{l.extrasPendentes === 1 ? '' : 's'} pendente{l.extrasPendentes === 1 ? '' : 's'}
                            </Selo>
                          )}
                          {l.excecoes > 0 && <Selo>{l.excecoes} exceç{l.excecoes === 1 ? 'ão' : 'ões'}</Selo>}
                          {l.semPreco > 0 && <Selo tom="cinza">{l.semPreco} sem preço</Selo>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.status.length === 0 ? (
                          <span className="text-xs text-muted-foreground">sem pedido</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(l.status)].map((s) => (
                              <StatusProdutosBadge key={s} status={s} />
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${l.excedeu ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>
                        {mascaraMoeda(l.valorPedido)}
                        {l.valorKit > 0 && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            kit {mascaraMoeda(l.valorKit)} · extra {mascaraMoeda(l.valorExtras)}
                          </span>
                        )}
                        {l.valorImplantacao > 0 && (
                          <span className="block text-xs font-normal text-violet-700 dark:text-violet-300">
                            + implantação {mascaraMoeda(l.valorImplantacao)} (fora do limite)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.limite > 0 || l.limiteManual ? mascaraMoeda(l.limite) : '—'}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {l.limiteManual
                            ? `definido pelo gestor · calculado ${mascaraMoeda(l.limiteCalculado)}`
                            : l.limite > 0
                              ? 'calculado pelo kit'
                              : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.percentual != null ? `${Math.round(l.percentual * 100)}%` : '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${l.ceu.excedeu ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>
                        {l.ceu.temLinhas || l.ceu.limite != null ? mascaraMoeda(l.ceu.valor) : '—'}
                        {l.ceu.limite != null ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            limite {mascaraMoeda(l.ceu.limite)}
                            {l.ceu.percentual != null ? ` · ${Math.round(l.ceu.percentual * 100)}%` : ''}
                          </span>
                        ) : (
                          l.ceu.temLinhas && <span className="block text-xs font-normal text-muted-foreground">sem limite definido</span>
                        )}
                        {l.ceu.valorImplantacao > 0 && (
                          <span className="block text-xs font-normal text-violet-700 dark:text-violet-300">
                            + implantação {mascaraMoeda(l.ceu.valorImplantacao)} (fora do limite)
                          </span>
                        )}
                        {avisosOrcamentoCeu(l.ceu).map((a) => (
                          <span key={a} className="block text-xs font-normal text-amber-700 dark:text-amber-400">
                            {a}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{mascaraMoeda(l.media6)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{mascaraMoeda(l.media12)}</TableCell>
                      <TableCell className="text-right">
                        {l.pedidoMensalId && (
                          <Link to={`/materiais/pedidos/${l.pedidoMensalId}`} className="text-sm text-primary underline">
                            {l.aprovavel && podeAprovar ? 'Ajustar item a item' : 'Ver pedido'}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        icon={<Check className="size-6 text-emerald-600" />}
        iconClassName="bg-emerald-50"
        title="Aprovar pedidos selecionados?"
        description={`${selecionados.size} contrato(s): os pedidos validados de ${rotuloCompetencia(competencia)} serão aprovados pela quantidade validada (o kit já aprovado não muda). Pedidos ainda com o inspetor ficam de fora.`}
        confirmLabel="Aprovar"
        onConfirm={aprovar}
      />

      <ConfirmDialog
        open={confirmarConfig != null}
        onOpenChange={(a) => !a && setConfirmarConfig(null)}
        icon={<Check className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title={confirmarConfig ? 'Ligar a aprovação automática do kit?' : 'Desligar a aprovação automática do kit?'}
        description={
          confirmarConfig
            ? 'Os próximos envios dos líderes terão o kit do mês aprovado na hora; só o pedido extra passa pelo inspetor e pela aprovação. Pedidos já enviados não mudam.'
            : 'Os próximos envios voltam a passar inteiros pela aprovação (kit e extra). Pedidos já enviados não mudam.'
        }
        confirmLabel={salvandoConfig ? 'Salvando…' : confirmarConfig ? 'Ligar' : 'Desligar'}
        confirmDisabled={salvandoConfig}
        onConfirm={salvarConfig}
      />
    </MateriaisShell>
  )
}

function Resumo({ titulo, valor, alerta = false }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${alerta ? 'text-red-700 dark:text-red-400' : ''}`}>{valor}</p>
    </div>
  )
}
