# Proposta: recomeçar o núcleo do Vale-Transporte (VT)

Data: 18/11/2026. Documento para conferência da gestora. Nenhum código foi escrito. Nada foi alterado no sistema, no banco ou em produção.

Sempre que aparece "(Regras §N)", o número vem do documento `docs/VT_REGRAS_TARIFARIAS.md`, que é a fonte de verdade deste texto. Quando um valor vem do cadastro de tarifas do sistema e não está no documento de regras, isso está escrito ao lado.

---

## 1. Resumo em 5 linhas

1. Hoje o sistema tem três jeitos de chegar ao valor do VT ao mesmo tempo, e eles não conversam.
2. Proposta: um caminho só, em linha reta: Pessoa, Rota real, Preço pela regra, Carga do mês, Fechamento.
3. O valor deixa de ser escolhido à mão num bilhete antigo. Ele é calculado pela regra oficial, com a data do serviço.
4. Faltou dado? O sistema mostra "pendente" e diz o motivo. Nunca R$ 0 escondido, nunca valor chutado.
5. Antes de escrever código, a gestora confere os exemplos da seção 5. Depois rodamos dezembro em paralelo com a planilha e com o módulo antigo.

---

## 2. Por que recomeçar o núcleo

**Três caminhos para o mesmo valor.**
1. O bilhete nomeado, escolhido à mão, que veio da planilha antiga (9 bilhetes com valor diário fechado). É o que paga hoje.
2. As decisões e pacotes versionados (migration 169).
3. O preço revisado pela rota do Google (migration 173).

**Dois fluxos de carga** que não conversam: o antigo e o "novo fluxo" (lotes, migration 170). O fechamento só lê o antigo.

**O erro está no valor por dia, não na conta de dias.** A multiplicação dias × valor está certa. Cerca de 100 dos 245 trajetos têm algum sinal de problema. Comparado com a planilha, o módulo dá cerca de R$ 5.000 por mês a menos (36 pessoas). A causa principal é a regra de 24/10, que trocou BUI (R$ 18,80) por BU Niterói (R$ 11,20) usando a cidade do cadastro.

**Erros no catálogo de bilhetes:**
- O bilhete TREM está em R$ 15,80, que é preço de metrô. O trem custa R$ 7,60, ou seja, R$ 15,20 por dia (Regras §7).
- O BUI de R$ 18,80 é aplicado a trajeto com ônibus municipal de Niterói. O BUI não cobre esse ônibus (Regras §4, exceção de Niterói).
- O BUI é aplicado a quem está "Suspenso Setrans". A suspensão pode ter várias causas e o benefício não vale enquanto está suspenso (Regras §4).

**Buracos do fluxo novo:**
- Dia sem posto identificado some em silêncio.
- Optante que não aparece no relatório entra com R$ 0 como se estivesse "pronto".
- Ignora o desconto e o crédito do fechamento.
- Os dados do cartão são fixos como "desconhecido", então só confirma trajeto de 1 condução.
- O preço revisado fica congelado, sem data de vigência.
- O valor extra manual pode ser somado duas vezes.
- Não deixa criar trajeto para posto novo.
- As tarifas por modal estão escritas à mão no código.

Conclusão: remendar não resolve, porque o problema é ter várias fontes para o mesmo número. Vamos trocar o núcleo e aproveitar o resto.

---

## 3. O que fica e o que sai

### O que fica (aproveitado)
- Cadastro de optantes.
- Situação do cartão na Riocard já gravada no cadastro (situação do BU, data da consulta, número do cartão).
- Leitura do relatório "Gestão de escalas" do Flit.
- Coberturas de férias e treinamento.
- Conferência pelo ponto no fechamento.
- Permissões de acesso.
- Consulta ao Google Routes (sugere rotas).
- Tabela de tarifas oficiais, com fonte e vigência.

### O que sai
- A escolha de bilhete à mão como fonte do valor.
- Os fluxos duplicados (fica um só).
- Preços escritos dentro do código.

### O que acontece com os 9 bilhetes
Eles viram só o **nome da carga na Riocard** (o que se pede ao carregar o cartão). Deixam de decidir o valor.

