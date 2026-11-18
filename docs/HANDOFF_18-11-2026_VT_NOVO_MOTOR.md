# Handoff VT — 18/11/2026: decisão de refazer o núcleo e motor novo de tarifa

> Ponto de retomada. Nada desta sessão foi commitado, publicado ou gravado no banco.

## 1. Diagnóstico (auditoria somente leitura, 18/11/2026)

- Suíte verde (1.527 testes antes; 1.563 depois do motor), tsc e lint limpos — o problema não é código quebrado, é o **desenho**.
- O valor pago hoje = dias [T] do Flit × valor de um **bilhete escolhido à mão** (catálogo de 9 bilhetes vindo da planilha antiga). O sistema não calcula tarifa e não sabe a rota real.
- Três caminhos de valor convivem (bilhete legado; decisões/pacotes da 169; preço revisado da 173) e dois fluxos de carga (legado e lote 170) que não conversam.
- A conta dias × valor está certa (0 erros na carga de dez/2026). O erro é o valor/dia: ~100 de 245 trajetos com sinal de problema; módulo ≈ **R$ 5.054/mês a menos** que a planilha (36 pessoas), sobretudo pela regra de 24/10 (BUI→BU Niterói pela cidade do cadastro; CEP mostra SG em casos como Thiago Lontra e José Orlando).
- Catálogo errado por definição: TREM 15,80 (usa metrô; trem = 7,60 → 15,20); BUI 18,80 com ônibus municipal de Niterói (BUI não cobre — Regras §4); BUI para "Suspenso Setrans".
- Defeitos do fluxo novo (L1–L17 do relatório): dia sem posto descartado em silêncio; optante fora do relatório entra com R$ 0 "pronto"; lote ignora o fechamento anterior; cartão fixo "desconhecido" na revisão (só confirma 1 condução); preço da 173 congelado sem vigência; valor extra pode somar duas vezes; não cria trajeto para posto novo; tarifas por modal escritas à mão em `cotarCatraca.ts:64-72`; teto BUI assimétrico (`cotarCatraca.ts:262`).
- **Erro de tarifa encontrado:** `regrasOficiais.ts` tinha 5721D = 11,70 (correto **33,70**) e 721D = 14,25 (correto **15,95**). Nenhum trajeto confirmado usa essas linhas.
- Outros achados (dados): 7 trajetos confirmados de inativos/afastados; rascunhos de carga para 4 optantes inativos; 2 optantes ativos sem trajeto (Claudio Eleno, Francisco de Assis R. Pinto); 6 trajetos com duas decisões "confirmadas" vigentes (revisão 1 legado + revisão 2) — o resolvedor usa a mais nova (R$ 11,20), mas a confirmação deveria fechar a anterior; 1 itinerário do Everaldo sem vínculo. Novembro: a gestora mandou ignorar.

## 2. Decisões da gestora (18/11/2026)

1. **Refazer o núcleo** do VT; aproveitar cadastro de optantes, situação Riocard, parser do Flit, coberturas, fechamento, permissões, Google Routes e tarifas oficiais. Proposta completa: `docs/PROPOSTA_VT_NOVO_MODULO.md`.
2. **O código segue `docs/VT_REGRAS_TARIFARIAS.md`, não o que a gestora disser de memória.** O que a regra não decide (§10) vira pendência, nunca chute.
3. Caminho único: **Pessoa → Rota real (ida E volta, confirmada pelo RH) → Preço pela regra → Carga do mês → Fechamento**. O RH confirma a ROTA; o valor sempre sai da regra.
4. Exemplos de cálculo da proposta (§5) **aprovados**, com a ressalva de que intermunicipal usa a tarifa por linha (§6A).
5. **Cartão:** situação do BU vem do arquivo da Riocard, **atualizado mensalmente** (`scripts/vt/importar-riocard-bu.ts`). "Não conferido = sem BUI" aprovado.
6. **BUN:** conferido em fontes de 26/11/2024 — quem tem BUI e VT vinculado ao CPF tem BUN automático (registrado em VT_REGRAS_TARIFARIAS.md, seção "Habilitação automática do BUN"). Ativado ⇒ BUI e BUN; Suspenso Setrans ⇒ BUN provável, conferir no Portal da empresa → Usuários → Gerenciar Bilhete Único; demais ⇒ sem integração.
7. **Transição:** quem não tem rota confirmada segue com o valor atual marcado "não conferido".
8. **Tarifa por linha DETRO** (linha/variante/seção/vigência); linha fora da tabela = pendência com o nome da linha. Começar por Niterói (SG, Itaboraí, Maricá); **linhas e modais do Rio depois** (há colaboradores do Rio).
9. **Jev (TypeSafe) autorizado** só para: ordenar a fila de revisão, casar nome de linha do Google com a tabela DETRO e pré-marcar a rota mais provável. Envia **só dados de linhas** (código, operadora, pontos, horários, valores) — nunca nome/CPF/matrícula/endereço. Chave no servidor. Nunca calcula valor nem confirma.

