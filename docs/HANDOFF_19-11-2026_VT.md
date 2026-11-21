# Handoff VT — 19/11/2026: teste da revisão de rota, política do BU e tarifa de Niterói

> Ponto de retomada. Continuação de `docs/HANDOFF_18-11-2026_VT_NOVO_MOTOR.md`.
> **Nada foi publicado no site.** A Edge Function `vt-rota` NÃO foi redeployada.

## 1. O que foi feito

### Commit `2625785` (enviado ao GitHub)
- **Política da empresa: integração presumida** (decisão da gestora). O colaborador TEM que ter o BU com integração, que é direito da empresa para pagar menos. Por isso o motor calcula SEMPRE com BUN/BUI, qualquer que seja a situação na Riocard.
  - Quem não está "Ativado" recebe só o aviso genérico para regularizar o cartão. Decisão: nunca dizer se o problema é no BUI ou no BUN, para não assumir responsabilidade por informação errada.
  - Seção nova em `docs/VT_REGRAS_TARIFARIAS.md`.
- **Exceção por pessoa "Pagar tarifa cheia"** (prerrogativa da empresa, motivo obrigatório): ação na aba Colaboradores do VT.
  - **Migration 174 APLICADA** (colunas `colaboradores.vt_tarifa_cheia/_motivo/_por/_em`).
  - Backup em `dados-locais/backup_vt_174_2026-11-19/`. Teste em transação desfeita: TUDO OK. Verificação após aplicar: 540 colaboradores, 245 optantes, 0 exceções.
- **Ônibus municipal de Niterói com BUN = R$ 4,45** (antes R$ 5,60).
  - Fonte: Lei 3.887/2024, que não exclui o VT, mais 3 fontes de notícia.
  - 2 ônibus integrados em até 1 h = R$ 4,45 no total.
  - Limite de 2 viagens com desconto por dia; a 3ª viagem paga R$ 5,60.
  - Exceção "tarifa cheia" = R$ 5,60.
  - Efeito: 1 ou 2 ônibus em cada sentido passa de R$ 11,20 para **R$ 8,90 por dia**.
- **Barca Araribóia continua R$ 5,45** (decisão da gestora). Duas fontes dizem R$ 5,15; anotado como divergência nas regras.
- **Revisão de rota:**
  - botão "Consultar ida e volta";
  - volta igual à ida por padrão ("Volta diferente? Escolher outra");
  - máscara HH:MM;
  - alternativas repetidas agrupadas; selo "Mais em conta" só quando há diferença de valor;
  - rodapé com Salvar/Fechar fixo;
  - operadora "Intermunicipal (DETRO)" quando o Google diz "Prefeitura de Niterói";
  - explicações em linguagem do colaborador, que servirá de base para o comunicado futuro;
  - texto "Pode trocar depois: ... nova revisão".
- **Aba Trajetos:**
  - mostra as LINHAS orçadas ("Ida: 62 → 39A · Volta: 39A → 62") e o valor do dia;
  - esconde afastados;
  - sem a coluna de endereço; só o aviso "Endereço incompleto";
  - ícones maiores e colunas redistribuídas;
  - texto "Rota ainda não cadastrada para este posto".
- **Aba Colaboradores:** `vt_tipo_cartao` aposentado na tela. No lugar, a coluna "BU na Riocard", só leitura. Sem mudança no banco.

### Commit desta parada (horário do turno), NÃO publicado
- A revisão lê o turno da escala Flit (`locais_trabalho_diario.turno`, últimos 60 dias, no posto do trajeto, o mais frequente). Arquivos: `src/lib/vt/horarioTurno.ts` e `turnosDoPosto.ts`.
  - Ida: "chegar até" a entrada (`arrivalTime`).
  - Volta: sai na saída. No turno noturno, volta no dia seguinte.