### Nada é apagado
Os dados antigos (bilhetes, trajetos, cargas) ficam guardados para consulta.

---

## 4. O novo caminho, em linha reta

**Pessoa → Rota real → Preço pela regra → Carga do mês → Fechamento**

Regra geral para qualquer etapa: se falta dado, o item fica **pendente com o motivo escrito**. Nunca R$ 0 escondido. Nunca valor chutado.

### 4.1 Pessoa
- **Entra:** a pessoa é optante do VT. Mais os fatos do cartão: modelo do cartão (Personalizado Usuário, Personalizado Empresa, etc.), vínculo do cartão ao CPF, situação do BUN, situação do BUI, data da consulta (Regras §3, §4, §8).
- **Quem confirma:** o RH, conferindo o cartão na Riocard.
- **Sai:** uma ficha de cartão com o que a pessoa realmente pode usar.
- **Se falta dado:** modelo do cartão não conferido significa **sem BUI** (Regras §4: só Personalizado Usuário ou Expresso habilita; Regras §8: sem o dado, o resultado não é confiável). BUI "Suspenso Setrans" também significa sem BUI. BUN sem vínculo ao CPF confirmado significa sem integração BUN (Regras §3).

### 4.2 Rota real
- **Entra:** a rota de **ida e a rota de volta**, cada uma com suas linhas, sentido e horários. A volta não é presumida igual à ida (Regras §8: dados por sentido).
- **Quem confirma:** o Google sugere; o RH escolhe a rota que a pessoa realmente faz e confirma. A mais barata nem sempre é a real (Regras §11).
- **Sai:** uma rota confirmada, guardada com a evidência (linhas, horários, data).
- **Se falta dado:** sem rota confirmada **não há valor calculado**. Durante a transição, a pessoa continua com o valor atual, marcado "não conferido".

### 4.3 Preço pela regra
- **Entra:** a rota confirmada, a ficha do cartão e a **data do serviço**.
- **Quem confirma:** ninguém digita. O sistema calcula, e o RH só vê o resultado e o motivo.
- **Sai:** valor por sentido e por dia (ida + volta), com a regra aplicada e a fonte.
- **Regras de base:**
  - A base é a **tarifa integral**. O R$ 4,45 do BUN é subsídio e não entra na conta (Regras §2, §3).
  - Integração só vale quando **todos os requisitos estão provados**: linhas diferentes, mesmo sentido, tempo máximo, modelo do cartão, situação ativa (Regras §3, §4).
  - A tarifa certa é a vigente **na data do serviço**. Reajuste não muda o passado.
- **Se falta dado:** o resultado é "pendente" com motivo, e o sistema mostra o valor sem integração como referência, quando existir.

### 4.4 Carga do mês
- **Entra:** os dias de trabalho ([T]) do relatório do Flit × o preço do dia do **posto daquele dia** (ferista e cobertura recebem pelo posto do dia).
- **Quem confirma:** a gestora ou a mesa, conferindo a lista de prontos e a lista de pendentes.
- **Sai:** a carga do mês gravada, conferida no banco (o sistema relê o que gravou e mostra o resultado).
- **Se falta dado:** dia sem posto, optante fora do relatório, rota não confirmada, tudo isso vai para uma **lista separada de pendências**. Quem está pronto é gravado. Quem está pendente fica de fora, visível, com o motivo. Nunca entra com R$ 0.

### 4.5 Fechamento
Igual ao atual:
- Falta comprovada no ponto: o dia é **descontado** na carga do mês seguinte.
- Dia trabalhado que não estava na carga: o dia é **creditado** na carga do mês seguinte.
- Dia sem registro no ponto: "não conferido". Não desconta sem evidência.
- Desconto que passa do valor do mês não vira saldo. O piso é R$ 0.

O fechamento passa a ler a carga do novo caminho, e o desconto e o crédito entram de fato na carga seguinte.

---

## 5. Exemplos de cálculo

**Como ler:** "Por sentido" é uma viagem (só ida, ou só volta). "Por dia" é ida + volta, ou seja, o dobro. Todas as contas supõem ida e volta iguais, apenas para o exemplo. No sistema real, cada sentido é confirmado separadamente.

