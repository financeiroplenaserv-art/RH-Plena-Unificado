# Aplicar Migration 076 — Corrige RPC do consentimento LGPD (tela travada no aceite)

> Data de criação: 2026-07-27
> O que ela habilita: o botão **"Aceito e quero continuar"** da tela de consentimento LGPD volta a funcionar. Sem ela, o usuário fica preso na tela do termo (erro silencioso no toast).

---

## Por que essa migration é necessária?

A coluna `perfis.consentimento_lgpd_finalidades` é `TEXT[]` (migration 036), mas a RPC `registrar_consentimento_lgpd` (migration 068) recebe `p_finalidades` como `jsonb` e atribui direto na coluna. O PostgreSQL não converte `jsonb` → `text[]` sozinho, então o UPDATE falha com erro de tipo e o consentimento nunca é gravado.

O bug só apareceu agora (27/07) porque todos os consentimentos anteriores foram gravados antes da migration 068 existir.

**Não há pré-requisito além da 068 já aplicada** (ela está — é a versão quebrada que esta corrige).

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 076

Arquivo local:

```
supabase/migrations/076_fix_consentimento_lgpd_rpc.sql
```

### 4. Execute (Run)

Resultado esperado: `Success. No rows returned`.

### 5. Verifique

Faça login com um usuário de teste (ex.: Visualizador Teste), marque a caixa de aceite e clique em **"Aceito e quero continuar"**. O sistema deve entrar normalmente.

Opcional, no SQL Editor:

```sql
select email, nome, consentimento_lgpd, consentimento_lgpd_versao
from perfis
where nome like '% Teste';
```

O usuário que aceitou deve aparecer com `consentimento_lgpd = true` e versão `1.0`.

---

## Se algo der errado

- **Erro de versão do termo** — significa que a migration funcionou, mas o app mandou uma versão diferente do termo ativo. Verifique se há mais de um termo ativo em `termos_lgpd` (deve haver só o `1.0` ativo).
- **"Perfil não encontrado"** — o usuário autenticado não tem linha em `perfis`; relogue para recriar o perfil automaticamente.
