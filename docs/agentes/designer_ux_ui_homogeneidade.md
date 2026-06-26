# Relatório de UX/UI — Homogeneidade Visual do CORH

**Data:** 2026-06-25  
**Responsável:** Designer de Produto Sênior / UX Reviewer  
**Escopo:** Consistência visual geral, fluxo mobile `/mobile/falta`, telas de Extras/Recibos e diretrizes para o módulo de Férias.

---

## 1. Avaliação geral de consistência visual

### 1.1 Paleta de cores
O sistema adota uma identidade sóbria baseada em tons de cinza/azul-escuro:

- `#1F2937` (gray-800) → cor principal de títulos, sidebar, botões primários do módulo Extras;
- `#F8FAFC` (slate-50) → fundo das páginas;
- `#94A3B8` (slate-400) → textos secundários;
- `#E2E8F0` / `#F1F5F9` → bordas e divisores.

**Problema crítico:** o design token `--primary` definido em `src/index.css` aponta para `hsl(222.2 47.4% 11.2%)`, que equivale ao slate-900 (`#0f172a`), **não** ao `#1F2937` usado em quase todo o código. Isso faz com que `<Button>` do shadcn renderize num tom mais azulado/escuro que os botões customizados (`ExtrasButton`), gerando descasamento visual.

### 1.2 Tipografia
- A fonte `Inter` é declarada globalmente no `body`, mas `ExtrasPageWrapper` reinsere `font-family: Inter, sans-serif` via `style`, criando redundância.
- Os tamanhos de título não seguem uma escala fixa:
  - Dashboard: `text-lg font-semibold text-slate-900`;
  - Extras: `text-2xl font-bold` com cor inline `#1F2937`;
  - Mobile: `text-xl font-bold`.
- Há mistura de `font-semibold`, `font-bold` e `font-medium` para funções similares.

### 1.3 Bordas e arredondamento
Três raios diferentes coexistem para a mesma função de “card”:

- `rounded-xl` (componentes shadcn);
- `rounded-[12px]` (Dashboard, Colaboradores);
- `rounded-2xl` (MobileFaltaPage).

O mesmo ocorre com inputs: `rounded-md` (shadcn padrão) vs `rounded-lg` vs `rounded-xl`.

### 1.4 Componentes
Há **três camadas de componentes** convivendo:

1. **shadcn/ui** (`Button`, `Input`, `Select`, `Dialog`, `Table`, `Card`);
2. **Componentes próprios do módulo Extras** (`ExtrasButton`, `ExtrasCard`);
3. **Elementos HTML nativos** (`<select>`, `<input type="checkbox">`).

Cada camada possui alturas, cores de foco, estados disabled e padding distintos. O resultado é uma UI funcional, mas com cara de “costurada”.

### 1.5 Espaçamento
- Grid gaps variam entre `gap-2`, `gap-3`, `gap-4` e `gap-6` sem regra clara.
- Padding de cards oscila: `p-4`, `p-5`, `p-6`, `!p-4`.

---

## 2. Problemas de UX encontrados

