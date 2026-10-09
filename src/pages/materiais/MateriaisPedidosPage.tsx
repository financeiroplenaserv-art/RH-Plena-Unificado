import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Plus } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { SeletorMes, Selo, StatusCeuBadge, StatusProdutosBadge } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { PedidoExtraDialog } from '@/components/materiais/PedidoExtraDialog'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { useMateriaisPedidos, useMateriaisSemPedido } from '@/hooks/useMateriaisPedidos'
import { podeCriarPedidoExtraMateriais, podeVerSemPedidoMateriais } from '@/lib/permissoes'
import { hojeBrasil, mascaraMoeda } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { janelaPedido } from '@/lib/materiais/datas'
import { qtdEfetiva, temExcecao } from '@/lib/materiais/filas'
import { rotaEfetiva } from '@/lib/materiais/pedidos'
import { competenciaDoMes } from '@/lib/materiais/painel'

// Lista do mês (docs/PLANO_MATERIAIS_FASE1.md §5.1): todos os pedidos da
// competência com o status das duas filas, valor e exceções.

interface FiltroPedidos {
  situacao: 'todos' | 'em_validacao' | 'validado' | 'ceu_aberto'
  contrato: string
}
const FILTRO_PADRAO: FiltroPedidos = { situacao: 'todos', contrato: 'todos' }

