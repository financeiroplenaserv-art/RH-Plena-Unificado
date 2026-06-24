# Rotacionar Chaves do Supabase — Roteiro Prático

> Data de criação: 2026-06-24  
> Motivo: o arquivo `.env` foi commitado anteriormente no Git. Mesmo removido depois, as chaves ainda existem no histórico do repositório.

---

## ⚠️ Antes de começar

- Escolha um momento de **baixo uso** do sistema.
- Avise os usuários que o sistema pode precisar de novo login após a rotação.
- Tenha em mãos um local seguro para anotar as novas chaves (gerenciador de senhas).
- Este roteiro **não migra para Publishable keys**. Continuaremos usando a chave `anon` legada por enquanto.

---

## 1. Rotacionar a chave `anon` (usada pelo frontend)

### 1.1. No painel do Supabase

1. Acesse:
   ```
   https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
   ```

2. No menu lateral, vá em **Project Settings → API**.

3. Na seção **Project API keys**, localize a chave `anon` public.

4. Clique em **Regenerate** ao lado da chave `anon`.

5. Copie a **nova chave `anon`** imediatamente (o painel pode escondê-la depois).

### 1.2. Atualizar o `.env` local

1. Abra o arquivo `.env` na raiz do projeto.

2. Atualize a linha:
   ```env
   VITE_SUPABASE_ANON_KEY=nova_chave_anon_aqui
   ```

3. **Não commitar** o `.env`. Verifique se ele continua no `.gitignore`:
   ```
   .env
   .env.local
   .env.*.local
   ```

### 1.3. Verificar se o sistema carrega a nova chave

1. Reinicie o servidor de desenvolvimento (se estiver rodando):
   ```bash
   npm run dev
   ```

2. Abra o sistema no navegador e tente fazer login.

3. Verifique se as páginas carregam normalmente.

---

## 2. Rotacionar a chave `service_role` (usada em backend/scripts)

> A `service_role` dá acesso total ao banco. Ela **não deve** ser usada no frontend.

### 2.1. No painel do Supabase

1. Ainda em **Project Settings → API**.

2. Localize a chave `service_role` secret.

3. Clique em **Regenerate** ao lado da chave `service_role`.

4. Copie a **nova chave `service_role`**.

### 2.2. Atualizar onde estiver sendo usada

No projeto atual, a `service_role` não está sendo usada em código (apenas existe no `.env.example` como referência). Mas se houver algum script, servidor ou integração usando, atualize:

```env
SUPABASE_SERVICE_ROLE_KEY=nova_chave_service_role_aqui
```

Verifique se não há chaves antigas em:
- Arquivos `.env` locais
- CI/CD (GitHub Actions, Vercel, Netlify, etc.)
- Servidores de backend
- Scripts automatizados

---

## 3. Resetar a senha do banco de dados (Postgres)

1. No painel, vá em **Project Settings → Database**.

2. Na seção **Database password**, clique em **Reset database password**.

3. Escolha uma senha forte e salve no gerenciador de senhas.

> ⚠️ Se você ou algum membro da equipe conecta-se diretamente ao banco via Postgres (pgAdmin, psql, DBeaver, etc.), precisará atualizar a senha nessas conexões.

---

## 4. Regenerar o JWT Secret (opcional, mas recomendado)

> ⚠️ **Atenção:** essa ação desloga **todos** os usuários atualmente logados. Todos precisarão fazer login novamente.

1. No painel, vá em **Project Settings → Database → Postgres**.

2. Procure por **JWT Secret** ou **JWT Settings**.

3. Clique em **Regenerate**.

4. Confirme a ação.

---

## 5. Verificações após a rotação

Execute estes testes no sistema:

- [ ] Login com usuário comum funciona.
- [ ] Login com usuário admin funciona.
- [ ] Página de colaboradores carrega.
- [ ] Página de ocorrências carrega.
- [ ] Página de CEU carrega.
- [ ] Upload de anexos em ocorrências funciona.
- [ ] Upload de arquivos em VR funciona.
- [ ] Importação do e-Contador continua funcionando.
- [ ] Usuário não-admin não consegue deletar registros (teste em dev/homologação).

---

## 6. Próximo passo: limpar o histórico do Git (opcional)

Se o repositório for pessoal ou todos da equipe estiverem cientes, considere remover o `.env` do histórico do Git:

```bash
# Com git filter-repo (recomendado)
git filter-repo --path .env --invert-paths

# Ou com git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

Depois:

```bash
git push origin --force --all
```

> ⚠️ Isso reescreve o histórico de commits. Não faça em repositórios compartilhados sem avisar a equipe.

---

## ✅ Checklist final

- [ ] Chave `anon` rotacionada no painel.
- [ ] `.env` local atualizado com nova `anon`.
- [ ] Chave `service_role` rotacionada no painel.
- [ ] Senha do banco resetada.
- [ ] JWT Secret regenerado (se aplicado).
- [ ] Testes de login e funcionalidades realizados.
- [ ] `.env` não commitado.