| # | Problema | Onde ocorre | Impacto |
|---|----------|-------------|---------|
| 1 | **Feedback de erro via toast** longe do campo | `MobileFaltaPage`, `ExtrasPlantaoPage`, `ExtrasFormPage` | O usuário precisa associar a mensagem ao campo sozinho; em mobile, o toast pode sumir antes da correção. |
| 2 | **Tabelas não adaptadas a mobile** | `ExtrasLancamentosPage`, `ExtrasRecibosPage` | Scroll horizontal e botões pequenos dificultam o toque. |
| 3 | **Botões de ação com ícones pequenos** | Tabelas de Extras/Recibos | Área de toque abaixo do recomendado (44×44 px). |
| 4 | **Select nativo misturado com Select shadcn** | `ExtrasRecibosPage` (filtro Empresa), `MobileFaltaPage` | Quebra a consistência visual. |
| 5 | **Card de alertas do Dashboard pode perder a borda esquerda** | `DashboardPage` | `border-none` + `border-l-4 border-l-red-500` podem conflitar no Tailwind. |
| 6 | **Tela de revisão com `max-w-[55%]`** | `MobileFaltaPage` passo 5 | Em telas pequenas, textos longos quebram ou ficam desalinhados. |
| 7 | **Indicador de passos com 5 círculos de 40 px** | `MobileFaltaPage` | Em telas < 360 px, os círculos ficam apertados. |
| 8 | **Falta de estado de carregamento** | `MobileFaltaPage`, `ExtrasPlantaoPage` | O usuário não sabe se as listas de colaboradores/departamentos ainda estão carregando. |
| 9 | **Ações destrutivas sem confirmação além de `window.confirm`** | `ExtrasRecibosPage`, `ExtrasLancamentosPage` | Experiência abrupta; ideal seria modal de confirmação padronizado. |
| 10 | **Checkboxes nativos diferentes do componente `Checkbox`** | `ExtrasFormPage`, `ExtrasRecibosPage`, `ExtrasPlantaoPage` | O componente `Checkbox` do projeto é customizado (slate-900), mas vários formulários usam o input nativo. |
| 11 | **Filtros ocupam muito espaço vertical** | `ExtrasLancamentosPage`, `ExtrasRecibosPage` | O conteúdo principal fica abaixo da dobra em telas pequenas. |

---

## 3. Sugestões específicas para melhorar a `MobileFaltaPage`

A ideia **não é reinventar** o fluxo, mas ajustar o que existe para ficar mais coeso, acessível e mobile-first.

### 3.1 Inputs e selects
- **Opção A (recomendada):** manter os selects nativos em mobile — eles abrem o picker do SO e são ótimos para touch —, mas estilizar com a mesma altura (56 px), raio (`rounded-xl`), borda (`#E2E8F0`) e cor de texto (`#1F2937`) dos inputs customizados.
- **Opção B:** usar o componente `Select` do shadcn com altura aumentada (`h-14`) e fonte `text-base` para evitar zoom no iOS.

### 3.2 Feedback de validação
- Substituir `toast.error` por mensagens inline abaixo de cada campo obrigatório.
- Manter o toast apenas para erros de servidor ou confirmação de salvamento.

### 3.3 Navegação entre passos
- Tornar os círculos dos passos já concluídos clicáveis para voltar.
- Em telas pequenas, reduzir o grid de turnos para 2 colunas (`grid-cols-2 sm:grid-cols-3`).

### 3.4 Tela de revisão (passo 5)
- Evitar `max-w-[55%]` com `justify-between`. Preferir cards de resumo em duas colunas ou listar cada item como:

```
Data
17/06/2026
```

Isso melhora a legibilidade em telas estreitas.

### 3.5 Tela de sucesso
- Adicionar botão **“Voltar ao início”** / “Voltar ao dashboard” além de “Novo registro” e “Ver lançamentos”.
- Adicionar animação sutil no ícone de check.

### 3.6 Loading
- Exibir skeleton ou spinner enquanto `colaboradores` e `departamentos` ainda não foram carregados.

### 3.7 Botões de opção
- Padronizar raio com os inputs (`rounded-xl` ou `rounded-lg`).
- Garantir altura mínima de 48 px e boa área de toque.

---

## 4. Sugestões para o módulo de Férias (usabilidade mobile)

> **Nota:** Não foi localizado um briefing detalhado do módulo de férias no repositório. As sugestões abaixo são baseadas no placeholder `/ferias`, nas boas práticas de gestão de férias e na necessidade de manter consistência com os demais módulos.

### 4.1 Visão geral / Dashboard de férias
- Cards de resumo: **Em férias**, **Programadas**, **Pendentes de agendamento**, **Períodos vencidos**.
- Alerta visual quando um colaborador estiver próximo de perder o direito (similar aos alertas do Dashboard).

### 4.2 Listagem mobile
- **Usar cards, nunca tabelas**, em telas pequenas. Cada card deve conter:
  - Nome do colaborador;
  - Período (início → fim);
  - Dias de direito / dias gozados / saldo;
  - Status (programada, gozando, gozada, cancelada) com badge colorido;
  - Ações principais (editar, cancelar, imprimir).

