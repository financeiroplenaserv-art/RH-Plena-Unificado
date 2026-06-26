import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Wallet,
  AlertCircle,
  FileWarning,
  ClipboardList,
  TrendingUp,
  Bell,
  Package,
  Briefcase,
  Building2,
  ArrowRight,
  Boxes,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn, formatarData } from '@/lib/utils'
import { toast } from 'sonner'
import { LoadingScreen } from '@/components/LoadingScreen'
import type { Ocorrencia, Colaborador } from '@/types/database'

interface AlertaModulo {
  id: string
  modulo: string
  tipo: string
  descricao: string
  severidade: 'critica' | 'alta' | 'media' | 'baixa'
  link: string
}

const statusConfig: Record<Colaborador['status'], { bullet: string; label: string }> = {
  Ativo: { bullet: 'bg-emerald-500', label: 'Ativo' },
  Inativo: { bullet: 'bg-slate-400', label: 'Inativo' },
  Afastado: { bullet: 'bg-amber-400', label: 'Afastado' },
}

function isMesAtual(dataStr: string) {
  const data = new Date(dataStr)
  const hoje = new Date()
  return data.getFullYear() === hoje.getFullYear() && data.getMonth() === hoje.getMonth()
}

function diasAte(dataStr: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataStr)
  data.setHours(0, 0, 0, 0)
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [carregando, setCarregando] = useState(true)

  const [totalColaboradores, setTotalColaboradores] = useState(0)
  const [ativos, setAtivos] = useState(0)
  const [afastados, setAfastados] = useState(0)
  const [ocorrenciasPendentes, setOcorrenciasPendentes] = useState(0)
  const [ocorrenciasMes, setOcorrenciasMes] = useState(0)
  const [alertasCriticos, setAlertasCriticos] = useState(0)
  const [projetosVR, setProjetosVR] = useState(0)
  const [contratosAdicionais, setContratosAdicionais] = useState(0)
  const [totalItensCEU, setTotalItensCEU] = useState(0)
  const [entregasMesCEU, setEntregasMesCEU] = useState(0)
  const [itensEmAbertoCEU, setItensEmAbertoCEU] = useState(0)
  const [ultimosColaboradores, setUltimosColaboradores] = useState<Colaborador[]>([])
  const [ultimaImportacao, setUltimaImportacao] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<AlertaModulo[]>([])

  useEffect(() => {
    async function carregarKpis() {
      setCarregando(true)
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      try {
        const [
          { count: total },
          { count: ativosCount },
          { count: afastadosCount },
          { data: colaboradores },
          { data: colaboradoresRecentes },
          { data: ocorrencias },
          { count: pendentesCount },
          { count: alertasCount },
          { count: projetosVRCount },
          { count: contratosCount },
          { data: itensCEU },
          { data: entregasCEU },
        ] = await Promise.all([
          supabase.from('colaboradores').select('*', { count: 'exact', head: true }),
          supabase.from('colaboradores').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
          supabase.from('colaboradores').select('*', { count: 'exact', head: true }).eq('status', 'Afastado'),
          supabase.from('colaboradores').select('*').order('created_at', { ascending: false }).limit(1),
          supabase.from('colaboradores').select('*').eq('status', 'Ativo').order('created_at', { ascending: false }).limit(5),
          supabase.from('ocorrencias').select('*'),
          supabase.from('ocorrencias').select('*', { count: 'exact', head: true }).eq('status', 'Pendente'),
          supabase
            .from('alertas')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ativo')
            .in('severidade', ['critica', 'alta']),
          supabase.from('projetos_vr').select('*', { count: 'exact', head: true }),
          supabase.from('contratos_adicionais').select('*', { count: 'exact', head: true }),
          supabase.from('itens').select('*'),
          supabase.from('entregas').select('*'),
        ])

        const pendentes = pendentesCount || 0
        const alertasCriticosCount = alertasCount || 0

        const itens = (itensCEU || []) as { id: string; nome: string; tipo: string; ca: string | null; validade: string | null; estoque: number | null; estoque_minimo: number | null }[]
        const entregas = (entregasCEU || []) as { id: string; data_entrega: string; data_devolucao: string | null }[]

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
        setAfastados(afastadosCount || 0)
        setUltimaImportacao(colaboradores?.[0]?.created_at || null)
        setUltimosColaboradores((colaboradoresRecentes || []) as Colaborador[])
        setOcorrenciasPendentes(pendentes)
        setOcorrenciasMes(
          (ocorrencias || []).filter((o: Ocorrencia) => new Date(o.data_ocorrencia) >= inicioMes).length
        )
        setAlertasCriticos(alertasCriticosCount)
        setProjetosVR(projetosVRCount || 0)
        setContratosAdicionais(contratosCount || 0)
        setTotalItensCEU(itens.length)
        setEntregasMesCEU(entregas.filter((e) => isMesAtual(e.data_entrega)).length)
        setItensEmAbertoCEU(entregas.filter((e) => !e.data_devolucao).length)
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
        if (alertasCriticosCount > 0) {
          listaAlertas.push({
            id: 'alertas-criticos',
            modulo: 'Alertas',
            tipo: 'Alertas críticos',
            descricao: `${alertasCriticosCount} alerta(s) crítico(s) ativo(s)`,
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

  const atalhos = useMemo(
    () => [
      { label: 'Nova Ocorrência', path: '/rh/ocorrencias/novo', icon: <FileWarning className="h-4 w-4 text-amber-600" /> },
      { label: 'Listar Ocorrências', path: '/rh/ocorrencias', icon: <ClipboardList className="h-4 w-4 text-blue-600" /> },
      { label: 'Verificar Alertas', path: '/rh/alertas', icon: <TrendingUp className="h-4 w-4 text-emerald-600" /> },
      { label: 'Projetos VR', path: '/vr/projetos', icon: <Wallet className="h-4 w-4 text-purple-600" /> },
      { label: 'Nova Entrega CEU', path: '/ceu/movimentacoes/novo', icon: <Package className="h-4 w-4 text-cyan-600" /> },
      { label: 'Itens CEU', path: '/ceu/itens', icon: <Boxes className="h-4 w-4 text-indigo-600" /> },
      { label: 'Contratos', path: '/adicionais/contratos', icon: <Briefcase className="h-4 w-4 text-rose-600" /> },
      { label: 'Empresas', path: '/empresas', icon: <Building2 className="h-4 w-4 text-slate-600" /> },
      { label: 'Colaboradores', path: '/colaboradores', icon: <Users className="h-4 w-4 text-teal-600" /> },
    ],
    []
  )

  if (carregando) {
    return <LoadingScreen className="h-screen" />
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Visão geral dos módulos da plataforma</p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/rh/alertas')}
          className="gap-1.5 text-xs bg-red-600 hover:bg-red-700"
        >
          <Bell className="h-3.5 w-3.5" />
          {alertasCriticos > 0 ? `${alertasCriticos} alerta(s) crítico(s)` : 'Central de Alertas'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-none rounded-[12px] shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Colaboradores Ativos</span>
              <div className="p-2 rounded-lg bg-white/10">
                <Users className="w-5 h-5 text-slate-300" />
              </div>
            </div>
            <div className="text-3xl font-bold">{ativos}</div>
            <p className="text-xs text-slate-400 mt-1">Total geral: {totalColaboradores}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[12px] shadow-sm bg-white border-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Ocorrências Pendentes</span>
              <div className="p-2 rounded-lg bg-red-50 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{ocorrenciasPendentes}</div>
            <p className="text-xs text-slate-500 mt-1">Aguardando análise</p>
          </CardContent>
        </Card>

        <Card className="rounded-[12px] shadow-sm bg-white border-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Projetos VR</span>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{projetosVR}</div>
            <p className="text-xs text-slate-500 mt-1">Cadastrados</p>
          </CardContent>
        </Card>

        <Card className="rounded-[12px] shadow-sm bg-white border-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-600">Entregas CEU no Mês</span>
              <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{entregasMesCEU}</div>
            <p className="text-xs text-slate-500 mt-1">{itensEmAbertoCEU} em aberto no total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-[12px] shadow-sm bg-white border-none lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Atalhos rápidos</h3>
            <div className="flex flex-wrap gap-3">
              {atalhos.map((atalho) => (
                <Button
                  key={atalho.path}
                  variant="outline"
                  onClick={() => navigate(atalho.path)}
                  className="gap-2 rounded-lg border-slate-300 bg-white hover:bg-slate-50"
                >
                  {atalho.icon}
                  {atalho.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[12px] shadow-sm bg-white border-none">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Resumo por módulo</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Itens CEU</span>
                <span className="font-semibold text-slate-900">{totalItensCEU}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Contratos adicionais</span>
                <span className="font-semibold text-slate-900">{contratosAdicionais}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Afastados</span>
                <span className="font-semibold text-slate-900">{afastados}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Ocorrências no mês</span>
                <span className="font-semibold text-slate-900">{ocorrenciasMes}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {alertas.length > 0 && (
        <Card className="rounded-[12px] shadow-sm bg-white border-none border-l-4 border-l-red-500">
          <CardContent className="p-5">
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

      <Card className="rounded-[12px] shadow-sm bg-white border-none">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Colaboradores recentes</h3>
            <span className="text-xs text-slate-500">
              Última atualização: {ultimaImportacao ? formatarData(ultimaImportacao.split('T')[0]) : 'Nunca'}
            </span>
          </div>

          {ultimosColaboradores.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Nenhum colaborador encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-100">
                    <th className="pb-3 pl-2">Colaborador</th>
                    <th className="pb-3">Cargo</th>
                    <th className="pb-3">Departamento</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosColaboradores.map((colab) => {
                    const status = statusConfig[colab.status]
                    return (
                      <tr
                        key={colab.id}
                        className="text-sm text-slate-700 border-b border-slate-50 last:border-none hover:bg-slate-50/50"
                        style={{ height: '52px' }}
                      >
                        <td className="py-[7px] pl-2 font-medium text-slate-900">{colab.nome_completo}</td>
                        <td className="py-[7px]">{colab.cargo || '—'}</td>
                        <td className="py-[7px]">{colab.departamento || '—'}</td>
                        <td className="py-[7px]">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full', status.bullet)} />
                            <span>{status.label}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
            <span>{ativos} ativos</span>
            <span>{afastados} afastados</span>
            <span>{ocorrenciasPendentes} ocorrências pendentes</span>
            <span>{ocorrenciasMes} ocorrências no mês</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
