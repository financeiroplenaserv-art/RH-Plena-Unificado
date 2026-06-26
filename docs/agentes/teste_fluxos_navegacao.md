# Teste Exploratório de Navegação — CORH

**Data:** 25/06/2026  
**Responsável:** QA Sênior (Agente)  
**Escopo:** mapeamento estático das rotas de `src/App.tsx`, páginas relacionadas, menu (`Sidebar.tsx`) e fluxos de navegação entre os principais CRUDs.  
**Stack:** React + TypeScript + Vite + React Router DOM + Tailwind + shadcn/ui.

---

## 1. Resumo Executivo

Foram analisadas **56 rotas** declaradas em `src/App.tsx` (incluindo redirecionamentos e placeholders) e **51 exports lazy** em `src/routes/lazyPages.ts`. O menu lateral (`Sidebar.tsx`) possui **14 itens**, cobrindo apenas as entradas principais dos módulos. Os principais achados são:

- **Rota `/configuracoes` existe mas está oculta** (sem item no menu).  
- **Três módulos do menu apontam para páginas placeholder** (`/escalas`, `/ferias`, `/relatorios`) sem ação/botão de saída.  
- **A rota `/mobile/falta` é renderizada fora do layout padrão**, sem sidebar e sem menu, só acessível por URL direta.  
- **Muitas sub-rotas internas não têm botão/link de retorno fixo**, o que gera dependência exclusiva do histórico do navegador.  
- **Duplicação semântica de rotas de colaboradores** (`/colaboradores` x `/rh/colaboradores/:id`) gera confusão de navegação.

---

## 2. Mapa de Rotas

### 2.1 Módulos e rotas principais

