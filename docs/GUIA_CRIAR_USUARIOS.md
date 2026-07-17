# Guia: Criando os Primeiros Usuários no CORH

> Este guia é para **administradores do sistema** que precisam dar acesso a novos usuários.
> O CORH não permite cadastro público. Todo acesso é criado por você.

---

## 1. O que você precisa antes de começar

- Acesso ao **painel do Supabase** do projeto (URL do projeto e senha).
- Acesso ao **CORH com perfil de administrador** (`adm` ou `admin`).
- Lista de e-mails e perfis desejados dos novos usuários.

---

## 2. Criar o usuário no Supabase Auth

O Supabase Auth é quem guarda o e-mail e a senha do usuário.

1. Acesse o painel do Supabase:  
   `https://supabase.com/dashboard/project/[SEU-PROJECT-ID]`

2. No menu lateral, clique em **Authentication** → **Users**.

3. Clique no botão **Add user** (ou **New user**).

4. Preencha:
   - **E-mail**: use o e-mail corporativo da pessoa.
   - **Senha**: crie uma senha temporária forte. Exemplo: `Corh@2026!`  
     ⚠️ **Importante**: anote essa senha. Você vai passar para o usuário.

5. Deixe a opção **Auto-confirm** ativada se quiser que o usuário entre sem confirmar e-mail.  
   Se preferir mais segurança, deixe desativado e peça para a pessoa confirmar o e-mail antes de usar.

6. Clique em **Create user**.

✅ O usuário agora existe no Supabase, mas ainda não tem acesso ao CORH. O próximo passo é definir o perfil dele.

---

## 3. Definir o perfil de acesso no CORH

O CORH controla o que cada usuário pode ver e fazer através do menu **Permissões**.

1. Faça login no CORH com seu perfil de administrador.

2. No menu lateral, clique em **Permissões**.

3. Você verá uma lista de recursos organizados por grupos (Dados Mestres, Ocorrências, Extras, VR, etc.).

4. Para definir o perfil de um usuário, você precisa primeiro saber qual **nível de acesso** ele terá:

| Perfil | O que pode fazer | Quando usar |
|---|---|---|
| `visualizador` | Apenas visualiza dados. Não cria, edita nem exclui. | Colaboradores de outras áreas que só precisam consultar. |
| `gestor` | Visualiza e edita ocorrências. Não acessa configurações. | Gestores de área que acompanham o time. |
| `rh` | Visualiza colaboradores, cria/edita ocorrências, pode importar dados. | Analistas de RH. |
| `dp1` / `dp2` | Acessam módulos de VR e integrações conforme permissão. | Departamento Pessoal. |
| `mesa` / `inspetoria` | Acessam módulo de Extras e lançamentos. | Operação de ponto. |
| `financeiro` | Acessa recibos e marca extras como pagos. | Financeiro. |
| `admin` | Acesso total ao sistema. | Você e pouquíssimas pessoas de confiança. |

5. No menu **Permissões**, você configura o que cada perfil pode fazer.  
   Se quiser que todos os `gestor` tenham acesso de edição em ocorrências, marque as permissões para o perfil `gestor`.

6. Para alterar o nível de acesso de um usuário específico, você pode:
   - Acessar a tabela `perfis` no Supabase (SQL Editor → `SELECT * FROM public.perfis`) e alterar o campo `nivel_acesso`.
   - Ou, se houver uma tela de gestão de usuários no CORH, use ela.

> 💡 **Dica**: novos usuários criados no Supabase já conseguem fazer login, mas entram com o perfil `visualizador` por padrão. Você precisa mudar manualmente para `rh`, `gestor` ou outro perfil no banco.

---

## 4. Comando SQL para ajustar o perfil (opcional)

Se você quiser ajustar o nível de acesso diretamente pelo SQL Editor do Supabase:

```sql
-- Substitua o email pelo email do usuário e o perfil desejado
UPDATE public.perfis
SET nivel_acesso = 'rh'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'usuario@empresa.com'
);
```

Perfis válidos: `adm`, `admin`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `inspetoria`, `financeiro`, `visualizador`.

---

## 5. Passar o acesso para o usuário

Envie para a pessoa:

1. **Link do CORH**: URL do site publicado.
2. **E-mail**: o e-mail cadastrado no Supabase.
3. **Senha temporária**: a senha que você criou.
4. **Instrução**: peça para ela trocar a senha no primeiro acesso ou assim que possível.

Exemplo de mensagem:

> Olá! Seu acesso ao CORH foi criado.
>
> Link: https://corh.plena.com.br  
> E-mail: usuario@plena.com.br  
> Senha temporária: Corh@2026!  
>
> Por favor, acesse o link e altere sua senha no primeiro login.  
> Se tiver problemas, entre em contato comigo.

---

## 6. Configurações de segurança recomendadas no Supabase

Para evitar que outras pessoas criem contas por conta própria:

1. Vá em **Authentication → Settings**.
2. Verifique:
   - **Enable email confirmations**: ative se quiser confirmar e-mail antes do primeiro acesso.
   - **Enable signup**: recomendamos **desativar**, já que você cria usuários manualmente.
   - **Minimum password length**: 8 caracteres ou mais.

---

## 7. Checklist de criação de usuário

- [ ] Criei o usuário no Supabase Auth (e-mail + senha temporária).
- [ ] Anotei a senha temporária.
- [ ] Defini o nível de acesso no menu Permissões ou via SQL.
- [ ] Enviei o link, e-mail e senha para o usuário.
- [ ] Pedi para o usuário trocar a senha no primeiro acesso.
- [ ] Testei o login com o novo usuário para confirmar que funciona.

---

## 8. Problemas comuns

### O usuário não consegue fazer login
- Confirme se o e-mail está correto no Supabase Auth.
- Verifique se a senha temporária foi digitada corretamente.
- Veja se o usuário foi confirmado (confirmado por e-mail ou marcado como confirmed no Supabase).

### O usuário entra, mas não vê os menus esperados
- O perfil dele provavelmente está como `visualizador`.  
- Verifique e ajuste o campo `nivel_acesso` na tabela `public.perfis`.

### O usuário entra, mas vê dados que não deveria
- Revise as permissões no menu **Permissões** do CORH.
- Revise as políticas de RLS no Supabase para garantir que não estão muito abertas.

---

## 9. Próximos passos

Depois de criar os primeiros usuários:

1. Faça um teste piloto com 1 ou 2 pessoas de cada perfil.
2. Use o guia `GUIA_TESTES_PILOTO.md` para organizar o teste.
3. Colete feedbacks e ajuste permissões antes de liberar o acesso para mais pessoas.
