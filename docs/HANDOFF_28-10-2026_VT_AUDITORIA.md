# HANDOFF 28/10/2026 — VT: auditoria completa, correções e importação Riocard

> Escrito para o próximo agente dar continuidade. Sessão de 27–28/10/2026.
> Estado do git: pacote commitado em `6032204` (branch `vt-fase1`), mesclado na
> `main`, push das duas branches feito, **deploy de produção verificado**
> (bundle `index-CIKk8iSs.js` conferido em https://plena-corh.netlify.app/).
> Nota: o commit `3796032` (docs do deploy) existe só na `main`; a `vt-fase1`
> recebe no próximo merge. Working copy está na branch `vt-fase1`.

## 1. O incidente que motivou tudo

Em 25/10/2026 a usuária mesa (maciel@plenaserv.com) calculou a carga de VT de
novembro/2026 e **nada foi gravado** (`vt_cargas` ficou com 0 linhas, sem log).
Causa provável: o botão "Gravar carga" estava desabilitado pelo portão de
pendências (banner amarelo) e o feedback era fraco — ou confundiu "Baixar Excel"
com gravar. As 39 coberturas de férias que ela registrou **estavam salvas** e
seguem valendo.

## 2. A auditoria (4 auditores em paralelo)

- **Dados (banco, somente leitura)**: 4 divergências trajeto × cadastro
  (Anaide→Calle Maggiore × CASCAIS; José Robson→Praia d'Ofir × GRAND VALLEY;
  Rafaela→Grand Valley × CBO MACAÉ; Ronald→Itaguaí × MARINO); 17 trajetos com
  bilhete suspeito (9 BU Niterói fora de Niterói — pagando a menos; 3 Passagem
  SG em Niterói×Niterói e 1 BUI dentro de SG — a mais; 4 Passagem SG em
  SG→Niterói — a menos); **15 coberturas de novembro em postos sem trajeto
  confirmado do ferista** (travariam o portão); 2 sobreposições de cobertura
  (Everaldo 2 postos 01–04/11; José Ricardo Jardins 10–11/11); DUOCONNECT sem
  cidade; 14 optantes sem tipo de cartão; 3 optantes Afastado com trajeto.
- **Código da Carga**: achou 2 bugs críticos reais — estado parcial do pipeline
  podia gravar o cálculo de um mês na competência de outro; e o recálculo após
  restaurar o rascunho era no-op (registrar cobertura destravava o portão sem
  atualizar os valores).
- **Demais abas**: sugestão de trajeto indistinguível de gravado (a "pessoa em
  2 lugares"); trocar bilhete de trajeto confirmado salvava sem reconfirmação;
  aviso de bilhete incompatível com buracos; selo Ferista marcando treinamento.
- **Consistência/docs**: migrations 155–163 todas aplicadas (cabeçalhos
  "NÃO aplicada" de 155/157–160 estão desatualizados nos arquivos);
  PLANO_MODULO_VT.md diz "PROPOSTA — nada implementado" (obsoleto);
  docs/REGRAS_NEGOCIO.md não tem seção VT.

## 3. O que foi corrigido no código (tudo no commit 6032204)

**Aba Carga** (`src/hooks/useVtCarga.ts`, `src/pages/vt/VtCargaTab.tsx`,
`src/lib/vt/carga.ts` + `cargaRascunho.ts` novo):
- Banner permanente "a carga está gravada?" conferido no BANCO
  (`verificarGravacao`; verde/âmbar/vermelho; compara CONJUNTO de
  colaborador_ids, não contagem — `situacaoGravacaoCarga`).
- Rascunho do relatório parseado em localStorage (`corh:vt:carga`,
  `validarRascunhoCarga` estrito) + restauração automática ao voltar à aba
  (`restaurarRascunho`; pipeline separado em `processarPessoas`; `reprocessar`
  dispensa o File). Sair da tela não perde mais o cálculo.
- Pipeline publica estado só no sucesso (limpa tudo na falha) — fim da
  mistura de competências.
- `semEscala` = SÓ "fora do relatório" (bloqueia); `semDiaDeTrabalho` novo
  (no relatório sem [T] → R$ 0, NÃO bloqueia) — afastado não trava mais.
- `gravarCargas` envia `gerada_em` no upsert; filtro de prontos unificado
  (`prontaParaGravar`, inclui `!semEscala`); importar desabilitado até
  `dadosProntos`; beforeunload quando não gravado.

**Aba Trajetos** (`VtTrajetosTab.tsx`, `trajetos.ts`, `useVt.ts`):
- Sugestão automática com selo "Sugestão — não gravada"; aviso âmbar de
  mudança de posto (trajeto gravado ≠ cadastro); trocar bilhete/valor extra
  de trajeto confirmado DESCONFIRMA (volta a "A confirmar");
  `avisoBilheteIncompativel` ampliado (municipal_outra, Passagem SG em
  Niterói); `avisoCartaoDoTrajeto` novo (cartão da pessoa × cartão necessário);
  valor extra manual por dia (input "Extra/dia R$", composição visível).

**Demais**: coberturas com erro 23505 específico; selo Ferista ignora
treinamento (`useCarteiraFeristas` filtra tipo); ConfirmDialog ao desmarcar
optante com trajetos; JAE (RJ) no select de cartão; aba Bilhetes com "Qual
cartão" + "Tem integração" (pré-preenche ao reajustar).

## 4. Migrations aplicadas (Management API, 28/10/2026)

- **165** `vt_bilhetes.cartao_necessario` ('bun'/'bui'/'jae'/'comum') +
  `usa_integracao` + seeds dos 9 bilhetes + CHECK de
  `colaboradores.vt_tipo_cartao` com 'jae'.
- **166** `vt_trajetos.valor_extra_centavos` (0..100000).
- **167** `colaboradores.vt_bu_ativado` / `vt_bu_situacao` /
  `vt_bu_consultado_em` / `vt_riocard_numero_cartao`.

Regras de tarifa ensinadas pela gestora (documentadas no cabeçalho da 165):
BUN R$ 5,60/perna integração 2 cond./1h só Niterói; BUI R$ 9,40/perna TETO
mesmo com 2 ônibus entre cidades, **exige cartão validado**; Passagem SG
R$ 7,10/perna linha direta SG→Niterói; Sem integração BU R$ 32,00 = sem cartão
validado; RJ varia. **Cartão que a pessoa TEM ≠ valor que recebe** (24/10).

## 5. Dados gravados nesta sessão

- **13 trajetos 'sugerido'** dos feristas para as coberturas de novembro
  (SQL e verificação em `dados-locais/trajetos_feristas_nov_2026-10-27/`):
  Andressa (Itaboraí, BUI)→ÉVORA e PALAZZO R$ 18,80; demais 9 feristas
  Niterói→Niterói com BU NITERÓI R$ 11,20 (Angelo→Cascais; Everaldo→Mérito
  Barreto e Itaguaí; Francisco das Chagas→Itaguaí; Francisco Soares→CBO;
  Jaldeni→Palazzo; José Robson→Grand Valley e Calle Maggiore; Ronald→Marino;
  Ronaldo da Silva→Lagoa Mar; Vanderlei→Abaeté). **A gestora confirma um a um
  na aba Trajetos (escolha dela — "opção 2").** `vt_tipo_cartao` do Vanderlei
  preenchido ('bun').
- **Importação Riocard** (`scripts/vt/importar-riocard-bu.ts`, dry-run padrão;
  cruzamento em `scripts/vt/cruzar-riocard.ts`): 248/266 casados por CPF
  (normalizado a 11 dígitos — o banco tem CPFs sem zero à esquerda) e gravados,
  0 erros. Backup em `dados-locais/riocard_2026-10-28/` junto com
  `revisao_riocard.xlsx` (cruzamento completo). `vt_tipo_cartao` NÃO foi
  alterado — o fato Riocard é a âncora, a classificação é decisão da gestora.

## 6. Pendências — gestora (ela faria em 29/10)

1. Confirmar os 13 trajetos dos feristas (VT → Trajetos, selo "A confirmar").
2. Revisar os **11 CRÍTICOS da Riocard** (cadastro diz BUI, BU não ativado —
   quase todos "Suspenso Setrans"): Willian Ribeiro, Elaine Pinto, Fabiana
   Lima, Wallace Rodrigues, Joao Feliciano, Luiz Otavio Sabino, Sidnei
   Azevedo, Edinaldo Medeiros, Fabio Brum, Jose Orlando Targino, Jose Wilton
   Leite. Ação: reativar na Setrans ou reclassificar o trajeto.
3. Revisar as **17 divergências de valor** (avisos novos na aba Trajetos
   ajudam) — lista completa no relatório da auditoria (seção 2 acima).
4. Decidir a **cobertura dupla do Everaldo** (Mérito Barreto × Itaguaí,
   01–04/11) e a do **José Ricardo** (Jardins 10–11/11 — provável erro de data).
5. Reimportar o relatório na aba Carga → resolver pendências do banner →
   **Gravar carga** → conferir banner verde.
6. Verificar os 3 optantes fora da lista Riocard (Elcio Cardoso, Renato de
   Oliveira Pereira, Cassio Eduardo).

## 7. Pendências — técnicas (próximo agente)

- Departamento DUOCONNECT (`3c68d824-…`) sem cidade — impede avaliar escopo de
  3 trajetos (Eliana, Fabiana, Rejane). Preencher a cidade no cadastro.
- Caso Andressa: gestora pode dar **valor extra manual** (migration 166) —
  ela mencionou "colocar valor a mais manualmente"; perguntar o valor.
- 4 divergências trajeto × cadastro (seção 2): confirmar trajeto do posto novo
  e excluir o antigo (a tela agora avisa).
- Aba Colaboradores do VT poderia exibir `vt_bu_ativado`/`vt_bu_situacao`
  (campos gravados na 167, ainda não exibidos em tela nenhuma).
- Docs: atualizar PLANO_MODULO_VT.md (status, fonte de férias = relatório
  Flit), criar seção VT em docs/REGRAS_NEGOCIO.md, corrigir cabeçalhos
  "NÃO aplicada" das migrations 155/157–160.
- `npm run lint` global quebrado por `.claude/worktrees/` (pré-existente) —
  lint escopado por arquivo funciona.
- Fase 4 Riocard segue pendente de decisão (o `vt_riocard_numero_cartao`
  gravado na 167 já ajuda).
- Nada foi commitado depois do deploy além do commit de docs `3796032`
  (só na `main`).

## 8. Estado verificado

- `npx vitest run src/lib/vt`: 170 testes passando. Suíte completa: 1359.
- `npm run build`: passa. Deploy verificado (hashes iguais).
- Banco: 236 trajetos confirmados + 13 sugeridos; 39 coberturas; vt_cargas e
  vt_fechamentos vazias (carga de novembro ainda não gravada — é a tarefa da
  gestora em 29/10).