| Módulo | Rota (entrada) | Página | Permissões (App.tsx) | Item no menu? |
|---|---|---|---|---|
| Dashboard | `/` | `DashboardPage` | Qualquer autenticado | Sim (`Dashboard`) |
| Colaboradores | `/colaboradores` | `ColaboradoresPage` | Qualquer autenticado | Sim (`Colaboradores`) |
| Departamentos | `/departamentos` | `DepartamentosPage` | Todos | Sim (`Departamentos`) |
| Empresas | `/empresas` | `EmpresasPage` | Todos | Sim (`Empresas`) |
| e-Contador | `/importar/econtador` | `ImportarEContadorPage` | admin, adm, dp1, dp2 | Sim (`e-Contador`) |
| Escalas | `/escalas` | `PlaceholderPage` | Qualquer autenticado | Sim (`Escalas`) |
| RH — Ocorrências | `/rh` -> `/rh/ocorrencias` | `OcorrenciasPage` | admin, adm, gestor, rh, dp1, dp2, mesa, inspetoria | Sim (`Ocorrências`) |
| RH — Nova ocorrência | `/rh/ocorrencias/novo` | `OcorrenciaFormPage` | admin, adm, gestor, rh, dp1, dp2, mesa | Não |
| RH — Ocorrência por colaborador | `/rh/ocorrencias/colaborador/:id` | `OcorrenciaFormPage` | admin, adm, gestor, rh, dp1, dp2, mesa | Não |
| RH — Detalhe ocorrência | `/rh/ocorrencias/:id` | `OcorrenciaDetailPage` | admin, adm, gestor, rh, dp1, dp2, mesa | Não |
| RH — Ficha colaborador | `/rh/colaboradores/:id` | `ColaboradorDetailPage` | Todos | Não |
| RH — Editar colaborador | `/rh/colaboradores/:id/editar` | `ColaboradorFormPage` | admin, adm, gestor, rh, dp1, dp2, mesa | Não |
| RH — Importar | `/rh/importar` | `ImportarRhPage` | admin, adm, rh, dp1, dp2 | Não |
| RH — Modelos | `/rh/modelos` | `ModelosPage` | admin, adm, gestor, rh, dp1, dp2 | Não |
| RH — Alertas | `/rh/alertas` | `AlertasPage` | admin, adm, dp1 | Não |
| Benefícios (VR) | `/vr` -> `/vr/projetos` | `VrProjetosPage` | admin, adm, dp1, dp2 | Sim (`Benefícios`) |
| VR — Novo/Editar | `/vr/projetos/novo`, `/vr/projetos/:id/editar` | `VrProjetoFormPage` | admin, adm, dp2 | Não |
| VR — Detalhe | `/vr/projetos/:id` | `VrProjetoDetailPage` | admin, adm, dp1, dp2 | Não |
| Férias | `/ferias` | `PlaceholderPage` | Qualquer autenticado | Sim (`Férias`) |
| CEU/Uniformes | `/ceu` -> `/ceu/dashboard` | `CeuDashboardPage` | Todos | Sim (`Uniformes`) |
| CEU — Itens | `/ceu/itens` | `CeuItensPage` | admin, adm, dp1, mesa | Não |
| CEU — Item form | `/ceu/itens/novo`, `/ceu/itens/:id/editar` | `CeuItemFormPage` | admin, adm, dp1, mesa | Não |
| CEU — Fornecedores | `/ceu/fornecedores` | `CeuFornecedoresPage` | admin, adm, gestor, dp1 | Não |
| CEU — Movimentações | `/ceu/movimentacoes` | `CeuMovimentacoesPage` | admin, adm, gestor, dp1, mesa, inspetoria | Não |
| CEU — Nova entrega | `/ceu/movimentacoes/novo` | `CeuEntregaFormPage` | admin, adm, gestor, dp1 | Não |
| CEU — Lançamento rápido | `/ceu/lancamento-rapido` | `CeuLancamentoRapidoPage` | admin, adm, gestor, dp1 | Não |
| CEU — Relatórios | `/ceu/relatorios` | `CeuRelatoriosPage` | admin, adm, gestor, dp1, mesa | Não |
| CEU — Importar | `/ceu/importar` | `CeuImportarPage` | admin, adm, dp1 | Não |
| Configurações | `/configuracoes` | `ConfiguracoesPage` | admin, adm, gestor, dp2 | **Não** |
| Adicionais | `/adicionais` -> `/adicionais/contratos` | `AdicionaisContratosPage` | admin, adm, gestor, dp2, mesa, financeiro | Sim (`Adicionais`) |
| Adicionais — Vínculos | `/adicionais/vinculos` | `AdicionaisVinculosPage` | admin, adm, gestor, dp2, mesa | Não |
| Adicionais — Calendário | `/adicionais/calendario` | `AdicionaisCalendarioPage` | admin, adm, dp2, mesa | Não |
| Adicionais — Relatório | `/adicionais/relatorio` | `AdicionaisRelatorioPage` | admin, adm, dp1, mesa, financeiro | Não |
| Adicionais — Importar ponto | `/adicionais/importar-ponto` | `ImportarPontoPage` | admin, adm, dp2, mesa | Não |
| Extras | `/extras` -> `/extras/lancamentos` | `ExtrasLancamentosPage` | admin, adm, mesa, inspetoria, financeiro | Sim (`Extras`) |
| Extras — Novo/Editar | `/extras/novo`, `/extras/:id/editar` | `ExtrasFormPage` | admin, adm, mesa, inspetoria | Não |
| Extras — Balanço | `/extras/balanco` | `ExtrasBalancoPage` | Todos | Não |
| Extras — Relatório | `/extras/relatorio` | `ExtrasRelatorioPage` | admin, adm, mesa, financeiro | Não |
| Extras — Recibos | `/extras/recibos` | `ExtrasRecibosPage` | admin, adm, mesa, dp1, financeiro | Não |
| Extras — Categorias | `/extras/categorias` | `ExtrasCategoriasPage` | admin, adm, mesa, inspetoria, financeiro | Não |
| Extras — Plantão mobile | `/extras/mobile` | `ExtrasPlantaoPage` | admin, adm, mesa, inspetoria | Não |
| Mobile (falta) | `/mobile/falta` | `MobileFaltaPage` | admin, adm, mesa, inspetoria | **Não (fora do layout)** |
| Relatórios | `/relatorios` | `PlaceholderPage` | Qualquer autenticado | Sim (`Relatórios`) |
| Fallback | `*` | `Navigate to /` | — | — |

