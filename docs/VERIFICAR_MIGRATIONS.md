# Como verificar se as migrations de segurança já foram aplicadas

Siga os passos abaixo no painel do Supabase para confirmar se as migrations `010` e `011` já estão ativas no banco de produção.

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

## 3. Resultado

Se todas as policies e RLS estiverem presentes, as migrations **já foram aplicadas**.

Se faltar alguma policy ou RLS, ainda é necessário executar as migrations 010 e 011 no **SQL Editor**.
