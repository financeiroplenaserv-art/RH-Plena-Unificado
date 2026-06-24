# Roteiro de Segurança — Supabase

Este documento descreve os passos para aplicar a migração de RLS e rotacionar as chaves do Supabase.

> ⚠️ **Atenção:** este roteiro envolve alterações no banco de dados e nas credenciais do projeto. Execute em um momento de baixo uso do sistema e, se possível, faça backup dos dados importantes antes.

---

## Parte 1 — Aplicar a migração 010 (RLS)

A migração `supabase/migrations/010_rls_tabelas_negocio.sql` habilita Row Level Security nas tabelas de negócio e restringe DELETE apenas a administradores.

### Passos

1. Acesse o painel do Supabase:
   ```
   https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
   ```

2. No menu lateral, clique em **SQL Editor**.

3. Clique em **New query**.

4. Abra o arquivo local:
   ```
   supabase/migrations/010_rls_tabelas_negocio.sql
   ```

5. Copie todo o conteúdo e cole no editor do Supabase.

6. Clique em **Run**.

7. Verifique se não houve erros na execução.

> A migração foi escrita para ignorar silenciosamente tabelas que ainda não existem no banco, evitando erros do tipo `relation does not exist`.

### O que muda após aplicar

- Todos os usuários autenticados continuam podendo **ler, inserir e atualizar** dados.
- Apenas usuários com `nivel_acesso = 'admin'` na tabela `perfis` podem **deletar** registros.
- O histórico de importações do e-Contador continua visível apenas para o próprio usuário.

---

## Parte 1.5 — Aplicar a migração 011 (RLS nos storage buckets)

A migração `supabase/migrations/011_storage_buckets_rls.sql` protege os buckets `ocorrencia-anexos` e `vr-arquivos`.

### Passos

1. No painel do Supabase, acesse **SQL Editor → New query**.
2. Abra o arquivo local:
   ```
   supabase/migrations/011_storage_buckets_rls.sql
   ```
3. Copie todo o conteúdo e cole no editor.
4. Clique em **Run**.
5. Verifique se não houve erros.

### O que muda após aplicar

- Os buckets ficam privados (`public = false`).
- Usuários autenticados podem fazer upload, leitura e atualização de arquivos.
- Apenas administradores podem deletar arquivos dos buckets.

---

## Parte 1.6 — Aplicar a migração 012 (remover policies antigas do storage)

> ⚠️ **Importante:** a migração `011` já criou policies seguras, mas ainda existem policies antigas concedendo permissão `ALL` para qualquer usuário autenticado. A migração `012` remove essas policies antigas.

### Passos

1. Siga o roteiro detalhado em:
   ```
   docs/APLICAR_MIGRATION_012.md
   ```

2. Em resumo:
   - Acesse o painel do Supabase → SQL Editor → New query.
   - Cole o conteúdo de `supabase/migrations/012_limpar_policies_storage_antigas.sql`.
   - Clique em **Run**.

### O que muda após aplicar

- As policies antigas `Permitir admin e rh vr` e `Permitir admin e rh ocorrencias` são removidas.
- Apenas administradores podem deletar arquivos dos buckets.

---

## Parte 2 — Rotacionar as chaves do Supabase

> ⚠️ **Por que rotacionar?** O arquivo `.env` foi commitado anteriormente no repositório Git. Mesmo tendo sido removido depois, as chaves ainda estão no histórico do Git e podem ser vistas por quem tem acesso ao repositório.

> **Decisão atual:** por causa de instabilidade observada com as novas **Publishable keys** no Supabase (erros 404 em algumas requisições), o sistema continuará usando a chave **`anon`** legada por enquanto. O código já está preparado para aceitar `VITE_SUPABASE_PUBLISHABLE_KEY` quando a feature estiver estável, mas o `.env` local deve manter `VITE_SUPABASE_ANON_KEY` funcionando.

### 2.1. Antes de começar

- Tenha em mãos as novas chaves que serão geradas.
- Prepare um arquivo `.env` local atualizado (não commitar).
- Avise a equipe que o sistema pode precisar de novo login após a rotação.

### 2.2. Rotacionar as chaves de API

