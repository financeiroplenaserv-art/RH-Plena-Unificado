import { useState, useEffect, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PageLoading } from '@/components/PageLoading'
import { cn } from '@/lib/utils'
import { verificarPermissao } from '@/lib/permissoes'
import type { Perfil } from '@/types/database'
import { LoginPage } from '@/pages/LoginPage'
import { RedefinirSenhaPage } from '@/pages/RedefinirSenhaPage'
import { ConsentimentoLGPDPage } from '@/pages/ConsentimentoLGPDPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ColaboradoresPage } from '@/pages/ColaboradoresPage'
import {
  ImportarEContadorPage,
  DepartamentosPage,
  ConfiguracoesPage,
  AuditoriaPage,
  EmpresasPage,
  PermissoesPage,
  RelatoriosPage,
  EscalasPage,
  EscalasImportarPage,
  EscalasLocaisPage,
  EscalasMapeamentoPage,
  FeriasPage,
  FeriasImportarPage,
  FeriasNotificacoesPage,
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
  CeuItensPage,
  CeuItemFormPage,
  CeuMovimentacoesPage,
  CeuEntregaFormPage,
  CeuLancamentoRapidoPage,
  CeuTamanhosPage,
  CeuRelatoriosPage,
  CeuImportarPage,
  CeuCrachasPage,
  MateriaisContratosPage,
  MateriaisKitPage,
  MateriaisCatalogoPage,
  MateriaisFornecedoresPage,
  MateriaisAlteracoesKitPage,
  MateriaisPedidosPage,
  MateriaisPedidoDetalhePage,
  MateriaisValidacaoPage,
  MateriaisPainelPage,
  MateriaisSemPedidoPage,
  CeuPedidosPage,
  QuadroColaboradoresPage,
  AdicionaisContratosPage,
  AdicionaisVinculosPage,
  AdicionaisCalendarioPage,
  AdicionaisFeriadosPage,
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
  PedidoLiderPage,
  BiPerformanceLabPage,
} from '@/routes/lazyPages'

