import { useEffect } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { Users, Route, Ticket, CalendarClock } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleShell } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { useVt } from '@/hooks/useVt'
import { useCarteiraFeristas } from '@/hooks/useCarteiraFeristas'
import { podeGerenciarVT, podeVisualizarVT, verificarPermissao } from '@/lib/permissoes'
import { VtColaboradoresTab } from './VtColaboradoresTab'
import { VtTrajetosTab } from './VtTrajetosTab'
import { VtBilhetesTab } from './VtBilhetesTab'
import { VtCargaTab } from './VtCargaTab'

// Módulo VT (Vale-Transporte) — Fase 1: cadastro de optantes/tipo de bilhete,
// trajetos casa → posto e bilhetes de VT com valor diário e vigência
// (docs/PLANO_MODULO_VT.md, modelo de 21/10/2026 §2d; migration 156 renomeou
// "combinação" para "bilhete", termo da operação).

const TABS = [
  { path: '/vt', label: 'Colaboradores', icon: Users },
  { path: '/vt/trajetos', label: 'Trajetos', icon: Route },
  { path: '/vt/carga', label: 'Carga', icon: CalendarClock },
  { path: '/vt/bilhetes', label: 'Bilhetes', icon: Ticket },
]

export function VtPage() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const vt = useVt()
  const carteira = useCarteiraFeristas()

  useEffect(() => {
    if (user && podeVisualizarVT(user.nivel_acesso)) {
      vt.carregarTudo()
      void carteira.listar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (authLoading) return null
  if (!user || !verificarPermissao(user.nivel_acesso, 'rota', 'vt')) {
    return <Navigate to="/" replace />
  }

  const podeGerenciar = podeGerenciarVT(user.nivel_acesso)
  const podeVisualizar = podeVisualizarVT(user.nivel_acesso)
  if (!podeVisualizar && !podeGerenciar) {
    return <Navigate to="/" replace />
  }

  const aba =
    location.pathname === '/vt/trajetos'
      ? 'trajetos'
      : location.pathname === '/vt/carga'
        ? 'carga'
        : location.pathname === '/vt/bilhetes'
          ? 'bilhetes'
          : 'colaboradores'

  return (
    <ModuleShell tabs={TABS}>
      <PageHeader
        backTo="/"
        title="Vale-Transporte"
        description="Optantes, trajetos casa → posto e custo do dia pelos bilhetes de VT"
      />

      {aba === 'colaboradores' && (
        <VtColaboradoresTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          loading={vt.loading}
          podeGerenciar={podeGerenciar}
          salvarVtColaborador={vt.salvarVtColaborador}
          ehFerista={carteira.ehFerista}
        />
      )}
      {aba === 'trajetos' && (
        <VtTrajetosTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          bilhetes={vt.bilhetes}
          trajetos={vt.trajetos}
          loading={vt.loading}
          usuarioId={user.id}
          podeGerenciar={podeGerenciar}
          salvarTrajeto={vt.salvarTrajeto}
          confirmarTrajeto={vt.confirmarTrajeto}
          removerTrajeto={vt.removerTrajeto}
          recarregarTrajetos={vt.listarTrajetos}
        />
      )}
      {aba === 'bilhetes' && (
        <VtBilhetesTab
          bilhetes={vt.bilhetes}
          loading={vt.loading}
          podeGerenciar={podeGerenciar}
          novaVigenciaBilhete={vt.novaVigenciaBilhete}
          desativarBilhete={vt.desativarBilhete}
          recarregarBilhetes={vt.listarBilhetes}
        />
      )}
      {aba === 'carga' && (
        <VtCargaTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          trajetos={vt.trajetos}
          bilhetes={vt.bilhetes}
          dadosProntos={!vt.loading}
          usuarioId={user.id}
          podeGerenciar={podeGerenciar}
          ehFerista={carteira.ehFerista}
          adicionarFeristaCarteira={carteira.adicionar}
        />
      )}
    </ModuleShell>
  )
}
