import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { Selo } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { useMateriaisPedidos } from '@/hooks/useMateriaisPedidos'
import { formatarDataHora } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { ordemRota, rotaEfetiva, textoRota } from '@/lib/materiais/pedidos'
import { temExcecao } from '@/lib/materiais/filas'

// Fila do inspetor (docs/PLANO_MATERIAIS_FASE1.md §5.1): só pedidos com
// pedido extra/exceção (em_validacao), por rota. Desde 16/10/2026 (migration
// 135) o kit do mês confirmado pelo líder não passa por aqui (com a
// configuração ligada já sai aprovado) — o inspetor valida só os extras.

export function MateriaisValidacaoPage() {
  const { pedidos, itens, loading, estruturaPendente, carregar } = useMateriaisPedidos()
  const contratosHook = useMateriaisContratos()
  const { carregar: carregarContratos } = contratosHook

  useEffect(() => {
    carregar({ emValidacao: true })
    carregarContratos()
  }, [carregar, carregarContratos])

  const contratoPorId = useMemo(() => new Map(contratosHook.contratos.map((c) => [c.id, c])), [contratosHook.contratos])

  const linhas = useMemo(
    () =>
      pedidos
        .map((p) => {
          const doPedido = itens.filter((l) => l.pedido_id === p.id)
          const c = contratoPorId.get(p.contrato_id)
          return {
            p,
            c,
            rota: c ? rotaEfetiva(p, c) : p.rota_override,
            excecoes: doPedido.filter(temExcecao).length,
            repeticoes: doPedido.filter((l) => l.possivel_repeticao).length,
            outros: doPedido.filter((l) => !l.item_id).length,
          }
        })
        .sort((a, b) => ordemRota(a.rota) - ordemRota(b.rota) || (a.c?.nome ?? '').localeCompare(b.c?.nome ?? '', 'pt-BR')),
    [pedidos, itens, contratoPorId]
  )

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Validação"
        description="Pedidos com pedido extra (a mais do kit, fora do kit, outros materiais) ou repetição aguardando o inspetor. O kit do mês não passa por aqui. Uniforme, EPI e crachá são conferidos na aba CEU → Pedidos."
      />
      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            <Link to="/ceu/pedidos" className="font-medium text-primary underline">
              Conferir uniforme, EPI e crachá no CEU → Pedidos
            </Link>
          </p>
          <DataTable title="Aguardando validação" count={linhas.length}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : linhas.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nada para validar" description="Nenhum pedido extra aguardando o inspetor." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Pedido extra</TableHead>
                    <TableHead>Último envio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map(({ p, c, rota, excecoes, repeticoes, outros }) => (
                    <TableRow key={p.id} className="hover:bg-accent/40">
                      <TableCell className="tabular-nums">{textoRota(rota)}</TableCell>
                      <TableCell>
                        <Link to={`/materiais/pedidos/${p.id}`} className="font-medium text-primary hover:underline">
                          {c?.nome ?? 'Contrato'}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c ? nomeCurtoDepartamentoFuzzy(contratosHook.departamentos, c.departamento_id) : ''}
                          {p.tipo === 'extra' ? ' · extra' : ''}
                        </p>
                        {p.implantacao && (
                          <span className="mt-0.5 inline-block">
                            <Selo tom="roxo">Implantação</Selo>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{rotuloCompetencia(p.competencia)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {excecoes > 0 && <Selo>{excecoes} exceç{excecoes === 1 ? 'ão' : 'ões'}</Selo>}
                          {outros > 0 && <Selo>outros materiais</Selo>}
                          {repeticoes > 0 && <Selo tom="vermelho">repetição</Selo>}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {p.enviado_em ? formatarDataHora(p.enviado_em) : '—'}
                        {p.responsavel_nome && <span className="block text-xs text-muted-foreground">{p.responsavel_nome}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}
    </MateriaisShell>
  )
}