### 2.2 Observações sobre o mapa

- O menu não reflete a profundidade de cada módulo. Após entrar em um módulo, o usuário depende de botões internos para navegar entre lista -> formulário -> detalhe.  
- A rota `/configuracoes` é praticamente invisível para o usuário comum, sendo acessível apenas por URL direta ou pelo redirecionamento da página `ConfiguracoesPage` após salvar o token do e-Contador.  
- A rota `/mobile/falta` não compartilha o layout com sidebar; seu único ponto de saída visível é o botão "Ver lançamentos" (`/extras/lancamentos`) na tela de sucesso ou o botão `X` no cabeçalho.

---

## 3. Dead Ends e Fluxos Confusos/Quebrados

### 3.1 Dead ends (páginas sem saída clara além do menu lateral)

| Página | Rota | Problema |
|---|---|---|
| `PlaceholderPage` | `/escalas`, `/ferias`, `/relatorios` | Apenas exibe ícone e texto "Módulo em construção". Não há botão Voltar, link para dashboard nem ação alternativa. |
| `CeuLancamentoRapidoPage` | `/ceu/lancamento-rapido` | Não possui botão/link de retorno. O usuário depende do botão do navegador. |
| `CeuImportarPage` | `/ceu/importar` | Não possui botão/link de retorno. |
| `ImportarPontoPage` | `/adicionais/importar-ponto` | Não possui botão/link de retorno. |
| `ExtrasRelatorioPage` | `/extras/relatorio` | Não possui botão/link de retorno. |
| `ExtrasCategoriasPage` | `/extras/categorias` | Não possui botão/link de retorno. |
| `ExtrasBalancoPage` | `/extras/balanco` | Não possui botão/link de retorno (apenas ações internas). |
| `ExtrasRecibosPage` | `/extras/recibos` | Não possui botão/link de retorno. |
| `ConfiguracoesPage` | `/configuracoes` | Sem item de menu; depois de salvar redireciona para `/importar/econtador`. Sem ação de cancelar. |

### 3.2 Fluxos confusos

| Fluxo | Problema | Impacto |
|---|---|---|
| **Colaboradores** | A listagem principal fica em `/colaboradores`, mas a ficha detalhada fica em `/rh/colaboradores/:id` e a edição em `/rh/colaboradores/:id/editar`. A página `/colaboradores` abre os dados em modal interno, não navegando para essas rotas. | Duplicidade semântica: o usuário não sabe se deve usar o modal ou a rota `/rh/colaboradores/:id`. A rota do RH é praticamente inatingível pelo fluxo normal. |
| **Ocorrências -> voltar** | `OcorrenciaFormPage` usa `navigate(-1)` ao invés de rota fixa. | Se o usuário acessar `/rh/ocorrencias/novo` via link direto/bookmark, o botão voltar pode levá-lo para fora do sistema. |
| **Dashboard -> atalhos com permissões incompatíveis** | Atalhos como "Nova Entrega CEU" (`/ceu/movimentacoes/novo`) e "Verificar Alertas" (`/rh/alertas`) aparecem para todos os perfis no dashboard, mas as rotas exigem permissões específicas. | Usuários sem permissão clicam e são redirecionados para `/` sem explicação. |
| **CEU — Entrega** | Após salvar, `CeuEntregaFormPage` vai para passo 4 com botões "Ver entregas" e "Visualizar recibo". Não há link direto para novo item ou dashboard. | Fluxo de sucesso OK, mas falta atalho para novo item ou nova entrega. |
| **Extras — Plantão mobile** | `/extras/mobile` (`ExtrasPlantaoPage`) é um formulário mobile dentro de uma rota desktop. Não há indicação de que é uma tela otimizada para celular. | Pode confundir usuários desktop. |

