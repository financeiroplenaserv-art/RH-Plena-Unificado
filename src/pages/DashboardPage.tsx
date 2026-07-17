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

function calcularMarcoExperiencia(dias: number): MarcoExperiencia | null {
  const marcos: MarcoExperiencia[] = [30, 60, 90]
  for (const marco of marcos) {
    if (dias >= marco - 7 && dias <= marco + 7) return marco
  }
  return null
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
      const marco = calcularMarcoExperiencia(dias)
      if (marco) resultado.push({ colaborador: colab, marco, dias })
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

  const admissoesRecentes = useMemo(() => {
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

    return colaboradoresAtivos
      .filter((colab) => {
        if (!colab.data_admissao) return false
        const dAdm = normalizarData(colab.data_admissao)
        return dAdm ? dAdm >= trintaDiasAtras : false
      })
      .sort((a, b) => {
        const da = normalizarData(a.data_admissao)!
        const db = normalizarData(b.data_admissao)!
        return db.getTime() - da.getTime()
      })
  }, [colaboradoresAtivos])

  if (carregando) {
    return <LoadingScreen className="h-screen" />
  }

  const totalAlertas = alertas.length
  const nomeUsuario = user?.nome?.split(' ')[0] || 'Usuário'

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* Header com saudação */}
      <div className="bg-white border-b border-slate-200 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">
            {saudacao()}, {nomeUsuario} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {formatarDataCompleta(new Date())}
            {totalAlertas > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-slate-900">{totalAlertas} itens</span>
                {' precisam de atenção hoje'}
              </>
            )}
          </p>

          <Button
            size="sm"
            onClick={() => navigate('/rh/alertas')}
            className={cn(
              'mt-4 gap-2 rounded-lg',
              totalAlertas > 0 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            )}
          >
            <Bell className="h-4 w-4" />
            Central de Alertas
            {totalAlertas > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-white text-red-600 text-xs font-bold">
                {totalAlertas}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Cards principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="rounded-2xl shadow-sm bg-white border-none cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/colaboradores')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Colaboradores Ativos</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{ativos}</p>
                <p className="text-sm text-slate-400 mt-1">Total geral: {totalColaboradores}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="rounded-2xl shadow-sm bg-white border-none cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/rh/ocorrencias')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Ocorrências Pendentes</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{ocorrenciasPendentes}</p>
                <p className="text-sm text-slate-400 mt-1">Aguardando análise</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seções de rolagem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contratos de experiência */}
          <Card className="rounded-2xl shadow-sm bg-white border-none lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <CalendarHeart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Contratos de experiência</h3>
                  <p className="text-xs text-slate-500">Colaboradores próximos dos marcos de 30, 60 ou 90 dias</p>
                </div>
              </div>

              {experiencia.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum contrato de experiência próximo do vencimento.</p>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {experiencia.map(({ colaborador: colab, marco, dias }) => (
                    <button
                      key={colab.id}
                      onClick={() => navigate(`/colaboradores/${colab.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-left transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                          marco === 30 && 'bg-purple-100 text-purple-700',
                          marco === 60 && 'bg-blue-100 text-blue-700',
                          marco === 90 && 'bg-emerald-100 text-emerald-700'
                        )}>
                          {marco}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{colab.nome_completo}</p>
                          <p className="text-xs text-slate-500">{colab.cargo || '—'} · {colab.departamento || '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={cn(
                          'text-xs',
                          marco === 30 && 'border-purple-200 text-purple-700 bg-purple-50',
                          marco === 60 && 'border-blue-200 text-blue-700 bg-blue-50',
                          marco === 90 && 'border-emerald-200 text-emerald-700 bg-emerald-50'
                        )}>
                          {dias} dias
                        </Badge>
                        <p className="text-xs text-slate-400 mt-1">Adm. {formatarDiaMes(colab.data_admissao)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aniversariantes */}
          <Card className="rounded-2xl shadow-sm bg-white border-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Aniversariantes</h3>
                  <p className="text-xs text-slate-500">Mês atual</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Aniversário de vida</p>
                  {aniversariantes.vida.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">Nenhum aniversariante este mês.</p>
                  ) : (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {aniversariantes.vida.map(({ colaborador: colab, data }) => (
                        <div
                          key={colab.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg',
                            aniversariantes.destaqueHoje(data) ? 'bg-rose-50 border border-rose-100' : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarDays className={cn('w-4 h-4', aniversariantes.destaqueHoje(data) ? 'text-rose-600' : 'text-slate-400')} />
                            <span className="text-sm text-slate-900">{colab.nome_completo}</span>
                          </div>
                          <span className={cn(
                            'text-xs font-medium',
                            aniversariantes.destaqueHoje(data) ? 'text-rose-600' : 'text-slate-500'
                          )}>
                            {formatarDiaMes(data)}
                            {aniversariantes.destaqueHoje(data) && ' · Hoje'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Aniversário de empresa</p>
                  {aniversariantes.empresa.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">Nenhum aniversário de empresa este mês.</p>
                  ) : (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {aniversariantes.empresa.map(({ colaborador: colab, data }) => {
                        const dAdm = normalizarData(data)!
                        const anos = new Date().getFullYear() - dAdm.getFullYear()
                        return (
                          <div
                            key={colab.id}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg',
                              aniversariantes.destaqueHoje(data) ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-slate-50'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck className={cn('w-4 h-4', aniversariantes.destaqueHoje(data) ? 'text-emerald-600' : 'text-slate-400')} />
                              <span className="text-sm text-slate-900">{colab.nome_completo}</span>
                            </div>
                            <span className={cn(
                              'text-xs font-medium',
                              aniversariantes.destaqueHoje(data) ? 'text-emerald-600' : 'text-slate-500'
                            )}>
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

        {/* Admissões recentes */}
        <Card className="rounded-2xl shadow-sm bg-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Admissões recentes</h3>
                  <p className="text-xs text-slate-500">Últimos 30 dias</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/colaboradores')} className="gap-1 text-slate-600">
                Ver todos <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {admissoesRecentes.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Nenhuma admissão nos últimos 30 dias.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {admissoesRecentes.map((colab) => (
                  <button
                    key={colab.id}
                    onClick={() => navigate(`/colaboradores/${colab.id}`)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{colab.nome_completo}</p>
                      <p className="text-xs text-slate-500">{colab.cargo || '—'} · {colab.departamento || '—'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
                      {formatarDiaMes(colab.data_admissao)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas dos módulos */}
        {alertas.length > 0 && (
          <Card className="rounded-2xl shadow-sm bg-white border-none border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-600" />
                Alertas dos módulos
              </h3>
              <div className="space-y-2">
                {alertas.map((alerta) => (
                  <button
                    key={alerta.id}
                    onClick={() => navigate(alerta.link)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          alerta.severidade === 'critica' && 'bg-red-600',
                          alerta.severidade === 'alta' && 'bg-orange-500',
                          alerta.severidade === 'media' && 'bg-amber-400',
                          alerta.severidade === 'baixa' && 'bg-blue-400'
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          [{alerta.modulo}] {alerta.tipo}
                        </p>
                        <p className="text-xs text-slate-500">{alerta.descricao}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
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
