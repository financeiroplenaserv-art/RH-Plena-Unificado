# CORH — Design System v1.0
### Especificação completa de redesign para implementação

> **Como usar:** este documento é uma especificação executável. Aplique na ordem das seções 1 → 8. A seção 1 (tokens) resolve ~60% do visual sozinha, porque todos os componentes herdam as variáveis. As seções 2–3 padronizam os componentes compartilhados; a seção 5 é o checklist tela por tela.
>
> **Stack do projeto:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix) + lucide-react.
>
> **Direção visual:** minimalista e elegante. Uma única cor de marca (azul estilo Microsoft/Edge). Sidebar azul-marinho escura. Degradê apenas em 3 lugares. Sem cores decorativas por módulo.

---

## 1. Tokens de cor — `src/index.css`

Substitua o bloco `:root` existente por este. **Não altere nomes de variáveis** — o shadcn/ui inteiro passa a herdar automaticamente.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ===== CORH — paleta baseada no azul Microsoft/Edge ===== */
    --background: 210 33% 97%;          /* #F4F8FC — fundo da área de trabalho */
    --foreground: 214 32% 17%;          /* texto principal (slate azulado escuro) */

    --card: 0 0% 100%;
    --card-foreground: 214 32% 17%;

    --popover: 0 0% 100%;
    --popover-foreground: 214 32% 17%;

    /* Azul Microsoft — cor primária de ação */
    --primary: 207 90% 42%;             /* #0F6CBD */
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 94%;
    --secondary-foreground: 213 60% 25%;

    --muted: 210 40% 94%;
    --muted-foreground: 213 16% 47%;

    --accent: 208 88% 93%;              /* #E3F0FB — hovers, badges, tints */
    --accent-foreground: 208 84% 32%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;

    --border: 214 25% 89%;
    --input: 214 25% 87%;
    --ring: 207 90% 42%;

    --radius: 0.75rem;

    /* Sidebar — azul-marinho profundo (identidade herdada do login) */
    --sidebar-background: 222 57% 11%;      /* #0C1730 */
    --sidebar-foreground: 214 25% 78%;      /* cinza-azulado claro */
    --sidebar-primary: 207 90% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 219 45% 18%;          /* hover sutil */
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 220 40% 16%;
    --sidebar-ring: 207 90% 50%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}

