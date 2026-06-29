# Workflow de Migrations — RH Plena Unificado

> Regras obrigatórias para qualquer agente que for criar ou aplicar migrations no Supabase.

---

## 1. Antes de criar uma migration

- Verifique o maior número existente em `supabase/migrations/`.
- **NUNCA use um número já utilizado.** Se houver conflito, renumerar a migration anterior ou a nova.
- Nomeie no padrão: `NNN_descricao_curta.sql` (ex: `042_limpar_rls_sensiveis.sql`).

## 2. Antes de aplicar migrations

Sempre rodar primeiro:

```bash
npx supabase migration list
```

Anote o estado atual (print/salvar saída). Identifique:
- Migrations aplicadas no remote (coluna `Remote` preenchida).
- Migrations pendentes.
- Números duplicados ou conflitantes.

## 3. Aplicar migrations

Use apenas o comando oficial:

```bash
npx supabase db push
```

**NÃO aplique o conteúdo da migration diretamente pelo SQL Editor** sem registrar na tabela `supabase_migrations.schema_migrations`, pois isso deixa o estado inconsistente.

## 4. Depois de aplicar

Obrigatoriamente rode novamente:

```bash
npx supabase migration list
```

Confirme que todas as migrations aparecem na coluna `Remote`.

## 5. Caso existam migrations duplicadas

Se dois arquivos locais tiverem o mesmo número (ex: `038_*`):

1. Decida qual deve manter o número original.
2. Renumerar a outra para um número livre (ex: `043_*`).
3. Rode `npx supabase migration list` para confirmar que ambas aparecem como pendentes.
4. Rode `npx supabase db push`.
5. Rode `npx supabase migration list` novamente para confirmar aplicação.

## 6. Registrar no checklist

Após aplicar, atualize:
- `docs/CHECKLIST_IMPLANTACAO.md`
- `docs/CHECKLIST_CORRECOES.md`
- `docs/CONTINUAR_AQUI.md`

Mencione a data e o comando utilizado.

## 7. Verificação periódica

Antes de qualquer sessão de trabalho relevante, rode:

```bash
npx supabase migration list
```

Isso evita descobrir migrations pendentes apenas no momento do deploy.

---

## 📝 Log de aplicações

### 2026-06-26
- Problema: migrations 040, 041, 042 e uma das 038 não estavam aplicadas no remote.
- Causa: dois arquivos com número `038` (`038_departamentos_sem_nome_curto_inativos.sql` e `038_rls_extras_ocorrencias.sql`). O CLI aplicou apenas um.
- Ação: renomeada `038_rls_extras_ocorrencias.sql` → `043_rls_extras_ocorrencias.sql`.
- Comando: `npx supabase db push`
- Aplicadas: `040_corrigir_select_aberto_037.sql`, `041_rls_configuracoes_token_restrito.sql`, `042_limpar_rls_sensiveis.sql`, `043_rls_extras_ocorrencias.sql`.
- Verificação: `npx supabase migration list` confirmou todas as migrations de 001 a 043 aplicadas no remote.

---

### 2026-06-26 (continuação)
- Ação: criada e aplicada `044_isolar_storage_contexto.sql`.
  - Isolou SELECT/UPDATE/DELETE dos buckets `ocorrencia-anexos` e `vr-arquivos` pelo path (`ocorrencia_id` / `projeto_id`), verificando existência do registro no banco.
- Ação: criada e aplicada `045_restringir_insert_storage_contexto.sql`.
  - Reforçou INSERT nos buckets para exigir o mesmo contexto válido.
- Verificação: `npx supabase migration list` confirmou 044 e 045 aplicadas no remote.

---

### 2026-06-26 (finalização permissões dinâmicas)
- Ação: criada e aplicada `046_tabela_permissoes_perfil.sql`.
  - Criou tabela `permissoes_perfil` com RLS e seed de 132 permissões de ações.
- Ação: criada e aplicada `047_permissoes_rotas_menus.sql`.
  - Adicionou permissões de menus (`menu:*`) e rotas (`rota:*`) para todos os perfis.
- Comando: `npx supabase db push`
- Verificação: `npx supabase migration list` confirmou 046 e 047 aplicadas no remote.

---

### 2026-06-29
- Ação: verificação e aplicação das migrations 048–051 do módulo Escalas.
- Comando: `npx supabase migration list` confirmou que 001–047 já estavam aplicadas.
- Comando: `npx supabase db push` aplicou 048, 049, 050 e 051.
- Verificação: `npx supabase migration list` confirmou 001–051 aplicadas no remote.

*Criado em: 2026-06-26*
