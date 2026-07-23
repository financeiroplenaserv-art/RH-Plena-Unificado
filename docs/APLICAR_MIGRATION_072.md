# Aplicar Migration 072 — Ocorrências: forma de assinatura e documento assinado

> Data de criação: 2026-07-23
> O que ela habilita: o registro de **como a ocorrência foi assinada** (papel ou Youk) e a marcação de anexos como **documento assinado** digitalizado.
> Pré-requisito: nenhum além das tabelas `ocorrencias` e `ocorrencia_anexos` já existentes (migrations anteriores).

---

## Por que essa migration é necessária?

Depois que o RH gera o PDF do registro de ocorrência, o documento precisa ser assinado pelo colaborador. O fluxo passa a ser:

1. RH gera o PDF (agora com logo e CNPJ da empresa no cabeçalho).
2. O colaborador assina **em papel** ou o documento é enviado para assinatura eletrônica via **Youk**.
3. Na tela de detalhes da ocorrência, o RH:
   - informa a **forma de assinatura** (campo "Assinatura" no card de dados — opcional);
   - anexa o documento assinado digitalizado, marcando o tipo **"Documento assinado"** no upload (opcional).

A migration cria duas colunas:

1. `ocorrencias.forma_assinatura` — `TEXT` opcional, restrita a `'papel'` ou `'youk'` (`NULL` = não informado).
2. `ocorrencia_anexos.tipo_documento` — `TEXT NOT NULL DEFAULT 'comprovante'`, restrita a `'comprovante'` ou `'documento_assinado'`. Anexos existentes permanecem comprovantes.

Nenhuma policy nova é criada: as colunas herdam as policies RLS já consolidadas nas migrations 058/059.

---

## Passo a passo para aplicar

### 1. Acesse o painel do Supabase

```
https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
```

### 2. Abra o SQL Editor

No menu lateral, clique em **SQL Editor → New query**.

### 3. Cole o conteúdo da migration 072

Arquivo local:

```
supabase/migrations/072_ocorrencia_assinatura.sql
```

### 4. Execute (Run)

Clique em **Run**. Não deve retornar erro (os comandos usam `ADD COLUMN IF NOT EXISTS`, então a migration é idempotente).

### 5. Valide

1. No sistema, abra uma ocorrência em **RH → Ocorrências → detalhes**.
2. No card **Dados da Ocorrência**, altere o campo **Assinatura** para "Assinou em papel" ou "Enviado via Youk" — deve salvar sem erro (visível apenas para quem pode editar, e não em ocorrências canceladas).
3. Na aba **Documentos**, selecione o tipo **"Documento assinado"** e envie um arquivo — ele deve aparecer na lista com o selo verde **"Assinado"**.
4. Gere o PDF da ocorrência: o cabeçalho deve exibir o logo institucional, o nome e o CNPJ da empresa; a forma de assinatura (se informada) aparece nos dados da ocorrência e o anexo assinado aparece como "Documento (assinado)".

---

## Observações

- Os dois campos são **opcionais** — ocorrências antigas e novas funcionam normalmente sem preenchê-los.
- O campo de assinatura registra apenas **como** o documento foi assinado; a assinatura eletrônica em si continua sendo feita fora do sistema (Youk), conforme `docs/REGRAS_NEGOCIO.md`.
- Alterações passam pela trilha de auditoria (`log_auditoria`) via o trigger já existente em `ocorrencias`.