1. No painel do Supabase, vá em **Project Settings → API**.

2. Na seção **Project API keys**, clique em **Regenerate** para:
   - `anon` public
   - `service_role` secret

3. Copie as novas chaves e atualize o arquivo `.env` local:
   ```env
   VITE_SUPABASE_URL=https://jmdjdogskvybsdjtmpmb.supabase.co
   VITE_SUPABASE_ANON_KEY=nova_chave_anon_aqui
   ```

4. Se houver algum servidor/backend usando a `service_role`, atualize também:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=nova_chave_service_role_aqui
   ```

5. **Não desabilite as legacy API keys no painel enquanto estiver usando `VITE_SUPABASE_ANON_KEY`.** A migração para Publishable keys ficará para uma etapa futura.

### 2.3. Alterar a senha do banco de dados (Postgres)

1. Vá em **Project Settings → Database**.

2. Na seção **Database password**, clique em **Reset database password**.

3. Salve a nova senha em um local seguro (gerenciador de senhas).

### 2.4. Regenerar o JWT Secret (opcional, mas recomendado)

> ⚠️ Esta ação invalida todos os tokens de autenticação ativos. Todos os usuários logados serão deslogados.

1. Vá em **Project Settings → Database → Postgres**.

2. Procure por **JWT Secret** ou **JWT Settings**.

3. Clique em **Regenerate**.

4. Após isso, todos os usuários precisarão fazer login novamente.

### 2.5. Atualizar o ambiente local

1. Edite o arquivo `.env` na raiz do projeto com as novas chaves.

2. **Nunca commitar o `.env`.** Verifique se ele continua no `.gitignore`:
   ```
   .env
   .env.local
   .env.*.local
   ```

3. Se o repositório for privado e somente você tiver acesso, o risco é menor. Se for compartilhado, considere também limpar o histórico do Git (veja Parte 3).

---

## Parte 3 — Limpar chaves do histórico do Git (opcional e arriscado)

> ⚠️ **Atenção:** limpar o histórico do Git reescreve o histórico de commits. Se outras pessoas já clonaram o repositório, isso pode causar grandes problemas de sincronização. Só faça se o repositório for pessoal ou se todos estiverem cientes.

Se desejar prosseguir, execute no terminal:

```bash
# Instalar ferramenta de limpeza
git filter-repo --path .env --invert-paths
```

Ou, com `filter-branch`:

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

Depois:

```bash
git push origin --force --all
```

---

## Parte 4 — Verificações após a rotação

1. Tente fazer login no sistema com um usuário comum.
2. Tente fazer login com um usuário admin.
3. Verifique se a importação do e-Contador continua funcionando.
4. Verifique se as páginas de colaboradores, ocorrências e CEU carregam normalmente.
5. Com um usuário não-admin, tente deletar algo — deve ser bloqueado pelo banco.

---

## Pendências de segurança

- [x] Aplicar RLS nas tabelas de negócio (migração 010 pronta)
- [x] Preparar código para novas Publishable/Secret API keys
- [x] Revisar storage buckets e habilitar RLS (migração 011 pronta)
- [x] Aplicar as migrações 010 e 011 no banco de produção
- [x] Aplicar a migração 012 no banco de produção
- [ ] Rotacionar as chaves `anon` e `service_role` no painel do Supabase
- [ ] Limpar chaves antigas do histórico do Git
- [ ] (Futuro) Migrar definitivamente das legacy API keys para Publishable keys
- [ ] (Futuro) Desabilitar legacy API keys no painel do Supabase
- [ ] (Futuro) Revogar o legacy JWT secret

> A migração para as novas Publishable keys apresentou erros 404 em algumas requisições (especialmente no histórico do e-Contador), possivelmente por limitações atuais da feature no Supabase. O sistema voltou a usar a `anon` key legada temporariamente, mas o código já está preparado para aceitar `VITE_SUPABASE_PUBLISHABLE_KEY` quando a migração for viável.

## Contato e próximos passos

Após concluir, recomendamos:
- Revisar os storage buckets do Supabase e habilitar RLS neles também.
- Revisar quem tem acesso ao projeto no painel do Supabase.
- Considerar habilitar autenticação de dois fatores nas contas com acesso.
