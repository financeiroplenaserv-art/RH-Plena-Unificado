# Relatório do dia — Segurança do Supabase

> Data: 2026-06-23
> Tarefa em andamento: Roteiro de segurança do Supabase (RLS, storage buckets e credenciais).
> Próximo agente: leia este arquivo antes de continuar.

---

## ✅ O que já estava pronto no início do dia

- `.env` removido do repositório Git.
- `.env.example` atualizado para suportar `VITE_SUPABASE_PUBLISHABLE_KEY` (com fallback para `VITE_SUPABASE_ANON_KEY`).
- `src/lib/supabase.ts` preparado para aceitar Publishable Key com fallback para anon.
- `.gitignore` já ignora `.env`.
- `docs/SEGURANCA_SUPABASE.md` criado com roteiro completo.
- `supabase/migrations/010_rls_tabelas_negocio.sql` criada.
- `supabase/migrations/011_storage_buckets_rls.sql` criada.
- Build e lint do projeto estão passando.

---

## ✅ O que foi feito hoje

1. **Revisão das migrations 010 e 011**
   - Adicionada a tabela `log_auditoria` na migration 010 (aplica apenas se existir).
   - Reescrita a migration 011 para:
     - Criar policies apenas se os buckets existirem.
     - Usar `public.is_admin()` na regra de DELETE.
     - Tornar os buckets privados.

2. **Criação da migration 012**
   - Arquivo: `supabase/migrations/012_limpar_policies_storage_antigas.sql`
   - Remove policies antigas dos buckets que davam permissão `ALL` para qualquer autenticado:
     - `Permitir admin e rh vr`
     - `Permitir admin e rh ocorrencias`
   - **Ainda não foi aplicada no banco.**

3. **Atualização da documentação**
   - `docs/SEGURANCA_SUPABASE.md` foi atualizado para:
     - Refletir a decisão de manter a chave `anon` (por instabilidade das Publishable keys).
     - Incluir a Parte 1.5 (migration 011) e Parte 1.6 (migration 012).
     - Ajustar a lista de pendências.
   - `docs/VERIFICAR_MIGRATIONS.md` criado com passo a passo para verificar no painel se as migrations foram aplicadas.

4. **Verificação no painel do Supabase**
   - Confirmado que a **migration 010 foi aplicada**: tabelas de negócio possuem RLS habilitado e as 4 policies esperadas.
   - Confirmado que a **migration 011 foi aplicada**: buckets `ocorrencia-anexos` e `vr-arquivos` possuem as 4 policies de SELECT/INSERT/UPDATE/DELETE.
   - Identificado problema: ainda existem policies antigas `ALL` nos buckets, concedendo permissão total a qualquer autenticado. A migration 012 foi criada para corrigir isso.

5. **Validação do código**
   - TypeScript: ✅
   - Build: ✅ (requer `NODE_OPTIONS="--max-old-space-size=8192"` no ambiente local)
   - Lint: ✅

---

## ⏳ O que falta fazer

### Passo imediato (prioridade 1)
- [ ] **Aplicar a migration 012 no banco de produção**
  - Arquivo: `supabase/migrations/012_limpar_policies_storage_antigas.sql`
  - Aplicar via **SQL Editor** no painel do Supabase.
  - Após aplicar, verificar no **Storage → Buckets → Policies** que as policies antigas foram removidas.

### Passos seguintes
- [ ] **Rotacionar as chaves `anon` e `service_role` no painel do Supabase**
  - Project Settings → API → Regenerate.
  - Atualizar o `.env` local (não commitar).
  - Manter `VITE_SUPABASE_ANON_KEY` por enquanto (não migrar para Publishable key ainda).

- [ ] **Limpar chaves antigas do histórico do Git**
  - Usar `git filter-repo` ou `git filter-branch` para remover o `.env` do histórico.
  - Atenção: reescreve o histórico. Só fazer se o repositório for pessoal ou todos estiverem cientes.

- [ ] **(Futuro) Migrar para Publishable keys**
  - Aguardar estabilidade da feature no Supabase.
  - Quando for viável, atualizar `.env` para `VITE_SUPABASE_PUBLISHABLE_KEY` e desabilitar legacy keys.

---

## 📁 Arquivos criados/alterados hoje

- `supabase/migrations/010_rls_tabelas_negocio.sql` (alterado)
- `supabase/migrations/011_storage_buckets_rls.sql` (alterado)
- `supabase/migrations/012_limpar_policies_storage_antigas.sql` (criado)
- `docs/SEGURANCA_SUPABASE.md` (atualizado)
- `docs/VERIFICAR_MIGRATIONS.md` (criado)
- `docs/RELATORIO_DO_DIA.md` (este arquivo)

---

## ⚠️ Observações importantes

- **Decisão do dia:** manter a chave `anon` legada por enquanto. Não migrar para `VITE_SUPABASE_PUBLISHABLE_KEY` devido a instabilidade observada (erros 404 em algumas requisições).
- **Problema ativo até aplicar a 012:** as policies antigas `Permitir admin e rh vr` e `Permitir admin e rh ocorrencias` ainda permitem DELETE para qualquer usuário autenticado nos storage buckets.
- O `.env` local existe mas não deve ser commitado. Ele contém as credenciais atuais.

---

## 🚀 Sugestão de recomeço amanhã

1. Aplicar a migration 012 no painel do Supabase.
2. Verificar no painel se as policies antigas sumiram.
3. Se tudo estiver ok, seguir para a rotação das chaves `anon`/`service_role`.