### 4.3 Formulário de agendamento em passos
Sugestão de fluxo mobile:

1. **Colaborador e período** — autocomplete + calendário;
2. **Tipo** — férias integrais, parceladas, abono/pecúlio;
3. **Cobertura / substituto** — integrar com o módulo de extras para sugerir preenchimento de falta/substituição;
4. **Revisão e confirmação**.

### 4.4 Calendário
- Exibir calendário mensal com destaque para períodos de férias.
- Indicar dias úteis vs fins de semana/feriados.

### 4.5 Relatórios e exportação
- Botão claro para exportar em PDF/Excel.
- Filtros rápidos: “Próximas 30 dias”, “Vencidos”, “Por departamento”.

### 4.6 Integração
- Quando um colaborador for marcado como “Férias”, sugerir automaticamente o lançamento de falta/cobertura no módulo Extras.

---

## 5. Proposta de padrões para manter homogeneidade

### 5.1 Tokens de cor
Atualizar `src/index.css` para refletir a identidade real do CORH:

```css
:root {
  --primary: 220 13% 18%;        /* próximo de #1F2937 */
  --primary-foreground: 0 0% 100%;
  --background: 210 40% 98%;     /* #F8FAFC */
  --foreground: 220 13% 18%;
  --muted-foreground: 215 16% 47%; /* #64748B */
  --border: 214 32% 91%;         /* #E2E8F0 */
}
```

A partir daí, usar `bg-primary`, `text-primary`, `text-muted-foreground`, `border-border` em vez de cores hex inline.

### 5.2 Tipografia
| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Título de página | `text-2xl font-bold` | `text-xl font-bold` |
| Subtítulo | `text-sm text-muted-foreground` | `text-xs text-muted-foreground` |
| Label de campo | `text-sm font-medium` | `text-base font-medium` |
| Valor/corpo | `text-sm` | `text-base` |

### 5.3 Raio e sombreamento
- Adotar `rounded-xl` para cards e `rounded-lg` para inputs/botões secundários.
- Remover `rounded-[12px]` e `rounded-[8px]` espalhados.

### 5.4 Inputs e botões touch
- Altura mínima: **48 px** desktop / **56 px** mobile.
- Fonte mínima: **16 px** em inputs mobile para evitar zoom no iOS.
- Área de toque mínima: **44×44 px**.

### 5.5 Componentes
- **Priorizar os componentes shadcn/ui** (`Button`, `Input`, `Select`, `Dialog`, `Card`, `Checkbox`).
- Depreciar `ExtrasButton` e `ExtrasCard` ou reescrevê-los como thin wrappers sobre os componentes shadcn.
- Nunca usar `<select>` nativo salvo em telas mobile onde o picker nativo seja intencional e estilizado.

### 5.6 Tabelas
- Em `md` ou menor, transformar linhas da tabela em **cards**.
- Manter `<Table>` apenas para breakpoints `md+`.

### 5.7 Feedback
- Validações de formulário: **inline** (mensagem abaixo do campo).
- Toasts: sucesso, erro de servidor, confirmação de ações.

### 5.8 Acessibilidade
- Foco visível (`focus-visible:ring-2 focus-visible:ring-primary`).
- `aria-label` em botões de ícone.
- Labels associadas a cada input (`htmlFor` + `id`).

---

## 6. Ajustes rápidos que podem ser feitos amanhã

Abaixo uma lista acionável, ordenada do menor para o maior esforço:

