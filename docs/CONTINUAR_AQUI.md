# CONTINUAR AQUI — RH Plena Unificado

> **Último trabalho:** 23/07/2026 (noite) — assinatura de ocorrências (migration 072) + hardening da Edge Function e-Contador + correção do cabeçalho do PDF (logo/empresa)
> **✅ RESOLVIDO em 24/07/2026:** PDF saindo "Plena EA" era o **service worker do PWA segurando JS antigo** no navegador. Solução: `skipWaiting()` em `src/sw.ts` (próximas atualizações ativam sozinhas) + marcador de build no rodapé do PDF para diagnóstico. No mesmo pacote: CPF do colaborador passou a sair no PDF (`COLUNAS_AUTOCOMPLETE` não trazia a coluna `cpf`). Validado pela usuária em produção (Plena EA e Plena Tech). Detalhes: `docs/HANDOFF_23-07-2026_PDF_EMPRESA.md`.
> **Relatório completo:** `docs/HANDOFF_23-07-2026_NOITE.md` (anterior: `docs/HANDOFF_23-07-2026.md` — módulo Férias)  
> **Checklist:** `docs/CHECKLIST_IMPLANTACAO.md`  
> **Perfis/Permissões:** `docs/PERFIL_ACOES_MODELO.md`  
> **Regras de negócio:** `docs/REGRAS_NEGOCIO.md`  

---

## ✅ Estado atual

### Assinatura de ocorrências (23/07/2026 — noite)
- **Migration 072** (`072_ocorrencia_assinatura.sql`): `ocorrencias.forma_assinatura` (`papel`/`youk`, opcional) e `ocorrencia_anexos.tipo_documento` (`comprovante`/`documento_assinado`). ✅ **Aplicada no SQL Editor em 23/07/2026.**
- Detalhes da ocorrência: campo "Assinatura" no card de dados e tipo "Documento assinado" no upload de anexos (selo verde "Assinado").
- Formulário de nova ocorrência reordenado: **Macro Grupo → Tipo → Título** (título agora é o item 4, depois do tipo).
- PDF da ocorrência com logo institucional e CNPJ no cabeçalho; forma de assinatura e anexos assinados refletidos no documento.
- **Edge Function e-Contador**: `/funcionarios` restrito às empresas permitidas (cache 5 min) + encoding dos parâmetros. ✅ **Re-deploy feito em 23/07/2026.**
- Relatório completo: `docs/HANDOFF_23-07-2026_NOITE.md`.

### Cabeçalho do PDF de ocorrência (23/07/2026 — noite, complemento)
- Logo trocada para `logo_plena_30anos_redonda.png` e cabeçalho passou a exibir nome + CNPJ reais da empresa.
- `gerarPDFOcorrencia` resolve a empresa em cadeia: ocorrência → colaborador → departamento (id ou nome) → fallback Plena EA (`src/lib/pdf.ts`).
- **Correção de dados via SQL Editor (sem migration):** 58 ocorrências dos colaboradores reais da **Plena Tech** estavam com `empresa_id` divergente (Plena EA/nulo) e foram alinhadas ao `empresa_id` do colaborador.
- **Acidente revertido:** a primeira versão do UPDATE moveu também as ~5.033 históricas do placeholder "OCORRENCIAS HISTORICAS – NAO IDENTIFICADO" (matrícula `999999`) para Plena Tech; revertidas para Plena EA (estado da importação) na mesma sessão. O placeholder teve `empresa_id` zerado — ele não pertence a empresa nenhuma; **nunca usar empresa de colaborador como fonte para UPDATE em lote sem excluir a matrícula 999999**.
- Históricas de ex-colaboradores de empresas que não existem mais ficam como estão (só histórico — decisão da gestão). Retrato final: Plena EA 9.175 / Plena Tech 58 ocorrências.
- **Causa raiz do "PDF sai Plena EA":** `COLUNAS_AUTOCOMPLETE` (`src/components/AutocompleteColaborador.tsx`) não incluía `empresa_id` — ocorrências criadas pelo formulário ("Nova ocorrência") salvavam `empresa_id` NULL e o PDF caía no fallback. Corrigido; `buscarEmpresaDoRegistro` também consulta o cadastro do colaborador no banco quando o objeto vem incompleto.
- Atenção: o app é PWA — após deploy, orientar Ctrl+Shift+R (ou unregister do service worker) para o navegador largar o JS antigo.

