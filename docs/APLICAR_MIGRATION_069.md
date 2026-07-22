# Aplicar Migration 069 — Acesso da inspetoria ao plantão mobile (/mobile/falta)

> Data de criação: 2026-07-22
> Sintoma que ela resolve: o inspetor não consegue lançar extras pelo celular no fim de semana (`/mobile/falta`) — a rota redireciona para o dashboard e/ou o lançamento mostra "Erro ao registrar extra" mesmo gravando o registro.

---

## Por que essa migration é necessária?

Dois problemas foram diagnosticados na página `/mobile/falta` para o perfil `inspetoria`:

1. **Permissão de rota ausente.** A linha `('inspetoria', 'rota', 'mobile_falta')` só existia dentro da função `reset_permissoes_perfil` (migration 054), não no seed inicial (047). Perfis que nunca passaram pelo reset ficam sem acesso — o `ProtectedRoute` redireciona para o dashboard.

2. **Falso erro no salvamento (risco de duplicidade).** A página usava `insert().select().single()`. A inspetoria **não tem SELECT em `extras`** (regra de negócio: visualização só `adm, mesa, financeiro, dp1`). O INSERT era gravado, mas o SELECT do retorno falhava e a tela mostrava erro — o usuário tendia a tentar de novo, criando lançamentos duplicados.

A migration resolve com:

1. Grant versionado da permissão `('inspetoria', 'rota', 'mobile_falta', true)`.
2. RPC `registrar_extra_plantao(jsonb)` (SECURITY DEFINER): valida o perfil (`is_admin`/`is_editor`), checa duplicidade (mesma lógica do frontend) e insere — tudo atômico, sem exigir SELECT em `extras`. O frontend (`MobileFaltaPage`) passa a usar essa RPC.

**Nenhuma regra de visibilidade foi alterada:** a inspetoria continua sem ler os extras dos demais.

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 069

Arquivo local:

```
supabase/migrations/069_acesso_mobile_falta_inspetoria.sql
```

### 4. Execute (Run)

Clique em **Run**. Não deve retornar erro.

### 5. Valide

1. Faça login com um usuário do perfil `inspetoria`.
2. Acesse diretamente `https://plena-corh.netlify.app/mobile/falta` — o assistente de 5 passos deve abrir (não pode redirecionar para o dashboard).
3. Faça um lançamento de teste: deve aparecer a tela de sucesso (✓ verde).
4. Tente lançar o **mesmo** colaborador/departamento/data de novo: deve aparecer o aviso de duplicidade, sem gravar.
5. Confira em **Extras → Lançamentos** (com um usuário `mesa`/`financeiro`/`adm`) que o registro de teste apareceu uma única vez.
6. Exclua o registro de teste.

---

## Observações

- Se quiser que outro perfil (ex.: `mesa`) também use a página mobile, conceda a rota na tela **Permissões** ("Acessar lançamento mobile de falta") — não precisa de SQL.
- A RPC aceita qualquer perfil com `is_editor()` (admin, adm, rh, gestor, dp1, dp2, mesa, inspetoria, financeiro) — quem controla o acesso à página é a permissão de rota.