- [ ] **1. Corrigir token `--primary`** em `src/index.css` para `#1F2937`.
- [ ] **2. Padronizar raio dos cards** para `rounded-xl` (ou definir `rounded-[12px]` globalmente e aplicar em todo lugar).
- [ ] **3. Corrigir borda esquerda do card de alertas** no `DashboardPage` (remover conflito `border-none` / `border-l-4`).
- [ ] **4. Substituir `<select>` nativo** do filtro Empresa em `ExtrasRecibosPage` pelo componente `Select` do shadcn.
- [ ] **5. Aumentar área de toque** dos botões de ação das tabelas (`size-5`, `min-w-[44px]`, `min-h-[44px]`).
- [ ] **6. Adicionar estado de loading** (skeleton ou spinner) em `MobileFaltaPage` e `ExtrasPlantaoPage` enquanto carregam colaboradores/departamentos.
- [ ] **7. Trocar checkboxes nativos** por `<Checkbox>` do projeto em `ExtrasFormPage`, `ExtrasRecibosPage` e `ExtrasPlantaoPage`.
- [ ] **8. Ajustar `MobileFaltaPage`:**
  - tornar passos concluídos clicáveis;
  - grid de turnos responsivo (`grid-cols-2 sm:grid-cols-3`);
  - mensagens de erro inline;
  - adicionar botão “Voltar ao dashboard” na tela de sucesso.
- [ ] **9. Criar esboço da página `/ferias`** substituindo o placeholder por cards de resumo e botão “Novo agendamento”.
- [ ] **10. Documentar** esses padrões em um `DESIGN_SYSTEM.md` ou atualizar `AGENTS.md` para que novas telas os sigam.

---

## Conclusão

O CORH já possui uma identidade visual clara e componentes funcionais, mas ainda sofre com **descasamento de tokens, duplicação de componentes e responsividade em telas pequenas**. Os ganhos mais imediatos virão de:

1. Alinhar os tokens CSS à paleta real usada nas telas;
2. Consolidar os componentes de UI (shadcn como base);
3. Adaptar tabelas e formulários para mobile;
4. Melhorar o feedback de erro/loading.

A `MobileFaltaPage` está no caminho certo com seu fluxo em passos, mas precisa de refinamentos de usabilidade. O módulo de férias deve reaproveitar a mesma abordagem mobile-first: cards, passos e integração com o fluxo de extras.

---

**Próximo passo recomendado:** abrir uma task de refactor de UI para consolidar `ExtrasButton`/`ExtrasCard` nos componentes shadcn e criar um pequeno style guide no repositório.
```

# Relatório de UX/UI — Homogeneidade Visual do CORH

**Data:** 2026-06-25  
**Responsável:** Designer de Produto Sênior / UX Reviewer  
**Escopo:** Consistência visual geral, fluxo mobile `/mobile/falta`, telas de Extras/Recibos e diretrizes para o módulo de Férias.

---

## 1. Avaliação geral de consistência visual

### 1.1 Paleta de cores
O sistema adota uma identidade sóbria baseada em tons de cinza/azul-escuro:

- `#1F2937` (gray-800) → cor principal de títulos, sidebar, botões primários do módulo Extras;
- `#F8FAFC` (slate-50) → fundo das páginas;
- `#94A3B8` (slate-400) → textos secundários;
- `#E2E8F0` / `#F1F5F9` → bordas e divisores.

**Problema crítico:** o design token `--primary` definido em `src/index.css` aponta para `hsl(222.2 47.4% 11.2%)`, que equivale ao slate-900 (`#0f172a`), **não** ao `#1F2937` usado em quase todo o código. Isso faz com que `<Button>` do shadcn renderize num tom mais azulado/escuro que os botões customizados (`ExtrasButton`), gerando descasamento visual.

### 1.2 Tipografia
- A fonte `Inter` é declarada globalmente no `body`, mas `ExtrasPageWrapper` reinsere `font-family: Inter, sans-serif` via `style`, criando redundância.
- Os tamanhos de título não seguem uma escala fixa:
  - Dashboard: `text-lg font-semibold text-slate-900`;
  - Extras: `text-2xl font-bold` com cor inline `#1F2937`;
  - Mobile: `text-xl font-bold`.
- Há mistura de `font-semibold`, `font-bold` e `font-medium` para funções similares.

### 1.3 Bordas e arredondamento
Três raios diferentes coexistem para a mesma função de “card”:

- `rounded-xl` (componentes shadcn);
- `rounded-[12px]` (Dashboard, Colaboradores);
- `rounded-2xl` (MobileFaltaPage).

