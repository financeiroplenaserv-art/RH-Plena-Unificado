# Aplicar Migration 071 — Férias: notificações e previsões manuais do RH

> Data de criação: 2026-07-23
> O que ela habilita: o registro de **previsões de férias pelo RH** (planejamento com 30 dias de antecedência) e o **controle de notificações** enviadas ao colaborador e ao responsável pelo contrato.
> Pré-requisito: a migration **070** precisa estar aplicada (ela cria a tabela `ferias_periodos`).

---

## Por que essa migration é necessária?

O CORH passa a consolidar três visões de férias:

1. **Gozo** — férias já gozadas (histórico vindo do Flit).
2. **Agendado** — férias pagas/programadas no Alterdata, que chegam via Flit (confirmadas).
3. **Previsto** — planejamento do RH lançado manualmente na tela (até ~60 dias à frente).

Quando a previsão é confirmada no Alterdata e chega ao CORH via importação do Flit, o sistema **baixa automaticamente** a previsão manual que cobre o mesmo período — as visões se alinham sozinhas.

A migration cria:

1. Tabela `ferias_notificacoes` (colaborador, período vinculado, destinatário `colaborador`/`responsavel_contrato`, data, observação, usuário que registrou).
2. Policies RLS no padrão do projeto + trigger de auditoria.
3. Ajuste na policy de DELETE de `ferias_periodos`: editores podem excluir apenas períodos **manuais** (previsões); períodos do Flit continuam restritos a admin.

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 071

Arquivo local:

```
supabase/migrations/071_ferias_notificacoes.sql
```

### 4. Execute (Run)

Clique em **Run**. Não deve retornar erro.

### 5. Valide

1. No sistema, acesse **Férias → Visão geral** e clique em **Nova previsão**: lance uma previsão para um colaborador.
2. Clique em **Notificar** na linha do colaborador e registre uma notificação (colaborador e/ou responsável pelo contrato).
3. Abra **Férias → Notificações** e confira o registro na listagem.
4. Importe uma planilha do Flit que contenha o mesmo período como "Próximo período": a previsão manual deve ser baixada automaticamente (resumo da importação mostra "previsão(ões) alinhada(s)").

---

## Observações

- As previsões manuais **nunca são apagadas** pela reimportação do Flit — só são baixadas quando um período confirmado (agendado/gozo) do Flit **cobre as mesmas datas**.
- Quem registra a notificação fica gravado em `usuario_id` e tudo passa pela trilha de auditoria (`log_auditoria`).
