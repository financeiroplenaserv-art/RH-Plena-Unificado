# Handoff VT — 21/11/2026 (tarde/noite): recomeço do zero

> Ponto de retomada. Continuação de `docs/HANDOFF_21-11-2026_VT.md` (manhã).
> Rotina mensal para a gestora: `docs/ROTINA_MENSAL_VT.md`.
> Regras tarifárias: `docs/VT_REGRAS_TARIFARIAS.md` (atualizado hoje).
> Detalhes técnicos de cada passo: últimos bullets de VT no `AGENTS.md`.

## 1. Linha do tempo do dia

1. **Situação do BU da Plena Tech** (relatório Riocard da conta Tech): cruzado. A gravação pelo agente foi barrada pela proteção automática. O SQL que cobre também os novos optantes está em `dados-locais/riocard_2026-11-21/atualizar_bu_novos_optantes_2026-11-21.sql` (16 pessoas) — **AINDA NÃO RODADO**; a gestora roda no terminal.
2. **Optantes pelo Alterdata.** Relatórios "desconta VT" (238) e "Declaração de Não Beneficiário" (61), sem ninguém nos dois e todos encontrados no CORH. **29 mudanças gravadas**: 24 passaram a optantes e 5 deixaram de ser. Ficaram **27 ativos/afastados fora das duas listas**, para a gestora conferir no Alterdata. Arquivos em `dados-locais/alterdata_optantes_vt_2026-11-21/`. **A API da Alterdata não expõe VT**: o CORH (`vt_optante`) é a fonte, atualizada por esses relatórios.
3. **Telas:**
   - a revisão de rota consulta a volta junto com a ida;
   - a aba Trajetos recarrega a evidência ao fechar a revisão e mostra o custo e a situação da revisão (não do legado);
   - abas reordenadas, com "Rotas a confirmar" antes de "Trajetos";
   - aba Bilhetes removida (`/vt/bilhetes` redireciona).
4. **RECOMEÇO DO ZERO** (decisão da gestora). Apagados: bilhetes da planilha, pacotes, trajetos, revisões, itinerários, rascunhos de carga e coberturas (nenhuma tocava dezembro). Mantidos: optantes, BU Riocard e tarifas do código. Backup em `dados-locais/backup_vt_recomeco_2026-11-21/`.
5. **Lote de rotas (exceção autorizada pela gestora).** `scripts/vt/preencher-rotas-lote.ts` consultou o Google para os 257 optantes, escolheu a alternativa de menor custo calculável e confirmou 241 rotas no usuário da gestora (`financeiroplenaserv`). O cache do Google está em `dados-locais/vt_rotas_lote_2026-11-21/google/`, para reprocessar sem custo.
6. **Erro de classificação achado pela gestora (caso 1MB10).** O Google rotula quase toda linha da região como "Prefeitura de Niterói". Corrigido com `ehCodigoLinhaMunicipalNiteroi`. 14 rotas foram refeitas.
7. **Três revisões independentes** (agentes `vt-niteroi`, `vt-sao-goncalo` e revisão de código):
   - preços por passagem e classificação Niterói/SG confirmados;
   - a escolha automática por custo errou em parte das rotas;
   - correções: BUI não presumido em toda linha AC; `motivosRevisaoHumana`; volta segue a ida; encerramento da confirmada anterior; ajustes não copiados; paginação do domínio do lote; contador da aba Trajetos;
   - **28 rotas reprocessadas** (27 voltaram à fila);
   - 13 confirmadas antigas tiveram a vigência encerrada.
8. **Aba Carga ligada às rotas confirmadas.** Fluxo único (lote), fechamento anterior entrando como ajuste, lote confirmado gravando `vt_cargas` para a aba Fechamento, e bloqueio de quem tem dia sem posto identificado.

## 2. Estado do banco ao fim do dia

