import { useState, useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
  const { user, loading, login, signUp, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false)
  const [verificandoPrimeiroAcesso, setVerificandoPrimeiroAcesso] = useState(true)

  useEffect(() => {
    async function verificar() {
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
        await signUp(email, senha)
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

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <div className="flex h-screen bg-slate-50">
        <SidebarWrapper
          user={user}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
        />
        <div
          className={cn(
            'flex-1 flex flex-col transition-all duration-300',
            sidebarOpen ? 'ml-60' : 'ml-16'
          )}
        >
          <HeaderWrapper user={user} />
          <main className="flex-1 overflow-auto p-6">
            <Suspense fallback={<PageLoading />}>
              <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/colaboradores" element={<ColaboradoresPage />} />
              <Route
                path="/departamentos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <DepartamentosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresas"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <EmpresasPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/importar/econtador" element={<ImportarEContadorPage />} />

              <Route
                path="/rh"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <Navigate to="/rh/ocorrencias" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <OcorrenciasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/colaborador/:colaboradorId"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <OcorrenciaDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <ColaboradorDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <ColaboradorFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/importar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <ImportarRhPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/modelos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <ModelosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/alertas"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <AlertasPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/ceu" element={<Navigate to="/ceu/dashboard" replace />} />
              <Route
                path="/ceu/dashboard"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <CeuDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <CeuItensPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/fornecedores"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <CeuFornecedoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/movimentacoes"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <CeuMovimentacoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/movimentacoes/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <CeuEntregaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/lancamento-rapido"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <CeuLancamentoRapidoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/relatorios"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <CeuRelatoriosPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ceu/importar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <CeuImportarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/vr" element={<Navigate to="/vr/projetos" replace />} />
              <Route
                path="/vr/projetos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <VrProjetosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/novo"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <VrProjetoDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id/editar"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
                    <ConfiguracoesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/adicionais" element={<Navigate to="/adicionais/contratos" replace />} />
              <Route
                path="/adicionais/contratos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <AdicionaisContratosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/vinculos"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <AdicionaisVinculosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/calendario"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <AdicionaisCalendarioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/relatorio"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor', 'visualizador']}>
                    <AdicionaisRelatorioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/importar-ponto"
                element={
                  <ProtectedRoute user={user} nivelMinimo={['admin', 'rh', 'gestor']}>
                    <ImportarPontoPage />
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
    </BrowserRouter>
  )
}

export default App
