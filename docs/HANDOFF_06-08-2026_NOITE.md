# Handoff — 06/08/2026 (noite): atestado sem assinatura obrigatória + pendências zeradas + Escalas

> Passagem para o próximo agente. Sessão da noite de 06/08 em duas partes:
>
> **Parte 1 (commits `f8fcd28`, `1267a51`) — seções 1–3 abaixo.** Sem migrations novas. Testes: 273 passando, 1 skipped. **Deploy Netlify produção FEITO em 06/08 à noite** (bundle `index-BoMA2ddX.js` — hash conferido, site `plena-corh`). 2º deploy do dia.
>
> **Parte 2 (commit `3a1814a`) — seções 4–6 abaixo (Escalas).** Migration **100** criada e **APLICADA em produção** via `db query --linked`. Testes: **277 passando, 1 skipped**. Lint limpo, build ok. **Deploy PENDENTE** — a usuária optou por não deployar agora (economia de créditos): produção está com o bundle da Parte 1, sem as mudanças de Escalas. Próximo deploy deve incluir este commit.

## 1. Ocorrências de atestado não exigem mais documento assinado (commit `f8fcd28`)

- **Pedido da gestão:** a maioria das ocorrências exige 2 anexos para ativar (Pendente → Ativa): o **documento comprobatório do motivo da sanção** e o **documento assinado pelo colaborador**. Para ocorrências de **atestado**, só o comprobatório (o próprio atestado) deve ser obrigatório.
- **Escopo confirmado com a usuária (perguntar antes de assumir):** vale para os 3 tipos nascidos de atestado médico na importação de ponto:
  - `Falta Justificada (atestado)`
  - `Licença Médica (até 15 dias)`
  - `Licença Médica (acima 15 dias — INSS)`
- **Implementação:** nova constante `TIPOS_SEM_ASSINATURA_OBRIGATORIA` e função `exigeDocumentoAssinado(tipo)` em `src/lib/ocorrencias/tiposOcorrencia.ts` (retorna `exigeDocumento(tipo) && !isenta`). Aplicada em:
  - `src/pages/rh/useOcorrenciaDetalhe.ts` (`handleAtivar`) — só bloqueia por falta de assinatura quando o tipo exige;
  - `src/components/ocorrencias/ocorrencia-detail/DetailHeader.tsx` — botão "Ativar" habilita só com o comprobatório nesses tipos; tooltip condicional;
  - `StatusBanner.tsx` — pendências e texto explicativo condicionais ("apenas o documento comprobatório (atestado médico)");
  - `AnexosTab.tsx` — dica de anexos condicional (nova prop `exigeDocAssinado`, passada por `OcorrenciaDetailPage`).
- Os 3 tipos **continuam** com `exigeAnexo: true` (o comprobatório segue obrigatório) e continuam nascendo como "Pendente" na importação de ponto — só caiu a exigência da assinatura.
- **Testes:** `src/lib/ocorrencias/tiposOcorrencia.test.ts` (5 testes novos).
- **Docs:** regra registrada em `docs/REGRAS_NEGOCIO.md` (seção Ocorrências) e no `AGENTS.md` seção 11.

## 2. Pendências do handoff anterior zeradas (commit `f8fcd28`)

A usuária confirmou como **resolvidas** todas as pendências da seção 5 do `docs/HANDOFF_06-08-2026.md` (marcadas com ✅ lá):

- Validação em produção do fluxo das 3 telas de extras (Sim/Não, valor travado, faturado independente, SEM NOME, categoria no mobile).
- Pendências antigas de 03/08 e 04/08: relatório de Adicionais de julho, "Esqueci a senha", primeiro login dos 10 usuários reais, feriados, recibo do Ricardo, importação unificada (~60 ocorrências), revisão visual dos menus por perfil, reimpressão em lote dos recibos CEU, validações de 04/08.
- Itens 5–7 do diagnóstico de filtros CEU (rascunho restaurado, abas Vencimento/Estoque, Fornecedores).

## 3. Estado e próximos passos (Parte 1)

- **Working tree limpa**, `main` no GitHub = produção (commit `f8fcd28`).
- **Validar em produção com a usuária:** ativar uma ocorrência de atestado/licença médica anexando apenas o comprobatório (lembrar do Ctrl+Shift+R — PWA).
- Sem pendências formais abertas no momento.
- Regras de sempre: migrations manuais (nunca `db push`), backup antes de mexer no banco, 1–2 deploys/dia no site `plena-corh`, verificar hash do bundle após cada deploy.

---

# Parte 2 — Escalas (commit `3a1814a`, migration 100 APLICADA, deploy pendente)

## 4. Investigação: "confirmação em lote sumiu" — não era bug

