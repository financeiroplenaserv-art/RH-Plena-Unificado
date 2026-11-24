# Handoff VT — 24/11/2026

> Continuação de `docs/HANDOFF_22-11-2026_VT.md`. Tudo desta sessão está commitado (`f513194` + este handoff), enviado ao GitHub e publicado (bundle `assets/index-BpDa2Wtw.js` conferido em produção).

## 1. Regra alterada: BUI integra intermunicipal + ônibus municipal de Niterói
- A gestora trouxe extratos do Riocard Mais de 2 colaboradores (em `dados-locais/`: `23-11-2026 - Extrato completo Riocard Mais - 01.04.11914442-5-2.pdf` e `WhatsApp Image 2026-11-24 at 18.54.23.jpeg`). Eles provam a integração a **R$ 9,40 por sentido**, nos dois sentidos. O primeiro ônibus cobra a tarifa dele e o segundo cobra o que falta para fechar R$ 9,40. Exemplos: 515M R$ 7,10 + linha 30 R$ 2,30; 33 R$ 4,45 + 532M R$ 4,95.
- Isso substitui a antiga "exceção de Niterói". Detalhes e ressalvas estão em `docs/VT_REGRAS_TARIFARIAS.md` §4 e no bullet de 24/11 do AGENTS.md.
- Ressalvas ainda abertas:
  - antes de 16/11 a pessoa do extrato não integrava (o BUI dela provavelmente foi ativado por volta dessa data);
  - em 17/11, 515M às 05:50 → linha 30 às 08:44 (2h54) não integrou, sem explicação.
  - Se outro extrato repetir isso, revisar a janela de 3 h.
- O mesmo extrato confirmou duas regras que já existiam: BUN Niterói + Niterói em menos de 1 h (a 2ª passagem sai a R$ 0,00) e a 3ª viagem municipal de Niterói no dia a R$ 5,60.
- Código alterado: `motor/calcularSentido.ts`, `cotarCatraca.ts` e `regrasOficiais.ts` (`REGRA_BUI_NITEROI_INTEGRA`), mais os testes. São 461 testes do VT e passaram.

## 2. Rotas regravadas (autorizado pela gestora)
- 37 rotas confirmadas mudavam com a regra nova.
- **33 foram regravadas**, cada uma com nova revisão confirmada:
  - script: `scripts/vt/aplicar-regra-bui-niteroi.ts`;
  - verificação: 33/33;
  - efeito: −R$ 155,10 por dia, cerca de −R$ 3.412 por mês;
  - backup, lista (`rotas_afetadas.xlsx`) e `verificacao.json` em `dados-locais/vt_regra_bui_niteroi_2026-11-24/`.
- **Ficaram de fora 4 rotas pendentes de linha AC ou "BUI direto"**: Carmo, Marino, Miraflores (2590R) e CBO 760D→4425D. Dependem da Riocard/DP sobre o BUI em linhas AC e em linhas acima de R$ 9,40.

## 3. Casos com valor gravado divergente por OUTRA causa (não é a regra nova)
- **Ana Bela Ferreira Pina** — Guaxindiba (SG) → posto MÉRITO BARRETO (Rua Dr. March, 329, Barreto, Niterói).
  - O que está gravado: 18,80/dia, com ida 489M → 425D e volta 2520D → 489M. Há também uma revisão 2 aberta (sugerida) na fila Rotas a confirmar.
  - O problema: o Google sugeriu a **425D (Alcântara – Campo Grande, R$ 20,25)**, uma linha para o Rio usada só num trecho local. O motor marca pendência `BUI_DIRETO_PENDENTE`, porque a regra não diz o que a catraca cobra quando uma linha passa de R$ 9,40.
  - Sugestão dada à gestora: confirmar com a colaboradora o ônibus real. Provavelmente é **489M + 532M (Alcântara – Niterói via Dr. March, R$ 7,10)**, que fecha em R$ 9,40 sem dúvida; o extrato mostra integrações com a 532M. A volta também deve ser revista. Se a rota real for essa, o valor segue 18,80 e só as linhas registradas mudam.
- **Carvalho Neto** — 141C→709D→45 / 750D→2425D.
  - Gravado 23,25; o motor atual dá 55,90, pendente de linha AC.
  - Revisar na fila.

## 4. Pendências que continuam (do handoff de 22/11)
- R$ 13,10 do Thiago Lontra: **resolvido**. Com a regra nova, 491M + 33 = R$ 9,40 por sentido. A rota dele (OSCAR PEREIRA, ida 491M → 33, volta 760D → 491M) está entre as 33 regravadas: 22,95 → 18,80/dia. A volta usa a 760D, linha "D", e vale conferir com ele se é mesmo o ônibus que pega.
- Primeiro uso real da aba Importações do mês (Alterdata + Riocard EA + Tech).
- Base de Niterói (R$ 4,45 × R$ 5,60) segue com o jurídico.

## 5. Linha D proibida fora do Rio (decisão da gestora, 24/11/2026)
- Regra: linha D só quando casa OU posto é no Rio; senão a alternativa fica marcada, não pode ser "Mais em conta" nem salvar/confirmar. Cidade ausente = só aviso. Código: `situacaoLinhaD`/`linhasDProibidas` em `src/lib/vt/revisaoHumana.ts`; tela `VtRevisaoRota.tsx`; scripts de lote recusam.
- Levantamento (somente leitura, nada gravado): 19 rotas confirmadas vigentes têm linha D; **17 fora do Rio (proibidas pela regra nova)** e 2 legítimas (Carvalho Neto, casa no Rio; Centro Auditivo Telex, posto no Rio). Sugeridas abertas: 23, todas sem itinerário. Planilha: `dados-locais/vt_linha_d_2026-11-24/linha_d.xlsx`. **A gestora mandou as 17 de volta para a fila (24/11/2026):** 11 já tinham revisão aberta (de 21/11) e 6 receberam revisão nova 'sugerida' (sem itinerário e sem custo, vigente desde 24/11), com o SQL `dados-locais/vt_linha_d_2026-11-24/backup_fila/abrir_revisoes.sql`, que tem trava de contagem. Backup em `backup_fila/decisoes_antes.json`; `verificacao.json` confirma 17 rotas na fila e 17 confirmadas ainda vigentes. **Nenhuma foi desconfirmada**: o valor gravado continua sendo pago até a revisão nova ser confirmada, sem linha D. Na fila elas podem aparecer como "Sem rota cadastrada" ou "Rota antiga", porque a revisão aberta não tem itinerário; basta abrir "Revisar".