**Origem dos valores:**
- R$ 5,60, R$ 9,40, R$ 7,60, R$ 7,90, R$ 7,10, R$ 9,10, R$ 10,40: documento de Regras.
- R$ 5,55 (ônibus municipal de São Gonçalo) e R$ 5,00 (ônibus municipal do Rio, Jaé): **não estão no documento de Regras**. Estão no cadastro de tarifas do sistema, com fonte (Riocard, tarifas de 28/09/2026, e Jaé), mas pedimos que a gestora confirme. Aparecem marcados "a conferir".

| | Situação | Regra aplicada | Por sentido | Por dia | Status |
|---|---|---|---:|---:|---|
| a | Niterói → Niterói, 1 ônibus municipal de Niterói por sentido | Tarifa integral de Niterói (Regras §3) | 5,60 | 11,20 | Confirmado |
| b | Niterói → Niterói, 2 ônibus municipais, linhas diferentes, mesmo sentido, até 1 h, BUN ativo no CPF | Integração BUN ônibus-ônibus: paga-se 1 tarifa por sentido (Regras §3) | 5,60 | 11,20 | Confirmado |
| c | Igual a (b), mas BUN não confirmado | Sem integração: soma das duas tarifas (Regras §3, §8) | 11,20 | 22,40 | Pendente: conferir BUN. Com BUN válido cai para 11,20 por dia |
| d | São Gonçalo → Niterói, linha direta 484M | Tarifa da linha (Regras §6) | 7,10 | 14,20 | Confirmado |
| e | Jardim Catarina → Niterói, linha direta 483M | Tarifa da linha (Regras §6) | 9,10 | 18,20 | Confirmado |
| f | Linha direta acima de 9,40 sem baldeação (ex.: 100D) | Base integral da linha (Regras §6) | 10,40 | 20,80 | Pendente: redução pelo BUI direto depende de DP/jurídico (Regras §2, §10) |
| g | Intermunicipal + ônibus municipal de São Gonçalo, BUI elegível | Integração BUI (Regras §4, §5) | 9,40 | 18,80 | Confirmado (se todos os requisitos estiverem provados) |
| h | Intermunicipal 536R + municipal de Niterói 35 | BUI não cobre Niterói; somam-se as tarifas (Regras §4, §6, §11) | 14,70 | 29,40 | Confirmado, mas a rota precisa ser a real |
| i | Igual a (g), com BUI "Suspenso Setrans" | Sem BUI: soma das integrais (Regras §4) | 14,65 (a conferir) | 29,30 (a conferir) | Pendente: tarifa de SG a conferir |
| j | Só trem | Tarifa do trem (Regras §7) | 7,60 | 15,20 | Confirmado |
| k1 | Trem + metrô, BUI elegível | Integração BUI (Regras §5) | 9,40 | 18,80 | Confirmado |
| k2 | Trem + metrô, sem BUI | Soma: 7,60 + 7,90 (Regras §7) | 15,50 | 31,00 | Confirmado |
| l | Três conduções, com BUI | Duas primeiras pela integração, a terceira à parte (Regras §4) | 9,40 + terceira | 18,80 + 2 × terceira | Pendente: depende de qual é a terceira |
| m | Só ônibus municipal do Rio (Jaé) | Tarifa do Jaé | 5,00 (a conferir) | 10,00 (a conferir) | Pendente: tarifa a conferir |

### Detalhes e observações de cada exemplo

**a)** O ônibus municipal de Niterói custa R$ 5,60 de tarifa integral. O R$ 4,45 que o BUN cobra na catraca é subsídio e **não** é a base do VT (Regras §3). Um ônibus por sentido: 5,60 × 2 = 11,20.

**b)** Pela integração do BUN, quem pega dois ônibus de linhas diferentes, no mesmo sentido, com até 1 hora entre as validações, paga uma tarifa. Vale até 2 vezes ao dia, ida e volta (Regras §3). Exige cartão vinculado ao CPF. Resultado: 5,60 por sentido, 11,20 por dia.

