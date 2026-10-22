import { useEffect } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { Users, Route, Layers } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleShell } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { useVt } from '@/hooks/useVt'
import { podeGerenciarVT, podeVisualizarVT, verificarPermissao } from '@/lib/permissoes'
import { VtColaboradoresTab } from './VtColaboradoresTab'
import { VtTrajetosTab } from './VtTrajetosTab'
import { VtCombinacoesTab } from './VtCombinacoesTab'

// Módulo VT (Vale-Transporte) — Fase 1: cadastro de optantes/tipo de bilhete,
// trajetos casa → posto e combinações de VT com valor diário e vigência
// (docs/PLANO_MODULO_VT.md, modelo de 21/10/2026 §2d).

const TABS = [
  { path: '/vt', label: 'Colaboradores', icon: Users },
  { path: '/vt/trajetos', label: 'Trajetos', icon: Route },
  { path: '/vt/combinacoes', label: 'Combinações', icon: Layers },
]

export function VtPage() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const vt = useVt()

  useEffect(() => {
    if (user && podeVisualizarVT(user.nivel_acesso)) {
      vt.carregarTudo()
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
      : location.pathname === '/vt/combinacoes'
        ? 'combinacoes'
        : 'colaboradores'

  return (
    <ModuleShell tabs={TABS}>
      <PageHeader
        backTo="/"
        title="Vale-Transporte"
        description="Optantes, trajetos casa → posto e custo do dia pelas combinações de VT"
      />

      {aba === 'colaboradores' && (
        <VtColaboradoresTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          loading={vt.loading}
          podeGerenciar={podeGerenciar}
          salvarVtColaborador={vt.salvarVtColaborador}
        />
      )}
      {aba === 'trajetos' && (
        <VtTrajetosTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          combinacoes={vt.combinacoes}
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
      {aba === 'combinacoes' && (
        <VtCombinacoesTab
          combinacoes={vt.combinacoes}
          loading={vt.loading}
          podeGerenciar={podeGerenciar}
          novaVigenciaCombinacao={vt.novaVigenciaCombinacao}
          desativarCombinacao={vt.desativarCombinacao}
          recarregarCombinacoes={vt.listarCombinacoes}
        />
      )}
    </ModuleShell>
  )
}
