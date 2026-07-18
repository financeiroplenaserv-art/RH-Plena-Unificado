# Aplicar Migration 065 — RLS de escalas, CEU, alertas e modelos

> Data de criação: 2026-07-18
> Continuação da leva 2 da auditoria pré-go-live.

## O que ela faz

1. **Escalas (4 tabelas):** `locais_trabalho`, `mapeamento_flit_local_trabalho`, `locais_trabalho_diario`, `historico_local_trabalho_diario` — SELECT passa a exigir perfil autorizado (`pode_ver_escalas`). Bloqueado: `visualizador`.
2. **CEU (3 tabelas):** `itens`, `fornecedores`, `entregas` — SELECT via `pode_ver_ceu` (admin/adm/gestor/dp1/dp2/mesa/inspetoria).
3. **Alertas e modelos de ocorrência:** SELECT via `pode_ver_alertas` (admin/adm/gestor/rh/dp1/dp2/mesa). O Dashboard de perfis fora da lista mostra a Central de Alertas vazia.
4. **Token e-Contador:** o perfil `rh` deixa de ler `econtador_token` (a migration 055 já dizia que RH não acessa o e-Contador; agora a RLS reflete isso — só admin/dp).
5. **Higiene:** remove a policy órfã `Perfis delete admin` (redundante).

## Passo a passo

1. Acesse `https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb` → **SQL Editor → New query**.
2. Cole o conteúdo de `supabase/migrations/065_rls_escalas_ceu_alertas_modelos.sql`.
3. Clique em **Run**. Não deve retornar erro.
4. Valide com `teste.mesa`:
   - Escalas, CEU (Movimentações/Itens/Fornecedores) e Dashboard abrem normalmente.
   - Ocorrências abrem com os modelos disponíveis.
5. Valide com `teste.visualizador` (se existir): Escalas e CEU devem mostrar listas vazias.

## Se algo quebrar

Se alguma tela ficar vazia para um perfil que deveria ver dados, revise a lista de perfis na função correspondente (`pode_ver_escalas` / `pode_ver_ceu` / `pode_ver_alertas`) e me avise — o ajuste é de uma linha no `IN (...)`.
