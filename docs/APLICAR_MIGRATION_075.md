# Aplicar Migration 075 — RPC do plantão mobile grava gera_extra e Reforço Contratual

> Data de criação: 2026-07-24
> O que ela habilita: os lançamentos feitos pelo **celular** (`/mobile/falta`, usado pela inspetoria no fim de semana) passam a gravar corretamente os campos da migration 074 — **falta de controle interno** (`gera_extra = false`) e **Reforço Contratual**.

---

## Por que essa migration é necessária?

O app mobile não insere direto na tabela `extras` — ele chama a função `registrar_extra_plantao` (criada na migration 069), que tem uma lista explícita de colunas. Sem esta atualização, os campos novos enviados pelo app são **silenciosamente ignorados** e o registro grava sempre `gera_extra = true` / `reforco_contratual = false`.

A migration recria a função incluindo as duas colunas, com `COALESCE` para os defaults antigos (compatível com versões do app que ainda não enviam os campos).

**Pré-requisito: migration 074 aplicada** (ela cria as colunas). Se a 074 ainda não foi aplicada, aplique-a primeiro.

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 075

Arquivo local:

```
supabase/migrations/075_rpc_extra_plantao_gera_extra_reforco.sql
```

### 4. Execute (Run)

Resultado esperado: `Success. No rows returned`.

### 5. Verifique

Rode no SQL Editor:

```sql
select prosrc like '%gera_extra%' as rpc_grava_gera_extra
from pg_proc
where proname = 'registrar_extra_plantao';
```

Deve retornar `true`.

---

## Se algo der errado

- **Erro `column "gera_extra" does not exist`** — a migration 074 não foi aplicada. Aplique-a antes e rode esta novamente.
