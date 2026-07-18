# Aplicar Migration 062 — Restaurar leitura de permissoes_perfil

> Data de criação: 2026-07-18
> Sintoma que ela resolve: usuários não-admin (ex.: `teste.mesa`) entram no sistema e veem a **sidebar vazia** (só a marca CORH e o botão Sair).

---

## Por que essa migration é necessária?

A migration 058 (consolidação de RLS) restringiu o `SELECT` da tabela `permissoes_perfil` para administradores (`USING public.is_admin()`).

O app carrega as permissões do próprio perfil no login (`useAuth > carregarPermissoesDoPerfil`) para montar a sidebar. Sem permissão de leitura, o cache de permissões fica vazio e `verificarPermissao` retorna `false` para todos os itens de menu — resultado: sidebar vazia para qualquer perfil que não seja `admin`/`adm`.

A tabela `permissoes_perfil` contém apenas flags de visibilidade de menus/ações (`perfil, recurso, acao, permitido`) — não há dados pessoais. O `SELECT` volta a ser aberto a usuários autenticados (como era na migration 046); a escrita (INSERT/UPDATE/DELETE) continua restrita a administradores.

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 062

Arquivo local:

```
supabase/migrations/062_select_permissoes_perfil_autenticados.sql
```

Conteúdo:

```sql
DROP POLICY IF EXISTS "Permitir select de permissoes_perfil" ON public.permissoes_perfil;

CREATE POLICY "Permitir select de permissoes_perfil"
  ON public.permissoes_perfil
  FOR SELECT
  TO authenticated
  USING (true);
```

### 4. Execute (Run)

Clique em **Run**. Não deve retornar erro.

### 5. Valide

No sistema, faça logout e login novamente com o usuário de teste (ex.: `teste.mesa`). A sidebar deve exibir os menus do perfil `mesa` (Dashboard, Colaboradores, Departamentos, Empresas, Ocorrências, Extras, Adicionais, CEU, Férias, Relatórios).