O mesmo ocorre com inputs: `rounded-md` (shadcn padrão) vs `rounded-lg` vs `rounded-xl`.

### 1.4 Componentes
Há **três camadas de componentes** convivendo:

1. **shadcn/ui** (`Button`, `Input`, `Select`, `Dialog`, `Table`, `Card`);
2. **Componentes próprios do módulo Extras** (`ExtrasButton`, `ExtrasCard`);
3. **Elementos HTML nativos** (`<select>`, `<input type="checkbox">`).

Cada camada possui alturas, cores de foco, estados disabled e padding distintos. O resultado é uma UI funcional, mas com cara de “costurada”.

### 1.5 Espaçamento
- Grid gaps variam entre `gap-2`, `gap-3`, `gap-4` e `gap-6` sem regra clara.
- Padding de cards oscila: `p-4`, `p-5`, `p-6`, `!p-4`.

---

## 2. Problemas de UX encontrados

| # | Problema | Onde ocorre | Impacto |
|---|----------|-------------|---------|
| 1 | **Feedback de erro via toast** longe do campo | `MobileFaltaPage`, `ExtrasPlantaoPage`, `ExtrasFormPage` | O usuário precisa associar a mensagem ao campo sozinho; em mobile, o toast pode sumir antes da correção. |
| 2 | **Tabelas não adaptadas a mobile** | `ExtrasLancamentosPage`, `ExtrasRecibosPage` | Scroll horizontal e botões pequenos dificultam o toque. |
| 3 | **Botões de ação com ícones pequenos** | Tabelas de Extras/Recibos | Área de toque abaixo do recomendado (44×44 px). |
| 4 | **Select nativo misturado com Select shadcn** | `ExtrasRecibosPage` (filtro Empresa), `MobileFaltaPage` | Quebra a consistência visual. |
| 5 | **Card de alertas do Dashboard pode perder a borda esquerda** | `DashboardPage` | `border-none` + `border-l-4 border-l-red-500` podem conflitar no Tailwind. |
| 6 | **Tela de revisão com `max-w-[55%]`** | `MobileFaltaPage` passo 5 | Em telas pequenas, textos longos quebram ou ficam desalinhados. |
| 7 | **Indicador de passos com 5 círculos de 40 px** | `MobileFaltaPage` | Em telas < 360 px, os círculos ficam apertados. |
| 8 | **Falta de estado de carregamento** | `MobileFaltaPage`, `ExtrasPlantaoPage` | O usuário não sabe se as listas de colaboradores/departamentos ainda estão carregando. |
| 9 | **Ações destrutivas sem confirmação além de `window.confirm`** | `ExtrasRecibosPage`, `ExtrasLancamentosPage` | Experiência abrupta; ideal seria modal de confirmação padronizado. |
| 10 | **Checkboxes nativos diferentes do componente `Checkbox`** | `ExtrasFormPage`, `ExtrasRecibosPage`, `ExtrasPlantaoPage` | O componente `Checkbox` do projeto é customizado (slate-900), mas vários formulários usam o input nativo. |
| 11 | **Filtros ocupam muito espaço vertical** | `ExtrasLancamentosPage`, `ExtrasRecibosPage` | O conteúdo principal fica abaixo da dobra em telas pequenas. |

---

## 3. Sugestões específicas para melhorar a `MobileFaltaPage`

A ideia **não é reinventar** o fluxo, mas ajustar o que existe para ficar mais coeso, acessível e mobile-first.

### 3.1 Inputs e selects
- **Opção A (recomendada):** manter os selects nativos em mobile — eles abrem o picker do SO e são ótimos para touch —, mas estilizar com a mesma altura (56 px), raio (`rounded-xl`), borda (`#E2E8F0`) e cor de texto (`#1F2937`) dos inputs customizados.
- **Opção B:** usar o componente `Select` do shadcn com altura aumentada (`h-14`) e fonte `text-base` para evitar zoom no iOS.

