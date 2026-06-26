# CONTINUAR AQUI — RH Plena Unificado

> **Último trabalho:** 2026-06-26
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

### Qualidade / Preparação para produção (sessão anterior)
- **Permissões de configurações e e-Contador** corrigidas em `src/lib/permissoes.ts` para refletir `PERFIL_ACOES_MODELO.md` ✅
- **Tela administrativa de permissões** criada em `src/pages/PermissoesPage.tsx`, rota `/permissoes` e menu no sidebar para `adm`/`admin` ✅
- **Rotas e menus controlados pela tela de permissões** via `ProtectedRoute` e `Sidebar` ✅
- **Testes passando:** `npm test -- --run` → 40/40 ✅
- **Erros silenciados tratados:** `catch` vazios agora logam `console.error`; hooks e páginas principais unificam `console.error` + `toast.error` ✅
- **Mocks removidos do bundle de produção:** `mockData.ts` excluído, modo demonstração removido das páginas CEU, `VITE_MODO_MOCK` desativado em `useAdicionaisContratuais.ts` ✅

### Correções de usabilidade (sessão atual)
- **Filtro por departamento na tela de colaboradores** corrigido em `src/hooks/useColaboradores.ts` — agora busca por `departamento_id` **e** por `departamento` (nome), cobrindo registros importados do e-Contador ✅
- **Menu e-Contador unificado:** removido do sidebar a entrada duplicada "Configurações"; token do e-Contador fica apenas na tela `/importar/econtador`, com validação antes de salvar ✅
- **Página de auditoria global** criada em `src/pages/AuditoriaPage.tsx`, rota `/auditoria` adicionada e menu no sidebar visível para `adm`/`admin`/`gestor` ✅
- **Build de produção estabilizado:** `cross-env` adicionado ao script `build` com `--max-old-space-size=4096` para evitar falhas de memória ✅

### Permissões dinâmicas finalizadas
- **Tabela `permissoes_perfil`** criada via migration `046_tabela_permissoes_perfil.sql` ✅
- **Seed de 132 permissões de ações** + menu/rota via migration `047_permissoes_rotas_menus.sql` ✅
- **Hook `usePermissoes`** carrega e salva permissões do banco ✅
- **`src/lib/permissoes.ts`** refatorado para consultar DB com fallback seguro ✅
- **`ProtectedRoute`, `App.tsx` e `Sidebar`** usam permissões dinâmicas ✅
- **Bug "Apenas para administradores" corrigido** em `/permissoes` — aguarda `authLoading` antes de validar perfil ✅

### Validação final
- `npm run lint` ✅
- `npm test -- --run` → 40/40 ✅
- `npm run build` ✅

---

## 🎯 Próximos passos pendentes (priorizados)

### 🟠 Alto
1. **Testes manuais de login/perfis** — verificar menus e rotas para cada perfil de teste.
2. **Testes manuais de storage** — upload/Visualização de anexos de ocorrências e arquivos VR.
3. **Testes manuais do fluxo de extras** — cálculo, pagamento e auditoria.
4. **Revisar type assertions (`as`)** — reduzir uso, especialmente em formulários grandes.
5. **Quebrar páginas monolíticas** — `OcorrenciaFormPage`, `OcorrenciaDetailPage`, `CeuRelatoriosPage`.
6. **Unificar componentes de UI** — `CeuButton`, `VrButton`, `ExtrasButton`, etc.

### 🟡 Médio / após auditoria
7. **Confirmar PWA no celular** — "Adicionar à tela inicial" e tela cheia.
8. **Testar validação de duplicidade de extras** em cenário real.
9. **Definir design system** antes de implementar módulos novos.
10. **Módulos placeholders:** `/ferias`, `/escalas`, `/relatorios`.

---

## ⚠️ Atenções

- **Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.**
- **Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.**
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
- **Workflow de defesa em ocorrências:** não será implementado por decisão de negócio.
- **Preview local ativo:** `http://localhost:4178/` (se o servidor ainda estiver rodando).

---

*Se este arquivo estiver desatualizado, verifique `docs/RELATORIO_TRABALHO_2026_06_26.md`.*
