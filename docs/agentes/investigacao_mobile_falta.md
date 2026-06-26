# Investigação: `/mobile/falta` abrindo com sidebar no celular

## Resumo executivo

A rota `/mobile/falta` **está declarada fora do "grupo" de rotas desktop**, mas o **layout com sidebar e header é renderizado incondicionalmente** no mesmo nível do `BrowserRouter`. Como resultado, ao acessar `/mobile/falta`, o React Router renderiza a `MobileFaltaPage` **e**, simultaneamente, o layout desktop (Sidebar + Header) continua visível abaixo/ao lado.

A impressão do usuário é de que "abriu o sistema completo com sidebar" em vez da página mobile standalone.

---

## 1. Causa raiz mais provável

Em `src/App.tsx` o componente retorna a seguinte estrutura (simplificada):

```tsx
return (
  <BrowserRouter>
    <Routes>
      <Route path="/mobile/falta" element={...} />
    </Routes>

    {/* esse bloco SEMPRE é montado, independente da URL */}
    <div className="flex h-screen bg-slate-50">
      <SidebarWrapper ... />
      <div className={cn('flex-1 flex flex-col ...', sidebarOpen ? 'ml-60' : 'ml-16')}>
        <HeaderWrapper ... />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            {/* rotas desktop */}
          </Routes>
        </main>
      </div>
    </div>
  </BrowserRouter>
)
```

Pontos críticos:

1. O `<div className="flex h-screen bg-slate-50">` que envolve `<SidebarWrapper />` e `<HeaderWrapper />` está **fora de qualquer `<Route>`**. Ele não é condicional à URL.
2. A rota `/mobile/falta` foi colocada em um `<Routes>` separado, acima do layout, com a intenção de ficar "fora do layout". Mas o layout continua sendo renderizado logo abaixo.
3. O segundo `<Routes>` (dentro de `<main>`) não tem match para `/mobile/falta`, então o `<main>` fica vazio, **mas o sidebar e o header permanecem visíveis**.
4. A `MobileFaltaPage` usa classes normais de fluxo (`min-h-screen`, `sticky`, `max-w-md mx-auto`). Como o layout desktop empurra o conteúdo com `ml-60`/`ml-16`, a página mobile acaba sendo renderizada **dentro da área do layout desktop**, reforçando a sensação de que "abriu o sistema completo".

> **Conclusão:** A intenção de deixar `/mobile/falta` sem sidebar está correta na declaração da rota, mas falta fazer o **layout desktop ser condicional** — ele deve ser renderizado apenas para as rotas que realmente precisam dele.

---

## 2. Passo a passo do que acontece no celular

### Cenário A — usuário já está logado

1. O usuário digita `http://192.168.1.109:5173/mobile/falta` no navegador do celular.
2. O Vite dev server responde com `index.html`; o React é iniciado.
3. `useAuth` executa `supabase.auth.getSession()`. A sessão existe, então `user` é carregado.
4. `App.tsx` entra no ramo que renderiza `<BrowserRouter>`.
5. O primeiro `<Routes>` encontra match em `path="/mobile/falta"`.
6. `ProtectedRoute` verifica o nível de acesso (`admin`, `adm`, `mesa`, `inspetoria`). Se permitido, renderiza `<MobileFaltaPage />`.
7. **Imediatamente abaixo**, o bloco do layout desktop (`SidebarWrapper`, `HeaderWrapper`, `<main>`) é montado incondicionalmente.
8. O segundo `<Routes>` dentro de `<main>` não encontra nenhuma rota para `/mobile/falta`, então `<main>` fica vazio, mas o sidebar e header continuam ocupando a tela.
9. A `MobileFaltaPage` é renderizada também (fora do `<main>`), mas sobreposta/empurrada pela estrutura do layout desktop.
10. Resultado: o usuário vê a sidebar e o header do sistema completo, não uma tela mobile limpa.

### Cenário B — usuário não está logado

1. O usuário acessa `/mobile/falta` sem sessão.
2. `useAuth` não encontra sessão e `user` fica `null`.
3. `App.tsx` renderiza `<LoginPage />` **fora do `<BrowserRouter>`**.
4. O usuário preenche e-mail/senha e clica em "Entrar".
5. `handleLogin`/`handleLoginExistente` chama `login()`, que atualiza `user` no `useAuth`.
6. `App.tsx` re-renderiza, agora com `<BrowserRouter>`.
7. Como a URL do navegador ainda é `/mobile/falta`, o `<BrowserRouter>` respeita essa URL e tenta renderizar a rota.
8. **Problema:** o `LoginPage` não recebe nenhuma prop de "redirect after login" e o `App.tsx` não persiste a URL original. Se houver qualquer reload intermediário (ou se o usuário salvou um atalho para `/` depois de logar), a URL `/mobile/falta` é perdida.
9. Mesmo que a URL seja preservada, o problema do layout incondicional (Cenário A) continua acontecendo.

### Cenário C — usuário logado mas sem permissão

1. Se o usuário tiver um nível como `visualizador`, `financeiro`, `gestor`, etc., `ProtectedRoute` para `/mobile/falta` não encontra o nível na lista permitida.
2. `ProtectedRoute` executa `<Navigate to="/" replace />`.
3. O usuário é redirecionado para o Dashboard dentro do layout desktop.
4. Isso também explica relatos de "caiu no sistema completo", mas em um caso específico de permissão insuficiente.

---

## 3. Service worker / cache / PWA

**Não é causa do problema atual.**

Verificações realizadas:

