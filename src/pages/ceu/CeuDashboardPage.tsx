import { useEffect, useMemo } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate } from 'react-router-dom'
import {
  Boxes,
  CalendarClock,
  ClipboardList,
  PackageCheck,
  AlertTriangle,
  Plus,
  FileText,
  ArrowRight,
  BarChart3,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CeuShell } from './CeuShell'
import { CeuKpiCard } from '@/components/ceu/CeuKpiCard'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { LoadingScreen } from '@/components/LoadingScreen'
import type { ItemCEU } from '@/types/database'

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

function diasRestantesPrazo(dataEntregaStr: string, prazoDias: number) {
  const dataEntrega = new Date(dataEntregaStr)
  dataEntrega.setHours(0, 0, 0, 0)
  const prazo = new Date(dataEntrega)
  prazo.setDate(prazo.getDate() + prazoDias)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function CeuDashboardPage() {
  const navigate = useNavigate()
  const { itens, loading: loadingItens, listar: listarItens } = useCEUItens()
  const { entregas, loading: loadingEntregas, listar: listarEntregas } = useCEUEntregas()
  useEffect(() => {
    listarItens()
    listarEntregas()
  }, [listarItens, listarEntregas])

  const stats = useMemo(() => {
    const totalItens = itens.length
    const entregasDoMes = entregas.filter((e) => isMesAtual(e.data_entrega)).length
    const itensEmAberto = entregas.filter((e) => !e.data_devolucao).length
    const itensDevolvidos = entregas.filter((e) => !!e.data_devolucao).length

    const alertasEstoqueBaixo = itens.filter(
      (item) =>
        typeof item.estoque === 'number' &&
        typeof item.estoque_minimo === 'number' &&
        item.estoque_minimo > 0 &&
        item.estoque <= item.estoque_minimo
    )

    const totalEPIs = itens.filter((i) => i.tipo === 'EPI').length
    const totalUniformes = itens.filter((i) => i.tipo === 'Uniforme').length
    const totalColaboradores = new Set(entregas.map((e) => e.colaborador_id)).size

    const movimentacoesDoMes = entregas.filter(
      (e) => isMesAtual(e.data_entrega) || (e.data_devolucao && isMesAtual(e.data_devolucao))
    ).length

    const caVencendo = itens.filter((item) => {
      if (!item.ca || !item.validade) return false
      const dias = diasAte(item.validade)
      return dias >= 0 && dias <= 30
    })

    const prazoUsoVencendo = entregas.filter((e) => {
      if (e.data_devolucao || !e.item?.prazo_uso_dias) return false
      const dias = diasRestantesPrazo(e.data_entrega, e.item.prazo_uso_dias)
      return dias <= 7
    })

    return {
      totalItens,
      entregasDoMes,
      itensEmAberto,
      itensDevolvidos,
      alertasEstoqueBaixo,
      totalEPIs,
      totalUniformes,
      totalColaboradores,
      movimentacoesDoMes,
      caVencendo,
      prazoUsoVencendo,
    }
  }, [itens, entregas])

  const loading = loadingItens || loadingEntregas

  return (
    <CeuShell>
      <PageHeader
        backTo="/"
        title="CEU"
        description="Visão geral de itens, entregas e alertas"
      />

      {loading ? (
        <LoadingScreen className="h-96" />
      ) : (
        <>
          <ModuleCard title="Ações rápidas">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ModuleButton onClick={() => navigate('/ceu/movimentacoes/novo')}>
                <Plus className="w-4 h-4 mr-2" />
                Nova entrega
              </ModuleButton>
              <ModuleButton variant="outline" onClick={() => navigate('/ceu/itens/novo')}>
                <Plus className="w-4 h-4 mr-2" />
                Novo item
              </ModuleButton>
              <ModuleButton variant="outline" onClick={() => navigate('/ceu/fornecedores')}>
                <Plus className="w-4 h-4 mr-2" />
                Novo fornecedor
              </ModuleButton>
              <ModuleButton variant="outline" onClick={() => navigate('/ceu/relatorios')}>
                <FileText className="w-4 h-4 mr-2" />
                Relatórios
              </ModuleButton>
            </div>
          </ModuleCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <CeuKpiCard
              label="Total de itens cadastrados"
              value={stats.totalItens}
              icon={<Boxes className="w-5 h-5" />}
              gradient="blue"
            />
            <CeuKpiCard
              label="Total de entregas do mês"
              value={stats.entregasDoMes}
              icon={<CalendarClock className="w-5 h-5" />}
              gradient="dark-blue"
            />
            <CeuKpiCard
              label="Itens em aberto"
              value={stats.itensEmAberto}
              icon={<ClipboardList className="w-5 h-5" />}
              gradient="orange"
            />
            <CeuKpiCard
              label="Itens devolvidos"
              value={stats.itensDevolvidos}
              icon={<PackageCheck className="w-5 h-5" />}
              gradient="green"
            />
            <CeuKpiCard
              label="Alertas de estoque baixo"
              value={stats.alertasEstoqueBaixo.length}
              icon={<AlertTriangle className="w-5 h-5" />}
              gradient="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModuleCard title="Movimentações do mês" icon={<BarChart3 className="w-4 h-4" />}>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-slate-500">Entregas e devoluções registradas no mês atual</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats.movimentacoesDoMes}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <BarChart3 className="w-8 h-8 text-[#3B82F6]" />
                </div>
              </div>
            </ModuleCard>

            <ModuleCard title="Total de EPIs / Uniformes / Colaboradores" icon={<Boxes className="w-4 h-4" />}>
              <div className="grid grid-cols-3 gap-4 py-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalEPIs}</p>
                  <p className="text-xs text-slate-500 mt-1">EPIs</p>
                </div>
                <div className="text-center border-x border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalUniformes}</p>
                  <p className="text-xs text-slate-500 mt-1">Uniformes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{stats.totalColaboradores}</p>
                  <p className="text-xs text-slate-500 mt-1">Colaboradores</p>
                </div>
              </div>
            </ModuleCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ModuleCard title="Estoque baixo" icon={<AlertTriangle className="w-4 h-4" />}>
              {stats.alertasEstoqueBaixo.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">Nenhum item com estoque baixo.</p>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {stats.alertasEstoqueBaixo.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                      <span className="font-medium text-slate-700">{item.nome}</span>
                      <span className="text-xs text-orange-600 font-semibold">
                        {item.estoque} / {item.estoque_minimo} min
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ModuleButton
                variant="outline"
                size="sm"
                onClick={() => navigate('/ceu/itens')}
                className="mt-3 gap-1"
              >
                Gerenciar itens <ArrowRight className="w-3.5 h-3.5" />
              </ModuleButton>
            </ModuleCard>

            <ModuleCard title="Vencimento de CA próximo" icon={<ShieldAlert className="w-4 h-4" />}>
              {stats.caVencendo.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">Nenhum CA próximo do vencimento.</p>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {stats.caVencendo.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="font-medium text-slate-700">{item.nome}</p>
                        <p className="text-xs text-slate-400">CA: {item.ca}</p>
                      </div>
                      <span className="text-xs text-blue-700 font-semibold">
                        {diasAte(item.validade!)} dias
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ModuleButton
                variant="outline"
                size="sm"
                onClick={() => navigate('/ceu/itens')}
                className="mt-3 gap-1"
              >
                Ver itens <ArrowRight className="w-3.5 h-3.5" />
              </ModuleButton>
            </ModuleCard>

            <ModuleCard title="Prazo de uso dos itens" icon={<Clock className="w-4 h-4" />}>
              {stats.prazoUsoVencendo.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">Nenhum item próximo do prazo de uso.</p>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {stats.prazoUsoVencendo.map((e) => {
                    const item = e.item as ItemCEU
                    const dias = diasRestantesPrazo(e.data_entrega, item.prazo_uso_dias!)
                    return (
                      <li key={e.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-700">{item.nome}</p>
                          <p className="text-xs text-slate-400">
                            {e.colaborador?.nome_completo || e.colaborador_id}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold ${dias < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {dias < 0 ? `${Math.abs(dias)} dias atrasado` : `${dias} dias restantes`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              <ModuleButton
                variant="outline"
                size="sm"
                onClick={() => navigate('/ceu/movimentacoes')}
                className="mt-3 gap-1"
              >
                Ver entregas <ArrowRight className="w-3.5 h-3.5" />
              </ModuleButton>
            </ModuleCard>
          </div>
        </>
      )}
    </CeuShell>
  )
}
