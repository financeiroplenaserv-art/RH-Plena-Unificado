# Como verificar se as migrations de segurança já foram aplicadas

Siga os passos abaixo no painel do Supabase para confirmar se as migrations `010`, `011` e `012` já estão ativas no banco de produção.

## 1. Verificar RLS nas tabelas (migration 010)

1. Acesse o painel:
   ```
   https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
   ```

2. No menu lateral, clique em **Database → Tables**.

3. Verifique se as seguintes tabelas aparecem com **RLS habilitado** (ícone de escudo ou coluna "RLS"):
   - `empresas`
   - `colaboradores`
   - `departamentos`
   - `perfis`
   - `configuracoes`
   - `ocorrencias`
   - `ocorrencia_anexos`
   - `ocorrencia_testemunhas`
   - `ocorrencia_aprovacoes`
   - `ocorrencia_defesas`
   - `alertas`
   - `modelos_ocorrencia`
   - `auditoria`
   - `projetos_vr`
   - `resultados_vr`
   - `fornecedores`
   - `itens`
   - `entregas`
   - `contratos_adicionais`
   - `vinculos_adicionais`
   - `calendario_adicionais`

4. Clique em cada tabela e depois na aba **Policies**. Você deve ver policies como:
   - `Permitir select para autenticados`
   - `Permitir insert para autenticados`
   - `Permitir update para autenticados`
   - `Permitir delete apenas para admins`

5. Para a tabela `historico_importacoes_econtador`, as policies devem restringir ao próprio usuário:
   - `Usuários veem próprio histórico`
   - `Usuários inserem próprio histórico`
   - `Usuários atualizam próprio histórico`
   - `Apenas admins deletam histórico`

## 2. Verificar RLS nos storage buckets (migration 011)

1. No menu lateral, clique em **Storage → Buckets**.

2. Confirme que os buckets existem:
   - `ocorrencia-anexos`
   - `vr-arquivos`

3. Clique em cada bucket e depois em **Policies**. Você deve ver:
   - `Autenticados podem ler ...`
   - `Autenticados podem inserir ...`
   - `Autenticados podem atualizar ...`
   - `Apenas admins podem deletar ...`

4. Verifique também que os buckets estão como **Private** (não públicos).

## 3. Verificar remoção das policies antigas (migration 012)

1. Ainda em **Storage → Buckets**, clique no bucket **`ocorrencia-anexos`**.

2. Na aba **Policies**, confirme que **não existe** a policy:
   - `Permitir admin e rh ocorrencias`

3. Clique no bucket **`vr-arquivos`**.

4. Na aba **Policies**, confirme que **não existe** a policy:
   - `Permitir admin e rh vr`

5. Opcionalmente, execute a query abaixo no SQL Editor para confirmar que as policies antigas sumiram:

   ```sql
   SELECT policyname
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname IN (
       'Permitir admin e rh vr',
       'Permitir admin e rh ocorrencias'
     );
   ```

   **Resultado esperado:** nenhuma linha retornada.

## 4. Resultado

Se todas as policies e RLS estiverem presentes e as policies antigas tiverem sido removidas, as migrations **já foram aplicadas**.

Se faltar alguma policy, RLS ou ainda existirem policies antigas, execute a migration correspondente no **SQL Editor**:
- Migration 010: `supabase/migrations/010_rls_tabelas_negocio.sql`
- Migration 011: `supabase/migrations/011_storage_buckets_rls.sql`
- Migration 012: `supabase/migrations/012_limpar_policies_storage_antigas.sql`