### Módulo Férias (23/07/2026)
- **Rota `/ferias`** saiu do placeholder e ganhou 3 abas (padrão `ModuleShell`): Visão geral, Importar e Notificações.
- **Migration 070** (`ferias_periodos`): períodos por colaborador — tipos `gozo` (histórico), `agendado` (confirmado via Flit) e `previsto` (planejamento do RH); origem `flit`/`manual`. RLS padrão + auditoria.
- **Migration 071** (`ferias_notificacoes`): controle de notificações ao colaborador e ao responsável pelo contrato; DELETE de períodos manuais liberado para editores (Flit continua só admin).
- **Docs de aplicação:** `docs/APLICAR_MIGRATION_070.md` e `docs/APLICAR_MIGRATION_071.md` — **aplicar as duas no SQL Editor, em ordem**.
- **Importação Flit** (`/ferias/importar`): lê a planilha de férias do Flit (ex.: `dados-locais/Férias_23-07-2026.xlsx`), casa colaboradores por nome normalizado, mostra preview e grava de forma idempotente (delete+insert dos períodos `flit` do colaborador).
- **Previsão manual do RH** (botão "Nova previsão"): lança período `previsto`/`manual`. Quando o período confirmado chega do Flit cobrindo as mesmas datas, a previsão é **baixada automaticamente** na importação.
- **Notificações**: registro por colaborador (destinatário: colaborador ou responsável pelo contrato), com data, observação e usuário registrante.
- **Painel CLT**: situação por colaborador ativo — Em gozo, Agendado, Previsto, A vencer (≤60 dias do limite concessivo), Vencido, Em dia, Sem dados — calculada em `src/lib/ferias/calculoFerias.ts`. Cards, filtros e exportação Excel (respeita filtros aplicados).
- **Permissões**: `ferias.importar`, `ferias.exportar`, `ferias.gerenciar` no `PERMISSOES_PADRAO` e na tela Permissões.
- Arquivos: `src/lib/ferias/` (parser + cálculo + 26 testes), `src/hooks/useFerias.ts`, `src/pages/ferias/`.
- **Visão futura** (não implementada): saldos por período aquisitivo, alocação de feristas — ver `docs/agentes/arquitetura_modulo_ferias.md`.

### Ocorrências históricas e da inspetoria
- **961 ocorrências históricas** importadas do sistema antigo (`public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx`).
  - Script: `scripts/importar-ocorrencias-antigas.py`
  - 465 vinculadas a colaboradores existentes
  - 496 vinculadas ao colaborador placeholder
  - 9 casos de múltiplos matches (vinculados ao primeiro encontrado)
- **12 ocorrências da inspetoria** importadas (`public/ocorrencias_inspetoria_classificado.xlsx`).
  - Script: `scripts/importar-ocorrencias-inspetoria.py`
- Colaborador placeholder criado: `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`, status `Inativo`).
- Nome original preservado em `colaborador_nome`; número original em `titulo` e `descricao`.
- **1 ocorrência reassociada** após varredura dos 496 nomes: `PAULO JOSE DA SILVA` → `JOSE PAULO SILVA DE ARAUJO`.
- Planilha de revisão gerada: `dados-locais/revisao_496_nomes.xlsx`.
- **869 ocorrências da planilha Eliane** importadas (`public/ELIANE_OCO_Funcionarios_160726 occ rh tratada_final.xlsx`).
  - Script: `scripts/importar-ocorrencias-eliane.py`
  - 402 vinculadas a colaboradores existentes
  - 467 vinculadas ao colaborador placeholder
  - 0 inconsistências entre Macro e Tipo
  - Coluna `Matrícula` ignorada conforme orientação
- **5.380 ocorrências importadas hoje:**
  - Ocorrências históricas: 961
  - Ocorrências da inspetoria: 12
  - Planilha Eliane: 869
  - Planilha de faltas: 4.372
  - (6 ocorrências da planilha de faltas foram ignoradas por múltiplos matches)
- **Total atual no banco: 5.345 ocorrências** (2.969 vinculadas ao placeholder).

### Ajustes na tela de Ocorrências
- Busca textual agora inclui `colaborador_nome` e `descricao`.
- Filtros reorganizados em 3 linhas + dica informativa.
- Página de detalhes exibe nome original e aviso para ocorrências do placeholder.
- **Listagem e detalhes mostram nome de colaboradores inativos/não cadastrados** usando o campo `colaborador_nome`.
- Filtro de tipos com autocomplete — substituiu o filtro de gravidade; permite selecionar múltiplos tipos com chips.
- Botão "Limpar" ao lado de "Aplicar" para resetar todos os filtros rapidamente.
- Edição de ocorrências habilitada — botão "Editar" na lista e nos detalhes, rota `/rh/ocorrencias/:id/editar`.
- Arquivos alterados: `src/hooks/useOcorrencias.ts`, `src/pages/rh/OcorrenciasPage.tsx`, `src/pages/rh/OcorrenciaDetailPage.tsx`.

### Responsividade mobile / PWA
- Página `/mobile/falta` com inputs reduzidos no celular ✅
- CSS para normalizar inputs de data no mobile ✅
- Tabelas com `break-words` para evitar estouro de textos ✅
- PWA configurado com `vite-plugin-pwa` ✅

### Segurança / RLS
- Migrations 038–045 aplicadas: RLS de `extras`, `recibos_extras`, `categorias_extras`, `ocorrencias`, storage e isolamento por contexto ✅
- Migrations 044–045 aplicadas: isolamento de storage por `ocorrencia_id`/`projeto_id` via path ✅
- Edge Function `econtador` re-deployada com permissão adm/dp1/dp2 ✅
- Regras de negócio documentadas em `docs/REGRAS_NEGOCIO.md` ✅

