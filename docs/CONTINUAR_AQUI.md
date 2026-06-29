# CONTINUAR AQUI — RH Plena Unificado

> **Último trabalho:** 2026-06-28
> **Relatório completo:** `docs/RELATORIO_TRABALHO_2026_06_26.md`
> **Checklist:** `docs/CHECKLIST_IMPLANTACAO.md`
> **Perfis/Permissões:** `docs/PERFIL_ACOES_MODELO.md`
> **Regras de negócio:** `docs/REGRAS_NEGOCIO.md`

---

## ✅ Estado atual

### Responsividade mobile / PWA
- Página `/mobile/falta` com inputs reduzidos no celular ✅
- CSS para normalizar inputs de data no mobile ✅
- Tabelas com `break-words` para evitar estouro de textos ✅
- PWA configurado com `vite-plugin-pwa` ✅

### Formulário `/mobile/falta`
- Campo "Colaborador ausente" mostra os do departamento, mas permite buscar todos ✅
- Campo "Substituto" mostra todos os colaboradores ativos ✅
- Regra validada com a usuária ✅

### Segurança / RLS
- Migrations 038–045 aplicadas: RLS de `extras`, `recibos_extras`, `categorias_extras`, `ocorrencias`, storage e isolamento por contexto ✅
- Migration 039 aplicada: RLS granular dos buckets `ocorrencia-anexos` e `vr-arquivos` ✅
- Migrations 040–043 aplicadas: correção de SELECT aberto, token e-Contador restrito e limpeza de RLS sensíveis ✅
- Migrations 044–045 aplicadas: isolamento de storage por `ocorrencia_id`/`projeto_id` via path ✅
- Script manual disponível: `scripts/aplicar_rls_038_039_manual.sql` ✅
- Edge Function `econtador` re-deployada com permissão adm/dp1/dp2 ✅
- Regras de negócio documentadas em `docs/REGRAS_NEGOCIO.md` ✅

### Qualidade / Preparação para produção
- **Permissões de configurações e e-Contador** corrigidas em `src/lib/permissoes.ts` para refletir `PERFIL_ACOES_MODELO.md` ✅
- **Tela administrativa de permissões** criada em `src/pages/PermissoesPage.tsx`, rota `/permissoes` e menu no sidebar para `adm`/`admin` ✅
- **Rotas e menus controlados pela tela de permissões** via `ProtectedRoute` e `Sidebar` ✅
- **Mocks removidos do bundle de produção:** `mockData.ts` excluído, modo demonstração removido das páginas CEU, `VITE_MODO_MOCK` desativado em `useAdicionaisContratuais.ts` ✅
- **Tratamento de erros silenciados:** `catch` vazios agora logam `console.error`; hooks e páginas principais unificam `console.error` + `toast.error` ✅

### Correções de usabilidade
- **Filtro por departamento na tela de colaboradores** corrigido em `src/hooks/useColaboradores.ts` — agora busca por `departamento_id` **e** por `departamento` (nome), cobrindo registros importados do e-Contador ✅
- **Menu e-Contador unificado:** removido do sidebar a entrada duplicada "Configurações"; token do e-Contador fica apenas na tela `/importar/econtador`, com validação antes de salvar ✅
- **Página de auditoria global** criada em `src/pages/AuditoriaPage.tsx`, rota `/auditoria` adicionada e menu no sidebar visível para `adm`/`admin`/`gestor` ✅
- **Build de produção estabilizado:** `cross-env` adicionado ao script `build` com `--max-old-space-size=4096` para evitar falhas de memória ✅

### Sidebar reorganizado em grupos expansíveis
- **Novo agrupamento por área:** Cadastros, Operacional, RH, DP, Gestão e Relatórios ✅
- **Grupos colapsáveis/expandíveis** com estado persistido no `localStorage` ✅
- **Rótulos atualizados:** "Uniformes" renomeado para "CEU", VR renomeado para "Benefícios" ✅
- **Links verificados** e apontando para as rotas corretas (`/ceu/dashboard`, `/vr/projetos`, `/importar/econtador`, etc.) ✅
- **Permissões preservadas:** cada item só aparece para quem tem a permissão de menu correspondente ✅

### Botão Voltar em todas as páginas
- **Componente `PageHeader`** criado em `src/components/PageHeader.tsx` com título, descrição e botão voltar ✅
- **Aplicado em todas as páginas principais, listagens, formulários e detalhes** ✅
- **Dashboard mantido sem botão voltar** (página inicial) ✅

