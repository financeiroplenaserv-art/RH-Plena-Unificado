import { useState, useEffect, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PageLoading } from '@/components/PageLoading'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/types/database'
import { LoginPage } from '@/pages/LoginPage'
import { ConsentimentoLGPDPage } from '@/pages/ConsentimentoLGPDPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ColaboradoresPage } from '@/pages/ColaboradoresPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import {
  ImportarEContadorPage,
  DepartamentosPage,
  ConfiguracoesPage,
  EmpresasPage,
  OcorrenciasPage,
  OcorrenciaFormPage,
  OcorrenciaDetailPage,
  ColaboradorDetailPage,
  ColaboradorFormPage,
  ImportarRhPage,
  ModelosPage,
  AlertasPage,
  VrProjetosPage,
  VrProjetoFormPage,
  VrProjetoDetailPage,
  CeuDashboardPage,
  CeuItensPage,
  CeuItemFormPage,
  CeuFornecedoresPage,
  CeuMovimentacoesPage,
  CeuEntregaFormPage,
  CeuLancamentoRapidoPage,
  CeuRelatoriosPage,
  CeuImportarPage,
  AdicionaisContratosPage,
  AdicionaisVinculosPage,
  AdicionaisCalendarioPage,
  AdicionaisRelatorioPage,
  ImportarPontoPage,
  ExtrasLancamentosPage,
  ExtrasFormPage,
  ExtrasBalancoPage,
  ExtrasRelatorioPage,
  ExtrasRecibosPage,
  ExtrasCategoriasPage,
  ExtrasPlantaoPage,
  MobileFaltaPage,
} from '@/routes/lazyPages'

function SidebarWrapper({ user, isOpen, onToggle, onLogout }: {
  user: Perfil
  isOpen: boolean
  onToggle: () => void
  onLogout: () => void
}) {
  return <Sidebar user={user} isOpen={isOpen} onToggle={onToggle} onLogout={onLogout} />
}

function HeaderWrapper({ user }: { user: Perfil }) {
  return <Header user={user} />
}