### Qualidade / Preparação para produção
- Permissões de configurações e e-Contador corrigidas em `src/lib/permissoes.ts` ✅
- Tela administrativa de permissões criada em `src/pages/PermissoesPage.tsx` ✅
- Rotas e menus controlados pela tela de permissões ✅
- Mocks removidos do bundle de produção ✅
- Tratamento de erros silenciados ajustado ✅

### Correções de usabilidade
- Filtro por departamento na tela de colaboradores corrigido ✅
- Menu e-Contador unificado ✅
- Página de auditoria global criada ✅
- Build de produção estabilizado com `cross-env` ✅

### Sidebar reorganizado em grupos expansíveis
- Agrupamento por área: Cadastros, Operacional, RH, DP, Gestão e Relatórios ✅
- Grupos colapsáveis/expandíveis com estado no `localStorage` ✅
- Rótulos atualizados: "Uniformes" → "CEU", "VR" → "Benefícios" ✅

### Botão Voltar em todas as páginas
- Componente `PageHeader` criado ✅
- Aplicado em todas as páginas principais, listagens, formulários e detalhes ✅

### Permissões dinâmicas finalizadas
- Tabela `permissoes_perfil` criada via migration 046 ✅
- Seed de 132 permissões via migration 047 ✅
- Hook `usePermissoes`, `src/lib/permissoes.ts`, `ProtectedRoute`, `App.tsx` e `Sidebar` integrados ✅

### Segurança do token e-Contador
- Endpoints `/token-status` e `/remover-token` na Edge Function `econtador` ✅
- Frontend verifica token apenas pela Edge Function ✅
- Input de token continua `type="password"` ✅

### Módulo Escalas / Local de Trabalho Diário
- Tabelas `locais_trabalho`, `mapeamento_flit_local_trabalho`, `locais_trabalho_diario` (migrations 048–051) ✅
- Migrations 048–051 aplicadas no banco de produção ✅
- Importação Flit, inferência de local, aba Escalas, modal de confirmação, exportações ✅
- Importação de departamentos com deduplicação por similaridade de nome ✅

### Página de login
- Redesign com layout split: lado esquerdo em azul escuro degradê, texto "CORH — Controle Operacional e de RH", design limpo com cards de destaque; formulário de login do lado direito. ✅

---

## 🎯 Próximos passos pendentes (priorizados)

### 🟠 Alto
1. ~~**Aplicar migration 072** no SQL Editor e validar~~ — ✅ aplicada em 23/07/2026.
2. ~~**Re-deploy da Edge Function e-Contador**~~ — ✅ feito em 23/07/2026.
3. **Revisar/associar mais ocorrências do placeholder** usando `dados-locais/revisao_496_nomes.xlsx`.
4. **Revisar os 9 casos de múltiplos matches** da importação histórica.
5. **Verificar no sistema** se a busca e os detalhes das ocorrências históricas funcionam corretamente.
6. **Aplicar mais importações** conforme arquivos novos disponibilizados (ocorrências, colaboradores, departamentos, etc.).
7. **Testes manuais de login/perfis** — verificar menus e rotas para cada perfil de teste.
8. **Testes manuais de storage** — upload/visualização de anexos de ocorrências e arquivos VR.
9. **Testes manuais do fluxo de extras** — cálculo, pagamento e auditoria.
10. **Testes manuais do módulo Escalas** — importação Flit, confirmação de local e exportações.
11. **Revisar type assertions (`as`)** — reduzir uso, especialmente em formulários grandes.
12. **Quebrar páginas monolíticas** — `OcorrenciaFormPage`, `OcorrenciaDetailPage`, `CeuRelatoriosPage`.
13. **Unificar componentes de UI** — `CeuButton`, `VrButton`, `ExtrasButton`, etc.

### 🟡 Médio / após auditoria
12. **Confirmar PWA no celular** — "Adicionar à tela inicial" e tela cheia.
13. **Testar validação de duplicidade de extras** em cenário real.
14. **Definir design system** antes de implementar módulos novos.
15. **Módulos placeholders:** `/ferias`, `/escalas` (estrutura já criada), `/relatorios`.

---

## ⚠️ Atenções

- **O colaborador placeholder (`OCORRENCIAS HISTORICAS - NAO IDENTIFICADO`, matrícula `999999`) não deve ser excluído** enquanto houver ocorrências históricas vinculadas a ele.
- **Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.**
- **Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.**
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
- **Workflow de defesa em ocorrências:** não será implementado por decisão de negócio.
- O Vite dev server pode apresentar erro 504 ao carregar módulos lazy em desenvolvimento. Se ocorrer, reiniciar com `npm run dev` geralmente resolve.

---

*Se este arquivo estiver desatualizado, verifique o log de commits recentes e `docs/HANDOFF_PROXIMO_AGENTE_2026_07_16.md`.*