**c)** Sem a prova do BUN, a integração não pode ser presumida. A base é a soma das duas tarifas: 5,60 + 5,60 = 11,20 por sentido, 22,40 por dia. O sistema marca "pendente: conferir BUN". Se o BUN for confirmado, o valor cai para 11,20 por dia.

**d)** A linha 484M custa R$ 7,10 (Regras §6). Direta, é mais barata que o BUI de R$ 9,40. Não se usa BUI aqui. 7,10 × 2 = 14,20.

**e)** A linha 483M custa R$ 9,10 (Regras §6). Também é menor que 9,40, então não se usa BUI. 9,10 × 2 = 18,20.

**f)** A linha 100D custa R$ 10,40 (Regras §6). A base é a tarifa integral da linha: 10,40 × 2 = 20,80. O BUI poderia reduzir a cobrança na catraca, mas **a Regras (§2 e §10) diz que não há orientação que permita usar essa redução como base patronal quando não há baldeação**. Fica pendente até decisão do DP/jurídico. O sistema não aplica o BUI sozinho.

**g)** Exemplo ilustrativo: uma linha intermunicipal de R$ 9,10 mais um ônibus municipal de São Gonçalo (R$ 5,55, a conferir). A soma seria 14,65. O BUI integrado custa 9,40 por viagem integrada e é menor, então vale (Regras §4: "R$ 9,40 por viagem integrada"). Requisitos que o sistema precisa ter provado: cartão Personalizado Usuário, BUI ativo, até 2 serviços elegíveis, até 3 horas entre eles (Regras §4). Se o BUI não fosse menor que a soma, vale a soma (Regras §4: não escolher BUI quando a alternativa comum for mais barata).

**h)** O BUI **não** cobre o ônibus municipal de Niterói (Regras §4, exceção). Então somam-se: 536R (R$ 9,10, Regras §11) + linha 35 (R$ 5,60) = 14,70 por sentido, 29,40 por dia. No caso real do Alcemir (Regras §11) existe a alternativa 62 + 39A pelo Centro, que custa R$ 11,20 por sentido sem BUN, ou R$ 5,60 por sentido com BUN ativo. A 536R + 35 é a mais rápida, não a mais barata. **A escolha da rota é humana**: o RH confirma qual a pessoa realmente faz, depois de conferir desembarque, caminhada, horário e situação do BUN (Regras §11). A mais barata não é necessariamente a real.

**i)** Com BUI suspenso, não há integração. Soma das integrais: 9,10 + 5,55 = 14,65 por sentido, 29,30 por dia. Como o R$ 5,55 do ônibus municipal de São Gonçalo não está no documento de Regras, o sistema marca "tarifa a conferir" até a gestora confirmar. Nota: "Suspenso Setrans" pode ter causas diferentes de renda, como idade ou uso indevido (Regras §4). O RH deve consultar o motivo.

**j)** O trem custa R$ 7,60 (Regras §7). 7,60 × 2 = 15,20 por dia. **Hoje o bilhete TREM do catálogo cobra R$ 15,80**, que é preço de metrô, então paga R$ 0,60 a mais por dia.

**k)** Com BUI elegível, trem + metrô é uma integração de R$ 9,40 (Regras §5): 18,80 por dia. Sem BUI, soma-se 7,60 (trem) + 7,90 (metrô) = 15,50 por sentido, 31,00 por dia (Regras §7). Atenção: o MetrôRio tem janela de 120 minutos, não 3 horas (Regras §5).

**l)** Com BUI, a integração cobre **duas** conduções (Regras §4). A terceira é cobrada à parte, pela tarifa dela. O sistema calcula 9,40 + tarifa da terceira, e deixa pendente se a tarifa da terceira não estiver na fonte.

**m)** Ônibus municipal comum do Rio usa o cartão Jaé (Regras §5). A tarifa não está no documento de Regras. O cadastro de tarifas do sistema traz R$ 5,00 (fonte Jaé, consultada em 14/11/2026). Fica **a conferir** pela gestora antes de valer.