function App() {
  const { user, loading, login, signUp, logout, carregarPerfil } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false)
  const [verificandoPrimeiroAcesso, setVerificandoPrimeiroAcesso] = useState(true)
  const [recarregandoPerfil, setRecarregandoPerfil] = useState(false)
  const location = useLocation()
  const isMobileFalta = location.pathname === '/mobile/falta'

  useEffect(() => {
    async function verificar() {
      // CORREÇÃO DE SEGURANÇA: só consulta publicamente se o modo de primeiro
      // acesso estiver habilitado via variável de ambiente. Em produção,
      // recomenda-se desativar o sign-up público no Supabase Auth e gerenciar
      // usuários por convite/admin.
      const permitirPrimeiroAcesso = import.meta.env.VITE_PERMITIR_PRIMEIRO_ACESSO === 'true'
      if (!permitirPrimeiroAcesso) {
        setPrimeiroAcesso(false)
        setVerificandoPrimeiroAcesso(false)
        return
      }

      const { count, error } = await supabase
        .from('perfis')
        .select('*', { count: 'exact', head: true })
      setPrimeiroAcesso(!error && count === 0)
      setVerificandoPrimeiroAcesso(false)
    }
    if (!user) {
      verificar()
    } else {
      setVerificandoPrimeiroAcesso(false)
    }
  }, [user])

  const handleLogin = async (email: string, senha: string) => {
    setLoginLoading(true)
    try {
      if (primeiroAcesso) {
        // CORREÇÃO DE SEGURANÇA: primeiro acesso cria admin explicitamente.
        // Demais usuários criados via signUp ficam como visualizador por padrão.
        await signUp(email, senha, 'admin')
        toast.success('Primeira conta criada com sucesso')
      } else {
        await login(email, senha)
        toast.success('Login realizado com sucesso')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao realizar login')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLoginExistente = async (email: string, senha: string) => {
    setLoginLoading(true)
    try {
      await login(email, senha)
      toast.success('Login realizado com sucesso')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao realizar login')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    toast.success('Sessão encerrada')
  }

  const handleConsentimentoAceito = async () => {
    setRecarregandoPerfil(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await carregarPerfil(session.user)
    }
    setRecarregandoPerfil(false)
  }

  if (loading || verificandoPrimeiroAcesso) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LoginPage
          onLogin={handleLogin}
          onLoginExistente={handleLoginExistente}
          loading={loginLoading}
          primeiroAcesso={primeiroAcesso}
        />
      </>
    )
  }

  if (recarregandoPerfil) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  if (!user.consentimento_lgpd) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <ConsentimentoLGPDPage onConsentimentoAceito={handleConsentimentoAceito} />
      </>
    )
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route
          path="/mobile/falta"
          element={
            <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'inspetoria']}>
              <MobileFaltaPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      {!isMobileFalta && (
        <div className="flex h-screen bg-slate-50">
          <SidebarWrapper
            user={user}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onLogout={handleLogout}
          />
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 transition-all duration-300',
            sidebarOpen ? 'ml-60' : 'ml-16'
          )}
        >
          <HeaderWrapper user={user} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
            <Suspense fallback={<PageLoading />}>
              <Routes>
              <Route path="/mobile/falta" element={null} />
              <Route path="/" element={<DashboardPage />} />
              <Route path="/colaboradores" element={<ColaboradoresPage />} />
              <Route
                path="/departamentos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <DepartamentosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresas"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <EmpresasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/importar/econtador"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'dp2']}>
                    <ImportarEContadorPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/rh"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria']}>
                    <Navigate to="/rh/ocorrencias" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria']}>
                    <OcorrenciasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa']}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/colaborador/:colaboradorId"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa']}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa']}>
                    <OcorrenciaDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador']}>
                    <ColaboradorDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa']}>
                    <ColaboradorFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/importar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'rh', 'dp1', 'dp2']}>
                    <ImportarRhPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/modelos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2']}>
                    <ModelosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/alertas"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1']}>
                    <AlertasPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/ceu" element={<Navigate to="/ceu/dashboard" replace />} />
              <Route
                path="/ceu/dashboard"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador']}>
                    <CeuDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'mesa']}>
                    <CeuItensPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'mesa']}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'mesa']}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/fornecedores"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp1']}>
                    <CeuFornecedoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/movimentacoes"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp1', 'mesa', 'inspetoria']}>
                    <CeuMovimentacoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/movimentacoes/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp1']}>
                    <CeuEntregaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/lancamento-rapido"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp1']}>
                    <CeuLancamentoRapidoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/relatorios"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp1', 'mesa']}>
                    <CeuRelatoriosPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ceu/importar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1']}>
                    <CeuImportarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/vr" element={<Navigate to="/vr/projetos" replace />} />
              <Route
                path="/vr/projetos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'dp2']}>
                    <VrProjetosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp2']}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'dp2']}>
                    <VrProjetoDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp2']}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp2']}>
                    <ConfiguracoesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/adicionais" element={<Navigate to="/adicionais/contratos" replace />} />
              <Route
                path="/adicionais/contratos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp2', 'mesa', 'financeiro']}>
                    <AdicionaisContratosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/vinculos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'dp2', 'mesa']}>
                    <AdicionaisVinculosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/calendario"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp2', 'mesa']}>
                    <AdicionaisCalendarioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/relatorio"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp1', 'mesa', 'financeiro']}>
                    <AdicionaisRelatorioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/importar-ponto"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'dp2', 'mesa']}>
                    <ImportarPontoPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/extras" element={<Navigate to="/extras/lancamentos" replace />} />
              <Route
                path="/extras/lancamentos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <ExtrasLancamentosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'dp1']}>
                    <ExtrasFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'dp1']}>
                    <ExtrasFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/balanco"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador']}>
                    <ExtrasBalancoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/relatorio"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <ExtrasRelatorioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/recibos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <ExtrasRecibosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/categorias"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'financeiro', 'dp1']}>
                    <ExtrasCategoriasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/mobile"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'dp1']}>
                    <ExtrasPlantaoPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/escalas" element={<PlaceholderPage titulo="Escalas" descricao="Gestão de escalas de trabalho" />} />
              <Route path="/ferias" element={<PlaceholderPage titulo="Férias" descricao="Controle de férias e períodos de descanso" />} />
              <Route path="/relatorios" element={<PlaceholderPage titulo="Relatórios" descricao="Relatórios gerenciais do sistema" />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </main>
        </div>
      </div>
      )}
    </>
  )
}

export default App
