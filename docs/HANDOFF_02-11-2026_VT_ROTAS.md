# HANDOFF 02/11/2026 — VT: rascunho no banco, fim do portão, auditoria, roteirização (Routes API)

> Para o próximo agente. Sessão de 02/11/2026 na branch `vt-fase1`, mesclada
> na `main`, push das duas. Deploy de produção feito nesta sessão (bundle e
> verificação no corpo do commit de docs seguinte). Migration 168 APLICADA
> via Management API (antes do deploy).

## 1. Contexto: a gestora estava insatisfeita com o módulo VT

A carga de novembro calculada pela mesa em 25/10 nunca foi gravada (portão
bloqueou o botão; ela fez novembro na mão). Decisões dela nesta sessão:
**"grave o que está pronto sem bloquear"** e **"preciso de algo mais sólido"**
(roteirização de verdade, com chave do Google paga).

## 2. Migration 168 (APLICADA) + pacote de código

- `vt_cargas.status` ('rascunho'/'gravada', default 'rascunho') +
  `confirmada_em`/`confirmada_por`. O cálculo é salvo como RASCUNHO no banco
  logo após importar/restaurar/reprocessar (`salvarRascunho` em
  `useVtCarga.ts` — nunca rebaixa linha 'gravada'; apaga rascunho de quem saiu
  do cálculo; optante fora do relatório não é salvo). "Gravar carga" CONFIRMA
  quem passa em `prontaParaGravar`; pendência não bloqueia mais ninguém (o
  botão vira "Gravar quem está pronto (N)"). Banner com 4 estados
  (`situacaoGravacaoCarga(idsGravados, idsRascunho, idsCalculados)` —
  assinatura nova). Fechamento lê SÓ 'gravada'. beforeunload só quando nada
  foi para o banco.
- Auditoria: trigger `auditar_operacao` nas 5 tabelas vt_* (antes nenhuma
  gravava em log_auditoria — o incidente de 25/10 ficou sem rastro).
- Dialog "Quem cobre?" avisa na hora quando o ferista não tem trajeto
  confirmado para o posto.
- Backup: `dados-locais/backup_vt_168_2026-10-28/` (nome da pasta ficou com a
  data errada; a aplicação foi em 02/11/2026). Teste em transação desfeita ok.

## 3. Roteirização de verdade (Google Routes API)

- **Chave criada pela gestora** (projeto `corh-vt` no Google Cloud, chave
  restrita à Routes API, orçamento-alerta ~R$ 10/mês). Está no `.env` local
  como `GOOGLE_MAPS_API_KEY` (NUNCA commitada). Guia: `docs/VT_GOOGLE_API_KEY.md`.
  **Pendente: gravar como secret do Supabase quando a Edge Function `vt-rota`
  for escrita** (a integração na aba Trajetos NÃO foi feita ainda).
- Regras tarifárias oficiais pesquisadas: `docs/VT_REGRAS_TARIFARIAS.md`
  (BUI R$ 9,40 desde 19/12/2025, integração 2 modais/3h, **teto de renda
  R$ 3.205,20 — origem dos "Suspenso Setrans"**; Jaé obrigatório nos modais
  municipais do Rio desde ago/2025; Metrô R$ 7,90).
- **Motor de classificação pela rota real**: `src/lib/vt/classificarRota.ts`
  (16 testes, casos reais). Entrada neutra = pernas (modal × município ×
  cruza divisa) + fato Riocard. Nunca inventa valor fora do catálogo.
- **Regra nova da gestora (02/11/2026)**: quem trabalha no Rio usa Jaé;
  morando em Niterói/SG = **Riocard (BUI) + Jaé** (2 bilhetes no trajeto).
- **Semove = federação** (não operadora): no Google, "Semove - Intermunicipal"
  = intermunicipal; "Semove - São Gonçalo" = municipal SG. Linha
  intermunicipal no meio de trajeto municipal cobra intermunicipal (caso 516M
  da Joyce — ela estava certa).
- **CEP × cidade** (`cidadeDoCep`/`avisoCidadeDivergeDoCep` em `enderecos.ts`):
  aviso âmbar na aba Trajetos quando a cidade cadastrada diverge do CEP.
- POC: `scripts/vt/poc-rotas-api.ts` (horário fixo segunda 06:00 BRT,
  alternativas ligadas, classifica pela MELHOR rota — a união cega marcava
  BUI em massa; alternativa intermunicipal vira aviso). 249 trajetos:
  **120 OK × 129 divergentes**. Triagem em `scripts/vt/triagem-poc.ts` →
  `dados-locais/poc_rotas_api_2026-11-02_triagem.md`: A erro provável 23,
  B ambíguo 63 (manter valor atual + agir só se reclamarem), C Setrans 23,
  D pagando a mais 20. Decisão da gestora: **não revisar um a um** — grupos.

## 4. Correções de dados feitas

- **Marco Antônio Antunes de Oliveira → BUI** (gestora, 02/11/2026; POC: a
  melhor rota usa linha intermunicipal — downgrade errado do lote de 24/10).
  Backup + SQL em `dados-locais/backup_trajeto_marco_antonio_2026-11-02/`
  (auditado pelo trigger novo).

## 5. Vereditos dos casos citados

- Joyce BUI ✓ (rota usa Semove intermunicipal — a correção manual estava certa)
- Thiago BUI ✓ · Adalto, Michelle, Izequias ✓
- **Priscila Barcelos: BU Niterói → deveria ser JAE RJ** (mora e trabalha no
  Rio) — aguardando confirmação da gestora para corrigir.
- Amanda (TREM → JAE) — revisar.

## 6. Pendências

- **Deploy desta sessão**: feito — bundle `index-BWY7eHoV.js` conferido em
  https://plena-corh.netlify.app/ (hashes iguais; deploy `6ae8ef4bd932fe3e96bfe604`).
- **Aba Trajetos — trocar o selo ESCOPO pelo fato Riocard** (BU ativado/
  suspenso/não consultado): proposto à gestora em 02/11, ela ainda não
  respondeu explicitamente (o escopo cidade×cidade "não tem validade" —
  palavras dela). Não implementado.
- **Edge Function `vt-rota`**: sugestão de bilhete na tela com evidência.
- Grupo A (23): corrigir cidades/endereços em lote com OK da gestora.
- Priscila: confirmar e virar para JAE.
- Teste pré-existente quebrado por data: `MateriaisCompras.smoke.test.tsx`
  espera "Ainda não é o dia da compra" (falha em dia ≥ 20 — mockar `hojeBrasil`).
- `npm run lint` global quebrado por `.claude/worktrees/` (pré-existente).

## 7. Estado verificado

- `npx vitest run src/lib/vt`: 191 testes passam (16 do motor novo).
- `tsc -b tsconfig.app.json` e `npm run build`: passam.
- Banco: 250 trajetos confirmados (Marco Antônio agora BUI), 7 sugeridos;
  39 coberturas; vt_cargas com status (vazia — dezembro é a 1ª carga com o
  fluxo novo); auditoria ativa nas 5 tabelas vt_*.