- O horário usado fica gravado na evidência (`calculoMotor.horarioReferencia`).
- A Edge Function `vt-rota` foi alterada para aceitar `arrivalTime`, mas **NÃO foi publicada**. Até publicar, a tela usa o quebra-galho de sair 90 min antes da entrada.
  - Comando: `powershell scripts/lib/implantar-edge-function.ps1 -Slug vt-rota -Arquivo supabase/functions/vt-rota/index.ts -VerifyJwt 1`

## 2. Fatos comprovados nesta sessão
- **Alcemir** (consulta pública por CPF no site da Riocard): BUI "Suspenso Setrans (Motivo 7)" e **BUN "Habilitado"**. Ou seja, as duas situações são independentes. Registrado nas regras.
- A consulta por CPF tem reCAPTCHA: **NÃO automatizar**. O arquivo `Bilhete_Unico_Riocard.xlsx` só traz o BUI.
- Salvar o "Usa VT" grava em menos de 0,1 s no banco. A lentidão vista no teste foi o servidor local recompilando.

## 3. Aguardando a gestora
1. **Extratos de cartão VT.** Planilha `dados-locais/vt_extrato_bun_2026-11-19/conferir_extrato_15.xlsx`: 15 pessoas que provavelmente pegam 2 ônibus e 5 que pegam 1, por sugestão do Google, não confirmada.
   - Confirma a regra: 1º ônibus R$ 4,45 e 2º em até 1 h R$ 0,00.
   - Um usuário disse "de boca" que 2 ônibus custam R$ 5,60. As fontes escritas dizem R$ 4,45.
   - **Até confirmar, NÃO usar os R$ 8,90 numa carga real.** Se o extrato mostrar R$ 5,60, voltar a tarifa em `TARIFA_NITEROI_BUN` (`src/lib/vt/motor/tarifas.ts`).
2. Ok para **publicar a `vt-rota`** (horário de chegada).
3. Ida: chegar exatamente na entrada, ou com folga (ex.: 10 min)?
4. Mostrar a hora de chegada ("chegando às 06:48") na tela e no comunicado?
5. **URL da página de consulta da Riocard por CPF**, para o botão "Consultar na Riocard" + "Copiar CPF" (só para quem vê o CPF completo).
6. Confirmar as decisões da exceção:
   - sem pendência de cartão para quem tem a exceção;
   - BUN "não habilitado" no portal também presume integração;
   - aviso de regularizar também para quem não foi consultado;
   - motivo antigo some ao desmarcar (fica no `log_auditoria`);
   - revisões antigas não mudam sozinhas.
7. Tarifa: integração que cai além do limite diário = R$ 5,60. A ordem das viagens no dia é ida e depois volta.

## 4. Próximos passos (depois das respostas)
- Publicar a `vt-rota` e testar na tela com a gestora (localhost: `npm run dev`).
- Botão "Consultar na Riocard" (com a URL).
- Tela "Rotas a confirmar" (fila; Jev só com dados de linhas).
- Carga e fechamento num fluxo só pelo motor (buracos L1 a L3 do handoff de 18/11).
- Dezembro em paralelo (motor × planilha × módulo antigo).
- **Jaé (Rio):** pesquisar depois de Niterói/SG (metrô + ônibus municipal do Rio). Hoje fica pendente.
- **Comunicado individual ao colaborador** (objetivo final): explicar dias × rota × linhas × tarifa e pedir para regularizar o cartão, de forma genérica.

## 5. Observações técnicas
- Rodar o vitest pelo **PowerShell** (no Git Bash falha com `reading 'config'`).
- O `excelCompraArquivo.test.ts` (Materiais) às vezes estoura o tempo na suíte completa e passa sozinho.
- `docs/LANCAMENTO_MENSAL_EPIS.md` tem alteração de outra sessão, que não foi mexida nem commitada.

## 6. 21/11/2026 — continuação (sem deploy do frontend, sem commit, sem alteração de banco)