A usuária reportou que na aba Escalas não era mais possível confirmar vários dias do mesmo colaborador e que o sistema não mostrava mais onde o colab trabalhou mais. Veredito após código + git + banco + testes:

- **Confirmação em lote nunca foi removida:** marcar checkboxes → barra **"Aplicar local em N dia(s)"** aparece **acima da tabela** → "Confirmar em lote". O botão "Confirmar" da linha SEMPRE abriu o modal individual (desde a criação do módulo, commit `f3667b4`). A usuária confirmou que era isso — ela conhecia o modal do Alexandre (com histórico) e não achou a barra. **Caso encerrado sem correção.**
- **"Locais usados recentemente" só aparece com histórico identificado:** o DAMIAO (000821) tem 13 dias importados e **todos não identificados** — por isso o modal dele não mostra a seção. Diagnóstico: `scripts/diagnosticar-escalas-historico.mjs` (usa service role). Panorama 60 dias: 909 identificados × 91 não identificados — os 91 são dias cujos dispositivos/perímetros não têm mapeamento (aba **Escalas → Mapeamentos**).
- **Testes novos** travando o comportamento: `src/pages/escalas/AbaEscalasDiario.test.tsx` (3 testes: barra de lote aplica nos dias marcados, modal mostra locais recentes com contagem, modal omite a seção sem histórico).

## 5. Escalas → Importar: card "Arquivos já enviados" (migration 100)

- **Pedido da usuária:** replicar na importação de Escalas o que o Adicionais → Importar Ponto ganhou na migration 094 (arquivos salvos no servidor, reutilizáveis por qualquer operador).
- **Migration `100_escala_arquivos.sql`** — espelho da 094 para Excel: bucket privado `escala-arquivos` (xlsx/xls, 50 MB) + tabela `escala_arquivos` (metadados, join com `perfis` para autor). RLS: SELECT/INSERT `is_editor()`, DELETE `is_admin()`; policies do bucket no mesmo desenho. ✅ **Aplicada via `db query --linked` em 06/08/2026 e verificada** (tabela, bucket e 3 policies confirmados).
- **Nova lib `src/lib/escalas/escalaArquivos.ts`** — mesmo desenho de `src/lib/adicionais/pontoEspelhoArquivos.ts`: `listarArquivos` (últimos 10), `salvarArquivo` (dedupe por nome+tamanho), `baixarArquivo`, `excluirArquivo`. MIME por extensão (`.xls` vs `.xlsx`). Tipo `EscalaArquivoRow` em `src/types/database.ts`.
- **`EscalasImportarPage.tsx`:** ao clicar "Importar para o CORH", o Excel é salvo no servidor ANTES de processar (falha no salvamento só gera toast de aviso — a importação continua). Card "Arquivos já enviados" (visível quando não há arquivo selecionado): data, autor, tamanho, botão **"Usar este arquivo"** (baixa e roda a mesma pipeline, com prévia) e lixeira só para admin (ConfirmDialog). Diferente do Adicionais, **não há diálogo de duplicado** — o dedupe é silencioso na lib.
- **AGENTS.md atualizado:** 100 migrations, lista de buckets, entrada da 100.

## 6. Preservação de confirmações manuais na reimportação — já existia, mas tinha falha silenciosa

- A reimportação do Excel **já preservava** confirmações manuais (`fonte = 'manual'` não vai para o upsert; resumo mostra "N confirmação(ões) manual(is) preservada(s)") — desde a criação do módulo.
- **Bug encontrado e corrigido:** a consulta das confirmações (`useEscalasDiario.importarExcelFlit`) **truncava em 1000 linhas** (limite PostgREST) e não filtrava `fonte` no banco — numa reimportação grande, confirmações manuais além das primeiras 1000 linhas do período seriam **sobrescritas silenciosamente**. Corrigido: filtro `.eq('fonte', 'manual')` no banco + paginação por `range`. Teste novo em `src/hooks/useEscalasDiario.test.tsx` trava a regra (asserta o filtro, a paginação e que o dia manual não vai para o upsert).

## 7. Estado e próximos passos (Parte 2)

- **Working tree limpa**; `main` no GitHub = commit `3a1814a`. **Produção está um commit atrás** (deploy pendente — decisão da usuária para economizar créditos).
- **No próximo deploy:** verificar hash do bundle (regra do AGENTS.md) e avisar a usuária para validar em Escalas → Importar: card "Arquivos já enviados", "Usar este arquivo" e o toast de confirmações preservadas. Migration 100 já está no banco — o card funciona assim que o frontend subir.
- Testes: **277 passando, 1 skipped** (rls.test, sem Python). Lint limpo, build ok.
- Pendente de validação em produção (Parte 1): ativar ocorrência de atestado só com o comprobatório.