### Observação geral sobre os exemplos
Nenhum número do pedido foi alterado: todos bateram com as Regras. Os dois valores que não estão nas Regras (R$ 5,55 e R$ 5,00) estão marcados "a conferir".

---

## 6. Pontos que a regra NÃO decide

Estes casos ficam **pendentes** até alguém com autoridade decidir. O sistema não escolhe por conta própria (Regras §10).

1. **BUI direto, sem baldeação.** Quando uma linha intermunicipal sozinha é reduzida pelo BUI, não há orientação clara se essa redução conta como integração ou como desconto social para a base da empresa (Regras §2). Decide: DP/jurídico ou Riocard.
2. **Pacote Plena × cotação de catraca.** Quando o valor que a Plena já paga é diferente do que a regra calcula, qual vale? Decide: a gestora.
3. **Reajuste no meio do mês.** Se a tarifa muda no dia 15, o mês é dividido em dois preços ou vale um só? Decide: a gestora.
4. **Posto real para crédito fora da carga.** Quando a pessoa trabalha num dia que não estava na carga, qual evidência prova o posto onde ela esteve? Decide: a gestora.
5. **Compra do Riocard por CNPJ.** Comprar separado por CNPJ ou por empresa. Decide: a gestora com a Riocard.
6. **Modelo físico e lógico dos cartões.** Qual modelo de cartão a Plena realmente usa (Personalizado Usuário ou Empresa). "Comprado pela empresa" não quer dizer "Personalizado Empresa" (Regras §3). É conferência cadastral, na Riocard, pessoa a pessoa.

---

## 6A. Tarifa por linha (aprovado pela gestora em 18/11/2026)

As linhas que vêm de São Gonçalo (e de Itaboraí e Maricá) para Niterói **não têm um valor único**. A regra exige "identificar linha, variante e seção antes do preço" (Regras §6). Exemplos: 484M R$ 7,10; 483M e 492M R$ 9,10; 100D R$ 10,40.

Como o módulo novo trata isso:

1. **Tabela completa do DETRO.** As linhas de interesse da operação são cadastradas a partir da Portaria DETRO/PRES 1.960/2026 (Regras §6, §11), com linha, variante, seção, valor, fonte e data de vigência. A extração é feita uma vez e **conferida por uma pessoa** antes de valer.
2. **Linha e valor visíveis em cada trajeto.** Ex.: "Ida: 483M (R$ 9,10) · Volta: 483M (R$ 9,10)".
3. **Linha fora da tabela não ganha preço.** Vira pendência com o nome da linha ("tarifa da linha 4xxM a conferir"). Nunca se usa "valor médio de São Gonçalo".
4. **Linha direta acima de R$ 9,40** recebe o aviso de que o BUI pode reduzir a catraca, mas a base da empresa segue a pendência do DP/jurídico (Regras §2, §10).
5. **Reajuste:** cada valor tem data de início; a carga usa o valor vigente no dia trabalhado.

---

## 6B. Onde o Jev ajuda e onde ele não entra (aprovado pela gestora em 18/11/2026)

O Jev (TypeSafe) é um serviço que classifica e ordena itens e diz o quanto está seguro da resposta. Ele serve para **acelerar a revisão**, nunca para decidir dinheiro.

**Onde ajuda:**
- **Ordenar a fila "Rotas a confirmar":** os trajetos com mais chance de estarem errados aparecem primeiro.
- **Casar o nome da linha do Google com a tabela do DETRO** ("483 M Jardim Catarina" → 483M). Só casa sozinho com segurança alta; o resto vai para "conferir".
- **Pré-marcar a alternativa de rota mais provável** como sugestão. O clique de confirmar continua humano.

**Onde não entra:**
- Não calcula valor: o preço sai sempre da regra, igual para todos.
- Não confirma rota nem grava casamento por palpite (mesma regra do CEU).
- Se o Jev estiver fora do ar, o módulo funciona normalmente, só sem a ordenação.

**Dados enviados (autorização da gestora em 18/11/2026):** somente dados de linhas — código e nome da linha, operadora, pontos de embarque/desembarque, horários e valores. **Nunca** nome, CPF, matrícula ou endereço de colaborador (LGPD). A chave da API fica no servidor (Edge Function), nunca no navegador. As respostas são guardadas para não consultar de novo a cada abertura de tela.

