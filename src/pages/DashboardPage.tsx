import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  AlertCircle,
  ArrowRight,
  CalendarHeart,
  CalendarDays,
  UserCheck,
  Cake,
  Bell,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'

interface AlertaModulo {
  id: string
  modulo: string
  tipo: string
  descricao: string
  severidade: 'critica' | 'alta' | 'media' | 'baixa'
  link: string
}

interface ColaboradorResumido {
  id: string
  nome_completo: string
  data_admissao: string | null
  data_nascimento: string | null
  cargo: string | null
  departamento: string | null
}

type MarcoExperiencia = 30 | 60 | 90

function diasAte(dataStr: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataStr)
  data.setHours(0, 0, 0, 0)
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function diasDesde(dataStr: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataStr)
  data.setHours(0, 0, 0, 0)
  return Math.floor((hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24))
}

function normalizarData(dataStr: string | null | undefined): Date | null {
  if (!dataStr) return null
  const d = new Date(dataStr + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatarDiaMes(data: Date | string | null | undefined): string {
  const d = typeof data === 'string' ? normalizarData(data) : data
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function saudacao(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatarDataCompleta(data: Date): string {
  const opcoes: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return data.toLocaleDateString('pt-BR', opcoes)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [carregando, setCarregando] = useState(true)

  const [totalColaboradores, setTotalColaboradores] = useState(0)
  const [ativos, setAtivos] = useState(0)
  const [ocorrenciasPendentes, setOcorrenciasPendentes] = useState(0)
  const [alertas, setAlertas] = useState<AlertaModulo[]>([])
  const [colaboradoresAtivos, setColaboradoresAtivos] = useState<ColaboradorResumido[]>([])

  useEffect(() => {
    async function carregarKpis() {
      setCarregando(true)

      try {
        const [
          { count: total },
          { count: ativosCount },
          { count: pendentesCount },
          { count: alertasCount },
          { data: itensCEU },
          { data: ativosCompletos },
        ] = await Promise.all([
          supabase.from('colaboradores').select('id', { count: 'exact', head: true }),
          supabase.from('colaboradores').select('id', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('status', 'Pendente'),
          supabase
            .from('alertas')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'ativo')
            .in('severidade', ['critica', 'alta']),
          supabase.from('itens').select('estoque, estoque_minimo, ca, validade'),
          supabase
            .from('colaboradores')
            .select('id, nome_completo, data_admissao, data_nascimento, cargo, departamento')
            .eq('status', 'Ativo')
            .order('nome_completo'),
        ])

        const pendentes = pendentesCount || 0

        const itens = (itensCEU || []) as { id: string; nome: string; tipo: string; ca: string | null; validade: string | null; estoque: number | null; estoque_minimo: number | null }[]

        const estoqueBaixo = itens.filter(
          (item) =>
            typeof item.estoque === 'number' &&
            typeof item.estoque_minimo === 'number' &&
            item.estoque_minimo > 0 &&
            item.estoque <= item.estoque_minimo
        ).length

        const caVencendo = itens.filter((item) => {
          if (!item.ca || !item.validade) return false
          const dias = diasAte(item.validade)
          return dias >= 0 && dias <= 30
        }).length

        setTotalColaboradores(total || 0)
        setAtivos(ativosCount || 0)
        setOcorrenciasPendentes(pendentes)
        setColaboradoresAtivos((ativosCompletos || []) as ColaboradorResumido[])

        const listaAlertas: AlertaModulo[] = []
        if (pendentes > 0) {
          listaAlertas.push({
            id: 'rh-pendentes',
            modulo: 'RH',
            tipo: 'Ocorrências pendentes',
            descricao: `${pendentes} ocorrência(s) aguardando análise`,
            severidade: 'alta',
            link: '/rh/ocorrencias',
          })
        }
        if ((alertasCount || 0) > 0) {
          listaAlertas.push({
            id: 'alertas-criticos',
            modulo: 'Alertas',
            tipo: 'Alertas críticos',
            descricao: `${alertasCount} alerta(s) crítico(s) ativo(s)`,
            severidade: 'critica',
            link: '/rh/alertas',
          })
        }
        if (estoqueBaixo > 0) {
          listaAlertas.push({
            id: 'ceu-estoque',
            modulo: 'CEU',
            tipo: 'Estoque baixo',
            descricao: `${estoqueBaixo} item(ns) com estoque abaixo do mínimo`,
            severidade: 'media',
            link: '/ceu/itens',
          })
        }
        if (caVencendo > 0) {
          listaAlertas.push({
            id: 'ceu-ca',
            modulo: 'CEU',
            tipo: 'CA próximo do vencimento',
            descricao: `${caVencendo} certificado(s) de aprovação vencem em até 30 dias`,
            severidade: 'media',
            link: '/ceu/relatorios',
          })
        }
        setAlertas(listaAlertas)
      } catch (err: unknown) {
        const mensagem = err instanceof Error ? err.message : 'Erro ao carregar dashboard'
        console.error('Erro ao carregar KPIs do dashboard:', err)
        toast.error(mensagem)
      } finally {
        setCarregando(false)
      }
    }

    carregarKpis()
  }, [])

  const experiencia = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const resultado: { colaborador: ColaboradorResumido; marco: MarcoExperiencia; dias: number }[] = []

    colaboradoresAtivos.forEach((colab) => {
      if (!colab.data_admissao) return
      const dAdmissao = normalizarData(colab.data_admissao)
      if (!dAdmissao || dAdmissao > hoje) return
      const dias = diasDesde(colab.data_admissao)
      if (dias > 90) return
      const marco: MarcoExperiencia = dias <= 30 ? 30 : dias <= 60 ? 60 : 90
      resultado.push({ colaborador: colab, marco, dias })
    })

    return resultado.sort((a, b) => a.dias - b.dias)
  }, [colaboradoresAtivos])

  const aniversariantes = useMemo(() => {
    const hoje = new Date()
    const hojeMes = hoje.getMonth()
    const hojeDia = hoje.getDate()

    const aniversariosVida: { colaborador: ColaboradorResumido; tipo: 'vida' | 'empresa'; data: string }[] = []
    const aniversariosEmpresa: { colaborador: ColaboradorResumido; tipo: 'vida' | 'empresa'; data: string }[] = []

    colaboradoresAtivos.forEach((colab) => {
      if (colab.data_nascimento) {
        const dNasc = normalizarData(colab.data_nascimento)
        if (dNasc && dNasc.getMonth() === hojeMes) {
          aniversariosVida.push({ colaborador: colab, tipo: 'vida', data: colab.data_nascimento })
        }
      }
      if (colab.data_admissao) {
        const dAdm = normalizarData(colab.data_admissao)
        if (dAdm && dAdm.getMonth() === hojeMes) {
          aniversariosEmpresa.push({ colaborador: colab, tipo: 'empresa', data: colab.data_admissao })
        }
      }
    })

    const ehHoje = (dataStr: string) => {
      const d = normalizarData(dataStr)
      return d ? d.getDate() === hojeDia : false
    }

    return {
      vida: aniversariosVida.sort((a, b) => {
        const da = normalizarData(a.data)!
        const db = normalizarData(b.data)!
        return da.getDate() - db.getDate()
      }),
      empresa: aniversariosEmpresa.sort((a, b) => {
        const da = normalizarData(a.data)!
        const db = normalizarData(b.data)!
        return da.getDate() - db.getDate()
      }),
      destaqueHoje: (dataStr: string) => ehHoje(dataStr),
    }
  }, [colaboradoresAtivos])

  if (carregando) {
    return <LoadingScreen className="h-screen" />
  }

  const totalAlertas = alertas.length
  const nomeUsuario = user?.nome?.split(' ')[0] || 'Usuário'

  return (
    <div className="min-h-full pb-12">
      {/* Hero */}
      <div className="bg-brand-gradient px-4 py-8 text-white md:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-[24px] font-bold leading-tight lg:text-[28px]">
            {saudacao()}, {nomeUsuario}
          </h1>
          <p className="mt-1 text-[13px] text-white/80">
            {formatarDataCompleta(new Date())}
            {totalAlertas > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-white">{totalAlertas} itens</span>
                {' precisam de atenção hoje'}
              </>
            )}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Colaboradores ativos</p>
              <p className="mt-1 text-2xl font-bold">{ativos}</p>
              <p className="text-[11px] text-white/60">Total geral: {totalColaboradores}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Ocorrências pendentes</p>
              <p className="mt-1 text-2xl font-bold">{ocorrenciasPendentes}</p>
              <p className="text-[11px] text-white/60">Aguardando análise</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Contratos de experiência</p>
              <p className="mt-1 text-2xl font-bold">{experiencia.length}</p>
              <p className="text-[11px] text-white/60">Nos marcos de 30/60/90 dias</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/rh/alertas')}
            className={cn(
              'mt-6 gap-2 rounded-lg border',
              totalAlertas > 0
                ? 'border-white/20 bg-white text-red-600 hover:bg-white/90'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
            )}
          >
            <Bell className="h-4 w-4" />
            Central de Alertas
            {totalAlertas > 0 && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                {totalAlertas}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md"
            onClick={() => navigate('/colaboradores')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-blue-50 p-3 text-primary">
                  <Users className="size-6" />
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Colaboradores Ativos</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{ativos}</p>
                <p className="text-[13px] text-muted-foreground">Total geral: {totalColaboradores}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md"
            onClick={() => navigate('/rh/ocorrencias')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                  <AlertCircle className="size-6" />
                </div>
                <ArrowRight className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Ocorrências Pendentes</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{ocorrenciasPendentes}</p>
                <p className="text-[13px] text-muted-foreground">Aguardando análise</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seções de rolagem */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Contratos de experiência */}
          <Card className="rounded-2xl border-none shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <CalendarHeart className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Contratos de experiência</h3>
                  <p className="text-xs text-muted-foreground">Colaboradores próximos dos marcos de 30, 60 ou 90 dias</p>
                </div>
              </div>

              {experiencia.length === 0 ? (
                <p className="py-4 text-[13px] text-muted-foreground">Nenhum contrato de experiência próximo do vencimento.</p>
              ) : (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {experiencia.map(({ colaborador: colab, marco, dias }) => (
                    <button
                      key={colab.id}
                      onClick={() => navigate(`/colaboradores/${colab.id}`)}
                      className="flex w-full items-center justify-between rounded-xl border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-accent/40"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex size-10 items-center justify-center rounded-full text-sm font-bold',
                            marco === 30 && 'bg-purple-100 text-purple-700',
                            marco === 60 && 'bg-blue-100 text-blue-700',
                            marco === 90 && 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {marco}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{colab.nome_completo}</p>
                          <p className="text-xs text-muted-foreground">
                            {colab.cargo || '—'} · {colab.departamento || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            marco === 30 && 'border-purple-200 bg-purple-50 text-purple-700',
                            marco === 60 && 'border-blue-200 bg-blue-50 text-blue-700',
                            marco === 90 && 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {dias} dias
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">Adm. {formatarDiaMes(colab.data_admissao)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aniversariantes */}
          <Card className="rounded-2xl border-none shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                  <Cake className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Aniversariantes</h3>
                  <p className="text-xs text-muted-foreground">Mês atual</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aniversário de vida</p>
                  {aniversariantes.vida.length === 0 ? (
                    <p className="py-2 text-[13px] text-muted-foreground">Nenhum aniversariante este mês.</p>
                  ) : (
                    <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                      {aniversariantes.vida.map(({ colaborador: colab, data }) => (
                        <div
                          key={colab.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg p-2',
                            aniversariantes.destaqueHoje(data) ? 'border border-rose-100 bg-rose-50' : 'hover:bg-accent/40'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarDays
                              className={cn('size-4', aniversariantes.destaqueHoje(data) ? 'text-rose-600' : 'text-muted-foreground')}
                            />
                            <span className="text-sm text-foreground">{colab.nome_completo}</span>
                          </div>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              aniversariantes.destaqueHoje(data) ? 'text-rose-600' : 'text-muted-foreground'
                            )}
                          >
                            {formatarDiaMes(data)}
                            {aniversariantes.destaqueHoje(data) && ' · Hoje'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aniversário de empresa</p>
                  {aniversariantes.empresa.length === 0 ? (
                    <p className="py-2 text-[13px] text-muted-foreground">Nenhum aniversário de empresa este mês.</p>
                  ) : (
                    <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                      {aniversariantes.empresa.map(({ colaborador: colab, data }) => {
                        const dAdm = normalizarData(data)!
                        const anos = new Date().getFullYear() - dAdm.getFullYear()
                        return (
                          <div
                            key={colab.id}
                            className={cn(
                              'flex items-center justify-between rounded-lg p-2',
                              aniversariantes.destaqueHoje(data) ? 'border border-emerald-100 bg-emerald-50' : 'hover:bg-accent/40'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck
                                className={cn('size-4', aniversariantes.destaqueHoje(data) ? 'text-emerald-600' : 'text-muted-foreground')}
                              />
                              <span className="text-sm text-foreground">{colab.nome_completo}</span>
                            </div>
                            <span
                              className={cn(
                                'text-xs font-medium',
                                aniversariantes.destaqueHoje(data) ? 'text-emerald-600' : 'text-muted-foreground'
                              )}
                            >
                              {formatarDiaMes(data)}
                              {aniversariantes.destaqueHoje(data) && ` · ${anos} anos`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas dos módulos */}
        {alertas.length > 0 && (
          <Card className="rounded-2xl border-none shadow-sm">
            <CardContent className="p-6">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <Bell className="size-4 text-red-600" />
                Alertas dos módulos
              </h3>
              <div className="space-y-2">
                {alertas.map((alerta) => (
                  <button
                    key={alerta.id}
                    onClick={() => navigate(alerta.link)}
                    className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          alerta.severidade === 'critica' && 'bg-red-600',
                          alerta.severidade === 'alta' && 'bg-orange-500',
                          alerta.severidade === 'media' && 'bg-amber-400',
                          alerta.severidade === 'baixa' && 'bg-blue-400'
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          [{alerta.modulo}] {alerta.tipo}
                        </p>
                        <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