### 3.2 Feedback de validação
- Substituir `toast.error` por mensagens inline abaixo de cada campo obrigatório.
- Manter o toast apenas para erros de servidor ou confirmação de salvamento.

### 3.3 Navegação entre passos
- Tornar os círculos dos passos já concluídos clicáveis para voltar.
- Em telas pequenas, reduzir o grid de turnos para 2 colunas (`grid-cols-2 sm:grid-cols-3`).

### 3.4 Tela de revisão (passo 5)
- Evitar `max-w-[55%]` com `justify-between`. Preferir cards de resumo em duas colunas ou listar cada item como:

```
Data
17/06/2026
```

Isso melhora a legibilidade em telas estreitas.

### 3.5 Tela de sucesso
- Adicionar botão **“Voltar ao início”** / “Voltar ao dashboard” além de “Novo registro” e “Ver lançamentos”.
- Adicionar animação sutil no ícone de check.

### 3.6 Loading
- Exibir skeleton ou spinner enquanto `colaboradores` e `departamentos` ainda não foram carregados.

### 3.7 Botões de opção
- Padronizar raio com os inputs (`rounded-xl` ou `rounded-lg`).
- Garantir altura mínima de 48 px e boa área de toque.

---

## 4. Sugestões para o módulo de Férias (usabilidade mobile)

> **Nota:** Não foi localizado um briefing detalhado do módulo de férias no repositório. As sugestões abaixo são baseadas no placeholder `/ferias`, nas boas práticas de gestão de férias e na necessidade de manter consistência com os demais módulos.

### 4.1 Visão geral / Dashboard de férias
- Cards de resumo: **Em férias**, **Programadas**, **Pendentes de agendamento**, **Períodos vencidos**.
- Alerta visual quando um colaborador estiver próximo de perder o direito (similar aos alertas do Dashboard).

### 4.2 Listagem mobile
- **Usar cards, nunca tabelas**, em telas pequenas. Cada card deve conter:
  - Nome do colaborador;
  - Período (início → fim);
  - Dias de direito / dias gozados / saldo;
  - Status (programada, gozando, gozada, cancelada) com badge colorido;
  - Ações principais (editar, cancelar, imprimir).

### 4.3 Formulário de agendamento em passos
Sugestão de fluxo mobile:

1. **Colaborador e período** — autocomplete + calendário;
2. **Tipo** — férias integrais, parceladas, abono/pecúlio;
3. **Cobertura / substituto** — integrar com o módulo de extras para sugerir preenchimento de falta/substituição;
4. **Revisão e confirmação**.

### 4.4 Calendário
- Exibir calendário mensal com destaque para períodos de férias.
- Indicar dias úteis vs fins de semana/feriados.

### 4.5 Relatórios e exportação
- Botão claro para exportar em PDF/Excel.
- Filtros rápidos: “Próximas 30 dias”, “Vencidos”, “Por departamento”.

### 4.6 Integração
- Quando um colaborador for marcado como “Férias”, sugerir automaticamente o lançamento de falta/cobertura no módulo Extras.

---

## 5. Proposta de padrões para manter homogeneidade

### 5.1 Tokens de cor
Atualizar `src/index.css` para refletir a identidade real do CORH:

```css
:root {
  --primary: 220 13% 18%;        /* próximo de #1F2937 */
  --primary-foreground: 0 0% 100%;
  --background: 210 40% 98%;     /* #F8FAFC */
  --foreground: 220 13% 18%;
  --muted-foreground: 215 16% 47%; /* #64748B */
  --border: 214 32% 91%;         /* #E2E8F0 */
}
```

A partir daí, usar `bg-primary`, `text-primary`, `text-muted-foreground`, `border-border` em vez de cores hex inline.

### 5.2 Tipografia
| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Título de página | `text-2xl font-bold` | `text-xl font-bold` |
| Subtítulo | `text-sm text-muted-foreground` | `text-xs text-muted-foreground` |
| Label de campo | `text-sm font-medium` | `text-base font-medium` |
| Valor/corpo | `text-sm` | `text-base` |

