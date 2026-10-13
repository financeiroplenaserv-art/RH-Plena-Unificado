# HANDOFF — 13/10/2026 (tarde/noite) — Férias: validação local, UX do plano automático e importação da planilha

## Estado ao fim da sessão

- Branch `materiais-fase1`. Lint limpo, tsc ok, 129 testes do módulo Férias passando.
- Mudança de código da sessão: só `src/pages/ferias/FeriasProgramacaoPage.tsx` (UX do plano automático — ver abaixo).
- **Nada foi publicado no Netlify** — produção segue com o módulo antigo.
- Banco de produção recebeu dados reais: importação da planilha (ver abaixo).
- Lembrete automático agendado: **14/10 às 08:12** (cron id `01M4TX11TPS2R6Q5ASS74SMB5B`) verifica se o sync confirmou o agendamento do Claudio. ⚠️ Só dispara se esta sessão estiver viva; se não disparar, rodar a verificação manual (ver "Como continuar").

## O que foi feito nesta sessão

### 1. Plano automático — os 4 casos especiais identificados no banco
A prévia 01/01–30/06/2026 mostrou 4 pessoas, todas já conhecidas/esperadas:
- **José Fernando Alves da Silva** — aposentadoria em andamento (sem férias desde 2019);
- **Felipe Pereira Moraes** — mudou de empresa, mas **segue Ativo no cadastro** (pendência: inativar, decisão da gestão);
- **Silvania Guedes Evangelista** — afastada INSS desde 17/12/2024;
- **Milena de Souza Ferreira** — 2 licenças INSS ativas (2023 e 09/2025).
Usuário desmarcou as 4 e nada foi criado (correto). O botão "Criar 0 previsões" parecia não reagir — ver item 2.

### 2. UX do plano automático (`FeriasProgramacaoPage.tsx`)
- Aviso "Nenhuma pessoa selecionada — nada a criar..." quando tudo desmarcado;
- `gerarPreviaPlano` com try/catch + toast de erro (antes falha era silenciosa);
- Trocar as datas De/Até limpa a prévia anterior (era a causa do "não aconteceu nada": a prévia velha ficava na tela).

### 3. O mistério das 41 previsões
A 1ª geração para 2027 (15:51 UTC) **funcionou** — criou 31 previsões — mas a grade estava em 2026 e o usuário não viu. A 2ª (16:12) criou mais 10. **As 41 foram deletadas a pedido do usuário** (backup: `dados-locais/backup_previstos_plano_automatico_2026-10-13.json`).

### 4. Envio ao DP (Claudio) — verificação
- Enviado 13/10 08:44 BRT, `dp_agendamento_id = 1`. Sync diário roda 03:30 BRT — a 1ª chance de confirmação é 14/10 de manhã.
- Evidência esperada: **nova linha origem `econtador`** para o Claudio (o dedup só casa mesma origem; a manual fica intacta).
- Sync saudável: últimos 3 dias sem erro (534 Plena EA + 29 Plena Tech).
- ⚠️ **A solicitação do Claudio é um dos 7 registros "TESTE ALOCACAO" de 25/09 que virou real** — NÃO apagar na limpeza futura.
- ⚠️ **Divergência de data**: CORH/DP dizem 05/11–04/12; a planilha diz 06/11–05/12. Pendente de confirmação com a gestão; se a planilha estiver certa: corrigir no CORH e ajustar com o DP.

### 5. Importação da planilha "Planejamento Operacional" (pedido do usuário)
Fonte: `docs/Planejamento Operacional.xlsx` (2 abas ativas: Port-Zel-Enc.25 e Limp.25; na Limp o período está na coluna 10, não 9).
**Gravado no banco (aprovado pelo usuário):**
- **17 solicitações** nov/26–dez/26 com datas certas — tipo `agendado`, status `aprovada`, origem `manual`, observação com mês/posto da planilha;
- **11 alocações confirmadas** com treinamento da planilha (`precisa_treinamento`/`treinamento_detalhe`);
- **3 feristas novos na carteira**: Walace Rodrigues Sobrinho, Ricardo Maia de Castro, Marcelo Ramos Rufino ("Marcelo Rufino" na planilha).
- SQL + manifesto (permite desfazer): `dados-locais/importacao_planilha_ferias_2026-10-13.sql` e `..._manifest_2026-10-13.json`.
**Não importado:**
- 20 linhas que o sync do e-Contador já tinha trazido com datas idênticas (integração funcionando);
- Milena (INSS — planilha desatualizada, avisar a gestão); Tatiana Gomes Sardinha (Inativa); Inacio Cesar Pereira da Silva (não existe no cadastro);
- **José Roberto Miranda Albinos entrou SEM cobertura** — ferista da planilha (Roberto Santa Izabel Paixão) não existe no cadastro; aparece como "sem cobertura" na aba Alocação;
- **51 linhas só com mês** (dez/26 e 2027) — decisão do usuário: deixar de fora até terem datas.
- Nilson Viana: 18/11–03/12 (16 dias — nota "faltam 16 dias" da planilha preservada na observação); Thiago Lontra: férias do próprio ferista, sem substituição.

## Pendências para amanhã (14/10)

1. **Verificar confirmação do DP** (automático às 08:12 se a sessão estiver viva; senão, manual — ver abaixo). Se confirmado, ciclo ponta a ponta fechado.
2. **Confirmar com a gestão a data do Claudio** (05/11 × 06/11) e agir conforme resposta.
3. **Decisões de cadastro**: inativar Felipe Pereira Moraes (mudou de empresa); José Fernando (aposentadoria).
4. **Avisos à gestão**: Milena consta na planilha para nov/26 mas está afastada INSS; Roberto Santa Izabel Paixão (ferista) não existe no cadastro.
5. Limpeza (com confirmação da gestão): 6 registros "TESTE ALOCACAO" restantes (o do Claudio NÃO) + ~20 `agendado/aprovada` com datas passadas (jul–ago/26, origem flit — provavelmente virar `concluida`).
6. As 51 linhas só com mês: importar quando tiverem datas (rodar de novo o mesmo processo — a extração está pronta, basta refazer o script ou pedir para refazer).
7. **Publicar no Netlify** quando a gestão terminar a validação (lembrete: site `plena-corh`, verificar hash do bundle após deploy — AGENTS.md §10).

## Como continuar

- Subir o local: `npm run dev` → porta 5173 (ou 5174 se a 5173 estiver ocupada). Login normal, dados reais.
- Verificação manual do Claudio (se o cron não disparar): SQL pela Management API —
  `select origem, status, data_inicio, data_fim from ferias_solicitacoes s join colaboradores c on c.id=s.colaborador_id where c.nome_completo ilike '%CLAUDIO MARCIO%'`
  (usar `scripts/lib/executar-sql-arquivo.ps1 -Query ... -Saida ...` ou o `-Arquivo` em UTF-8; acentos inline no `-Query` corrompem).
- Ver o resultado da importação: Férias → Programação (chips de nov/dez; verde/amarelo = com ferista, vermelho = sem cobertura).
