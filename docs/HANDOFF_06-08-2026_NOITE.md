# Handoff — 06/08/2026 (noite): atestado sem assinatura obrigatória + pendências zeradas

> Passagem para o próximo agente. Sessão da noite de 06/08. **Sem migrations novas** (mudança só de frontend). Testes: **273 passando, 1 skipped** (rls.test, sem Python). Lint limpo, build ok. **Deploy Netlify produção FEITO em 06/08 à noite** (bundle `index-BoMA2ddX.js` — hash de produção conferido igual ao dist, site `plena-corh`). 2º deploy do dia (a usuária autorizou gastar os créditos — mudança importante para ela).

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

## 3. Estado e próximos passos

- **Working tree limpa**, `main` no GitHub = produção (commit `f8fcd28`).
- **Validar em produção com a usuária:** ativar uma ocorrência de atestado/licença médica anexando apenas o comprobatório (lembrar do Ctrl+Shift+R — PWA).
- Sem pendências formais abertas no momento.
- Regras de sempre: migrations manuais (nunca `db push`), backup antes de mexer no banco, 1–2 deploys/dia no site `plena-corh`, verificar hash do bundle após cada deploy.
