# Aplicar Migration 064 — Correções críticas de segurança (pré-go-live)

> Data de criação: 2026-07-18
> **Aplicar ANTES de liberar o sistema para usuários reais.**

---

## O que ela corrige

1. **Escalonamento a admin:** qualquer usuário podia virar admin alterando o próprio `nivel_acesso` em `perfis` (policies órfãs da migration 042 + self-update sem trava). A migration remove as policies órfãs, limita o self-INSERT ao nível `visualizador` e cria trigger que **bloqueia não-admin de alterar `nivel_acesso`/`empresa_id`** (o consentimento LGPD continua funcionando).
2. **`calendario_adicionais` aberto:** CRUD completo estava liberado a qualquer autenticado (policies das migrations 003 e 037). Passa a seguir o padrão das outras tabelas de adicionais.
3. **Policy aberta da 037 em `departamentos`:** anulava a restrição da migration 063 (policies combinam com OR). O DROP dela faz a 063 valer de verdade.
4. **Auditoria em `perfis`:** toda alteração de perfil passa a ser registrada em `log_auditoria`.
5. **Seed CEU:** insere as permissões do novo bloco CEU da tela Permissões para os perfis que já operam o módulo (gestor, dp1, dp2, mesa, inspetoria nas ações operacionais; gestor/dp nas administrativas).

## Passo a passo

1. Acesse `https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb` → **SQL Editor → New query**.
2. Cole o conteúdo de `supabase/migrations/064_seguranca_perfis_calendario_ceu.sql`.
3. Clique em **Run**. Não deve retornar erro.
4. Valide:
   - Login com `teste.mesa`: o sistema funciona normalmente.
   - No console do navegador (F12), tente como usuário não-admin:
     ```js
     const { createClient } = window.supabase ?? {}
     ```
     ou simplesmente confirme no banco que não é possível alterar `nivel_acesso` sem ser admin:
     ```sql
     -- logado como mesa, deve falhar com "Sem permissão para alterar nivel_acesso"
     update public.perfis set nivel_acesso = 'admin' where id = auth.uid();
     ```
5. Confira na tela **Permissões** que o grupo **CEU** aparece com as 9 ações.

## Se algo quebrar

- Usuário novo não consegue entrar: verifique se a policy `Perfis insert proprio visualizador` foi criada (ela permite o self-INSERT só como `visualizador`).
- Consentimento LGPD parou de gravar: o trigger só bloqueia mudanças em `nivel_acesso`/`empresa_id`; se o erro for outro, me avise com a mensagem exata.
