# Aplicar Migration 074 — Extras: falta sem extra (controle interno) + Reforço Contratual

> Data de criação: 2026-07-24
> O que ela habilita: lançar **faltas que não geram pagamento** na aba Extras (controle interno — aparecem no relatório diário de WhatsApp, mas não entram no balanço/recibos) e marcar lançamentos como **Reforço Contratual** (exibido no WhatsApp com 🪙).

---

## Por que essa migration é necessária?

A aba Extras passa a registrar também faltas sem geração de extra. Para distinguir esses registros dos extras pagáveis, a tabela ganha dois campos:

1. `extras.gera_extra` (padrão `true`) — `false` = controle interno, fora do pagamento.
2. `extras.reforco_contratual` (padrão `false`) — marcador de reforço contratual.

**Nenhuma regra de visibilidade foi alterada** e os registros existentes ficam todos como `gera_extra = true` (comportamento atual preservado).

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 074

Arquivo local:

```
supabase/migrations/074_extras_falta_sem_extra_reforco.sql
```

### 4. Execute (Run)

Resultado esperado: `Success. No rows returned`.

### 5. Verifique

Rode no SQL Editor:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'extras'
  and column_name in ('gera_extra', 'reforco_contratual');
```

Deve retornar as 2 colunas, ambas `boolean`, com defaults `true` e `false` respectivamente.

---

## Observação

Enquanto a migration não for aplicada, o formulário novo **não deve ser usado** (o app tentará gravar os campos novos e o lançamento falhará). Aplique primeiro, depois use o sistema normalmente.