### 3.3 Fluxos potencialmente quebrados

| Ponto | Descrição |
|---|---|
| `ColaboradorFormPage` (edição) | A rota `/rh/colaboradores/:id/editar` não é referenciada por nenhum link/button dentro de `/colaboradores` nem de `/rh/colaboradores/:id`. Só é acessível manualmente. |
| `ColaboradorDetailPage` -> "Nova Ocorrência" | O link `/rh/ocorrencias/colaborador/:id` é um bom atalho, mas a página de detalhe não é acessível a partir da lista principal. |
| `OcorrenciaDetailPage` | Botão "Voltar" fixo para `/rh/ocorrencias`. Se o usuário veio do dashboard, o link fixo é melhor que `navigate(-1)`, mas não há atalho para "Nova ocorrência" ou "Editar ocorrência". |
| `CeuMovimentacoesPage` | Não há link para detalhe/editar de uma entrega específica. Ações disponíveis: recibo, devolução, excluir. |
| `CeuItensPage` | Só permite editar/excluir. Não há página de detalhe do item nem histórico de entregas vinculadas. |
| `AdicionaisContratosPage` | Modal "Colaboradores vinculados" não tem link para a página `/adicionais/vinculos`. |
| `ExtrasLancamentosPage` | Tabela não possui link de detalhe; apenas editar/excluir. |
| `VrProjetoDetailPage` | Upload de arquivos e cálculos dependem de `podeEditar` baseado em `podeGerenciarVR`. Perfis `dp1` não conseguem editar dias/extra nem exportar TXT PAT/Alterdata, mas podem ver resultados e baixar comprovantes. |

---

## 4. Botões e Links Faltantes

### 4.1 Menu lateral (`Sidebar.tsx`)

- **Item `/configuracoes`** ausente.  
- **Submenu/expansão** não existe: todas as sub-rotas (formulários, relatórios, importações) ficam escondidas.  
- **Item `/mobile/falta`** não aparece no menu (por design, mas pode ser um atalho dedicado para inspetoria/mesa).  
- **Itens placeholder** (`/escalas`, `/ferias`, `/relatorios`) aparecem ativos no menu, gerando expectativa de funcionalidade.

### 4.2 Dashboard (`DashboardPage.tsx`)

- Atalhos **não respeitam permissões**. Sugestão: filtrar `atalhos` e `alertas` pelo `nivel_acesso` do usuário.  
- Falta atalho para **Configurações** (para perfis autorizados).  
- Falta atalho para **CEU — Movimentações** ou **CEU — Relatórios**.

### 4.3 CRUDs

| Página | Link/botão faltante |
|---|---|
| `ColaboradoresPage` | Link para ficha `/rh/colaboradores/:id` e edição `/rh/colaboradores/:id/editar`. |
| `ColaboradorDetailPage` | Link explícito para "Editar colaborador" (o código tem, mas só é útil se alguém chegar à rota). |
| `OcorrenciaFormPage` | Botão "Cancelar"/"Voltar para lista" fixo. |
| `CeuLancamentoRapidoPage` | Botão "Voltar para movimentações". |
| `CeuImportarPage` | Botão "Voltar para movimentações". |
| `ImportarPontoPage` | Botão "Voltar para calendário". |
| `ExtrasRelatorioPage` | Botão "Voltar para lançamentos". |
| `ExtrasCategoriasPage` | Botão "Voltar para lançamentos". |
| `ExtrasBalancoPage` | Botão "Voltar para lançamentos". |
| `ExtrasRecibosPage` | Botão "Voltar para lançamentos". |
| `PlaceholderPage` | Botão "Voltar para Dashboard". |