function SidebarWrapper({ user, isOpen, onToggle, onLogout, mobileOpen, setMobileOpen }: {
  user: Perfil
  isOpen: boolean
  onToggle: () => void
  onLogout: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}) {
  return (
    <>
      <Sidebar user={user} isOpen={isOpen} onToggle={onToggle} onLogout={onLogout} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 bg-sidebar p-0">
          <div className="flex h-full flex-col">
            <Sidebar user={user} isOpen={true} onToggle={() => setMobileOpen(false)} onLogout={onLogout} mobile />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function HeaderWrapper({ user, onMenuToggle }: { user: Perfil; onMenuToggle: () => void }) {
  return <Header user={user} onMenuToggle={onMenuToggle} />
}

function App() {
  const { user, loading, login, logout, carregarPerfil } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [recarregandoPerfil, setRecarregandoPerfil] = useState(false)
  // Fluxo "Esqueci a senha": o link do e-mail abre o app com uma sessão de
  // recuperação (evento PASSWORD_RECOVERY) — mostra a tela de nova senha
  // no lugar do login/app até a senha ser redefinida.
  const [redefinindoSenha, setRedefinindoSenha] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRedefinindoSenha(true)
    })
    return () => subscription.unsubscribe()
  }, [])
  const location = useLocation()
  const isMobileFalta = location.pathname === '/mobile/falta'

  const handleLogin = async (email: string, senha: string) => {
    setLoginLoading(true)
    try {
      await login(email, senha)
      toast.success('Login realizado com sucesso')
    } catch (err: unknown) {
      console.error('Erro ao realizar login:', err)
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

  // Link público do líder (QR code no quadro do contrato): sem login, sem
  // layout e ANTES do gate de autenticação — docs/PLANO_MATERIAIS_FASE1.md §4.2.
  if (location.pathname.startsWith('/pedido/')) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/pedido/:token" element={<PedidoLiderPage />} />
          <Route path="*" element={<PedidoLiderPage />} />
        </Routes>
      </Suspense>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    )
  }

  const handleSenhaRedefinida = async () => {
    // Encerra a sessão de recuperação para o usuário entrar com a senha nova
    await logout()
    setRedefinindoSenha(false)
    toast.success('Senha redefinida com sucesso! Entre com a nova senha.')
  }

  if (redefinindoSenha) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <RedefinirSenhaPage onSenhaRedefinida={handleSenhaRedefinida} />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LoginPage
          onLogin={handleLogin}
          loading={loginLoading}
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
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route
            path="/mobile/falta"
            element={
              <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'mobile_falta' }}>
                <MobileFaltaPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      {!isMobileFalta && (
        <div className="flex h-screen bg-background">
          <SidebarWrapper
            user={user}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onLogout={handleLogout}
            mobileOpen={mobileSidebarOpen}
            setMobileOpen={setMobileSidebarOpen}
          />
          <div
            className={cn(
              'flex flex-1 flex-col min-w-0 transition-all duration-300',
              sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'
            )}
          >
            <HeaderWrapper user={user} onMenuToggle={() => setMobileSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
              <Suspense fallback={<PageLoading />}>
              <Routes>
              <Route path="/mobile/falta" element={null} />
              <Route
                path="/"
                element={
                  // Quem só emite crachás (dp3) não tem Dashboard: cai direto na tela de crachás
                  !verificarPermissao(user.nivel_acesso, 'menu', 'dashboard') &&
                  verificarPermissao(user.nivel_acesso, 'menu', 'crachas') ? (
                    <Navigate to="/ceu/crachas" replace />
                  ) : (
                    <DashboardPage />
                  )
                }
              />
              <Route
                path="/colaboradores"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'colaboradores' }}>
                    <ColaboradoresPage />
                  </ProtectedRoute>
                }
              />
              {/* Quadro fica na área de Colaboradores; rota.colaboradores mantém o dp3 fora + trava interna na página */}
              <Route
                path="/colaboradores/quadro"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'colaboradores' }}>
                    <QuadroColaboradoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/departamentos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'departamentos' }}>
                    <DepartamentosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresas"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'empresas' }}>
                    <EmpresasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/importar/econtador"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'importar_econtador' }}>
                    <ImportarEContadorPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/rh"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <Navigate to="/rh/ocorrencias" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <OcorrenciasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/novo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/colaborador/:colaboradorId"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/:id/editar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <OcorrenciaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/ocorrencias/:id"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <OcorrenciaDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'colaboradores' }}>
                    <ColaboradorDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/colaboradores/:id/editar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'colaboradores' }}>
                    <ColaboradorFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/importar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'colaboradores' }}>
                    <ImportarRhPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/modelos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ocorrencias' }}>
                    <ModelosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rh/alertas"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'alertas' }}>
                    <AlertasPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/materiais" element={<Navigate to="/materiais/pedidos" replace />} />
              <Route
                path="/materiais/pedidos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisPedidosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/pedidos/:id"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisPedidoDetalhePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/validacao"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'materiais', acao: 'validar' }}>
                    <MateriaisValidacaoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/painel"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'materiais', acao: 'aprovar' }}>
                    <MateriaisPainelPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/sem-pedido"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'materiais', acao: 'ver_sem_pedido' }}>
                    <MateriaisSemPedidoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/contratos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisContratosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/kit"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisKitPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/catalogo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisCatalogoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/fornecedores"
                element={
                  // Quem não tem o módulo inteiro (dp2, financeiro) entra só nesta aba
                  <ProtectedRoute
                    user={user}
                    permissao={{ recurso: 'rota', acao: 'materiais' }}
                    fallback={
                      <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais_fornecedores' }}>
                        <MateriaisFornecedoresPage />
                      </ProtectedRoute>
                    }
                  >
                    <MateriaisFornecedoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materiais/alteracoes-kit"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'materiais' }}>
                    <MateriaisAlteracoesKitPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/ceu" element={<Navigate to="/ceu/movimentacoes" replace />} />
              <Route
                path="/ceu/itens"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuItensPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/novo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/itens/:id/editar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuItemFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/pedidos"
                element={
                  // Inspetoria confere e dp2 atende: a página checa as ações ceu.conferir_pedido/atender_pedido
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuPedidosPage />
                  </ProtectedRoute>
                }
              />
              {/* Fornecedores virou cadastro único do módulo Materiais */}
              <Route path="/ceu/fornecedores" element={<Navigate to="/materiais/fornecedores" replace />} />
              <Route
                path="/ceu/movimentacoes"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuMovimentacoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/movimentacoes/novo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuEntregaFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/lancamento-rapido"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuLancamentoRapidoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/tamanhos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuTamanhosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/crachas"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'ceu', acao: 'emitir_cracha' }}>
                    <CeuCrachasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ceu/relatorios"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuRelatoriosPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ceu/importar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ceu' }}>
                    <CeuImportarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/vr" element={<Navigate to="/vr/projetos" replace />} />
              <Route
                path="/vr/projetos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'vr' }}>
                    <VrProjetosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/novo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'vr' }}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'vr' }}>
                    <VrProjetoDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vr/projetos/:id/editar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'vr' }}>
                    <VrProjetoFormPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'configuracoes' }}>
                    <ConfiguracoesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/auditoria"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'auditoria' }}>
                    <AuditoriaPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/permissoes"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'permissoes' }}>
                    <PermissoesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/adicionais" element={<Navigate to="/adicionais/contratos" replace />} />
              <Route
                path="/adicionais/contratos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <AdicionaisContratosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/vinculos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <AdicionaisVinculosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/calendario"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <AdicionaisCalendarioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/feriados"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <AdicionaisFeriadosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/relatorio"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <AdicionaisRelatorioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/adicionais/importar-ponto"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'adicionais' }}>
                    <ImportarPontoPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/extras" element={<Navigate to="/extras/lancamentos" replace />} />
              <Route
                path="/extras/lancamentos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasLancamentosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/novo"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/:id/editar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/balanco"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasBalancoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/relatorio"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasRelatorioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/recibos"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasRecibosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/categorias"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasCategoriasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/extras/mobile"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'extras' }}>
                    <ExtrasPlantaoPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/escalas"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'escalas' }}>
                    <EscalasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/escalas/importar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'escalas' }}>
                    <EscalasImportarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/escalas/locais"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'escalas' }}>
                    <EscalasLocaisPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/escalas/mapeamento"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'escalas' }}>
                    <EscalasMapeamentoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ferias"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ferias' }}>
                    <FeriasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ferias/importar"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ferias' }}>
                    <FeriasImportarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ferias/notificacoes"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'ferias' }}>
                    <FeriasNotificacoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bi"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'bi' }}>
                    <BiPerformanceLabPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'relatorios' }}>
                    <RelatoriosPage />
                  </ProtectedRoute>
                }
              />

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