| Item | Quantidade |
|---|---|
| Trajetos | 243 |
| Rotas confirmadas (revisão mais nova confirmada com itinerário e custo) | 211 |
| Na fila "Rotas a confirmar" | 32 |
| Valor de R$ 8,90/dia (ônibus de Niterói a R$ 4,45) | ~160 |

- Todas as decisões valem **a partir de 21/11/2026**. A carga de novembro **não** pode ser refeita pelo fluxo novo; de dezembro em diante funciona.
- `vt_bilhetes`, pacotes e coberturas estão vazios. Não há carga, fechamento nem lote gravados.

## 3. Pendências da gestora

- [ ] **Jurídico:** a base de Niterói é R$ 4,45 ou R$ 5,60? Se for R$ 5,60, reprocessar o grupo de Niterói pelo script com `--somente`.
- [ ] **Riocard:** o BUI vale nas linhas de categoria "AC" e "A"? Hoje AC fica pendente e "A" integra.
- [ ] Rodar `atualizar_bu_novos_optantes_2026-11-21.sql`.
- [ ] **No portal da Riocard:**
  - inativar **só os 22 desligados** (20 da EA e 2 da Tech, listados na conversa);
  - os não optantes e os afastados ficam ativos, sem carga (decisão da gestora);
  - cadastrar os 8 optantes sem Riocard: Cassio, Claudio Eleno, Deandrea, Gabryel, Rafael Lemos, Reginaldo, Renato de Oliveira e Ricardo Ávila.
- [ ] Conferir no Alterdata os 27 ativos/afastados fora dos dois relatórios.
- [ ] André Luiz de Carvalho: corrigir a cidade para São Gonçalo na Alterdata (o CEP é de SG; a linha 61 é municipal de Niterói, então o valor não muda).
- [ ] Revisar as 32 rotas da fila. Conferir as rotas com volta diferente da ida (133; ex.: Paulo Cesar, que pode estar a R$ 16,50 em vez de R$ 18,80).
- [ ] Modelo da planilha do Jaé.
- [ ] Carga de dezembro: importar a escala, registrar coberturas, construir, conferir, confirmar e conferir o Excel por amostragem.

## 4. Próximos trabalhos técnicos sugeridos

1. **Primeira carga real (dezembro) acompanhada.** O fluxo do lote é novo em produção. Conferir:
   - que `vt_cargas` 'gravada' aparece na aba Fechamento;
   - que o Excel bate com os valores.
2. **Telas de importação mensal:**
   - relatórios do Alterdata (optantes);
   - PDF "Cadastro de Funcionários da Empresa" da Riocard (EA e Tech; leitura com pdfjs documentada no handoff da manhã, §4). Hoje o agente faz isso à mão.
3. **Lista oficial fechada das linhas municipais de Niterói** (Semobi), em vez de confiar na operadora do Google. Niterói e SG têm números repetidos: 42, 35, 17.
4. **"Consultar ida" não refaz a volta** já consultada quando o horário muda (achado do revisor, não corrigido).
5. **Arquivo de pedido Riocard (Fase 4).** Layout em `docs/PEF-V14-...pdf`. Rascunho em `scripts/vt/gerar-pedido-riocard.ts`, não commitado.

## 5. Cuidados

- **Escrita no banco.** A proteção automática do Claude Code às vezes barra escrita em produção pelo agente. Quando barrar, deixar o SQL pronto e pedir à gestora para rodar.
- **SQL com acento:** só via `scripts/lib/executar-arquivo-sql-management-api.ps1` (arquivo UTF-8).
- **Script do lote:** `npx vite-node scripts/vt/preencher-rotas-lote.ts`.
  - dry-run por padrão;
  - `--somente=<json [{id}]>` para refazer pessoas;
  - `--aplicar --usuario=<perfil>` grava;
  - a chave do Google está na variável de usuário do Windows `GOOGLE_MAPS_API_KEY`; passar pelo PowerShell.
- **Nunca rodar `--aplicar` sem `--somente`** depois do primeiro lote: em quem já tem rota confirmada, ele cria revisão nova.
