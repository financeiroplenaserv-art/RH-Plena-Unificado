# Design System — CORH

> Versão: 2.0 — Julho/2026
> Implementação da especificação `public/CORH — Design System (para Kimi Code).md`.

## Identidade visual

O CORH adota uma identidade **minimalista e elegante**: uma única cor de marca (azul estilo Microsoft/Edge `#0F6CBD`), sidebar azul-marinho escura (`#0C1730`) e degradê em apenas 3 lugares. Sem cores decorativas por módulo — os únicos acentos permitidos são os semânticos (verde/âmbar/vermelho) e a legenda de tipos do CEU.

## Tokens de cor (`src/index.css`)

| Variável | Valor | Uso |
|----------|-------|-----|
| `--background` | `#F4F8FC` | Fundo da área de trabalho |
| `--foreground` | slate azulado escuro | Texto principal |
| `--card` / `--popover` | `#FFFFFF` | Cards, modais, dropdowns (sempre opacos) |
| `--primary` | `#0F6CBD` | Ação primária, links ativos |
| `--accent` | `#E3F0FB` | Hovers, badges, tints |
| `--border` / `--input` | azul-acinzentado claro | Bordas e inputs |
| `--radius` | `0.75rem` | Raio padrão |
| `--sidebar-background` | `#0C1730` | Fundo da sidebar |

### Degradês (somente 3 lugares)

1. Painel esquerdo do **Login** — `.bg-brand-gradient` (`#0A142E → #102C5E → #1E6FBF`)
2. Cartão de boas-vindas do **Dashboard** — `.bg-brand-gradient`
3. **Botões primários** — `.bg-brand-gradient-soft` (`#0F6CBD → #3B99E8`)

Proibido degradê em formulários, tabelas, cards comuns, sidebar e modais.

## Componentes compartilhados (`src/components/corh/`)

| Componente | Responsabilidade |
|------------|------------------|
| `PageHeader` | Título 22px bold, subtítulo, botão Voltar (outline), ações à direita |
| `Filters` | Card de filtros com botões **Limpar** (ghost) + **Aplicar** (primário) |
| `DataTable` | Wrapper de tabela: título com contador, `overflow-x-auto`, `min-w-[720px]` |
| `StatusBadge` | Badges de status com dot (success/warning/danger/info/neutral) |
| `EmptyState` | Ícone em `bg-accent`, mensagem e CTA primário |
| `ConfirmDialog` | AlertDialog padrão: ícone circular, título centralizado, Cancelar + Confirmar |
| `ModuleTabs` | Abas com borda inferior, ativa `border-primary text-primary` |
| `Button` | Wrapper com variants `primary` (degradê), `secondary`, `outline`, `ghost`, `danger` |

## Componentes de layout

- `src/components/layout/Sidebar.tsx` — fundo `#0C1730`, ícones monocromáticos `strokeWidth={1.8}`, item ativo em pill `#0F6CBD`, grupos colapsáveis.
- `src/components/layout/Header.tsx` — Topbar: breadcrumb à esquerda, busca global, sino de notificações, avatar com `displayName` + selo de perfil.
- `src/components/layout/ModuleShell.tsx` — wrapper de módulo com abas no padrão do Design System; exporta também `ModuleCard` e `ModuleButton` atualizados (primary = degradê, danger = vermelho sólido apenas em confirmações).
- `src/lib/button-variants.ts` — `buttonVariants` compartilhado entre `Button`, `AlertDialog` e `ConfirmDialog`.

## Regras principais

1. **Botão de executar filtro chama-se sempre "Aplicar"** (nunca "Filtrar" ou "Buscar").
2. **CTA principal usa `bg-brand-gradient-soft`**; exportações e importações são secundárias (outline).
3. **Exclusão na linha da tabela**: botão-ícone discreto (`text-muted-foreground hover:text-red-600`), nunca botão vermelho cheio. O vermelho sólido `bg-red-600` existe apenas no diálogo de confirmação.
4. **Toda confirmação passa pelo `ConfirmDialog`** (ou AlertDialog com ícone circular + título centralizado); overlay sempre `bg-black/60`.
5. **Nenhum dropdown/modal com transparência ou blur** — sempre `bg-popover`/`bg-card` sólido.
6. **Tabelas**: cabeçalho small-caps cinza, hover `bg-accent/40`, dados secundários `text-[12px] text-muted-foreground`, números/datas `tabular-nums`.
7. **Estado vazio sempre com ação** (ícone + mensagem + botão).
8. **Marca aparece 1 vez por tela** (só na sidebar; no login, só no painel).
9. **Login técnico nunca exibido** — sempre `displayName` + perfil.
10. **CEU**: legenda fixa acima da lista — 🟠 EPI · 🟢 Uniforme · 🟡 Crachá.
11. **z-index único**: conteúdo `z-0`, topbar `z-10`, dropdown `z-50`, modal `z-[100]`, toast `z-[200]`.

## Responsividade

- Sidebar: fixa 240px em `≥ lg`; gaveta (`Sheet`) em `< lg`, aberta pelo hambúrguer da topbar.
- Filtros: grid `lg` 4 colunas, `md` 2, `< md` 1 (empilhado).
- Tabelas: rolagem horizontal com `min-w-[720px]` (não esmagar colunas); paginação sempre visível.
- Modais: `max-w-sm/lg` com margem lateral em mobile, `max-h-[85vh]` com rolagem interna.
- Formulários: 2 colunas `≥ md`, 1 coluna `< md`; botões de ação com largura total no celular.

## Arquivos-chave

- `src/index.css` — tokens e utilitários de degradê
- `src/components/corh/` — componentes do Design System
- `src/components/layout/` — Sidebar, Header (Topbar), ModuleShell
- `src/lib/button-variants.ts` — variantes do botão base
- Especificação completa: `public/CORH — Design System (para Kimi Code).md`
