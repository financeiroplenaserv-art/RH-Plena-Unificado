import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ClipboardList, X } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { useMateriaisAlteracoesKit } from '@/hooks/useMateriaisKit'
import { podeDecidirAlteracaoKit } from '@/lib/permissoes'
import { formatarDataDeTimestamp } from '@/lib/utils'
import type { MatKitAlteracao, StatusAlteracaoKit } from '@/types/materiais'

interface FiltroAlteracoes {
  status: 'todos' | StatusAlteracaoKit
  contrato: string
}

const FILTRO_PADRAO: FiltroAlteracoes = { status: 'pendente', contrato: 'todos' }

const ROTULO_STATUS: Record<StatusAlteracaoKit, { texto: string; variante: 'warning' | 'success' | 'danger' }> = {
  pendente: { texto: 'Pendente', variante: 'warning' },
  aprovada: { texto: 'Aprovada', variante: 'success' },
  rejeitada: { texto: 'Rejeitada', variante: 'danger' },
}

export function MateriaisAlteracoesKitPage() {
  const { user } = useAuth()
  const podeDecidir = user ? podeDecidirAlteracaoKit(user.nivel_acesso) : false
  const { alteracoes, loading, estruturaPendente, carregar, decidir } = useMateriaisAlteracoesKit()
  const contratosHook = useMateriaisContratos()
  const catalogo = useMateriaisCatalogo()

  const [filtro, setFiltro] = useFiltroPersistente<FiltroAlteracoes>('materiais.alteracoesKit', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroAlteracoes>(filtro)
  const [decisao, setDecisao] = useState<{ alteracao: MatKitAlteracao; aprovar: boolean } | null>(null)
  const [comentario, setComentario] = useState('')

  const { carregar: carregarContratos } = contratosHook
  const { carregar: carregarCatalogo } = catalogo
  useEffect(() => {
    carregarContratos()
    carregarCatalogo()
  }, [carregarContratos, carregarCatalogo])

  useEffect(() => {
    carregar(filtro.status)
  }, [carregar, filtro.status])

  const nomeContrato = useMemo(() => new Map(contratosHook.contratos.map((c) => [c.id, c.nome])), [contratosHook.contratos])
  const nomeItem = useMemo(() => new Map(catalogo.itens.map((i) => [i.id, i.nome])), [catalogo.itens])
  const nomeVariacao = useMemo(() => new Map(catalogo.variacoes.map((v) => [v.id, v.rotulo])), [catalogo.variacoes])

  const lista = useMemo(
    () => alteracoes.filter((a) => filtro.contrato === 'todos' || a.contrato_id === filtro.contrato),
    [alteracoes, filtro.contrato]
  )
  const filtrosAtivos = (filtro.status !== FILTRO_PADRAO.status ? 1 : 0) + (filtro.contrato !== FILTRO_PADRAO.contrato ? 1 : 0)
  const pendentes = estruturaPendente || contratosHook.estruturaPendente || catalogo.estruturaPendente

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }

  const confirmar = async () => {
    if (!decisao) return
    const ok = await decidir(decisao.alteracao.id, decisao.aprovar, comentario.trim() || null)
    setDecisao(null)
    setComentario('')
    if (ok) carregar(filtro.status)
  }

  const descreverItem = (a: MatKitAlteracao) =>
    `${nomeItem.get(a.item_id) ?? 'Item'}${a.variacao_id ? ` (${nomeVariacao.get(a.variacao_id) ?? '—'})` : ''}`

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Alterações de kit"
        description="Pedidos da mesa e da inspetoria para mudar o Kit Mensal. Só valem depois da decisão do gestor."
      />

      {pendentes ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para pedir uma alteração, abra o <Link to="/materiais/kit" className="text-primary underline">Kit Mensal</Link> do contrato e use
            "Solicitar alteração".
          </p>
          <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={loading}>
            <div className="space-y-1.5">
              <Label htmlFor="alt-status">Situação</Label>
              <select
                id="alt-status"
                className={CLASSE_SELECT}
                value={rascunho.status}
                onChange={(e) => setRascunho((r) => ({ ...r, status: e.target.value as FiltroAlteracoes['status'] }))}
              >
                <option value="pendente">Pendentes</option>
                <option value="aprovada">Aprovadas</option>
                <option value="rejeitada">Rejeitadas</option>
                <option value="todos">Todas</option>
              </select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="alt-contrato">Contrato</Label>
              <select
                id="alt-contrato"
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

          <DataTable title="Solicitações" count={lista.length}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState icon={<ClipboardList className="size-6" />} title="Nenhuma solicitação" description="Não há solicitações com esses filtros." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedida em</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Nova qtd./mês</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Situação</TableHead>
                    {podeDecidir && <TableHead className="w-48" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((a) => (
                    <TableRow key={a.id} className="hover:bg-accent/40">
                      <TableCell className="tabular-nums">{a.solicitado_em ? formatarDataDeTimestamp(a.solicitado_em) : '—'}</TableCell>
                      <TableCell>{nomeContrato.get(a.contrato_id) ?? '—'}</TableCell>
                      <TableCell>{descreverItem(a)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.quantidade_nova === 0 ? <span className="text-red-700">retirar</span> : a.quantidade_nova.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {a.motivo}
                        {a.comentario_decisao && <span className="block text-xs text-muted-foreground">Gestor: {a.comentario_decisao}</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={ROTULO_STATUS[a.status].variante}>{ROTULO_STATUS[a.status].texto}</StatusBadge>
                      </TableCell>
                      {podeDecidir && (
                        <TableCell>
                          {a.status === 'pendente' && (
                            <div className="flex justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => setDecisao({ alteracao: a, aprovar: false })}>
                                <X className="size-4" /> Rejeitar
                              </Button>
                              <Button size="sm" onClick={() => setDecisao({ alteracao: a, aprovar: true })}>
                                <Check className="size-4" /> Aprovar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      <ConfirmDialog
        open={!!decisao}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setDecisao(null)
            setComentario('')
          }
        }}
        icon={decisao?.aprovar ? <Check className="size-6 text-emerald-600" /> : <X className="size-6 text-red-600" />}
        iconClassName={decisao?.aprovar ? 'bg-emerald-50' : 'bg-red-50'}
        title={decisao?.aprovar ? 'Aprovar alteração?' : 'Rejeitar alteração?'}
        description={
          decisao
            ? `${nomeContrato.get(decisao.alteracao.contrato_id) ?? 'Contrato'} — ${descreverItem(decisao.alteracao)}: ${
                decisao.alteracao.quantidade_nova === 0 ? 'retirar do kit' : `${decisao.alteracao.quantidade_nova.toLocaleString('pt-BR')} por mês`
              }.${decisao.aprovar ? ' O kit é atualizado na hora.' : ''}`
            : ''
        }
        confirmLabel={decisao?.aprovar ? 'Aprovar' : 'Rejeitar'}
        destructive={!decisao?.aprovar}
        onConfirm={confirmar}
      >
        <div className="space-y-1.5">
          <Label htmlFor="alt-comentario">Comentário (opcional)</Label>
          <Textarea id="alt-comentario" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>
      </ConfirmDialog>
    </MateriaisShell>
  )
}
