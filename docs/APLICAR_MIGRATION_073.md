# Aplicar Migration 073 — CEU: número de recibo sequencial + situação da entrega

> Data de criação: 2026-07-24
> O que ela habilita: recibos CEU com **número sequencial e único** (`REC-AAAA-NNNNN`) gravado na entrega — a reemissão de um recibo sai com o **mesmo número** da primeira emissão — e o registro da **situação** do item (Novo, Substituição, Troca, Extravio/Perda) na entrega.

---

## Por que essa migration é necessária?

Hoje o número do recibo é sorteado no navegador e não fica gravado: reemitir o mesmo recibo gera outro número, e nada impede dois recibos com o mesmo número. A situação do item entregue também não era persistida (o recibo sempre saía "Novo").

A migration cria:

1. Coluna `entregas.numero_recibo` — preenchida na primeira emissão do recibo.
2. Coluna `entregas.situacao` — padrão `'Novo'`.
3. Sequência `ceu_recibo_seq` + função `proximo_numero_recibo()` (formato `REC-AAAA-NNNNN`), executável por usuários autenticados.

**Nenhuma regra de visibilidade de outras tabelas foi alterada.** A tabela `entregas` já existente e seus dados não são afetados (as colunas novas vêm vazias/padrão).

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 073

Arquivo local:

```
supabase/migrations/073_ceu_recibo_sequencial_situacao.sql
```

### 4. Execute (Run)

Resultado esperado: `Success. No rows returned`.

### 5. Verifique

Rode no SQL Editor:

```sql
select public.proximo_numero_recibo();
```

Deve retornar algo como `REC-2026-00001`. Se quiser, rode de novo — o número deve incrementar (`REC-2026-00002`).

---

## Se algo der errado

- **Erro `relation "public.entregas" does not exist`** — confirme que está no projeto correto (`jmdjdogskvybsdjtmpmb`).
- **Erro de permissão na verificação (passo 5)** — rode a verificação logado no SQL Editor do dashboard (ele executa como `postgres`, que tem permissão). O `grant` para `authenticated` vale para o app.

Enquanto a migration não for aplicada, o app continua funcionando e usa como fallback o número aleatório antigo — mas **aplique antes de emitir recibos oficiais**, para garantir unicidade e rastreabilidade.
