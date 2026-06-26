# CONTINUAR AQUI — RH Plena Unificado

> **Último trabalho:** 2026-06-26
> **Relatório completo:** `docs/RELATORIO_TRABALHO_2026_06_26.md`
> **Checklist:** `docs/CHECKLIST_IMPLANTACAO.md`
> **Perfis/Permissões:** `docs/PERFIL_ACOES_MODELO.md`
> **Regras de negócio:** `docs/REGRAS_NEGOCIO.md`

---

## ✅ Estado atual (pós sessão 2026-06-26)

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
- Migration 038 aplicada: RLS de `extras`, `recibos_extras`, `categorias_extras` e `ocorrencias` ✅
- Migration 039 aplicada: RLS granular dos buckets `ocorrencia-anexos` e `vr-arquivos` ✅
- Script manual disponível: `scripts/aplicar_rls_038_039_manual.sql` ✅
- Edge Function `econtador` re-deployada com permissão adm/dp1/dp2 ✅
- Menu **Configurações** adicionado na Sidebar ✅
- Regras de negócio documentadas em `docs/REGRAS_NEGOCIO.md` ✅

### Commits da sessão
- `28ca098` — responsividade mobile, PWA e formulário `/mobile/falta`
- `eebb0c2` — RLS de extras/ocorrências e regras de negócio
- `d663412` — ativa Edge Function e-Contador e adiciona Configurações no menu
- `7d3510c` — migration 039 de RLS granular do Storage
- `7d0764c` — script SQL manual para aplicação das migrations 038 e 039

---

## 🎯 Próximos passos pendentes (priorizados)

### 🔴 Crítico / antes de produção
1. **Resolver falha de memória nos testes** — `npm test` falha com `out of memory`. Ajustar `vitest.config.ts`.
2. **Tratar erros silenciados** — substituir `catch` vazio por toast + log.
3. **Remover mocks do bundle de produção** — `VITE_MODO_MOCK` e `mockData.ts`.
4. **Padronizar tratamento de erros** — unificar toast/console.error em hooks e páginas.

### 🟠 Alto
5. **Aplicar migrations futuras** com cuidado — verificar com `migration list` antes do `db push`.
6. **Revisar type assertions (`as`)** — reduzir uso, especialmente em formulários grandes.
7. **Quebrar páginas monolíticas** — `OcorrenciaFormPage`, `OcorrenciaDetailPage`, `CeuRelatoriosPage`.
8. **Unificar componentes de UI** — `CeuButton`, `VrButton`, `ExtrasButton`, etc.

### 🟡 Médio / após auditoria
9. **Confirmar PWA no celular** — "Adicionar à tela inicial" e tela cheia.
10. **Testar validação de duplicidade de extras** em cenário real.
11. **Definir design system** antes de implementar módulos novos.
12. **Módulos placeholders:** `/ferias`, `/escalas`, `/relatorios`.

---

## ⚠️ Atenções

- **Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.**
- **Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.**
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
- Build/testes podem falhar por falta de memória no ambiente; repetir se necessário.
- **Workflow de defesa em ocorrências:** não será implementado por decisão de negócio.

---

*Se este arquivo estiver desatualizado, verifique `docs/RELATORIO_TRABALHO_2026_06_26.md`.*