- `vite.config.ts` não utiliza `vite-plugin-pwa`.
- Não existe `manifest.json` em `public/`.
- Não existe `service-worker.js` (ou similar) em `public/`.
- O único worker encontrado é `public/pdf.worker.min.mjs`, usado para renderização de PDFs.
- `index.html` não registra nenhum service worker.

Portanto, não há cache de navegação ou comportamento offline interferindo na rota.

---

## 4. Soluções propostas

### 4.1 Solução rápida — ocultar layout com base na URL (não recomendada)

Usar `useLocation` dentro de `App.tsx` para não renderizar o layout quando a rota for `/mobile/falta`.

**Problemas:**

- Mistura lógica de roteamento com lógica de layout.
- Não escala bem se outras rotas mobile forem criadas (ex: `/mobile/folga`, `/mobile/extra`).
- Fragilidade: qualquer rota que comece com `/mobile/` precisaria ser tratada manualmente.

### 4.2 Solução intermediária — Layout Route do React Router (recomendada)

Criar um componente `MainLayout` e usar o padrão de **Layout Route** do React Router v6. Todas as rotas desktop ficam aninhadas dentro do layout; `/mobile/falta` fica fora.

**Vantagens:**

- Padrão idiomático do React Router v6.
- Separação clara entre rotas com layout e rotas standalone.
- Fácil de escalar para novas rotas mobile.
- Não precisa de lógica condicional esparsa no `App.tsx`.

### 4.3 Solução robusta — Layout Route + redirect após login

Além da **Solução 4.2**, resolver o fluxo de login para URLs diretas:

- Mover o `<BrowserRouter>` para envolver todo o `App` (incluindo a tela de login), ou
- Armazenar a URL desejada antes de redirecionar para login e restaurá-la após autenticação.

Isso garante que um link/bookmark para `/mobile/falta` funcione mesmo quando o usuário ainda não está logado.

---

## 5. Solução recomendada

Recomendo a **Solução 4.2 (Layout Route)** como correção imediata, pois resolve o problema reportado com a menor quantidade de alterações e de forma semântica. A **Solução 4.3** pode ser aplicada em seguida se houver necessidade de links diretos para usuários deslogados.

### Exemplo de implementação

#### 5.1 Criar `src/components/layout/MainLayout.tsx`

```tsx
import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { PageLoading } from '@/components/PageLoading'
import type { Perfil } from '@/types/database'

interface MainLayoutProps {
  user: Perfil
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onLogout: () => void
}

export function MainLayout({ user, sidebarOpen, onToggleSidebar, onLogout }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onToggle={onToggleSidebar}
        onLogout={onLogout}
      />
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarOpen ? 'ml-60' : 'ml-16'
        )}
      >
        <Header user={user} />
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
```

#### 5.2 Refatorar `src/App.tsx`

```tsx
import { Outlet } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'

// ... demais imports e estados ...

return (
  <BrowserRouter>
    <Toaster position="top-right" richColors />
    <Routes>
      {/* Rota mobile standalone — SEM sidebar/header */}
      <Route
        path="/mobile/falta"
        element={
          <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'mesa', 'inspetoria']}>
            <MobileFaltaPage />
          </ProtectedRoute>
        }
      />

      {/* Todas as rotas desktop — COM sidebar/header */}
      <Route
        element={
          <ProtectedRoute user={user}>
            <MainLayout
              user={user}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onLogout={handleLogout}
            />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/colaboradores" element={<ColaboradoresPage />} />
        <Route
          path="/departamentos"
          element={
            <ProtectedRoute user={user} nivelMinimo={['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador']}>
              <DepartamentosPage />
            </ProtectedRoute>
          }
        />
        {/* ... todas as outras rotas desktop ... */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
```

#### 5.3 Observações sobre a refatoração

- Remover os componentes auxiliares `SidebarWrapper` e `HeaderWrapper` de `App.tsx`, pois o `MainLayout` os encapsula.
- A `MobileFaltaPage` continua usando `Suspense` por ser carregada via `lazy` em `lazyPages.ts`. Se desejável, também pode-se envolvê-la em `<Suspense>` no nível da rota.
- O `ProtectedRoute` externo no layout já garante que rotas desktop só sejam acessíveis com usuário autenticado. As permissões específicas de cada página continuam funcionando normalmente.

---

## 6. Validação sugerida após a correção

1. Acesse `http://192.168.1.109:5173/mobile/falta` em um celular Android/iOS.
2. Confirme que **não aparecem** sidebar e header.
3. Preencha o formulário de falta e salve.
4. Após salvar, clique em "Ver lançamentos" e confirme que o sistema volta para `/extras/lancamentos` **com** sidebar/header.
5. Acesse `http://192.168.1.109:5173/` e navegue normalmente pelos módulos desktop.
6. Acesse `/mobile/falta` com um usuário de nível `visualizador` -> deve ser redirecionado para `/` (comportamento esperado do `ProtectedRoute`).

---

## 7. Referências inspecionadas

- `src/App.tsx` — estrutura de rotas e layout.
- `src/components/layout/ProtectedRoute.tsx` — lógica de permissão e redirecionamento.
- `src/pages/LoginPage.tsx` — formulário de login (sem redirect após login).
- `src/hooks/useAuth.ts` — gerenciamento de sessão.
- `src/pages/extras/MobileFaltaPage.tsx` — página mobile e seus redirecionamentos internos.
- `src/routes/lazyPages.ts` — importação lazy da `MobileFaltaPage`.
- `vite.config.ts` — ausência de PWA/service worker.
- `public/` — ausência de `manifest.json` e service worker.