@layer utilities {
  /* Degradês controlados — ÚNICOS do sistema */
  .bg-brand-gradient {
    background-image: linear-gradient(135deg, #0A142E 0%, #102C5E 55%, #1E6FBF 100%);
  }
  .bg-brand-gradient-soft {
    background-image: linear-gradient(120deg, #0F6CBD 0%, #3B99E8 100%);
  }
}
```

### Regra do degradê (rígida)
O degradê existe **somente** em 3 lugares, sempre nas classes acima:
1. Painel esquerdo do **Login** (já existe — manter);
2. Cartão de boas-vindas do **Dashboard** (`bg-brand-gradient`);
3. **Botões primários** (`bg-brand-gradient-soft`).

**Proibido:** degradê em campos de formulário, tabelas, cards comuns, sidebar, modais.

### Cores semânticas (inalteradas, são as únicas outras cores permitidas)
| Cor | Significado |
|---|---|
| Verde (`emerald`) | Ativo, sucesso, em dia |
| Âmbar (`amber`) | Pendente, atenção, prazo médio |
| Vermelho (`red`) | Urgente, erro, prazo ≤ 5 dias |
| CEU: laranja / verde / amarelo | EPI / Uniforme / Crachá (conteúdo, com legenda visível) |

---

## 2. Layout global

### 2.1 Sidebar (240px, azul-marinho, ícones monocromáticos)

Componente de referência completo — `src/components/CorhSidebar.tsx`:

```tsx
import { NavLink } from 'react-router'
import {
  LayoutGrid, FolderOpen, Users, Building2, Landmark, CalendarRange,
  Banknote, Umbrella, FileWarning, Briefcase, Wallet, HeartHandshake,
  Package, ShieldCheck, ClipboardCheck, Plug, KeyRound, BarChart3,
  LogOut, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type Item = { label: string; icon: React.ElementType; to?: string }
type Group = { label: string; icon: React.ElementType; children: Item[] }

const groups: Group[] = [
  { label: 'Cadastros', icon: FolderOpen, children: [
    { label: 'Colaboradores', icon: Users, to: '/colaboradores' },
    { label: 'Departamentos', icon: Building2, to: '/departamentos' },
    { label: 'Empresas', icon: Landmark, to: '/empresas' },
  ]},
  { label: 'Operacional', icon: CalendarRange, children: [
    { label: 'Escalas', icon: CalendarRange, to: '/escalas' },
    { label: 'Extras', icon: Banknote, to: '/extras/lancamentos' },
  ]},
  { label: 'RH', icon: HeartHandshake, children: [
    { label: 'Férias', icon: Umbrella, to: '/rh/ferias' },
    { label: 'Ocorrências', icon: FileWarning, to: '/rh/ocorrencias' },
  ]},
  { label: 'DP', icon: Briefcase, children: [
    { label: 'Adicionais', icon: Wallet, to: '/adicionais/contratos' },
    { label: 'Benefícios', icon: HeartHandshake, to: '/vr/projetos' },
    { label: 'CEU', icon: Package, to: '/ceu/movimentacoes' },
  ]},
  { label: 'Gestão', icon: ShieldCheck, children: [
    { label: 'Auditoria', icon: ClipboardCheck, to: '/gestao/auditoria' },
    { label: 'e-Contador', icon: Plug, to: '/gestao/e-contador' },
    { label: 'Permissões', icon: KeyRound, to: '/gestao/permissoes' },
  ]},
]

function NavItem({ icon: Icon, label, to, depth = false }:
  { icon: React.ElementType; label: string; to?: string; depth?: boolean }) {
  const base = cn(
    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
    depth && 'pl-9'
  )
  const content = (active: boolean) => (
    <>
      <Icon strokeWidth={1.8} className={cn('size-4 shrink-0',
        active ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-white')} />
      {label}
    </>
  )
  if (!to) return (
    <button className={cn(base, 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white')}>
      {content(false)}
    </button>
  )
  return (
    <NavLink to={to} className={({ isActive }) => cn(base,
      isActive
        ? 'bg-[#0F6CBD] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_14px_-4px_rgba(15,108,189,0.7)]'
        : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white')}>
      {({ isActive }) => content(isActive)}
    </NavLink>
  )
}

export function CorhSidebar() {
  const [open, setOpen] = useState<Record<string, boolean>>({ Cadastros: true })
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar">
      {/* Marca — aparece SOMENTE aqui no sistema inteiro */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="bg-brand-gradient-soft flex size-10 items-center justify-center rounded-xl shadow-lg shadow-black/30">
          {/* substituir pelo logo real */}
          <span className="text-[11px] font-extrabold text-white">3+</span>
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-white">CORH</p>
          <p className="text-[10px] text-sidebar-foreground/60">Controle Operacional e de RH</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <NavItem icon={LayoutGrid} label="Dashboard" to="/" />
        {groups.map((g) => {
          const isOpen = !!open[g.label]
          return (
            <div key={g.label}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [g.label]: !isOpen }))}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <g.icon strokeWidth={1.8} className="size-4 shrink-0 text-sidebar-foreground/50 group-hover:text-white" />
                {g.label}
                <ChevronDown className={cn('ml-auto size-3.5 text-sidebar-foreground/40 transition-transform', !isOpen && '-rotate-90')} />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {g.children.map((c) => <NavItem key={c.label} {...c} depth />)}
                </div>
              )}
            </div>
          )
        })}
        <NavItem icon={BarChart3} label="Relatórios" to="/relatorios" />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <NavItem icon={LogOut} label="Sair" />
      </div>
    </aside>
  )
}
```

**Regras da sidebar:**
- Ícones: lucide-react, `size-4`, `strokeWidth={1.8}`, cor única cinza-azulada — **nunca coloridos por módulo**;
- Item ativo: pill `#0F6CBD`, texto branco, brilho sutil;
- Hover: `bg-white/5`;
- Fundo sólido `#0C1730` (sem degradê).

### 2.2 Topbar (sem marca duplicada)

`src/components/Topbar.tsx`:

```tsx
import { Bell, ChevronRight, Search } from 'lucide-react'

export function Topbar({ breadcrumb }: { breadcrumb: string[] }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-white/85 px-6 backdrop-blur">
      <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {breadcrumb.map((b, i) => (
          <span key={b} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5" />}
            <span className={i === breadcrumb.length - 1 ? 'font-semibold text-foreground' : ''}>{b}</span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Buscar colaborador, ocorrência…"
            className="h-9 w-72 rounded-full border border-input bg-background pl-9 pr-4 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
        <button className="relative flex size-9 items-center justify-center rounded-full border border-input bg-white text-muted-foreground transition hover:border-primary/40 hover:text-primary">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
        </button>
        {/* Usuário: nome de exibição + perfil — NUNCA o login técnico */}
        <div className="flex items-center gap-2.5 rounded-full border border-input bg-white py-1 pl-1 pr-3">
          <div className="bg-brand-gradient-soft flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white">FP</div>
          <div className="leading-tight">
            <p className="text-[12px] font-semibold">Financeiro Plena</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-primary">ADM</p>
          </div>
        </div>
      </div>
    </header>
  )
}
```

**Regras da topbar:** remover logo/CORH duplicado · breadcrumb à esquerda · usuário com `displayName` + iniciais + selo de perfil (ADM/Operacional etc.).

---

## 3. Componentes padrão (obrigatórios em TODAS as telas)

### 3.1 Botões
| Tipo | Classes | Uso |
|---|---|---|
| Primário | `bg-brand-gradient-soft text-white font-semibold rounded-lg px-4 py-2 text-[13px] shadow-sm hover:opacity-95 hover:shadow` | Aplicar, Nova Ocorrência, Nova Entrega, Salvar, Cadastrar |
| Secundário | `border border-input bg-white text-muted-foreground rounded-lg px-3.5 py-2 text-[13px] hover:border-primary/40 hover:text-primary` | Atualizar, Exportar, Importar, Filtros |
| Ghost | `text-muted-foreground rounded-lg px-3.5 py-2 text-[13px] hover:bg-muted` | Limpar, Cancelar |
| Destrutivo | ícone `text-muted-foreground hover:text-red-600` | Excluir (sempre ícone, nunca botão cheio) |

**Vocabulário único:** botão de executar filtro chama-se sempre **"Aplicar"** (eliminar "Filtrar" e "Buscar" dos formulários de filtro).

### 3.2 Cards
`rounded-2xl border border-border bg-card shadow-sm` · padding `p-4` (denso) ou `p-5/6` (resumo) · nunca degradê.

### 3.3 Inputs e selects (gatilho fechado)
`h-10 rounded-lg border border-input bg-white px-3 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15`
Busca: mesma base + `pl-9` com `<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />`.

### 3.4 Dropdowns abertos (Select, Combobox, Popover, DropdownMenu)

**Regra rígida — sem transparência:** todo conteúdo que flutua sobre a página usa `bg-popover` **100% opaco** (já é `#FFFFFF` sólido nos tokens). Proibido: `bg-white/80`, `bg-popover/90`, `backdrop-blur` em dropdowns, opacidade parcial.

```tsx
// Select (Radix/shadcn) — padronize o Content:
<SelectContent className="z-50 rounded-xl border border-border bg-popover p-1 shadow-lg">
  <SelectItem className="cursor-pointer rounded-lg px-3 py-2 text-[13px] outline-none
    data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground
    data-[state=checked]:font-semibold data-[state=checked]:text-primary">
    {label}
  </SelectItem>
</SelectContent>
```

Checklist do dropdown:
- [ ] Fundo: `bg-popover` sólido, **sem** `backdrop-blur`, **sem** classes com `/opacidade`
- [ ] Sombra única do sistema: `shadow-lg` (nada de `shadow-2xl` colorida)
- [ ] Canto: `rounded-xl` · padding interno `p-1` · itens `rounded-lg`
- [ ] Item em destaque (hover/teclado): `bg-accent` + texto `accent-foreground`
- [ ] Item selecionado: `font-semibold text-primary` (sem fundo colorido extra)
- [ ] Altura máxima `max-h-72` com rolagem interna
- [ ] z-index único: `z-50` (ver tabela de camadas na seção 3.6)
- [ ] DropdownMenu de ações (linha de tabela): mesmo padrão; item destrutivo `text-red-600` apenas no texto/ícone — nunca fundo vermelho

**Busca dentro do dropdown (Combobox / busca de colaborador):** input no topo com fundo `bg-muted/50`, lista abaixo no padrão acima; estado "nenhum resultado" com texto 12px cinza centralizado.

### 3.5 Diálogos de confirmação e modais (exclusão, cancelamento, edição)

**Componente único para TODAS as confirmações do sistema** (`AlertDialog` do shadcn) — não criar variações por módulo:

```tsx
<AlertDialogContent className="rounded-2xl border-border bg-card p-6 shadow-xl">
  <AlertDialogHeader>
    {/* Ícone padrão: círculo com tint da cor da ação */}
    <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-50">
      <Trash2 className="size-5 text-red-600" strokeWidth={1.8} />
    </div>
    <AlertDialogTitle className="text-center text-[16px] font-bold">
      Excluir ocorrência?
    </AlertDialogTitle>
    <AlertDialogDescription className="text-center text-[13px] text-muted-foreground">
      O registro [75301] Pedido de demissão será removido permanentemente.
      Esta ação não pode ser desfeita.
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter className="mt-4 flex gap-2 sm:justify-center">
    <AlertDialogCancel className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted">
      Cancelar
    </AlertDialogCancel>
    {/* Ação destrutiva: vermelho SÓLIDO — único botão vermelho do sistema */}
    <AlertDialogAction className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700">
      Sim, excluir
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>
```

Regras de overlay e modal:
- [ ] **Overlay (fundo escurecido): sempre `bg-black/60`** — um único valor no sistema inteiro (hoje varia). Nada de `bg-black/40` numa tela e `/80` noutra
- [ ] Caixa do modal: `bg-card` **sólido** — sem transparência, sem blur
- [ ] Estrutura fixa: ícone circular no topo → título 16px bold centralizado → descrição 13px cinza → botões centralizados
- [ ] **Botão destrutivo sólido `bg-red-600`** — reservado exclusivamente para confirmar exclusão/irreversível. Todo o resto usa primário azul
- [ ] Cancelamento de formulário (ex.: cancelar novo extra): mesma caixa, ícone `AlertTriangle` em `bg-amber-50 text-amber-600`, botão de confirmação **primário azul** ("Sim, cancelar") — não é destruição, então não usa vermelho
- [ ] Modais de formulário (editar registro): `Dialog` com mesma casca (`rounded-2xl bg-card p-6`), título à esquerda, rodapé com Cancelar (ghost) + Salvar (primário)
- [ ] Larguras: confirmação `max-w-sm` · formulário `max-w-lg` ou `max-w-2xl`
- [ ] Fechar: X no canto superior direito + tecla Esc + clique no overlay (exceto durante salvamento)

### 3.6 Camadas (z-index) — tabela única
| Camada | Valor |
|---|---|
| Conteúdo da página | `z-0` |
| Topbar fixa | `z-10` |
| Dropdown / Popover / Tooltip | `z-50` |
| Modal / AlertDialog + overlay | `z-[100]` |
| Toast / notificação | `z-[200]` |

### 3.7 Responsividade — OBRIGATÓRIO: o sistema inteiro funciona em desktop, notebook e celular

**Princípio:** o CORH é usado pela equipe administrativa/operacional em **desktop, notebook e celular**. TODA tela deve ser utilizável nos três formatos — nenhuma funcionalidade pode existir só no desktop. O que muda entre os formatos é a **disposição** dos elementos (colunas, menu), nunca a existência deles.

**Breakpoints (Tailwind padrão):** `sm 640` · `md 768` · `lg 1024` · `xl 1280`.
Resumo de uso típico: celular `< md` · tablet/notebook pequeno `md–lg` · desktop `≥ lg`.

**Sidebar:**
- `≥ lg` (desktop/notebook): fixa, 240px
- `< lg` (celular/tablet): vira gaveta (`Sheet` do shadcn) aberta por botão hambúrguer na topbar — mesma aparência (azul-marinho, mesmos itens), sobre overlay `bg-black/60`
- A gaveta fecha ao escolher um item ou tocar fora

**Topbar:**
- `≥ md`: completa (breadcrumb + busca + sino + usuário com nome)
- `< md` (celular): busca global vira ícone que expande em tela cheia; usuário mostra só avatar + selo de perfil; breadcrumb trunca com "…"

**Grids de filtros:**
- `lg`: 4 colunas · `md`: 2 colunas · `< md`: 1 coluna (empilhado)
- Botões Limpar/Aplicar sempre em linha própria à direita; no celular ocupam largura total (Aplicar primeiro, Limpar depois)

**Tabelas — regra anti-esmagamento (todas as listas):**
- Nunca comprimir colunas além do legível: wrapper com `overflow-x-auto` e largura mínima da tabela (`min-w-[720px]`; `min-w-[900px]` no CEU e em Movimentações)
- Cabeçalho fixo (`sticky top-0 bg-muted`) durante rolagem vertical
- Coluna de ações sempre visível: fixa à direita em telas estreitas (`sticky right-0 bg-card` com sombra lateral sutil)
- No celular, a rolagem horizontal da tabela é o comportamento **esperado e correto** — não tentar "encolher tudo para caber"
- Paginação: no celular mostra apenas ‹ anterior, próxima › e o texto "1–50 de 319"

**Dashboard:** hero empilha KPIs em 1 coluna `< sm`, 3 colunas `≥ sm`; cards (Contratos, Aniversariantes) empilham `< lg`.

**Formulários (Novo Extra, Nova Entrega, Nova Empresa, Adicionais…):**
- 2 colunas `≥ md` · 1 coluna `< md`
- Campos de data/hora lado a lado apenas `≥ sm`
- Botões de ação (Salvar/Cadastrar) com largura total no celular
- Alvos de toque mínimos de 40px (`h-10` já garante)

**Modais e confirmações:**
- `max-w-sm/lg` com margem lateral de 16px no celular (`mx-4`), nunca colados na borda
- Altura máxima `max-h-[85vh]` com rolagem interna no conteúdo

**Dropdowns:** no celular, respeitam a largura da tela com margem de 8px; nunca ultrapassam as bordas.

**Registro de Plantão (`/extras/mobile`):** é a tela pensada primeiro para o celular — coluna única centralizada `max-w-md` em qualquer largura (no desktop fica centralizada, sem esticar).

**Testes obrigatórios antes de dar uma tela por pronta:**
- [ ] Abrir em 1280px (desktop), 768px (notebook/tablet) e 390px (celular)
- [ ] Toda ação principal executável nos 3 tamanhos (filtrar, criar, editar, excluir, exportar)
- [ ] Nenhum texto ou botão cortado; nenhuma rolagem horizontal da PÁGINA (só dentro de tabelas)

### 3.8 Tabela padrão (vale para TODAS as listas do sistema)

```tsx
<section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
  <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
    <h2 className="text-[14px] font-semibold">
      Lista de colaboradores
      <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-primary">319</span>
    </h2>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead>
        {/* Cabeçalho ÚNICO do sistema: small-caps cinza sobre fundo muted */}
        <tr className="border-b border-border bg-muted/40">
          <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Colaborador</th>
          {/* ...demais colunas */}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        <tr className="group transition-colors hover:bg-accent/40">
          <td className="px-5 py-3 text-[13px] font-semibold">{/* nome */}</td>
          <td className="px-5 py-3 text-[12px] text-muted-foreground">{/* dado secundário */}</td>
          <td className="px-5 py-3 text-[12px] tabular-nums text-muted-foreground">{/* data/telefone/qtd */}</td>
          <td className="px-5 py-3">{/* badge de status — ver 3.5 */}</td>
          <td className="px-5 py-3">
            {/* Ações: discretas, ganham destaque no hover da linha */}
            <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
              <button className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm">
                <Pencil className="size-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  {/* Paginação SEMPRE visível */}
  <div className="flex items-center justify-between border-t border-border px-5 py-3">
    <p className="text-[12px] text-muted-foreground">Mostrando <b>1–50</b> de <b>319</b></p>
    {/* páginas: ativa com bg-brand-gradient-soft text-white */}
  </div>
</section>
```

**Checklist da tabela:** cabeçalho small-caps cinza (`text-[11px] uppercase tracking-wider`) · hover `bg-accent/40` · dados secundários `text-[12px] text-muted-foreground` · números/datas `tabular-nums` · cabeçalho fixo (`sticky top-0`) quando a lista rolar dentro de container · ações à direita reveladas no hover.

### 3.9 Badges de status
```tsx
<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
  <span className="size-1.5 rounded-full bg-emerald-500" /> Ativo
</span>
```
Verde = Ativo/em dia · Âmbar = Ativa/pendente (`bg-amber-50 text-amber-700 bg-amber-500`) · Vermelho = inativo/urgente (`bg-red-50 text-red-700`).

### 3.10 Abas de módulo (Escalas, Extras, Ocorrências, CEU…)
```tsx
<button className={cn('flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition',
  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground')}>
  <Icon className="size-4" strokeWidth={1.8} /> {label}
</button>
```

### 3.11 Barra de filtros
Card próprio (`rounded-2xl border bg-card p-4`) acima da lista · grid de inputs (3.3) · à direita: **Limpar** (ghost) + **Aplicar** (primário) · sem caixas de texto explicativas — ajuda vira ícone `<HelpCircle className="size-4" />` com `title`/tooltip.

### 3.12 Estado vazio (sempre com ação)
```tsx
<div className="flex flex-col items-center gap-3 py-12 text-center">
  <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
    <CalendarRange className="size-6" strokeWidth={1.8} />
  </div>
  <p className="text-[13px] text-muted-foreground">Nenhum registro para os filtros selecionados.</p>
  <button className="bg-brand-gradient-soft rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-sm">
    Importar escala
  </button>
</div>
```

### 3.13 Tipografia
Título de página `text-[22px] font-bold tracking-tight` · subtítulo `text-[13px] text-muted-foreground` · corpo 13px · metadados 11–12px · saudação do Dashboard `text-[24px] lg:text-[28px] font-bold`.

---

## 4. Login (manter — apenas alinhar)
A tela de login atual é a referência de identidade e **permanece**. Ajustes mínimos: botão "Entrar" passa a usar `bg-brand-gradient-soft`; garantir que o azul do painel combine com os tokens novos (`#0A142E → #102C5E → #1E6FBF`).

---

## 5. Checklist tela por tela (TODAS as rotas)

### 5.1 Dashboard `/`
- [ ] Hero `bg-brand-gradient` com saudação por `displayName` + data + Central de Alertas (contador) + 3 KPIs embutidos (Colaboradores ativos · Ocorrências pendentes · Contratos de experiência)
- [ ] KPIs compactos, sem espaço vazio vertical, com contexto ("Total geral: 508")
- [ ] Contratos de experiência: badge de urgência (≤5 dias vermelho, demais âmbar)
- [ ] Aniversariantes: lista simples, ícone único
- [ ] Cartões de atalho clicáveis para módulos

### 5.2 Colaboradores `/colaboradores`
- [ ] Tabela no padrão 3.8 (cabeçalho small-caps, avatar com iniciais, paginação visível)
- [ ] "Filtrar" → **"Aplicar"** primário

### 5.3 Departamentos `/departamentos`
- [ ] Tabela no padrão 3.8 · "Novo departamento" = primário
- [ ] Botões Excel/CSV/Sync = secundários

### 5.4 Empresas `/empresas`
- [ ] Botão "Cadastrar" sai do cinza → **primário degradê**
- [ ] Tabela no padrão 3.8

### 5.5 Escalas `/escalas`
- [ ] Abas no padrão 3.10 · filtros no padrão 3.11 ("Filtrar" → "Aplicar")
- [ ] Estado vazio com ícone + botão **"Importar escala"** (padrão 3.12)
- [ ] Exportar Excel/PDF = secundários

### 5.6 Extras `/extras/*`
- [ ] Abas (Lançamentos, Novo, Balanço, Relatório, Recibos, Categorias, Mobile) no padrão 3.10
- [ ] "Novo extra" = primário · estado vazio com ação
- [ ] Formulário Novo Extra / Registro de Plantão: inputs no padrão 3.3, Salvar = primário

### 5.7 Férias `/rh/ferias`
- [ ] Aplicar padrões 3.8/3.10/3.11/3.12 (tela não revisada — seguir o sistema)

### 5.8 Ocorrências `/rh/ocorrencias`
- [ ] **Busca unificada:** 1 campo + seletor segmentado `Cadastrados | Históricos` (placeholder muda conforme seleção) — eliminar campo amarelo duplo
- [ ] Caixa "Dica para encontrar ocorrências" → ícone `<HelpCircle />` com tooltip
- [ ] "Aplicar" primário · tabela no padrão 3.8 · ações (ver/editar/excluir) discretas no hover

### 5.9 Adicionais `/adicionais/contratos`
- [ ] "Salvar" sai do cinza → primário · tabela no padrão 3.8 · estado vazio com ação

### 5.10 Benefícios `/vr/projetos`
- [ ] "Novo projeto" = primário · estado vazio com botão de ação · filtros no padrão 3.11

### 5.11 CEU `/ceu/movimentacoes`
- [ ] **Legenda fixa acima da lista:** 🟠 EPI · 🟢 Uniforme · 🟡 Crachá (badges pequenos com as cores existentes)
- [ ] "Nova Entrega" = primário · demais ações secundárias · tabela já está próxima do padrão — alinhar tokens

### 5.12 Gestão `/gestao/*` (Auditoria, e-Contador, Permissões) e Relatórios
- [ ] Aplicar padrões 3.8/3.10/3.11/3.12

---

## 6. Ordem de implementação sugerida
1. **Tokens** (`index.css`) + utilitários de degradê
2. **Sidebar + Topbar** (visíveis em todas as telas)
3. **Componentes compartilhados** (botões, tabela, filtros, badge, estado vazio) — idealmente extrair para `src/components/corh/`
4. **Telas** na ordem: Dashboard → Colaboradores → Ocorrências → CEU → demais

## 7. Critérios de aceite (Definition of Done)
- [ ] Nenhum ícone colorido por módulo na sidebar
- [ ] Marca aparece 1 vez por tela (só na sidebar; só no painel do login)
- [ ] Login técnico nunca exibido (sempre `displayName` + perfil)
- [ ] Todo botão de filtro diz "Aplicar"; todo CTA principal usa `bg-brand-gradient-soft`
- [ ] Toda tabela: small-caps + hover `bg-accent/40` + paginação visível
- [ ] Todo estado vazio tem ícone + ação sugerida
- [ ] Degradê somente nos 3 lugares definidos
- [ ] Ocorrências com busca unificada e sem caixa de instruções
- [ ] CEU com legenda de cores visível
- [ ] **Nenhum dropdown, modal ou caixa flutuante com transparência/blur** — tudo `bg-popover`/`bg-card` sólido
- [ ] Todo overlay de modal usa exatamente `bg-black/60`
- [ ] Toda exclusão/cancelamento passa pelo AlertDialog padrão (ícone circular + título centralizado); vermelho sólido `bg-red-600` só em ação irreversível
- [ ] Toda exclusão por ícone em tabela usa DropdownMenu padrão ou botão-ícone discreto — nunca botão vermelho cheio na linha
- [ ] z-index respeita a tabela única (dropdown `z-50`, modal `z-[100]`, toast `z-[200]`)
- [ ] Em `< lg`: sidebar vira gaveta; filtros empilham; tabelas rolam horizontalmente sem esmagar colunas
- [ ] Tabela de camadas, sombras (`shadow-lg` dropdown / `shadow-xl` modal) e raios idênticos em todas as telas
- [ ] **Toda tela testada em 1280px, 768px e 390px** — todas as ações executáveis nos 3 tamanhos (desktop, notebook/tablet, celular)
- [ ] Nenhuma rolagem horizontal da página inteira (apenas dentro de tabelas)
- [ ] Nenhuma funcionalidade disponível apenas no desktop
