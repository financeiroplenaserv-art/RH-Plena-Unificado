import { useEffect } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { Users, Route, CalendarClock, CalendarCheck, ListChecks, FileUp } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleShell } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { useVt } from '@/hooks/useVt'
import { useCarteiraFeristas } from '@/hooks/useCarteiraFeristas'
import { podeGerenciarVT, podeVerCPFCompleto, podeVisualizarVT, verificarPermissao } from '@/lib/permissoes'
import { VtColaboradoresTab } from './VtColaboradoresTab'
import { VtTrajetosTab } from './VtTrajetosTab'
import { VtRotasAConfirmarTab } from './VtRotasAConfirmarTab'
import { VtCargaTab } from './VtCargaTab'
import { VtFechamentoTab } from './VtFechamentoTab'
import { VtImportacoesTab } from './VtImportacoesTab'

// Módulo VT (Vale-Transporte) — Fase 1: cadastro de optantes/tipo de bilhete,
// trajetos casa → posto e bilhetes de VT com valor diário e vigência
// (docs/PLANO_MODULO_VT.md, modelo de 21/10/2026 §2d; migration 156 renomeou
// "combinação" para "bilhete", termo da operação).

const TABS = [
  { path: '/vt', label: 'Colaboradores', icon: Users },
  // Ordem do trabalho: primeiro confirmar as rotas, depois consultar os trajetos.
  { path: '/vt/rotas', label: 'Rotas a confirmar', icon: ListChecks },
  { path: '/vt/trajetos', label: 'Trajetos', icon: Route },
  { path: '/vt/carga', label: 'Carga', icon: CalendarClock },
  { path: '/vt/fechamento', label: 'Fechamento', icon: CalendarCheck },
  { path: '/vt/importacoes', label: 'Importações do mês', icon: FileUp },
]

export function VtPage() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const podeVerCpf = !!user && podeVerCPFCompleto(user.nivel_acesso)
  const vt = useVt({ incluirCpf: podeVerCpf })
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

  // Aba Bilhetes retirada no recomeço do VT (21/11/2026): os bilhetes da planilha foram
  // apagados e o preço sai das rotas confirmadas. Link antigo cai na fila de rotas.
  if (location.pathname === '/vt/bilhetes') return <Navigate to="/vt/rotas" replace />

  const aba =
    location.pathname === '/vt/trajetos'
      ? 'trajetos'
      : location.pathname === '/vt/rotas'
        ? 'rotas'
        : location.pathname === '/vt/importacoes'
        ? 'importacoes'
        : location.pathname === '/vt/carga'
        ? 'carga'
        : location.pathname === '/vt/fechamento'
          ? 'fechamento'
          : 'colaboradores'

  return (
    <ModuleShell tabs={TABS}>
      <PageHeader
        backTo="/"
        title="Vale-Transporte"
        description="Optantes, rotas casa → posto e custo do dia"
      />

      {aba === 'colaboradores' && (
        <VtColaboradoresTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          trajetos={vt.trajetos}
          loading={vt.loading}
          podeGerenciar={podeGerenciar}
          salvarVtColaborador={vt.salvarVtColaborador}
          salvarExcecaoTarifaCheia={vt.salvarExcecaoTarifaCheia}
          ehFerista={carteira.ehFerista}
          podeVerCpf={podeVerCpf}
        />
      )}
      {aba === 'rotas' && (
        <VtRotasAConfirmarTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          trajetos={vt.trajetos}
          loading={vt.loading}
          usuarioId={user.id}
          podeGerenciar={podeGerenciar}
          recarregarTrajetos={vt.listarTrajetos}
        />
      )}
      {aba === 'trajetos' && (
        <VtTrajetosTab
          colaboradores={vt.colaboradores}
          departamentos={vt.departamentos}
          bilhetes={vt.bilhetes}
          trajetos={vt.trajetos}
          extrasTrajeto={vt.colaboradoresDeTrajetos}
          loading={vt.loading}
          usuarioId={user.id}
          podeGerenciar={podeGerenciar}
          podeVerCpf={podeVerCpf}
          salvarTrajeto={vt.salvarTrajeto}
          confirmarTrajeto={vt.confirmarTrajeto}
          removerTrajeto={vt.removerTrajeto}
          recarregarTrajetos={vt.listarTrajetos}
        />
      )}
      {aba === 'fechamento' && (
        <VtFechamentoTab usuarioId={user.id} podeGerenciar={podeGerenciar} />
      )}
      {aba === 'importacoes' && (
        <VtImportacoesTab podeGerenciar={podeGerenciar} recarregarVt={vt.carregarTudo} />
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
          prioridadeFerista={carteira.prioridadeFerista}
          adicionarFeristaCarteira={carteira.adicionar}
          recarregarFeristas={carteira.listar}
        />
      )}
    </ModuleShell>
  )
}
