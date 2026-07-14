# Design System — CORH

> Versão: 1.0 — Julho/2026
> Paleta definida pelo agente especialista em design.

## Identidade visual

O CORH adota uma identidade **clean, minimalista e coesa**, inspirada no azul do Microsoft Edge, com fundo azul sutil e ícones em cores pastel-vivas.

## Paleta de cores

### Cores principais

| Nome | Hex | Uso |
|------|-----|-----|
| `--primary-600` | `#0F5EDD` | Botões primários, links ativos, indicadores principais |
| `--primary-500` | `#2B7EFF` | Hover, destaques leves |
| `--primary-700` | `#0A46AA` | Texto em fundos claros, ênfase forte |
| `--bg-page` | `#E8F1FA` | Fundo geral das páginas |
| `--bg-page-soft` | `#F3F8FD` | Fundo de seções alternadas |
| `--surface` | `#FFFFFF` | Cards, painéis, modais |
| `--border-color` | `#D4E3F3` | Bordas de cards, divisores, tabelas |
| `--border-focus` | `#2B7EFF` | Inputs e selects focados |

### Acento

| Nome | Hex | Uso |
|------|-----|-----|
| `--accent-teal` | `#00BFA6` | Verde-água — badges de sucesso leve, CTAs secundários, ícones de destaque |
| `--accent-teal-soft` | `#E0F7F4` | Fundos de alertas positivos |

### Texto

| Nome | Hex | Uso |
|------|-----|-----|
| `--text-primary` | `#1A2B44` | Títulos e texto principal |
| `--text-secondary` | `#4A6B93` | Subtítulos, ícones da sidebar |
| `--text-muted` | `#7A9ABE` | Placeholders, labels, textos desabilitados |

### Cores semânticas

| Status | Cor | Fundo suave |
|--------|-----|-------------|
| Sucesso | `#22A36C` | `#E8F5EE` |
| Aviso | `#E09E2C` | `#FDF4E3` |
| Perigo | `#D6454B` | `#FDEBEC` |
| Info | `#2B7EFF` | `#E8F1FA` |

### KPIs

| Uso | Cor |
|-----|-----|
| Principal | `#0F5EDD` |
| Positivo/crescimento | `#22A36C` |
| Atenção | `#E09E2C` |
| Complementar | `#5B6CC4` |

### Cores de domínio EPI/Uniforme (preservadas)

| Categoria | Cor | Fundo suave |
|-----------|-----|-------------|
| EPI | `#F29C38` | `#FCE8D3` |
| Uniforme — Azul | `#2B7EFF` | `#D6E7FF` |
| Uniforme — Verde | `#22A36C` | `#D6F0E3` |

> Essas cores são usadas **apenas** em relatórios, badges e gráficos de EPI/Uniforme.

## Componentes unificados

### `ModuleShell`

Wrapper de página com tabs opcionais. Usado por todos os módulos.

```tsx
import { ModuleShell } from '@/components/layout/ModuleShell'

<ModuleShell tabs={[{ path: '/ceu/itens', label: 'Itens', icon: Package }]}>
  {/* conteúdo */}
</ModuleShell>
```

### `ModuleCard`

Card padrão com header opcional.

```tsx
import { ModuleCard } from '@/components/layout/ModuleShell'

<ModuleCard title="Título" description="Descrição" icon={<Icon />}>
  {/* conteúdo */}
</ModuleCard>
```

### `ModuleButton`

Botão padrão do sistema.

```tsx
import { ModuleButton } from '@/components/layout/ModuleShell'

<ModuleButton variant="primary" size="default">Salvar</ModuleButton>
<ModuleButton variant="outline" size="sm">Cancelar</ModuleButton>
<ModuleButton variant="danger" size="icon"><Trash2 /></ModuleButton>
```

### Componentes compartilhados

- `DepartamentoAutocomplete` — autocomplete de departamentos

## Densidade

- Fundo de página: `--bg-page` (`#F8FAFC`)
- Padding do wrapper: `p-4 md:p-5`
- Espaçamento entre cards: `space-y-4`
- Padding interno do card: `p-5`
- Botão padrão: `h-9 px-4 text-sm`
- Botão grande: `h-10 px-5 text-sm`
- Título de página: `text-xl`
- Texto de label: `text-xs` ou `text-sm`

## Regras

1. **Não usar cores hex hardcoded** em novas páginas. Use as variáveis CSS ou classes Tailwind baseadas no tema.
2. **Não criar componentes por módulo**. Use `ModuleCard`, `ModuleButton`, `ModuleShell`.
3. **Preservar as cores de EPI/Uniforme** apenas nos contextos de relatório.
4. **Ícones alegres em cores pastel-vivas**, nunca cinza monótono.
5. **Cards brancos** com sombra suave e borda azulada.
6. **Build em máquina fraca**: usar `NODE_OPTIONS=--max-old-space-size=4096` para lint/build.

## Arquivos-chave

- `src/index.css` — variáveis CSS do tema
- `src/components/layout/ModuleShell.tsx` — componentes unificados
- `src/components/shared/` — componentes compartilhados