---

## 7. Telas do módulo novo

Só três.

### Rotas a confirmar
- Fila das pessoas com rota não confirmada.
- A sugestão do Google já vem pronta, por sentido (ida e volta separadas).
- Um clique para confirmar a rota escolhida.
- O motivo da pendência fica sempre visível ("cartão não conferido", "BUN sem vínculo", "tarifa a conferir").
- O preço calculado aparece junto, com a regra aplicada.

### Carga do mês
- Duas listas: **prontos** e **pendentes**. Cada pendente mostra o motivo.
- Nunca aparece R$ 0 escondido. Se o valor é zero de verdade (afastado o mês inteiro), a tela diz isso por escrito.
- A gravação é conferida no banco: a tela relê e mostra "gravado: N pessoas".
- Desconto e crédito do fechamento anterior entram e aparecem na linha da pessoa.

### Fechamento
- Compara a carga com o ponto, como hoje.
- Mostra falta comprovada (desconta), dia trabalhado fora da carga (credita) e dias "não conferidos".
- O resultado vai para a carga do mês seguinte.

---

## 8. Como fazer sem risco

1. **Especificação com exemplos aprovada.** Este documento. A gestora confere a seção 5 e responde a seção 9.
2. **Motor de cálculo.** Escrever a regra em código com **um teste automático por exemplo** (a até m). Cada exemplo vira uma prova de que o sistema calcula o que está neste documento.
3. **Telas.** As três da seção 7.
4. **Dezembro em paralelo.** Rodar o novo caminho ao lado da planilha e do módulo antigo. Comparar **pessoa a pessoa**. Cada diferença precisa ser explicada por uma regra. Diferença sem explicação é erro a corrigir antes de seguir.
5. **Só então desligar o antigo.** Os dados antigos continuam disponíveis para consulta.

**Tarefa operacional inevitável:** confirmar a rota de cerca de **245 trajetos** e conferir, na Riocard, o **modelo do cartão de cada pessoa**. Nenhum código substitui essa conferência. Sugestão: começar pelos casos com sinal de problema (cerca de 100) e pelos 36 que têm a maior diferença contra a planilha.

---

## 9. O que preciso que a gestora confira

1. Os exemplos da seção 5 batem com a regra que você conhece? Algum valor está errado?
2. Os dois valores marcados "a conferir" estão certos: **R$ 5,55** (ônibus municipal de São Gonçalo) e **R$ 5,00** (ônibus municipal do Rio, Jaé)?
3. Faltam casos reais da operação como exemplo? Por exemplo: barcas (Regras §3 e §5), VLT, linhas executivas, quem faz mais de uma viagem ida e volta por dia.
4. Você concorda com a regra "modelo do cartão não conferido = sem BUI", mesmo que isso aumente o valor enquanto a conferência não é feita?
5. Você concorda que, durante a transição, quem ainda não tem rota confirmada continue com o valor atual, marcado "não conferido"?
6. Dos seis pontos da seção 6, algum você já consegue decidir agora?

### Respostas da gestora (18/11/2026)

1. **Exemplos:** aprovados, com a ressalva de que o valor das linhas intermunicipais vem da tabela por linha (seção 6A), não de um valor único.
2. **Modelo do cartão:** aprovado "não conferido = sem BUI". A situação do BU é lida no site da Riocard e **atualizada mensalmente** (importação já existente, `scripts/vt/importar-riocard-bu.ts`). Pela regra, o BUI só é habilitado em Expresso ou VT Personalizado Usuário (Regras §4), então "BU ativado" na Riocard já indica cartão de modelo habilitável; "Suspenso", "Desativado", "Não possui" ou sem consulta = sem BUI.
3. **Transição:** aprovado — sem rota confirmada, segue o valor atual marcado "não conferido".
4. **Tabela de tarifas:** começar pelas linhas DETRO que chegam a Niterói (São Gonçalo, Itaboraí, Maricá); as linhas e modais do Rio de Janeiro entram depois, para os colaboradores que moram ou trabalham lá.
