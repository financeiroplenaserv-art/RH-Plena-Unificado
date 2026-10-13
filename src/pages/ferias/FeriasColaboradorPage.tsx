import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bell, CalendarDays, CalendarPlus, User, UserCheck } from 'lucide-react'
import { formatarData, hojeBrasil } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useFerias } from '@/hooks/useFerias'
import { supabase } from '@/lib/supabase'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import { resumirFerias, listarAquisitivos } from '@/lib/ferias/calculoFerias'
import type { Colaborador, FeriasNotificacao } from '@/types/database'
import type {
  FeriasAlocacaoComSolicitacao,
  FeriasFerista,
  FeriasSolicitacao,
  OrigemSolicitacaoFerias,
  StatusAlocacaoFerias,
  StatusSolicitacaoFerias,
  TipoFerias,
} from '@/types/ferias'
import { FeriasShell } from './FeriasShell'
import { ProgramarFeriasDialog } from './ProgramarFeriasDialog'

const ROTULO_TIPO: Record<TipoFerias, string> = { gozo: 'Gozo', agendado: 'Agendado', previsto: 'Previsto' }

const ROTULO_STATUS: Record<StatusSolicitacaoFerias, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const VARIANTE_STATUS: Record<StatusSolicitacaoFerias, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  aprovada: 'info',
  em_andamento: 'info',
  concluida: 'success',
  cancelada: 'neutral',
}

const ROTULO_ORIGEM: Record<OrigemSolicitacaoFerias, string> = { flit: 'Flit', manual: 'Manual', econtador: 'e-Contador' }

const ROTULO_STATUS_ALOCACAO: Record<StatusAlocacaoFerias, string> = {
  sugerida: 'Sugerida',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
}

const VARIANTE_STATUS_ALOCACAO: Record<StatusAlocacaoFerias, 'success' | 'warning' | 'neutral'> = {
  sugerida: 'warning',
  confirmada: 'success',
  cancelada: 'neutral',
}

function condicoes(s: FeriasSolicitacao): string {
  const partes: string[] = []
  if (s.dias_abono > 0) partes.push(`Abono ${s.dias_abono}d`)
  if (s.adiantamento_13) partes.push('13º')
  if (s.parcelada) partes.push('Parcelada')
  return partes.length > 0 ? partes.join(' · ') : '—'
}

