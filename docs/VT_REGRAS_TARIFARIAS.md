# VT — Matriz de regras tarifárias e pendências

> Revisada em 14/11/2026 após pesquisa principal, duas validações independentes e confronto das divergências com a página atual do Rio Bilhete Único. Esta matriz separa fato oficial, regra operacional da Plena e pontos ainda não decididos. Ela não autoriza alteração automática de trajetos ou valores.

## 1. Três valores que não podem ser misturados

1. **Cobrança na catraca:** o que o passageiro paga ao usar os serviços.
2. **Base legal do VT:** o valor que a empresa calcula para o deslocamento residência–trabalho.
3. **Pacote operacional Plena:** o bilhete com valor diário que a operação decidiu carregar.

O simulador de catraca informa e questiona. A política confirmada pela Plena decide o pacote carregado.

## Política da empresa: integração presumida (19/11/2026)

> **Isto é política da empresa, não regra tarifária.** As regras das seções 3 a 7 continuam descrevendo o que vale na catraca; esta seção diz como a Plena decide calcular o VT.

Decisão da gestora, 19/11/2026: *"O colaborador tem que ter o BU com integração. Se não tem, precisa regularizar a situação. A integração é um direito da empresa, para pagar menos o VT do colaborador. Temos que saber se o BUI está ativo ou não, para comunicar ao colaborador e dizer que vamos pagar como se ele tivesse, com algumas exceções, que são prerrogativa da empresa."*

- **Padrão (integração presumida):** o motor (`src/lib/vt/motor/`) calcula sempre com a integração BUN e BUI disponível, como se o cartão estivesse ativo, qualquer que seja a situação na Riocard: Ativado, Suspenso Setrans, Não possui BU, Desativado, Ativação Solicitada ou não consultado. Essas situações deixam de gerar pendência de cartão e não levam mais à tarifa cheia.
- **O resto da regra continua valendo.** A política presume só o cartão. Continuam valendo a janela de tempo (BUN 1 h, BUI 3 h, MetrôRio 120 min), linhas diferentes, o máximo de duas conduções por integração, a combinação descrita na regra. O par intermunicipal + ônibus municipal de Niterói integra pelo BUI (§4, regra de 24/11/2026; antes era a "exceção de Niterói", substituída). Combinação não descrita continua pendente.
- **Aviso, não pendência:** quando a situação na Riocard é diferente de "Ativado", o resultado traz `regularizarCartao = true`, com um texto simples para o colaborador. Exemplo: *"Seu Bilhete Único consta como Suspenso Setrans na Riocard. O VT é calculado com a integração; regularize seu cartão para não pagar a diferença."* O valor não fica pendente por isso.
- **Exceção por pessoa (prerrogativa da empresa):** "Pagar tarifa cheia" (`colaboradores.vt_tarifa_cheia`, migration 174). Exige motivo e registra quem marcou e quando. Só quem gerencia o VT (`vt.gerenciar`) marca, na aba VT → Colaboradores. Com a exceção, o motor cobra a tarifa integral de cada condução, sem avaliar nenhuma integração. Também não gera pendência de cartão nem a pendência "BUI direto", porque a decisão já foi tomada pela empresa. As pendências da própria tarifa continuam valendo, como linha desconhecida, seção ambígua ou tarifa a conferir.
- **O que já foi gravado não muda.** Cargas, lotes e evidências salvas guardam o cálculo da época (`calculoMotor`). A política vale só para cálculos novos, e a evidência nova registra a política usada (`calculoMotor.cartao.politicaIntegracao`).

## 2. Legislação federal do VT