Decisões da gestora e o que foi feito:
- **`vt-rota` v2 publicada** (aceita `arrivalTime`). A revisão de rota deixou de usar o quebra-galho de sair 90 min antes: com turno, a ida consulta `arrivalTime = entrada − 10 min` (`FOLGA_CHEGADA_MINUTOS`, `chegadaComFolgaBRT`); a evidência grava `horarioReferencia.folgaMinutos` (opcional, evidências antigas sem o campo continuam válidas). Turno noturno: volta no dia seguinte (inalterado). A hora prevista de chegada NÃO aparece na tela (a decisão 4 da seção 3 foi "não mostrar").
- **Botão Riocard**: "Consultar na Riocard" + "Copiar CPF" (`ConsultaRiocardAcoes.tsx`) nas abas Colaboradores e Trajetos, só com `colaborador.ver_cpf_completo`. No painel de revisão de rota NÃO foi colocado (ele não recebe o CPF; as duas abas já cobrem o uso). O CPF é lido do banco só para quem tem a permissão.
- **Exceção tarifa cheia**: confirmada como raríssima; o comportamento atual (integração presumida + aviso para quem não está "Ativado" ou nunca foi consultado) já era esse — sem mudança de código nem banco.
- **R$ 4,45 confirmado** por pesquisa com usuários; `docs/VT_REGRAS_TARIFARIAS.md` atualizado (origem do R$ 5,60, habilitação automática, cartão VT de empresa, 3ª viagem/janela/mesma linha, limite mensal de 60 viagens A CONFIRMAR, integração entre consórcios não verificada, fontes). A pendência de extrato deixa de bloquear o uso dos R$ 8,90/dia.
- **Nova aba "Rotas a confirmar"** (`/vt/rotas`): aba própria (e não filtro em Trajetos) por ter contador, ordem e "Próxima" próprios. Lista optantes ativos sem revisão confirmada (itinerário + custo + decisão confirmada), ordem sugerida → antiga → sem rota, depois nome. Revisar abre o `VtRevisaoRota` existente (remontado por pessoa); "Próxima da fila" abre a seguinte; a linha sai da fila ao confirmar.

Pendências que dependem da gestora:
1. **Optante sem trajeto gravado** ("Sem rota cadastrada"): a fila só aponta para a aba Trajetos, porque a revisão exige um trajeto/decisão já existentes e criar trajeto exigiria escolher bilhete (dado). Se quiser revisar direto dali, será preciso decidir como criar o trajeto (ex.: bilhete provisório).
2. Publicar o frontend (nenhum deploy feito) — checklist de deploy da `main` no AGENTS.md §10.
3. Confirmar o limite de 60 viagens integradas por mês (Lei 2.851/2011) antes de implementar.
4. Mantém-se: URL de consulta da Riocard já usada; Jaé (Rio) e comunicado individual ao colaborador seguem como próximos passos.


## Atualização de 21/11/2026 — seção DETRO, gratuito Itaboraí/Maricá e regras do parecer

Sem deploy, commit, migration ou alteração de dados.

**Feito**
- `src/lib/vt/motor/tarifas.ts`: `opcoesSecaoDetro(linha)` (trechos com valor único por seção; seção null/ambígua não vira opção), pendência `DETRO_SECAO_ESCOLHER` (com `linha` e `opcoesSecao`, tipos em `motor/tipos.ts`), tarifa `onibus_municipal_gratuito` (R$ 0), `LINHAS_AC_MARICA`/`ehLinhaAcMarica`.
- `calcularSentido.ts`: par com gratuito = "não integra" (cobra só a outra); par com linha AC de Maricá = pendência `BUI_LINHA_AC_NAO_CONFIRMADA`. `precificarPerna.ts`: gratuito = 0; AC avulsa = pendência.
- `googleRoutes.ts`: linha com código na tabela DETRO => intermunicipal (a operadora do Google não decide); `OPERADORAS_MUNICIPAIS_GRATUITAS` (lista explícita, curta — AMPLIAR só com o nome exato devolvido numa consulta real); `definirSecaoPerna`. `contratosTarifarios.ts`: `secaoDetro`/`secaoDetroRotulo` opcionais na perna, `secoesDetro` opcional no `calculoMotor`, sistema `gratuito`. `adaptadorItinerario.ts` repassa a seção ao motor; `idaVolta.ts` grava o resumo `secoesDetro`.
- `VtRevisaoRota.tsx`: seletor "Trecho pago" por condução/sentido; sem escolha o salvar fica bloqueado com "Escolha o trecho (seção) pago da linha X"; volta pré-marcada herda a seção da ida (mesma linha); remover condução limpa as escolhas daquela alternativa.
- Testes novos: `motor/secaoGratuito.test.ts` e `pages/vt/VtRevisaoRota.secao.test.tsx`; ajustado o teste antigo de 416M em `motor.test.ts`.
- `docs/VT_REGRAS_TARIFARIAS.md` atualizado (§3 valores/barcas, §6, §10).