### Permissões dinâmicas finalizadas
- **Tabela `permissoes_perfil`** criada via migration `046_tabela_permissoes_perfil.sql` ✅
- **Seed de 132 permissões de ações** + menu/rota via migration `047_permissoes_rotas_menus.sql` ✅
- **Hook `usePermissoes`** carrega e salva permissões do banco ✅
- **`src/lib/permissoes.ts`** refatorado para consultar DB com fallback seguro ✅
- **`ProtectedRoute`, `App.tsx` e `Sidebar`** usam permissões dinâmicas ✅
- **Bug "Apenas para administradores" corrigido** em `/permissoes` — aguarda `authLoading` antes de validar perfil ✅

### Segurança do token e-Contador
- **Corrigida exposição/indisponibilidade** do token: a migration 041 bloqueou SELECT de `econtador_token` no frontend, mas `econtadorApi.ts` ainda consultava a tabela diretamente ✅
- **Adicionados endpoints `/token-status` e `/remover-token`** na Edge Function `econtador` ✅
- **Frontend verifica token apenas pela Edge Function**, sem acesso direto ao valor cifrado ✅
- **Input de token continua `type="password"`** e exibe mensagem segura quando já salvo ✅
- **Botão "Redefinir token"** permite remover o token sem expor o valor ✅
- **Edge Function `econtador` re-deployada** no Supabase ✅

### Módulo Escalas / Local de Trabalho Diário
- **Tabelas criadas:** `locais_trabalho`, `mapeamento_flit_local_trabalho`, `locais_trabalho_diario` (migrations 048–051) ✅
- **Migrations 048–051 aplicadas no banco de produção** via `npx supabase db push` ✅
- **Importação Flit:** parser Excel com agrupamento por matrícula + data e prevenção de duplicatas ✅
- **Inferência de local:** dispositivo fixo → perímetro → departamento mapeado ✅
- **Aba Escalas:** filtros por competência (20 a 19) ou período livre, ordenação, exportação Excel/PDF ✅
- **Modal de confirmação:** fundo branco, nome curto do local e sugestão por histórico do colaborador ✅
- **Exibição do colaborador:** nome completo + matrícula para evitar confusão ✅
- **Preservação de confirmações manuais** na reimportação de arquivos Flit ✅
- **Importação de departamentos** com deduplicação por similaridade de nome ✅
- **Scripts de análise dos dados Flit** em `scripts/` ✅

### Validação final
- `npm run lint` ✅
- `npm test -- --run` → 54/54 ✅
- `npm run build` ✅

---

## 🎯 Próximos passos pendentes (priorizados)

### 🟠 Alto
1. **Aplicar migrations 048–051 no banco de produção** (se ainda não aplicadas).
2. **Testes manuais de login/perfis** — verificar menus e rotas para cada perfil de teste.
3. **Testes manuais de storage** — upload/visualização de anexos de ocorrências e arquivos VR.
4. **Testes manuais do fluxo de extras** — cálculo, pagamento e auditoria.
5. **Testes manuais do módulo Escalas** — importação Flit, confirmação de local e exportações.
6. **Revisar type assertions (`as`)** — reduzir uso, especialmente em formulários grandes.
7. **Quebrar páginas monolíticas** — `OcorrenciaFormPage`, `OcorrenciaDetailPage`, `CeuRelatoriosPage`.
8. **Unificar componentes de UI** — `CeuButton`, `VrButton`, `ExtrasButton`, etc.

### 🟡 Médio / após auditoria
9. **Confirmar PWA no celular** — "Adicionar à tela inicial" e tela cheia.
10. **Testar validação de duplicidade de extras** em cenário real.
11. **Definir design system** antes de implementar módulos novos.
12. **Módulos placeholders:** `/ferias`, `/escalas` (estrutura já criada), `/relatorios`.

---

## ⚠️ Atenções

- **Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.**
- **Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.**
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
- **Workflow de defesa em ocorrências:** não será implementado por decisão de negócio.
- **Preview local ativo:** `http://localhost:4178/` (se o servidor ainda estiver rodando).

---

*Se este arquivo estiver desatualizado, verifique o log de commits recentes e `docs/RELATORIO_TRABALHO_2026_06_26.md`.*