**Fato oficial:** a [Lei 7.418/1985](https://www.planalto.gov.br/ccivil_03/leis/l7418.htm) e o [Decreto 10.854/2021, arts. 107, 112, 114–117 e 124–125](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/d10854.htm) estabelecem:

- VT para o deslocamento residência–trabalho–residência, inclusive com mais de um meio.
- Quantidade e tipo adequados ao deslocamento informado.
- Cálculo pela tarifa integral, mesmo quando existe desconto local.
- **Reduções decorrentes de integração de serviços não são consideradas desconto** e podem ser consideradas no cálculo.
- Participação do empregado, em regra, até 6% do salário básico, com as regras de proporcionalidade e opção previstas nos arts. 114–117.

**Pendência jurídica:** quando o BUI reduz uma única linha intermunicipal, sem transbordo, não localizamos orientação específica que classifique essa redução como integração ou desconto social para a base patronal. Não automatizar essa substituição antes de decisão do DP/jurídico ou orientação formal da Riocard.

## 3. Niterói — BUN e tarifa municipal

### Elegibilidade e cartão

**Fato oficial:**

- Não exige residência em Niterói nem declaração de renda.
- Exige cartão Riocard Mais vinculado ao CPF.
- BUN e BUI podem coexistir no mesmo Riocard.
- O VT Personalizado Usuário pode receber benefícios tarifários. “Comprado pela empresa” não é sinônimo de “Personalizado Empresa”; é necessário conferir o modelo real.

Fontes: [não morador](http://www.riocardmais.com.br/duvidas-frequentes/nao-sou-morador-de-niteroi-posso-utilizar-o-beneficio-do-bilhete-unico-niteroi-1146.html), [declaração de renda](http://www.riocardmais.com.br/duvidas-frequentes/para-ter-o-bilhete-unico-niteroi-preciso-declarar-minha-renda-1145.html), [BUN](http://www.riocardmais.com.br/BUN), [BUN+BUI](http://www.riocardmais.com.br/duvidas-frequentes/possuo-outro-cartao-habilitado-para-bilhete-unico-intermunicipal-bui-e-sou-morador-de-niteroi-preciso-trocar-de-cartao-para-ter-o-bilhete-unico-niteroi-bun-1148.html) e [produto VT](http://www.riocardmais.com.br/produto/vale-transporte).

### Habilitação automática do BUN (conferido em 18/11/2026)

**Fato, por duas fontes independentes de 26/11/2024 que reproduzem o comunicado do lançamento:**

- Quem já está cadastrado no **BUI** "não precisa fazer nada": o Riocard Mais "já estará automaticamente habilitado para o Bilhete Único de Niterói".
- Cartões **Vale-Transporte vinculados ao CPF (personalizado usuário)** "também estão automaticamente habilitados".
- **Não podem ser habilitados:** cartão Empresarial, Vale-Transporte ao portador, tipo empresa sem CPF e Cartão Digital.

Fontes: [Diário do Transporte](https://diariodotransporte.com.br/2024/11/26/passageiros-ja-podem-habilitar-o-bilhete-unico-de-niteroi-para-manter-tarifa-reduzida/) e [Super Rádio Tupi](https://www.tupi.fm/rio/confira-como-habilitar-o-bu-de-niteroi-no-riocard-mais-e-garantir-o-subsidio-na-tarifa-de-transporte/). As páginas oficiais da Riocard Mais e do Rio Bilhete Único recusaram acesso automatizado (HTTP 403) em 18/11/2026; reconferir nelas quando possível. O guia da Riocard Mais para empresas cita a consulta/solicitação em **Portal da empresa → Usuários → Gerenciar Bilhete Único** (liberação em até 48 h).

**Regra operacional derivada (para o cálculo):**

- BU **Ativado** no arquivo da Riocard ⇒ cartão habilitado ao BUI ⇒ **BUN habilitado**.
- **Suspenso Setrans** ⇒ o cartão foi cadastrado no BUI, portanto é vinculado ao CPF; o BUN não depende de renda, então é **provável**, mas não comprovado pelo arquivo — conferir no Portal da empresa antes de aplicar a integração BUN.
  - **Confirmado em 19/11/2026 (1 caso real, consulta pública por CPF no site da Riocard Mais, "Consultar Disponibilidade de Bilhete Único por CPF"):** a mesma consulta mostrou "Situação atual do Bilhete Único Intermunicipal: Suspenso Setrans (Motivo: 7)" e, no bloco "Bilhete Único Municipal de Niterói", "Situação do Bilhete Único Niterói: **Habilitado**". Ou seja: **BUI suspenso não derruba o BUN**. Os dois benefícios têm situações independentes. Amostra de 1 caso: conferir mais alguns antes de tratar como regra geral. O significado dos códigos de "Motivo" não está documentado aqui.
- **Não possui BU / Desativado / sem consulta** ⇒ BUN **não comprovado**. Até 18/11/2026 isso levava à tarifa integral com pendência; **desde 19/11/2026 vale a "Política da empresa: integração presumida"** (calcula com integração e avisa o colaborador para regularizar), salvo exceção "tarifa cheia" por pessoa.

### Integração ônibus–ônibus

**Fato oficial:**

- Dois ônibus/micro-ônibus municipais convencionais de **linhas diferentes e no mesmo sentido**.
- Até **1 hora entre validações**.
- Benefício até **2 vezes ao dia**, normalmente ida e volta, com intervalo mínimo de 1 hora entre elas.
- Mesma linha ou sentidos incompatíveis não caracterizam integração.
- Após esgotar o limite, viagens adicionais cobram tarifa cheia.

Fontes: [BUN](https://site.riobilheteunico.com.br/bilhete-unico-niteroi/), [intervalos](https://www.riocardmais.com.br/duvidas-frequentes/qual-o-tempo-de-intervalo-para-realizar-a-integracao-do-bilhete-unico-niteroi-bun-1149.html) e [limite diário](https://www.riocardmais.com.br/duvidas-frequentes/quantas-vezes-por-dia-meu-cartao-pode-fazer-a-integracao-do-bilhete-unico-niteroi-bun-1152.html).

### Valores

- **Com o Bilhete Único de Niterói (BUN) habilitado: R$ 4,45** por viagem no ônibus municipal de Niterói, e R$ 4,45 no total na integração de dois ônibus municipais (linhas diferentes, mesmo sentido, até 1 hora entre embarques).
- **R$ 5,60**: pagamento em dinheiro, cartão não habilitado e a exceção por pessoa "tarifa cheia" (cada ônibus a R$ 5,60, sem integração).
- **Limite de 2 viagens com desconto por dia por pessoa** (normalmente ida e volta). A partir da 3ª viagem **paga** em ônibus municipal de Niterói no dia, a tarifa é R$ 5,60. O motor confere o dia inteiro (ida + volta, em ordem de embarque); a integração de dois ônibus conta como uma viagem.
- **Decisão da gestora (19/11/2026):** o VT da Plena usa **R$ 4,45** no ônibus municipal de Niterói com BUN. A frase anterior deste documento ("base legal do VT da Plena: R$ 5,60 por sentido, pois R$ 4,45 é subsídio/desconto social") **estava errada e foi retirada**: a Lei municipal 3.887/2024 institui o subsídio para "reduzir o valor das tarifas pagas pelo usuário", limitado a 2 viagens por dia por usuário, com cartão cadastrado e habilitado. A lei não exclui o vale-transporte; só veda acumular a **gratuidade** com o VT.
- Constantes no código: `TARIFA_NITEROI_BUN` (R$ 4,45, limite de 2 viagens/dia, vigência e fonte) e `onibus_municipal_niteroi` (R$ 5,60) em `src/lib/vt/motor/tarifas.ts`. Evidências e cargas já gravadas guardam o `calculoMotor` da época e **não são recalculadas**.
- **CONFIRMADO por pesquisa com usuários (gestora, 21/11/2026):** quem pega 1 ônibus, ou 2 ônibus municipais no mesmo sentido, paga **R$ 4,45**. O extrato formal de um cartão VT seria a prova definitiva, mas não é mais pendência para usar o valor.
- **Origem do R$ 5,60 (pesquisa de 21/11/2026):** é a tarifa em **dinheiro** desde 06/07/2025 (reajuste por decisão judicial, de R$ 5,15 para R$ 5,60). Também paga R$ 5,60 quem tem cartão **não habilitado** no BUN.
  - **Habilitação automática:** quem tem o BUI e os cartões Vale-Transporte vinculados ao CPF ("Personalizado Usuário"). Cartão VT tipo **EMPRESA** não vinculado ao CPF precisa de cadastro feito pelo empregador — provável origem do relato "de boca" de que 2 ônibus custam R$ 5,60.
  - **Outras situações de tarifa cheia:** 3ª viagem paga no dia (limite de 2 com desconto); segundo ônibus fora da janela de 1 hora; segundo ônibus da mesma linha.
  - **Limite de 60 viagens por mês: FECHADO (parecer de 21/11/2026).** Vale **só para quem tem gratuidade** (Lei 3.887/2024, art. 7º, §1º). **Não vale para o VT.** Não há limite mensal a implementar.
  - **Integração entre consórcios diferentes: CONFIRMADA** (parecer de 21/11/2026). A integração BUN vale entre empresas diferentes (Transnit × Transoceânico): Lei 2.851/2011, art. 7º ("um ou mais operadores").
  - **A integração de 2 ônibus conta como 1 viagem** do limite de 2 por dia (Lei 2.851/2011, arts. 5º e 7º) — já é como o motor calcula.
  - **Outras situações de R$ 5,60 (parecer):** cartão VT do tipo empresa/ao portador (sem CPF), cartão Empresarial ou Cartão Digital; e benefício ativo em **outro cartão do mesmo CPF** (por exemplo, um cartão particular).
- **Exceção "pagar tarifa cheia" (confirmado 21/11/2026):** é raríssima. Todos são tratados como quem usa integração (política presumida); quem não está "Ativado" na Riocard, ou nunca foi consultado, recebe o aviso genérico para regularizar o cartão.

Fontes da pesquisa de 21/11/2026: [Prefeitura de Niterói — tarifa reduzida](https://niteroi.rj.gov.br/prefeitura-mantem-tarifa-reduzida-para-usuarios-do-bilhete-unico-municipal/), [Estação Rio (07/07/2025)](https://estacaorio.com/2025/07/07/tarifa-de-onibus-em-niteroi-sobe-para-r-560/), [Moovit — habilitação do BUN](https://moovit.com/pt/blog/bilhete-unico-de-niteroi-saiba-como-garantir-subsidio-na-tarifa-no-riocard/), [Diário do Transporte (26/11/2024)](https://diariodotransporte.com.br/2024/11/26/passageiros-ja-podem-habilitar-o-bilhete-unico-de-niteroi-para-manter-tarifa-reduzida/amp/), [Lei 2.851/2011](https://urbanismo.niteroi.rj.gov.br/anexos/Mobilidade/Lei%20Ordin%C3%A1ria%202851%202011%20Bilhete%20Municipal.pdf) e [Cidade de Niterói](https://cidadedeniteroi.com/transito/quanto-custa-a-passagem-de-onibus-em-niteroi/).

Fontes: [Lei municipal 3.887/2024](https://urbanismo.niteroi.rj.gov.br/anexos/Mobilidade/Lei%20Ordin%C3%A1ria%203887%202024%20Subs%C3%ADdio%20Tarif%C3%A1rio-TPCO.pdf), [Prefeitura de Niterói (04/07/2025)](https://niteroi.rj.gov.br/prefeitura-mantem-tarifa-reduzida-para-usuarios-do-bilhete-unico-municipal/), [Portal Flumibuss (jul/2025)](https://portalflumibussrj.com.br/2025/07/06/niteroi-reajusta-passagem-de-onibus-para-r-560-mas-mantem-valor-do-bilhete-unico-em-r-445-a-partir-deste-domingo-06/), [guia Cidade de Niterói (consultado em 02/11/2026: "integração entre dois ônibus municipais pagando uma única tarifa de R$ 4,45")](https://cidadedeniteroi.com/transito/quanto-custa-a-passagem-de-onibus-em-niteroi/) e [Riocard — tarifas](http://www.riocardmais.com.br/Tarifas).

### Barcas

Existe integração BUN com barcas, com pontos e tarifas próprios; não é simplesmente “a segunda condução é grátis”. A tabela atual da Riocard informa:

- Municipal de Niterói + Araribóia/Praça XV: **R$ 5,45**.
- Municipal de Niterói + Charitas: **R$ 8,15**.

A tabela e a vigência devem ser consultadas antes de automatizar.

- **Divergência FECHADA (parecer de 21/11/2026): ônibus + barca Araribóia pelo BUN = R$ 5,45.** A fórmula é *ônibus (R$ 4,45) + barca (R$ 5,00, desde fev/2026) − R$ 4,00 de subsídio* (Decreto municipal 13.413/2019). O R$ 5,15 do Portal Flumibuss era do tempo em que a barca custava R$ 4,70. **Charitas: R$ 7,70 na barca e R$ 8,15 com ônibus.** Fonte: [Mobilidade Niterói](https://www.urbanismo.niteroi.rj.gov.br/mobilidade.html).
- Barca com ônibus de Niterói e ônibus/VLT do Rio são 3 conduções: cotar BUN ônibus+barca (R$ 5,45) + Jaé (R$ 5,00); nunca aplicar BUN e BUI na mesma barca (não confirmado).

## 4. BUI — Bilhete Único Intermunicipal

### Elegibilidade e habilitação

**Fato oficial, pela página atual do programa:**

- Idade de **6 a 64 anos completos**.
- Residência no Estado do RJ.
- Renda mensal total declarada **inferior ou igual a R$ 3.205,20**.
- Um cartão por CPF, pessoal e intransferível.
- Cartões Expresso ou **VT Personalizado Usuário**. Personalizado Empresa/Ao Portador não habilita.
- No VT vinculado à empresa, o empregador declara a renda e habilita.
- Situação atual deve ser consultada; “Suspenso Setrans” pode decorrer de idade, renda ou uso indevido, não apenas renda.

Fontes: [Rio Bilhete Único — BUI](https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/), [modelos habilitáveis](http://www.riocardmais.com.br/duvidas-frequentes/o-que-e-o-bilhete-unico-intermunicipal-bui-1181.html), [habilitação pelo empregador](http://www.riocardmais.com.br/duvidas-frequentes/como-habilitar-o-bilhete-unico-intermunicipal-em-um-cartao-1131.html) e [suspensão](http://www.riocardmais.com.br/aplicativo-riocard-mais/habilitar-bilhete-unico-intermunicipal-no-app/o-que-significa-a-mensagem-bui-suspenso-setram-1513.html).

Páginas antigas divergem sobre idade e “inferior” versus “inferior ou igual”. Para novos desenvolvimentos, vale a página atual do programa; casos-limite continuam sujeitos à consulta real do cartão.

### Uso e cobrança

- Até **2 meios/serviços por viagem**, pelo menos um intermunicipal.
- Até **3 horas entre transbordos**, ressalvadas janelas específicas do produto/modal.
- Até **2 usos ao dia**, normalmente ida e volta, com intervalo mínimo de 1 hora.
- Mesma linha não caracteriza integração; serviços devem ser elegíveis e convencionais.
- Valor vigente: **R$ 9,40 por viagem integrada**, desde 19/12/2025, não “por condução física”.
- A terceira condução não está coberta pela mesma integração e exige cálculo separado.
- Não escolher BUI automaticamente quando a alternativa comum for mais barata ou a soma não justificar o benefício.

Fontes: [BUI atual](https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/), [intervalos](http://www.riocardmais.com.br/duvidas-frequentes/qual-o-tempo-de-intervalo-para-realizar-a-integracao-do-bui-1142.html), [limite diário](http://www.riocardmais.com.br/duvidas-frequentes/quantas-vezes-por-dia-meu-cartao-pode-fazer-a-integracao-do-bilhete-unico-intermunicipal-bui-1139.html) e [tarifas](http://www.riocardmais.com.br/Tarifas).

### Niterói e o BUI — REGRA ALTERADA em 24/11/2026 (comprovada por extrato)

**Vale hoje:** ônibus intermunicipal (DETRO) + ônibus municipal de Niterói **integram pelo BUI**: 2 conduções, janela de até 3 h, **total R$ 9,40 por sentido**, nos dois sentidos. O 1º ônibus cobra a tarifa dele e o 2º cobra o que falta até R$ 9,40. Niterói + Niterói continua pelo BUN (R$ 4,45 total em até 1 h). O BUI só compensa quando a soma cheia passa de R$ 9,40. Combinações de Niterói com outros modais (barca, SG municipal, Rio) seguem sem evidência de integração e são cobradas à parte.

**Fonte (decisão da gestora, 24/11/2026):** dois extratos reais do Riocard Mais de colaboradores (nov/2026; arquivos em `dados-locais`: extrato completo da conta 01.04.11914442-5-2 de 23/11/2026 e imagem de WhatsApp de 24/11/2026). Casos (intermunicipal R$ 7,10 + Niterói R$ 2,30, ou Niterói R$ 4,45 + intermunicipal R$ 4,95):

| Data | Viagem |
|---|---|
| 16/11 | 515M 06:08 R$ 7,10 → linha 30 (Niterói) 08:09 R$ 2,30 |
| 17/11 | linha 30 15:15 R$ 4,45 → 515M 17:18 R$ 4,95 |
| 18/11 | 33 18:53 R$ 4,45 → 532M 19:26 R$ 4,95 |
| 19/11 | 515M 06:02 R$ 7,10 → 30 07:53 R$ 2,30; 45 16:29 R$ 4,45 → 519M 18:42 R$ 4,95 |
| 20/11 | 403M 12:44 R$ 7,10 → 30 13:33 R$ 2,30 |
| 23/11 | 38A 22:10 R$ 4,45 → 403M 22:22 R$ 4,95 |

**Ressalvas registradas (não viram regra de código):**

- Antes de 16/11 a mesma pessoa **não** integrava; o BUI provavelmente foi ativado por volta de 16/11.
- Em 17/11, 05:50 515M → 08:44 linha 30 (2 h 54) **não integrou**, sem explicação (dentro das 3 h). Fica como ressalva; não há regra para isso no motor.
- Esta regra **contraria o texto da página do programa** transcrito abaixo (conservado como histórico). Se a Riocard voltar a aplicar a exceção, rever.
- O extrato também confirmou regras já existentes: BUN entre 2 ônibus de Niterói em menos de 1 h (67 13:56 R$ 4,45 → 17 14:22 R$ 0,00) e 3ª viagem municipal de Niterói no dia a R$ 5,60 (06/11, OC2).

**Histórico — SUBSTITUÍDO em 24/11/2026.** Texto anterior da página do BUI: *"Válido para todos os ônibus municipais que integram o sistema de bilhetagem Riocard, exceto os ônibus municipais de Niterói, cuja integração é feita exclusivamente pelo BUN."* Com base nele, o sistema presumia que intermunicipal + municipal de Niterói nunca integrava pelo BUI (ex.: 491M + 33 = R$ 13,55 por sentido; passa a R$ 9,40).

Fonte do texto antigo: [Rio Bilhete Único — BUI](https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/).

## 5. Rio de Janeiro — Jaé, Riocard+BUI e modais

**Regra segura:**

- Somente transporte municipal comum do Rio: **Jaé**.
- Intermunicipal + municipal dentro de integração BUI válida: **Riocard+BUI**, sem acrescentar Jaé automaticamente.
- Sem BUI, combinando modal estadual/intermunicipal com municipal do Rio: podem ser necessários **Riocard + Jaé**, com tarifas separadas.
- BUC municipal segue regras próprias do Jaé, distintas do BUI.

O [MetrôRio](https://www.metrorio.com.br/jaeouriocard) informa que BUI/Tarifa Social continuam no Riocard e que pode ser necessário usar Riocard e Jaé conforme o trajeto.

### Exceções e janelas específicas

Pela página de [meios e tarifas do MetrôRio](https://www.metrorio.com.br/como-pagar/meios-e-tarifas):

- Integrações com modais intermunicipais: Riocard+BUI.
- Integrações com ônibus municipal: Jaé ou Riocard+BUI, conforme o produto.
- Integrações Metrô+BRT/van: somente Jaé.
- Janela das integrações publicadas pelo MetrôRio: **120 minutos**, não a janela genérica de 3 horas.

A tabela atual da Riocard prevê, com BUI, **R$ 9,40** para:

- Ônibus intermunicipal + ônibus municipal da RM, **inclusive Niterói** (a antiga exceção de Niterói foi substituída em 24/11/2026 — ver §4).
- Intermunicipal + barcas.
- Intermunicipal + metrô ou trem.
- Trem + metrô.
- Trem + ônibus municipal.
- VLT + ônibus intermunicipal ou barcas.

Fonte: [Riocard — tarifas](http://www.riocardmais.com.br/Tarifas).

## 6. São Gonçalo, Itaboraí, Maricá e Niterói

**Não existe uma tarifa única para todo o par.** A [Portaria DETRO/PRES 1.960/2026](https://www.sindpass.com.br/wp-content/uploads/2026/02/Portaria-DETRO-Reajuste-2026.pdf), vigente desde 15/02/2026, mostra exemplos:

| Linha/trecho | Tarifa comum |
|---|---:|
| 484M — Niterói–Alcântara via Tribobó | R$ 7,10 |
| 483M — Jardim Catarina–Niterói via Tribobó | R$ 9,10 |
| 492M — Niterói–Jardim Catarina via BR-101 | R$ 9,10 |

> **Correção (parecer de 21/11/2026):** a **100D é Niterói–Candelária (Rio de Janeiro)**, e não um trecho São Gonçalo↔Niterói; foi retirada desta tabela (Niterói–Candelária: R$ 10,40, DETRO). E a **linha 62 é municipal de Niterói** (Fonseca), não de São Gonçalo: o caso 62 + 39A é integração BUN Niterói–Niterói (§3).

Decisão:

- **Classificação municipal × intermunicipal pelo código da linha na tabela DETRO, nunca pela operadora que o Google informa.** O Google devolve linhas DETRO (ex.: 489M, 532M) com a operadora "Prefeitura de Niterói". Código de linha com sufixo de letra que consta na tabela DETRO é intermunicipal; o adaptador (`src/lib/vt/googleRoutes.ts`) aplica essa regra antes de olhar a operadora.
- **Ônibus municipal de São Gonçalo: R$ 5,55** desde 01/11/2025, **sem bilhete único municipal**. SG municipal + Niterói municipal **não integra** (R$ 10,00 na soma). Fonte: [Diário do Rio](https://diariodorio.com/passagem-de-onibus-em-sao-goncalo-sobe-de-r-395-para-r-555/).
- **Itaboraí (gratuito desde 23/05/2025) e Maricá (EPT "vermelhinho"): o ônibus municipal custa R$ 0.** O motor trata como modal `onibus_municipal_gratuito`, reconhecido por **lista explícita de operadoras conhecidas** (`OPERADORAS_MUNICIPAIS_GRATUITAS`); operadora fora da lista **não é presumida gratuita** — vira pendência. Gratuito + DETRO: cobra-se só o DETRO (ou a seção). **Toda linha com categoria AC na tabela DETRO** (começou com 2144R/4144R de Maricá; a auditoria de 21/11/2026 achou o BUI aplicado em 6144R, 2590R, 2520D, 2425D e 4425D): BUI **não presumido** — pendência `BUI_LINHA_AC_NAO_CONFIRMADA` (nem pares nem linha avulsa), até a Riocard/Setrans confirmar. Linhas de categoria "A" (ex.: 5721D, 7721D, 1413M, 1121Q) seguem com BUI, **a confirmar** com a Riocard.
- **Tarifa DETRO por seção.** A Portaria traz, para várias linhas, o valor do percurso inteiro (seção 0) e valores por **seção** (trecho). O preço depende de onde a pessoa embarca e desce. Exemplos: **416M** Niterói–Manilha R$ 15,10 (inteiro), Manilha–Tribobó R$ 7,10, **Alcântara–Niterói R$ 7,10**; **414M** R$ 15,10 e Morada do Sol–Tribobó R$ 7,10; **413M** seção Niterói–Manilha R$ 9,10. O motor **não escolhe a seção sozinho**: devolve a pendência `DETRO_SECAO_ESCOLHER` com as opções e valores, e a tela de revisão pede o "Trecho pago" por condução e por sentido (a volta pré-marcada herda o trecho da ida). A seção escolhida vai na evidência (`secaoDetro`/`secaoDetroRotulo` na perna e `calculoMotor.secoesDetro`) e, portanto, no hash. Registros de seção ilegíveis no PDF (200 linhas marcadas "conferir") não viram opção.
- Identificar linha, variante e seção antes do preço.
- Nas linhas de R$ 7,10 ou R$ 9,10, a tarifa direta é inferior ao BUI de R$ 9,40.
- Acima de R$ 9,40, o BUI pode reduzir a cobrança na catraca se elegível; a base patronal sem transbordo permanece pendente conforme §2.
- Com municipal de São Gonçalo + intermunicipal, pode haver BUI se todos os requisitos forem atendidos.
- Com municipal de Niterói + intermunicipal, aplicar o BUI (2 conduções, R$ 9,40 por sentido — regra de 24/11/2026, §4); Niterói + Niterói segue pelo BUN.

## 7. Trem, metrô, barca e VLT

A tabela atual da Riocard informa:

- **Trem: R$ 7,60.**
- **Metrô: R$ 7,90.**

Não tratar os dois como uma única tarifa. Não retornar “sem integração” antes de avaliar BUI/BUN e as exceções por estação/produto.

O bilhete operacional “TREM” da Plena precisa de revisão de preço e significado antes de qualquer alteração de dados.

## 8. Dados mínimos para automatizar uma sugestão

Por sentido e por perna:

- sequência, linha, variante, operadora e modal;
- serviço municipal/intermunicipal e categoria urbano convencional/executivo;
- origem, destino e sentido da viagem;
- embarque, desembarque e ponto de transferência;
- horários previstos de validação;
- tarifa e vigência;
- sistema tarifário e regras específicas do produto.

Da pessoa/cartão:

- modelo do cartão e vínculo ao CPF;
- situação BUI/BUN e data da consulta;
- disponibilidade de Jaé quando necessário;
- usos já realizados no dia, quando relevantes.

Sem os dados exigidos pela regra, o resultado é `parcial` ou `indeterminado`, nunca confiança alta.

## 9. Erros conhecidos do classificador legado

O antigo `src/lib/vt/classificarRota.ts` e seu teste foram removidos na limpeza estática. Estes erros conhecidos ficam registrados para não serem reintroduzidos:

- impõe BUI+Jaé indevidamente no Rio/VLT;
- retorna antes do BUI para trilhos e barcas;
- não trata a exceção do municipal de Niterói;
- generaliza tarifa de SG sem destino/linha;
- presume integração de Niterói sem linha, sentido e horário;
- mistura trem com metrô;
- avisa excedente BUI só acima de quatro pernas em vez de a partir da terceira;
- usa confiança alta sem evidência suficiente.

## 10. Pendências de decisão

- **Base de Niterói: R$ 4,45 (BUN) — DECIDIDO pela gestora em 28/11/2026.** Ônibus municipal de Niterói = R$ 4,45 por viagem, **R$ 8,90 por dia (ida e volta)**, não R$ 11,20. Não há mais pendência de jurídico a bloquear carga com R$ 8,90 (a dúvida levantada em 21/11/2026 sobre o Decreto 10.854/2021, art. 124, e a tarifa cheia de R$ 5,60 fica apenas como registro histórico em `docs/PARECER_VT_REGRAS_2026-11-21.md`). R$ 5,60 só na exceção "tarifa cheia" por pessoa. O mesmo raciocínio vale para a Tarifa Social de R$ 5,00 no metrô/trem.
- BUI direto sem transbordo na base patronal: DP/jurídico/Riocard.
- **Teto de renda do BUI (R$ 3.205,20): informado pela gestora em 21/11/2026 — todos os colaboradores da Plena ganham abaixo do teto**, então a presunção do BUI vale para todos. Quem passar a ganhar acima no futuro vira **tarifa cheia obrigatória** no trecho intermunicipal (não é exceção opcional): o CORH não guarda salário, então o DP precisa avisar.
- **Modelo do cartão VT: informado pela gestora em 21/11/2026 — todos os cartões VT da Plena são "Personalizado Usuário" (vinculados ao CPF).** Logo, "Suspenso Setrans" **não** é prova de renda acima do teto nem de modelo de cartão errado: tratar como **pendência de habilitação/uso**, a resolver pela empresa no Portal da Riocard (Usuários → Gerenciar Bilhete Único). O significado dos códigos de "Motivo" não tem tabela pública.
- Política quando pacote Plena e cotação de catraca divergirem: gestora.
- Reajuste no meio da competência: gestora.
- Evidência do posto real para crédito fora da carga: gestora.
- Compra Riocard separada por CNPJ/empresa: gestora/Riocard.
- Modelo físico/lógico dos cartões usados pela Plena: conferência cadastral.

Enquanto pendentes, esses casos ficam fora da confirmação automática.


## 11. Linhas DETRO conferidas em 16/11/2026

Fonte oficial: [Portaria DETRO/PRES 1.960/2026](https://www.sindpass.com.br/wp-content/uploads/2026/02/Portaria-DETRO-Reajuste-2026.pdf), vigente desde 15/02/2026.

- **536R** — Niterói × Várzea das Moças (via Maria Paula): **R$ 9,10**.
- **542R** — Niterói × Anaia: **R$ 7,10**.
- **770D/771D** — Itaipu/Pendotiba × Candelária: **R$ 14,25**.

Essas tarifas alimentam `tarifaLinhaDetro` e `REGRA_DETRO_2026`. A comparação do caso Alcemir mostrou que a primeira alternativa do Google (536R + 35) é a mais rápida, mas não a mais barata. Com o BUN (política presumida, ônibus de Niterói a R$ 4,45): 62 + 39A pelo Centro custa R$ 4,45 por sentido (R$ 8,90/dia), com transferência válida de 18 minutos e duração total de 60 minutos; 536R + 35 custa R$ 13,55 por sentido (9,10 + 4,45); 542R + 39A custa R$ 11,55 (7,10 + 4,45); 62 + 771D/770D custa R$ 18,70 (4,45 + 14,25). Na exceção "tarifa cheia" o 62 + 39A custa R$ 11,20 por sentido (R$ 22,40/dia). Antes da decisão de 19/11/2026 (R$ 5,60) estes valores eram R$ 5,60, R$ 14,70, R$ 12,70 e R$ 19,85. A alternativa só pode ser escolhida depois de conferir desembarque, caminhada, horário real e situação do BUN.

## Rotas que o sistema nunca confirma sozinho (auditoria de 21/11/2026)

A escolha automática pela rota mais barata errou em parte dos casos. Ficam para o RH conferir com o colaborador (`src/lib/vt/revisaoHumana.ts`; na tela é só aviso, quem confirma é o RH):

- 3 ou mais conduções num sentido;
- a mesma linha duas vezes seguidas (erro típico do Google);
- linha DETRO para o Rio (código terminado em D) usada como trecho local, quando nem a casa nem o posto ficam no Rio.

No lote, a volta segue a ida: se a mesma rota no sentido contrário tem pendência, a pessoa fica na fila — o sistema não troca por outra volta mais barata.


## Linha D proibida quando a viagem fica fora do Rio (decisão da gestora, 24/11/2026)

> "Não vamos marcar para ninguém pegar a linha D, se é o caso de ainda ficar em Niterói."

Linha D = linha DETRO de 3–4 dígitos terminada em D (vai para a cidade do Rio pela ponte: 425D, 760D, 721D, 5721D, 2520D, 4425D). **Quando nem a casa nem o posto ficam na cidade do Rio de Janeiro** (a viagem fica do lado de cá da baía: Niterói, São Gonçalo, Itaboraí, Maricá etc.), uma alternativa de rota com linha D **não pode ser escolhida nem confirmada** — na tela de revisão (inclusive pela fila "Rotas a confirmar") nem por script de lote. Se a casa OU o posto é no Rio, a linha D é legítima e nada muda. Cidade ausente em um dos lados: **não bloqueia por palpite** — fica o aviso "confira se o trajeto fica fora do Rio" e a pessoa decide.

Motivo: a linha D é cara (R$ 14 a R$ 33 por sentido) e quase sempre existe uma linha M fazendo o mesmo trecho local (casos Ana Bela, 489M → 425D, e Thiago, 760D → 491M). Comparação de cidades sem acento e sem diferença de caixa, usando `colaboradores.cidade` e `departamentos.cidade`. Implementação em `src/lib/vt/revisaoHumana.ts` (`situacaoLinhaD`, `linhasDProibidas`).
