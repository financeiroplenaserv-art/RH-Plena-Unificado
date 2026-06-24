# Aplicar Migration 012 — Limpar Policies Antigas do Storage

> Data de criação: 2026-06-24  
> Pré-requisito: migrations 010 e 011 já aplicadas no banco de produção.

---

## ⚠️ Por que essa migration é necessária?

As migrations 010 e 011 criaram policies seguras nos buckets `ocorrencia-anexos` e `vr-arquivos`, mas ainda existem **policies antigas** no banco que concedem permissão `ALL` (incluindo DELETE) para **qualquer usuário autenticado**:

- `Permitir admin e rh vr`
- `Permitir admin e rh ocorrencias`

Essas policies antigas anulam a restrição de DELETE apenas para administradores. A migration 012 remove essas policies antigas, deixando apenas as regras seguras da migration 011.

---

## 📋 Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 012

Abra o arquivo local:

```
supabase/migrations/012_limpar_policies_storage_antigas.sql
```

Copie todo o conteúdo abaixo e cole no editor do Supabase:

```sql
-- Migração 012: Remove policies antigas de storage que concedem permissão total (ALL)
-- e conflitam com as regras da migration 011.
--
-- As policies removidas abaixo davam permissão ALL para qualquer usuário autenticado,
-- anulando a restrição de DELETE apenas para administradores.

DROP POLICY IF EXISTS "Permitir admin e rh vr" ON storage.objects;
DROP POLICY IF EXISTS "Permitir admin e rh ocorrencias" ON storage.objects;
```

### 4. Execute a query

Clique em **Run**.

A execução deve retornar sucesso sem erros. Como usamos `IF EXISTS`, não há problema se alguma das policies já tiver sido removida anteriormente.

---

## ✅ Verificações após a aplicação

### Verificar no painel

1. No menu lateral, vá em **Storage**.
2. Clique no bucket **`ocorrencia-anexos`**.
3. Vá para a aba **Policies**.
4. Confirme que **não existe** mais a policy `Permitir admin e rh ocorrencias`.
5. As policies que devem permanecer são:
   - `Autenticados podem ler anexos`
   - `Autenticados podem inserir anexos`
   - `Autenticados podem atualizar anexos`
   - `Apenas admins podem deletar anexos`

6. Repita o processo para o bucket **`vr-arquivos`**.
7. Confirme que **não existe** mais a policy `Permitir admin e rh vr`.
8. As policies que devem permanecer são:
   - `Autenticados podem ler vr-arquivos`
   - `Autenticados podem inserir vr-arquivos`
   - `Autenticados podem atualizar vr-arquivos`
   - `Apenas admins podem deletar vr-arquivos`

### Verificar via SQL (opcional)

Após aplicar, execute a query abaixo no SQL Editor para confirmar que as policies antigas sumiram:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Permitir admin e rh vr',
    'Permitir admin e rh ocorrencias'
  );
```

**Resultado esperado:** nenhuma linha retornada.

Para ver todas as policies atuais dos buckets:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%anexos%'
   OR policyname LIKE '%vr-arquivos%'
   OR policyname LIKE '%admin e rh%'
ORDER BY policyname;
```

---

## 🔄 Próximos passos

Após confirmar que a migration 012 foi aplicada com sucesso:

1. **Rotacionar as chaves `anon` e `service_role`** no painel do Supabase (Project Settings → API → Regenerate).
2. **Atualizar o `.env` local** com as novas chaves (não commitar).
3. **(Opcional) Limpar o histórico do Git** para remover o `.env` que foi commitado anteriormente.

Consulte `docs/SEGURANCA_SUPABASE.md` para o roteiro completo.
