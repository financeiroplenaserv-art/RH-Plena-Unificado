# Aplicar Migration 070 — Módulo Férias (tabela `ferias_periodos`)

> Data de criação: 2026-07-23
> O que ela habilita: o novo módulo **Férias** (menu "Férias" → Visão geral / Importar), que mostra a situação de férias de cada colaborador a partir da planilha exportada do Flit.

---

## Por que essa migration é necessária?

O módulo Férias armazena os períodos de férias (gozo realizado e próximo agendado) importados da planilha do Flit em uma tabela própria, `ferias_periodos`. Sem ela, a tela de importação não tem onde gravar e a Visão geral fica vazia.

A migration cria:

1. Tabela `ferias_periodos` (colaborador, data início/fim, tipo `gozo`/`agendado`, origem `flit`/`manual`).
2. Índices e constraint de unicidade (evita período duplicado por colaborador).
3. Policies RLS no padrão do projeto: leitura para autenticados, escrita para editores (`is_editor()`), exclusão só admin (`is_admin()`).
4. Trigger de auditoria (`auditar_operacao()`) — toda importação/alteração fica registrada em `log_auditoria`.

**Nenhuma regra de visibilidade de outras tabelas foi alterada.**

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 070

Arquivo local:

```
supabase/migrations/070_ferias_periodos.sql
```

### 4. Execute (Run)

Clique em **Run**. Não deve retornar erro.

### 5. Valide

1. No sistema, acesse **Férias → Importar** e envie a planilha do Flit (ex.: `Férias_23-07-2026.xlsx`).
2. Confira o preview (encontrados / não encontrados / ambíguos) e confirme a importação.
3. Abra **Férias → Visão geral**: os colaboradores devem aparecer com último gozo, próximo agendado e situação CLT.
4. No SQL Editor, confira os dados:

```sql
SELECT tipo, count(*) FROM public.ferias_periodos GROUP BY tipo;
```

---

## Observações

- A reimportação é idempotente: ao importar uma planilha nova, os períodos `origem='flit'` dos colaboradores presentes no arquivo são substituídos pelos novos. Pode reimportar sem medo de duplicar.
- Colaboradores da planilha que não casam com o cadastro (nome diferente) aparecem na lista de "não encontrados" da tela de importação para revisão.
