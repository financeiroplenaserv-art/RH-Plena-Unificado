# Correção: Layout desktop sobrepondo a página mobile `/mobile/falta`

## Problema

Ao acessar `http://192.168.1.109:5173/mobile/falta` em dispositivos móveis, a página **Nova falta** era renderizada, mas o layout desktop completo (Sidebar, Header e conteúdo das rotas empresas/departamentos/colaboradores/dashboard) também aparecia ao mesmo tempo, mesmo a URL permanecendo `/mobile/falta`.

## Causa

Em `src/App.tsx`, a rota `/mobile/falta` estava no primeiro `<Routes>` (fora do layout desktop), mas o layout desktop (`<SidebarWrapper />`, `<HeaderWrapper />` e o segundo `<Routes>`) era renderizado incondicionalmente abaixo. Como o layout não estava dentro de nenhuma condição de rota, ele aparecia para qualquer URL autenticada.

## Solução aplicada

1. Importado `useLocation` do `react-router-dom` em `src/App.tsx`.
2. Adicionada a verificação:
   ```tsx
   const location = useLocation()
   const isMobileFalta = location.pathname === '/mobile/falta'
   ```
3. O layout desktop foi envolvido com `{!isMobileFalta && (...)}`, de modo que:
   - Quando a rota atual for `/mobile/falta`, apenas o primeiro `<Routes>` renderiza a `<MobileFaltaPage />`, sem Sidebar/Header.
   - Para todas as outras rotas, o comportamento anterior é mantido (primeiro Routes + layout desktop completo).
4. Mantida a rota vazia `/mobile/falta` no segundo `<Routes>` (dentro do layout desktop) para evitar que o catch-all `*` redirecione a URL.
5. O `<BrowserRouter />` continua em `src/main.tsx`.

## Arquivos alterados

- `src/App.tsx`
- `docs/agentes/correcao_layout_mobile_falta.md` (este arquivo)

## Validação

- `npx eslint src/App.tsx` passou sem erros.
- `NODE_OPTIONS=--max-old-space-size=2048 npm run lint` passou sem erros.
- `npm run build` passou com sucesso.

## Resultado

A página `/mobile/falta` agora ocupa a tela inteira sem exibir a sidebar desktop, resolvendo o bug visual no acesso mobile.