## 3. Entregas desta sessão (não commitadas)

- `docs/PROPOSTA_VT_NOVO_MODULO.md` — proposta, exemplos, §6A tarifa por linha, §6B Jev, §9 respostas da gestora.
- `docs/VT_REGRAS_TARIFARIAS.md` — nova seção "Habilitação automática do BUN".
- `dados-locais/tarifas_detro_2026-11-18/` — PDF da Portaria DETRO/PRES 1.960/2026 (SHA-256 `bd4e24cb…cf3b`), CSV com as 3.399 tarifas e `tarifas_detro_niteroi.xlsx` para a gestora conferir (326 linhas de Niterói; 18 marcadas "Conferir": S110, MB21, MB26, 1910D, 2740D, P547, MS11 — código herdado da linha anterior no PDF).
- `scripts/vt/gerar-tarifas-detro.ts` → gera `src/lib/vt/dados/tarifasDetro2026.ts`.
- **Motor novo** em `src/lib/vt/motor/` (tipos, tarifas, cartao, precificarPerna, calcularSentido, calcularDia, index) + `motor.test.ts` (36 testes: um por exemplo a–m + casos-limite). Independente; NÃO ligado a tela/hook/banco. `cotarCatraca.ts` intacto (a tela atual ainda usa).
- Verificação: `npx vitest run src/lib/vt` 323 ok; `npm test` 1.563 ok; tsc e eslint ok. **Rodar vitest pelo PowerShell** (no Git Bash dá erro `reading 'config'` em qualquer teste).

## 4. Escolhas do motor em casos que a regra não descreve (gestora ainda não confirmou)

1. Duas intermunicipais de linhas diferentes integram pelo BUI (regra geral §4; a tabela do §5 não cita o par). ok
2. Metrô + ônibus municipal e SG municipal + Rio municipal ⇒ pendência (combinação não descrita). ver sobre bilhete JAE e SG municipal + rio municipal não sei
3. "Não possui BU"/"Desativado" ⇒ tarifa integral SEM pendência (fato); Suspenso/sem consulta ⇒ pendência. ok
4. Sem horário de embarque ⇒ não integra + pendência. Janela medida entre embarques (BUN 60 min; BUI 180; 120 com metrô). ok
5. Tarifa "a conferir" (SG 555, Rio 500) só gera pendência quando cobrada à parte; dentro do BUI serve só de comparação. ok
6. Seção não informada com preços diferentes ⇒ valor null + pendência listando as seções. ok
7. Limite de 2 integrações/dia não é verificado entre sentidos. ok

## 5. Próximos passos (ordem)

1. Gestora: conferir `tarifas_detro_niteroi.xlsx` (só as 18 "Conferir") e as escolhas da §4 acima. Perguntar se pode commitar o trabalho.
2. Tela **"Rotas a confirmar"**: fila ordenada (Jev), sugestão do Google com ida e volta, valor do motor + explicação, 1 clique para confirmar a rota; criar par novo (posto novo) permitido.
3. Ligar fatos do cartão (Riocard mensal) ao motor; registrar BUN conferido no portal.
4. Carga e fechamento num fluxo só, alimentados pelo motor; fechar os buracos L1–L3 (dia sem posto, optante fora do relatório, fechamento anterior).
5. Dezembro em paralelo: motor × planilha × módulo antigo, pessoa a pessoa; cada diferença explicada por regra.
6. Só então desligar o fluxo antigo (dados antigos ficam para consulta). Depois: linhas/modais do Rio; corrigir 5721D/721D e aposentar os valores à mão de `regrasOficiais.ts`/`cotarCatraca.ts`.

## 6. Motor ligado à revisão (18/11/2026)

> Sem deploy (frontend ou Edge Function), sem migration, sem gravação no banco, sem commit.

**O que foi feito**