### 5.3 Raio e sombreamento
- Adotar `rounded-xl` para cards e `rounded-lg` para inputs/botões secundários.
- Remover `rounded-[12px]` e `rounded-[8px]` espalhados.

### 5.4 Inputs e botões touch
- Altura mínima: **48 px** desktop / **56 px** mobile.
- Fonte mínima: **16 px** em inputs mobile para evitar zoom no iOS.
- Área de toque mínima: **44×44 px**.

### 5.5 Componentes
- **Priorizar os componentes shadcn/ui** (`Button`, `Input`, `Select`, `Dialog`, `Card`, `Checkbox`).
- Depreciar `ExtrasButton` e `ExtrasCard` ou reescrevê-los como thin wrappers sobre os componentes shadcn.
- Nunca usar `<select>` nativo salvo em telas mobile onde o picker nativo seja intencional e estilizado.

### 5.6 Tabelas
- Em `md` ou menor, transformar linhas da tabela em **cards**.
- Manter `<Table>` apenas para breakpoints `md+`.

### 5.7 Feedback
- Validações de formulário: **inline** (mensagem abaixo do campo).
- Toasts: sucesso, erro de servidor, confirmação de ações.

### 5.8 Acessibilidade
- Foco visível (`focus-visible:ring-2 focus-visible:ring-primary`).
- `aria-label` em botões de ícone.
- Labels associadas a cada input (`htmlFor` + `id`).

---

## 6. Ajustes rápidos que podem ser feitos amanhã

Abaixo uma lista acionável, ordenada do menor para o maior esforço:

- [ ] **1. Corrigir token `--primary`** em `src/index.css` para `#1F2937`.
- [ ] **2. Padronizar raio dos cards** para `rounded-xl` (ou definir `rounded-[12px]` globalmente e aplicar em todo lugar).
- [ ] **3. Corrigir borda esquerda do card de alertas** no `DashboardPage` (remover conflito `border-none` / `border-l-4`).
- [ ] **4. Substituir `<select>` nativo** do filtro Empresa em `ExtrasRecibosPage` pelo componente `Select` do shadcn.
- [ ] **5. Aumentar área de toque** dos botões de ação das tabelas (`size-5`, `min-w-[44px]`, `min-h-[44px]`).
- [ ] **6. Adicionar estado de loading** (skeleton ou spinner) em `MobileFaltaPage` e `ExtrasPlantaoPage` enquanto carregam colaboradores/departamentos.
- [ ] **7. Trocar checkboxes nativos** por `<Checkbox>` do projeto em `ExtrasFormPage`, `ExtrasRecibosPage` e `ExtrasPlantaoPage`.
- [ ] **8. Ajustar `MobileFaltaPage`:**
  - tornar passos concluídos clicáveis;
  - grid de turnos responsivo (`grid-cols-2 sm:grid-cols-3`);
  - mensagens de erro inline;
  - adicionar botão “Voltar ao dashboard” na tela de sucesso.
- [ ] **9. Criar esboço da página `/ferias`** substituindo o placeholder por cards de resumo e botão “Novo agendamento”.
- [ ] **10. Documentar** esses padrões em um `DESIGN_SYSTEM.md` ou atualizar `AGENTS.md` para que novas telas os sigam.

---

## Conclusão

O CORH já possui uma identidade visual clara e componentes funcionais, mas ainda sofre com **descasamento de tokens, duplicação de componentes e responsividade em telas pequenas**. Os ganhos mais imediatos virão de:

1. Alinhar os tokens CSS à paleta real usada nas telas;
2. Consolidar os componentes de UI (shadcn como base);
3. Adaptar tabelas e formulários para mobile;
4. Melhorar o feedback de erro/loading.

A `MobileFaltaPage` está no caminho certo com seu fluxo em passos, mas precisa de refinamentos de usabilidade. O módulo de férias deve reaproveitar a mesma abordagem mobile-first: cards, passos e integração com o fluxo de extras.

---

**Próximo passo recomendado:** abrir uma task de refactor de UI para consolidar `ExtrasButton`/`ExtrasCard` nos componentes shadcn e criar um pequeno style guide no repositório.
```