**Pendências**
- Nomes reais das operadoras de Itaboraí/Maricá no Google: a lista é um palpite conservador; operadora fora dela cai em pendência. Conferir numa consulta real e ampliar.
- Seções cujo texto ficou ilegível no PDF (200 linhas "conferir") não aparecem como opção; conferir com o PDF se alguma linha usada pela operação for afetada.
- Linhas AC de Maricá: BUI não presumido, aguarda confirmação.
- Base de Niterói R$ 4,45 × R$ 5,60: jurídico (Decreto 10.854/2021, art. 124, conferir numeração).
- Trajetos/cargas já gravados NÃO foram recalculados; linhas DETRO com seção em trajetos existentes aparecerão com a pendência na próxima revisão.

## Fila "Rotas a confirmar" ampliada (21/11/2026, fim do dia)

Implementado a pedido da gestora (sem deploy, sem aplicar migration, sem alterar dados):

1. **Criar trajeto direto pela fila.** Botão "Criar e revisar" para "Sem rota cadastrada". `src/lib/vt/criarTrajetoRevisao.ts` cria o `vt_trajetos` (sugerido/manual, `bilhete_id` NULL, escopo/precisão do cadastro) e a decisão sugerida (revisão = última do par + 1; o app cria porque não há trigger — só o backfill da 169 criou decisões). `vt_trajetos.bilhete_id` é NOT NULL hoje: **a criação depende da migration 175 (`175_vt_trajeto_bilhete_opcional.sql`), testada em transação desfeita e APLICADA em 21/11/2026 com autorização da gestora** (backup em `dados-locais/backup_vt_175_2026-11-21/`, 257 trajetos; verificação: bilhete_id nullable, CHECK presente, 0 sem bilhete). Sem a 175 o clique mostra aviso e não grava nada.
2. **Postos exigidos pela escala do mês** (`apoioRotasAConfirmar.ts` + `exigenciasDeCoberturas`/`exigenciasDeCargas`): coberturas/treinamentos com `data_fim >= hoje` e postos do detalhe das cargas da competência atual e seguinte, só optantes, motivos juntados, filtro "Só o que a carga do mês precisa", contador "A carga do mês precisa de N".
3. **Endereço mudou**: `calculoMotor.enderecoCasa` é gravado a partir de agora (`combinarIdaVolta` 7º parâmetro). Comparação por `enderecoMudou` (forma ignorada; mudança de rua/número/bairro/cidade/CEP conta). **Rotas confirmadas antes de hoje não têm o campo e não são acusadas** — para vigiá-las seria preciso revisá-las de novo ou reconstruir o endereço da época pelo `log_auditoria` (não feito: consulta pesada sob RLS, ver migration 108).

Ordem da fila: carga do mês → sugerida → endereço mudou → rota antiga → sem rota; "Próxima" passa pelos sem rota. Testes: `rotasAConfirmar.test.ts`, `rotasAConfirmarMes.test.ts`, `criarTrajetoRevisao.test.ts`, `VtRotasAConfirmarTab.test.tsx`.