- **Adaptador Google → motor** `src/lib/vt/motor/adaptadorItinerario.ts` (+ `adaptadorItinerario.test.ts`): converte cada perna de `ItinerarioVT` (saída de `googleRoutes.ts`) em `PernaMotor` (modal, linha, embarque ISO com fuso, operadora; seção = null). Mapeamento: ônibus DETRO intermunicipal → `onibus_intermunicipal` (inclui a correção 3 dígitos + letra da "Prefeitura de Niterói" = 422M/570D); municipal Niterói/SG/Rio só quando operadora + município batem; trem, metrô, barca, VLT, BRT, van diretos; **micro-ônibus, operadora desconhecida e veículo desconhecido → "outro"** (o motor devolve indeterminado). Horário sem fuso é descartado com aviso (nunca lido no fuso da máquina). `fatosCartaoDoCadastro(vt_bu_situacao, vt_bu_consultado_em)` monta `FatosCartaoMotor`; texto desconhecido = sem consulta.
- **Ida e volta** `src/lib/vt/motor/idaVolta.ts`: cálculo por sentido (`calcularAlternativaSentido`), ordenação por custo com indeterminado no fim, `calcularDiaIdaVolta` (= `calcularDia`) e `combinarIdaVolta`, que junta ida + volta numa única evidência: pernas com `sentido` ('ida'/'volta', sequência reiniciada por sentido) e o resultado do motor em `itinerario.calculoMotor` (versão `motor_v1`, data do serviço, status, valores ida/volta/dia, situação do BU, pendências). Tudo dentro do JSON e do hash da evidência — **cabe na `vt_itinerarios` atual, sem migration** (o CHECK só exige objeto com array `pernas` não vazio). `ItinerarioVT` ganhou o campo opcional `calculoMotor`.
- **Tela** `src/pages/vt/VtRevisaoRota.tsx` não usa mais `cotarCatraca` (o arquivo continua no projeto para os testes legados): duas seções, **Ida (casa → posto)** e **Volta (posto → casa)**, cada uma com horário editável (padrão 06:00 e 18:00, HH:MM, próxima segunda em Brasília — `src/lib/vt/partidaRota.ts`) e botão próprio de consulta. Cada alternativa mostra valor por sentido, status (Confirmado/Pendente/Indeterminado) e "Mais em conta" sem escolher; a selecionada mostra conduções com tarifa integral do motor, "Tirar condução", avisos, pendências com a seção da regra e a explicação passo a passo. Resumo **Ida + Volta = Total do dia**. Salvar só com status do dia `confirmado` e valor > 0; caso contrário o motivo aparece embaixo do botão.
- **Gravação**: `custo_diario_centavos` = valor do DIA do motor (ida + volta); `cotacao_id = 'motor_v1'` (coluna `text` sem CHECK — 169); a evidência é a alternativa combinada (`alternativa_id = "ida:google-N|volta:google-M"`). O repositório não mudou.
- **Fatos do cartão reais**: `useVt` passou a ler `vt_bu_consultado_em`; a aba Trajetos entrega `fatosCartaoDoCadastro(...)` à revisão (antes era um objeto fixo com BUN "não consultado"). `bunConfirmadoNoPortal` vai sempre `null` (não há coluna).
- **Edge Function `vt-rota`**: **não precisou de mudança** — já aceita origem, destino e `departureTime` livres; a volta é só a chamada com origem/destino invertidos e outro horário.

**O que falta**

- Registrar "BUN conferido no Portal" (`bunConfirmadoNoPortal`): exige coluna nova (migration) e tela. Sem isso, "Suspenso Setrans" com 2 ônibus de Niterói sempre fica pendente.
- `vt_itinerarios` guarda ida + volta numa linha só; se a gestão quiser consultar a volta separadamente (ex.: relatório por sentido), avaliar coluna/linha própria (migration).
- A data do serviço usada no cálculo é hoje (Brasília); a carga do mês ainda NÃO usa o motor (passo 4 do §5).
- Evidências antigas (só ida, `cotacao_id` legado) continuam válidas; a tela mostra "Volta: não registrada nesta evidência".
- Rodar a tela no navegador com a gestora (consulta real ao Google) antes de qualquer deploy.

**Verificação**: `npx vitest run src/lib/vt src/pages/vt src/hooks src/services` 43 arquivos / 383 testes ok; `npm test` 128 arquivos / **1.578 testes** ok (eram 1.563; +10 do adaptador/ida-volta, +5 da tela); `npx tsc -p tsconfig.app.json --noEmit` ok; `npx eslint src/lib/vt src/pages/vt src/services src/hooks/useVt.ts` ok; `npm run build` ok.