---

## 5. Lista Prioritária de Correções

### 🔴 Crítico — impacta usabilidade e acesso

1. **Adicionar `/configuracoes` no menu** para perfis autorizados (`admin`, `adm`, `gestor`, `dp2`).  
2. **Resolver os placeholders ativos no menu**: remover `Escalas`, `Férias` e `Relatórios` do menu enquanto não forem implementados, ou adicionar aviso claro e botão de retorno no `PlaceholderPage`.  
3. **Corrigir atalhos do dashboard para respeitar permissões**, evitando redirecionamentos silenciosos para `/`.  
4. **Padronizar botão Voltar** nas páginas sem saída (`CeuLancamentoRapidoPage`, `CeuImportarPage`, `ImportarPontoPage`, páginas de Extras e `PlaceholderPage`).

### 🟡 Alto — quebra fluxos principais

5. **Unificar navegação de colaboradores**: remover a duplicidade `/colaboradores` vs `/rh/colaboradores/:id` OU criar link da lista principal para a ficha do RH.  
6. **Tornar `/rh/colaboradores/:id/editar` acessível** a partir da ficha do colaborador.  
7. **Trocar `navigate(-1)` por rota fixa** em `OcorrenciaFormPage` para evitar comportamento inconsistente.  
8. **Adicionar breadcrumbs ou título de contexto** nas sub-rotas internas (CEU, Adicionais, Extras, VR) para reforçar onde o usuário está.  
9. **Adicionar submenu/expansão no `Sidebar.tsx`** para agrupar rotas filhas (ex.: Extras -> Lançamentos, Balanço, Recibos; CEU -> Itens, Movimentações, Relatórios).

### 🟢 Médio — melhorias de UX

10. **Adicionar atalho "Novo extra"/"Novo plantão"** no menu Extras para perfis `mesa`/`inspetoria`.  
11. **Incluir link de detalhe** nas tabelas de `CeuMovimentacoesPage`, `ExtrasLancamentosPage` e `AdicionaisContratosPage`.  
12. **Revisar permissões do menu vs App.tsx**: por exemplo, `Benefícios` aparece no menu para `dp1`, mas `/vr/projetos/novo` e `/vr/projetos/:id/editar` exigem `admin`/`adm`/`dp2`. Garantir que o menu só mostre o que o perfil pode executar.  
13. **Documentar `/mobile/falta`** como rota de uso mobile ou criar QR code/atalho na tela de login para inspetoria.

---

## 6. Notas Técnicas Complementares

- O componente `ProtectedRoute` redireciona para `/` quando o perfil não tem permissão. Isso é confuso para o usuário final; recomenda-se exibir uma página 403 ou toast explicativo.  
- `BrowserRouter` é usado corretamente no nível do `App`, mas `/mobile/falta` está em um `<Routes>` separado, fora do layout com `Sidebar`/`Header`. Isso é intencional, mas deve ser documentado.  
- `lazyPages.ts` centraliza todos os imports lazy, facilitando a manutenção. Qualquer nova rota deve ser adicionada lá e em `App.tsx`.  
- A tabela de rotas acima pode ser usada como base para testes automatizados de navegação (ex.: Playwright/Cypress) validando menu -> rota -> breadcrumb.

---

## 7. Conclusão

A aplicação CORH possui uma estrutura de rotas organizada por módulo, mas sofre com **falta de navegação secundária** (submenu, breadcrumbs, botões Voltar) e **rotas ocultas/inalcançáveis** (`/configuracoes`, `/rh/colaboradores/:id`, `/rh/colaboradores/:id/editar`). As páginas placeholder ativas no menu geram frustração, e o dashboard expõe atalhos sem verificação de permissão. A correção priorizada acima deve melhorar significativamente a experiência de navegação e reduzir dead ends.