export function FeriasColaboradorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const podeGerenciar = user?.nivel_acesso ? podeGerenciarFerias(user.nivel_acesso) : false

  const { listarSolicitacoes, listarNotificacoes, listarFuncoes, buscarFerista, listarAlocacoesFerista } = useFerias()

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [solicitacoes, setSolicitacoes] = useState<FeriasSolicitacao[]>([])
  const [notificacoes, setNotificacoes] = useState<FeriasNotificacao[]>([])
  const [ferista, setFerista] = useState<FeriasFerista | null>(null)
  const [alocacoes, setAlocacoes] = useState<FeriasAlocacaoComSolicitacao[]>([])
  const [funcaoNome, setFuncaoNome] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modalProgramar, setModalProgramar] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    // Lista completa de departamentos (sem filtro de nome_curto) para a
    // resolução fuzzy — useDepartamentos.listar() não serve (ver AGENTS.md §11).
    const [{ data: dadosColaborador, error: erroColaborador }, { data: deptData }, listaSolicitacoes, listaNotificacoes, funcoes, registroFerista] =
      await Promise.all([
        supabase
          .from('colaboradores')
          .select('id, matricula, nome_completo, status, cargo, departamento, departamento_id, empresa_id, data_admissao')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
        listarSolicitacoes(),
        listarNotificacoes(),
        listarFuncoes(),
        buscarFerista(id),
      ])
    if (erroColaborador) console.error('Erro ao carregar colaborador:', erroColaborador)
    setColaborador((dadosColaborador as Colaborador | null) ?? null)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])
    setSolicitacoes(listaSolicitacoes.filter((s) => s.colaborador_id === id))
    setNotificacoes(listaNotificacoes.filter((n) => n.colaborador_id === id))
    setFerista(registroFerista)
    setFuncaoNome(resolverFuncao((dadosColaborador as Colaborador | null)?.cargo, funcoes)?.nome ?? null)
    if (registroFerista) {
      setAlocacoes(await listarAlocacoesFerista(registroFerista.id))
    } else {
      setAlocacoes([])
    }
    setCarregando(false)
  }, [id, listarSolicitacoes, listarNotificacoes, listarFuncoes, buscarFerista, listarAlocacoesFerista])

  useEffect(() => {
    carregar()
  }, [carregar])

  const resumo = useMemo(() => {
    if (!colaborador) return null
    return resumirFerias(
      colaborador.data_admissao,
      solicitacoes.map((s) => ({ tipo: s.tipo, data_inicio: s.data_inicio, data_fim: s.data_fim, status: s.status }))
    )
  }, [colaborador, solicitacoes])

  const aquisitivos = useMemo(() => {
    if (!colaborador) return []
    const gozos = solicitacoes
      .filter((s) => s.tipo === 'gozo' && s.status !== 'cancelada')
      .map((s) => ({ inicio: s.data_inicio, fim: s.data_fim }))
    return listarAquisitivos(colaborador.data_admissao, gozos)
  }, [colaborador, solicitacoes])

  const departamentoExibido = colaborador
    ? nomeCurtoDepartamentoFuzzy(departamentos, colaborador.departamento_id, colaborador.departamento, colaborador.empresa_id)
    : '—'

  const historico = useMemo(
    () => [...solicitacoes].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio)),
    [solicitacoes]
  )

  const hojeISO = hojeBrasil()

  return (
    <FeriasShell>
      <PageHeader backTo="/ferias" title={colaborador?.nome_completo ?? 'Ficha de férias'}>
        {podeGerenciar && colaborador && (
          <Button variant="primary" size="sm" onClick={() => setModalProgramar(true)}>
            <CalendarPlus className="size-4" />
            Programar férias
          </Button>
        )}
      </PageHeader>

      {carregando && !colaborador ? (
        <p className="text-[13px] text-muted-foreground">Carregando...</p>
      ) : !colaborador ? (
        <EmptyState
          icon={<User className="size-6" />}
          title="Colaborador não encontrado"
          description="Verifique se o cadastro existe e tente novamente."
        />
      ) : (
        <>
          <section className="mb-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                <User className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">{colaborador.nome_completo}</p>
                <p className="text-[13px] text-muted-foreground">
                  Matrícula {colaborador.matricula} · {departamentoExibido}
                  {colaborador.cargo ? ` · ${colaborador.cargo}` : ''}
                  {funcaoNome ? ` (função: ${funcaoNome})` : ''}
                  {colaborador.data_admissao ? ` · admissão ${formatarData(colaborador.data_admissao)}` : ''}
                </p>
              </div>
              {resumo && (
                <StatusBadge
                  variant={
                    resumo.situacao === 'Vencido'
                      ? 'danger'
                      : resumo.situacao === 'A vencer'
                        ? 'warning'
                        : resumo.situacao === 'Em dia'
                          ? 'success'
                          : resumo.situacao === 'Em gozo' || resumo.situacao === 'Agendado'
                            ? 'info'
                            : 'neutral'
                  }
                >
                  {resumo.situacao}
                </StatusBadge>
              )}
              {ferista && (
                <StatusBadge variant="info">
                  Ferista{ferista.ativo ? '' : ' (inativo)'}
                </StatusBadge>
              )}
            </div>
          </section>

          <DataTable title="Períodos aquisitivos" count={aquisitivos.length} className="mb-4">
            {aquisitivos.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="Sem data de admissão"
                description="Cadastre a data de admissão do colaborador para calcular os períodos aquisitivos."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período aquisitivo</TableHead>
                    <TableHead>Limite concessivo</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aquisitivos.map((a) => (
                    <TableRow key={a.inicio}>
                      <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatarData(a.inicio)} a {formatarData(a.fim)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{formatarData(a.limiteConcessivo)}</TableCell>
                      <TableCell>
                        {a.atual ? (
                          <StatusBadge variant="info">Atual</StatusBadge>
                        ) : a.coberto ? (
                          <StatusBadge variant="success">Coberto</StatusBadge>
                        ) : a.limiteConcessivo < hojeISO ? (
                          <StatusBadge variant="danger">Limite vencido</StatusBadge>
                        ) : (
                          <StatusBadge variant="neutral">Em aberto</StatusBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>

          <DataTable title="Solicitações de férias" count={historico.length} className="mb-4">
            {historico.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="Nenhuma solicitação registrada"
                description="Programe as férias pelo botão acima ou importe a planilha do Flit."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condições</TableHead>
                    <TableHead>Ferista alocado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">{ROTULO_TIPO[s.tipo]}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatarData(s.data_inicio)} a {formatarData(s.data_fim)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={VARIANTE_STATUS[s.status]}>{ROTULO_STATUS[s.status]}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{condicoes(s)}</TableCell>
                      <TableCell className="text-muted-foreground">{s.ferista?.nome_completo ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{ROTULO_ORIGEM[s.origem]}</TableCell>
                      <TableCell className="text-muted-foreground">{s.observacao ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>

          {ferista && (
            <DataTable title="Coberturas como ferista" count={alocacoes.length} className="mb-4">
              {alocacoes.length === 0 ? (
                <EmptyState
                  icon={<UserCheck className="size-6" />}
                  title="Nenhuma cobertura registrada"
                  description="As alocações de cobertura deste ferista aparecerão aqui."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cobrindo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alocacoes.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-foreground">
                          {a.solicitacao?.colaborador ? (
                            <Link to={`/ferias/colaborador/${a.solicitacao.colaborador.id}`} className="text-primary hover:underline">
                              {a.solicitacao.colaborador.nome_completo}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                          {formatarData(a.data_inicio)} a {formatarData(a.data_fim)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={VARIANTE_STATUS_ALOCACAO[a.status]}>
                            {ROTULO_STATUS_ALOCACAO[a.status]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.origem === 'automatica' ? 'Automática' : 'Manual'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.motivo ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          )}

          <DataTable title="Notificações de férias" count={notificacoes.length}>
            {notificacoes.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-6" />}
                title="Nenhuma notificação registrada"
                description="Os avisos de férias enviados aparecerão aqui."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificacoes.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatarData(n.data_notificacao)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={n.destinatario === 'colaborador' ? 'info' : 'warning'}>
                          {n.destinatario === 'colaborador' ? 'Colaborador' : 'Responsável contrato'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{n.observacao ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>

          <ProgramarFeriasDialog
            open={modalProgramar}
            onOpenChange={setModalProgramar}
            colaboradorInicial={colaborador}
            onSalvo={carregar}
          />
        </>
      )}
    </FeriasShell>
  )
}