export function MateriaisPedidosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nivel = user?.nivel_acesso
  const podeExtra = nivel ? podeCriarPedidoExtraMateriais(nivel) : false
  const podeSemPedido = nivel ? podeVerSemPedidoMateriais(nivel) : false

  const [mes, setMes] = useFiltroPersistente<string>('materiais.pedidos.mes', hojeBrasil().slice(0, 7))
  const [filtro, setFiltro] = useFiltroPersistente<FiltroPedidos>('materiais.pedidos.filtro', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroPedidos>(filtro)
  const [extraAberto, setExtraAberto] = useState(false)

  const { pedidos, itens, ceuItens, loading, estruturaPendente, carregar } = useMateriaisPedidos()
  const contratosHook = useMateriaisContratos()
  const semPedido = useMateriaisSemPedido()
  const competencia = competenciaDoMes(mes)

  const { carregar: carregarContratos } = contratosHook
  const { carregar: carregarSemPedido } = semPedido
  useEffect(() => {
    carregarContratos()
  }, [carregarContratos])
  useEffect(() => {
    carregar({ competencia })
    if (podeSemPedido) carregarSemPedido(competencia)
  }, [carregar, carregarSemPedido, competencia, podeSemPedido])

  const contratoPorId = useMemo(() => new Map(contratosHook.contratos.map((c) => [c.id, c])), [contratosHook.contratos])

  const resumo = useMemo(() => {
    const m = new Map<string, { valor: number; excecoes: number; repeticoes: number; ceu: number; ceuAbertas: number }>()
    for (const p of pedidos) m.set(p.id, { valor: 0, excecoes: 0, repeticoes: 0, ceu: 0, ceuAbertas: 0 })
    for (const l of itens) {
      const r = m.get(l.pedido_id)
      if (!r) continue
      r.valor += qtdEfetiva(l) * (l.preco_unitario ?? 0)
      if (temExcecao(l)) r.excecoes++
      if (l.possivel_repeticao) r.repeticoes++
    }
    for (const l of ceuItens) {
      const r = m.get(l.pedido_id)
      if (!r) continue
      r.ceu++
      if (l.status !== 'atendido' && l.status !== 'cancelado') r.ceuAbertas++
    }
    return m
  }, [pedidos, itens, ceuItens])

  const lista = useMemo(
    () =>
      pedidos
        .filter((p) => filtro.contrato === 'todos' || p.contrato_id === filtro.contrato)
        .filter((p) => {
          if (filtro.situacao === 'todos') return true
          if (filtro.situacao === 'ceu_aberto') return (resumo.get(p.id)?.ceuAbertas ?? 0) > 0
          return p.status_produtos === filtro.situacao
        })
        .sort((a, b) => (contratoPorId.get(a.contrato_id)?.nome ?? '').localeCompare(contratoPorId.get(b.contrato_id)?.nome ?? '', 'pt-BR')),
    [pedidos, filtro, resumo, contratoPorId]
  )

  const filtrosAtivos = (filtro.situacao !== FILTRO_PADRAO.situacao ? 1 : 0) + (filtro.contrato !== FILTRO_PADRAO.contrato ? 1 : 0)
  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const janela = janelaPedido({ diaLimite: semPedido.config.dia_limite, diaAviso: semPedido.config.dia_aviso })
  const mostrarAvisoSemPedido = podeSemPedido && competencia === janela.competencia && janela.nivelAviso !== 'normal' && semPedido.lista.length > 0

  return (
    <MateriaisShell>
      <PageHeader showBackButton={false} title="Pedidos do mês" description="Pedidos de produtos, uniformes, EPI e crachás de cada contrato.">
        {podeExtra && (
          <Button onClick={() => setExtraAberto(true)}>
            <Plus className="size-4" /> Pedido extra
          </Button>
        )}
      </PageHeader>

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          {mostrarAvisoSemPedido && (
            <div
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${
                janela.nivelAviso === 'vermelho'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              }`}
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span className="flex-1">
                {semPedido.lista.length === 1 ? '1 contrato ainda não pediu' : `${semPedido.lista.length} contratos ainda não pediram`}
                {janela.nivelAviso === 'vermelho' ? ' — o prazo terminou.' : ` — prazo até ${janela.prazo.slice(8, 10)}/${janela.prazo.slice(5, 7)}.`}
              </span>
              <Link to="/materiais/sem-pedido" className="font-medium underline">
                Ver contratos
              </Link>
            </div>
          )}

          <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <SeletorMes id="ped-mes" valor={mes} onChange={setMes} />
            <div className="space-y-1.5">
              <Label htmlFor="ped-situacao">Situação</Label>
              <select
                id="ped-situacao"
                className={CLASSE_SELECT}
                value={rascunho.situacao}
                onChange={(e) => setRascunho((r) => ({ ...r, situacao: e.target.value as FiltroPedidos['situacao'] }))}
              >
                <option value="todos">Todos</option>
                <option value="em_validacao">Produtos com o inspetor</option>
                <option value="validado">Produtos aguardando o gestor</option>
                <option value="ceu_aberto">Uniforme/EPI em aberto</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ped-contrato">Contrato</Label>
              <select
                id="ped-contrato"
                className={CLASSE_SELECT}
                value={rascunho.contrato}
                onChange={(e) => setRascunho((r) => ({ ...r, contrato: e.target.value }))}
              >
                <option value="todos">Todos</option>
                {contratosHook.contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </Filters>

          <DataTable title={`Pedidos de ${rotuloCompetencia(competencia)}`} count={lista.length} minWidth={900}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState icon={<ClipboardList className="size-6" />} title="Nenhum pedido" description="Não há pedidos neste mês com esses filtros." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Uniforme / EPI / crachá</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((p) => {
                    const c = contratoPorId.get(p.contrato_id)
                    const r = resumo.get(p.id)
                    const rota = c ? rotaEfetiva(p, c) : p.rota_override
                    return (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`/materiais/pedidos/${p.id}`)}>
                        <TableCell>
                          <Link to={`/materiais/pedidos/${p.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {c?.nome ?? 'Contrato'}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted-foreground">
                            {c && <span>{nomeCurtoDepartamentoFuzzy(contratosHook.departamentos, c.departamento_id)}</span>}
                            {p.tipo === 'extra' && <Selo tom="azul">extra</Selo>}
                            {p.preenchido_pelo_escritorio && <Selo tom="cinza">preenchido pelo escritório</Selo>}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {rota ?? '—'}
                          {p.rota_override && (
                            <span className="ml-1">
                              <Selo tom="azul" title={p.rota_override_motivo ?? undefined}>
                                rota do dia
                              </Selo>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusProdutosBadge status={p.status_produtos} />
                            {(r?.excecoes ?? 0) > 0 && <Selo>{r!.excecoes} exceç{r!.excecoes === 1 ? 'ão' : 'ões'}</Selo>}
                            {(r?.repeticoes ?? 0) > 0 && <Selo tom="vermelho">repetição</Selo>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r && r.valor > 0 ? mascaraMoeda(r.valor) : '—'}</TableCell>
                        <TableCell>
                          {p.status_ceu === 'nao_se_aplica' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <StatusCeuBadge status={p.status_ceu} />
                              <span className="text-xs text-muted-foreground tabular-nums">{r?.ceu ?? 0} linha(s)</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{p.responsavel_nome ?? '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      {podeExtra && user && (
        <PedidoExtraDialog
          open={extraAberto}
          onOpenChange={setExtraAberto}
          userId={user.id}
          onCriado={(id) => {
            setExtraAberto(false)
            navigate(`/materiais/pedidos/${id}`)
          }}
        />
      )}
    </MateriaisShell>
  )
}
