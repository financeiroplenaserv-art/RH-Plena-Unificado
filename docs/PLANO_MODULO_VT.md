# PLANO — Módulo VT (Vale-Transporte)

> **Status: PROPOSTA para aprovação da gestora — nada implementado.**
> Origem: conversas de 2026-10-21/22. Prova de conceito validada (ver §9).
> Objetivo da gestora: creditar o VT **100% certo — nem a mais, nem a menos** — calculando o custo real de cada colaborador a partir da escala futura (Flit) e do trajeto casa → posto, com reconciliação no mês seguinte (mesmo modelo do VR).

---

## 1. O problema

Hoje a carga de VT é feita "contando os dias escalados no mês seguinte e descontando o que foi dado a mais na carga passada" (igual ao VR), **sem saber quanto custa o dia de cada colaborador**. Quando o colaborador muda de posto (contrato A → B), ninguém verifica se o bilhete dele cobre o trajeto novo nem se precisa de complemento. E quando o colaborador diz "meu bilhete acabou" no meio do mês, não há previsão para confrontar o relato.

Só entram no controle os colaboradores **optantes do VT** (nem todos usam).

## 2. As três regras tarifárias do nosso território (regra central do cálculo)

O quadro está em 6 cidades e **cada escopo tem sua regra de integração** — o motor de custo do dia precisa saber em qual escopo o trajeto acontece:

### 2a. Niterói → Niterói (207 dos 320 ativos — o caso mais importante)

**Bilhete Único de Niterói (BUN)** — municipal, não é o BUI estadual ([Otimiza.pro, conferido em 17/10/2026](https://otimizapro.com/tarifas-e-integracoes-transporte-publico-brasil/rj/niteroi), [Prefeitura de Niterói](https://niteroi.rj.gov.br/prefeitura-mantem-tarifa-reduzida-para-usuarios-do-bilhete-unico-municipal/)):

- **2 linhas municipais distintas em até 1 hora = 1 tarifa só** (integração).
- **A tarifa depende de COMO o VT é comprado**: VT **personalizado usuário** (a pessoa física compra, CPF) = **R$ 4,45**; **VT personalizado empresa/ao portador (a empresa compra — o caso da Plena, confirmado pela gestora em 21/10/2026: o cartão mostra o CPF, mas a compra é da empresa)** = **R$ 5,60**; dinheiro/cartão não habilitado = R$ 5,60.
- Integra também com **barcas/catamarã** (até 2 integrações/dia; Prefeitura citou R$ 5,15 e R$ 8,15 em jul/2025 — confirmar valores vigentes na carga inicial de tarifas).
- **Integração no cartão da empresa: CONFIRMADO pela gestora (21/10/2026)** — 2 ônibus municipais dentro de 1 hora cobram **R$ 5,60 pelo trecho inteiro** (a 2ª catracada não cobra). Regra do motor: em Niterói, cada janela de integração cobre até 2 conduções municipais por R$ 5,60.
- Limite do cartão VT: até 8 viagens/dia.
- **Compra do VT**: site **Riocard Mais → área "Para Empresas"**, com login e senha (é a operadora única em Niterói — é esse site que a gestora quer automatizar, decisão §10.2).

### 2b. Intermunicipal (São Gonçalo ↔ Niterói, Itaboraí/Maricá → Niterói etc. — ~67 ativos)

**Bilhete Único Intermunicipal (BUI)** — estadual: integração de até **2 modais** (sendo 1 intermunicipal) em **3 horas**, pagando **no máximo 1 tarifa** (R$ 9,40 desde 19/12/2025, antes R$ 8,55). Habilitados têm Tarifa Social (R$ 5) em alguns modais. Exige declaração de renda e pode ser suspenso. Fontes: [Gov. RJ](http://www.rj.gov.br/transporte/bilhete_unico_intermunicipal), [Brasil de Fato](https://www.brasildefato.com.br/2025/12/19/reajuste-no-bilhete-unico-impacta-passageiros-de-20-cidades-do-rio-de-janeiro/).

### 2c. Bilhete comum / sem integração (qualquer cidade, inclusive Macaé)

Cada embarque cobra tarifa cheia, sem janela de integração. Custo do dia = soma das tarifas das pernas (ida + volta).

### 2d. O modelo real da operação: BILHETES nomeados com valor diário (decisão da gestora, 21/10/2026; renomeado de "combinação" para "bilhete" em 21/10/2026 — migration 156)

A precificação NÃO é calculada embarque a embarque: a operação usa um **catálogo de bilhetes**, cada um com **valor por dia (ida + volta)** já fechado. Tabela real informada pela gestora:

| Bilhete | Valor/dia |
|---|---|
| CENTRO RJ | R$ 10,00 |
| BU NITERÓI | R$ 11,20 (= 2 × 5,60) |
| CARTÃO JAE RJ | R$ 14,00 |
| PASSAGEM SÃO GONÇALO | R$ 14,20 |
| TREM | R$ 15,80 (= 2 × 7,90 SuperVia) |
| ÔNIBUS E VLT — INTEGRAÇÃO RJ | R$ 16,00 |
| BILHETE ÚNICO INTERMUNICIPAL | R$ 18,80 (= 2 × 9,40) |
| ÔNIBUS, TREM E METRÔ | R$ 28,80 |
| SEM INTEGRAÇÃO BU | R$ 32,00 |

**Um trajeto (casa → posto) pode ter ATÉ 2 bilhetes** (ex.: BU NITERÓI + TREM) — o custo do dia é a **soma** das bilhetes do trajeto. A maioria dos colaboradores usa BU INTERMUNICIPAL ou BU NITERÓI. O motor de "conduções × tarifa" das §§2a–2c vira **conhecimento de apoio** para escolher a bilhete certo (e para conferir reajustes), não mais o cálculo principal.

**Fonte de tarifas com vigência**: a [Base Nacional de Tarifas e Integrações de VT da Otimiza.pro](https://otimizapro.com/tarifas-e-integracoes-transporte-publico-brasil/rj/niteroi) cobre todas as nossas cidades (Niterói, São Gonçalo, Maricá, Itaboraí, Macaé, Rio), com valor, data de vigência e ato oficial — serve de referência para alimentar `vt_tarifas` (a gravação segue manual/confirmada; licença CC BY-NC permite a consulta para decisões da própria empresa).

## 3. Fontes de dados (o que já existe no CORH)

| Dado | Fonte | Estado |
|---|---|---|
| Dias escalados + posto por dia (futuro) | Importação da escala Flit (`locais_trabalho_diario`) | ✅ existe |
| Dias realmente trabalhados (reconciliação) | Espelho de ponto Flit (Adicionais → Importar Ponto) | ✅ existe (parser já faz o parse por CPF) |
| Endereço residencial | Alterdata → `colaboradores.endereco/cidade/cep` (sync diário) | ✅ existe — **320/320 ativos preenchidos** |
| Endereço do posto | `departamentos.endereco/cidade/cep` | ✅ 62/64 ativos preenchidos (faltam PLENA TECH ADM e DUOCONNECT) |
| Salário base (teto do desconto de 6%) | Alterdata `salarioBase` | ⚠️ existe na API, **não importado hoje** — incluir no mapeamento (os DOIS caminhos: `useEContador` e `sync-econtador`) |
| "Usa VT?" / tipo de bilhete | — | ❌ **a API da Alterdata NÃO expõe** (verificado ao vivo em 21/10/2026, probes em `scripts/econtador-probe-vt*.mjs`) → cadastro manual no CORH |
| Horário da ficha da Alterdata | — | ❌ **não usar** (decisão da gestora: desatualizado; jornada vem do Flit) |

## 4. Descoberta do trajeto (o coração do módulo)

**Princípio: o sistema escreve, o RH só confirma.** O RH não cadastra trajeto na mão.

1. **Geocodificação** (1× por endereço, com cache no banco): casa do colaborador e endereço do posto → lat/lng + score de confiança.
   - **Origem (casa): endereço exato PRIMEIRO, bairro como fallback marcado (POC rodadas 2 e 4, 21/10/2026)**. Os endereços residenciais da Alterdata vêm sujos para geocodificação fina — número "0", lote/quadra/bloco no meio do texto ("LT 59", "53 FUNDOS", "CS 3"), rua dupla grudada, CEP divergente da rua; ~metade não resolve no nível da porta. **Teste porta × bairro (decisivo)**: no municipal simples o trajeto foi IDÊNTICO nos dois níveis (Badu→Ingá: mesmas linhas 48→46, só mudou o tempo a pé); no **intermunicipal deu diferença real** (Alcântara SG→Niterói: o exato achou a linha intermunicipal 9721D; o bairro sugeriu outra estrutura — o ponto exato de embarque define a linha alcançável e o número de conduções, que decide se cabe na integração do BUI). Regra final: (1) tenta o exato normalizado; (2) falhou → bairro, com selo **"precisão reduzida"** e confirmação humana obrigatória **com o mapa/rota na tela**; (3) **intermunicipal sempre pede confirmação**, mesmo com exato. A precisão alcançada é gravada no trajeto.
   - Normalização antes de buscar (aprendida na POC): cortar tokens de lote/quadra/bloco/casa/apartamento, número "0"/"S/N" vira sem-número, rua dupla grudada fica só a primeira.
   - Resultado de baixa confiança é **marcado para conferência**, nunca usado em silêncio.
2. **Rota de transporte público — SEM chave de API (decisão da gestora, 21/10/2026: "vamos sem a chave do Google; se for o caso, faremos")**: o sistema monta o **link do Google Maps já preenchido** (origem → posto, modo transporte público — links de consulta são gratuitos e não precisam de chave) e o RH abre, lê a rota sugerida e confirma na tela com o mínimo de cliques: **quantas conduções por sentido** (1 / 2 / 3+) e o **escopo** (municipal Niterói / intermunicipal / outra cidade). A partir daí o **custo é calculado pelas regras tarifárias** (§2) — não pelo Google. A chave da Routes API fica como **upgrade futuro**: com ela, a leitura das pernas vira automática e a confirmação humana vira só revisão.
   - Geocodificação (para posicionar origem/destino e montar os links) via **Nominatim/OSM gratuito** (com cache no banco e respeito ao rate limit de 1 req/s), com a normalização da POC; se um dia quiser mais precisão, troca-se o provedor sem mudar o fluxo.
3. **Custo do dia**: o trajeto referencia **1 ou 2 bilhetes do catálogo** (§2d) e o custo do dia é a soma dos valores diários vigentes — bilhetes em tabela **com vigência** (padrão `ceu_itens_precos`). As regras de integração (§§2a–2c) servem de apoio para ESCOLHER a bilhete certo.
4. **Confirmação humana de 1 clique**: fila "Trajetos a confirmar" — o RH vê "João: Niterói → CBO — ônibus 740I + barca + ônibus 100, R$ X/dia" e clica **Confirmar** ou **Ajustar**. Sem a confirmação, o trajeto não entra no cálculo (regra "importação nunca grava palpite").
5. **Fallback para cidade sem cobertura do Google** (POC: Macaé não tem ônibus no Google): trajeto **declarado 1× como padrão da cidade/posto** (ex.: Macaé = 1 ônibus municipal por sentido, tarifa local) — vale para todo colaborador daquele par, não é por pessoa.

O trajeto é **cache eterno por par casa→posto**: só recalcula quando muda o endereço do colaborador ou o posto do dia. Troca de contrato com par já conhecido = custo novo calculado na hora, sem intervenção.

## 5. Modelo de dados (novo)

| Tabela/coluna | Conteúdo |
|---|---|
| `colaboradores.vt_optante` (bool), `colaboradores.vt_tipo_cartao` ('bun' \| 'bui' \| 'comum'), `colaboradores.salario_base` (numeric, vindo da Alterdata) | cadastro do VT |
| `vt_trajetos` | colaborador × departamento: **bilhete_id + bilhete_2_id (nullable)** (§2d — custo do dia = soma dos valores diários dos bilhetes), origem ('manual'/'link_confirmado'), precisao_origem ('exato'/'bairro'), status ('sugerido'/'confirmado'), confirmado_por/em |
| `vt_bilhetes` | **bilhete nomeado com valor diário** (§2d: BU NITERÓI R$ 11,20 etc.) com `vigente_desde` — imutável, padrão `ceu_itens_precos`; reajuste = nova linha de vigência |
| `vt_cargas` | mensal por colaborador: dias por posto × custo/dia, necessidade, ajuste da reconciliação anterior, valor calculado, valor creditado, desconto 6% calculado |
| `vt_eventos` | "bilhete acabou", complemento autorizado/negado, troca de trajeto — com previsão × real |
| `vt_geocode_cache` | endereço normalizado → lat/lng/confiança (LGPD: sem nome/CPF) |

Regras do projeto que valem aqui: GRANT explícito em tabela nova; RLS padrão (SELECT autenticado, escrita `is_editor()` ou RPC); migrations com backup prévio; datas como data local; "hoje" = `hojeBrasil()`.

## 6. Fluxos operacionais

1. **Carga mensal** (virada do mês): escala do mês seguinte importada → VT → "Calcular cargas" → por colaborador: dias por posto, custo/dia, necessidade, ± ajuste da reconciliação anterior, desconto 6% (`min(6% × salario_base, necessidade)` — **depende de importar `salarioBase` da Alterdata**, pendente do desfreeze do e-Contador; até lá, a coluna mostra "—") → exportação. **Ponte escala→posto (decisão técnica, 21/10/2026)**: `locais_trabalho_diario` aponta para `locais_trabalho` (Escalas), que NÃO tem `departamento_id` — o posto do dia é resolvido por `encontrarDepartamentoFuzzy` (nome/nome_curto do local → departamentos), mesmo padrão de resolução já usado no projeto; sem match, o dia cai na fila "posto não identificado" (nunca custo inventado). **Transferência no meio do mês**: a escala já traz os dias no posto novo → o cálculo soma dias no X × custo X + dias no Y × custo Y sem intervenção; transferência programada sai certa na carga do mês seguinte. **Gatilho futuro (Fase 3)**: a ocorrência "Transferência de Setor" (que já atualiza `departamento_id`) dispara o alerta "o bilhete cobre o posto novo?".
2. **Troca de posto**: ao importar escala com posto novo para alguém, o sistema recalcula e **alerta** ("o bilhete do João cobre o trajeto novo? precisa complementar R$ X") — se o par casa→posto é inédito, entra na fila de confirmação.
3. **"Meu bilhete acabou"**: evento registrado com data → tela mostra **previsto × real** (dia previsto de esgotamento pelo cálculo × dia do relato; dias trabalhados a mais; troca de posto no meio do mês) → embasa autorizar ou questionar o complemento.
4. **Reconciliação** (após o ponto do mês): **"VR olha para trás, VT olha para a frente" (síntese da gestora, 21/10/2026)** — o VT credita contando os dias que a pessoa VAI trabalhar; o único olhar para trás é o fechamento: **se faltou (qualquer motivo — regra §10.3), desconta na carga do mês seguinte**. O fechamento confere também posto divergente do previsto (custou diferente → ajusta). dias reais × custo/dia vs. o que foi creditado → diferença entra automaticamente na próxima carga. **Fonte dos dias reais (decisão técnica, 21/10/2026)**: reprocessar o espelho de ponto **já arquivado** no bucket `ponto-espelhos` (migration 094) com o parser existente (`pdfPosicional`), cruzado com extras e `vt_coberturas` para o posto real — o espelho cobre TODOS os colaboradores, sem depender de vínculo de adicionais; não se pede reupload.

## 7. Integrações externas, custos e LGPD (versão sem chave Google — decisão de 21/10/2026)

- **Geocodificação**: Nominatim/OpenStreetMap — gratuito, com cache no banco (endereço nunca repete consulta) e respeito ao rate limit. Chamadas via Edge Function (ou direto — Nominatim é público e sem chave; avaliar CORS na implementação, Edge Function é o caminho seguro).
- **Rotas**: links gratuitos do Google Maps preenchidos pelo sistema, lidos pelo RH na confirmação. **Sem custo de API.** Upgrade futuro: Routes API (chave em secret, custo único estimado < US$ 15 + incremental desprezível) para automatizar a leitura das pernas.
- **LGPD**: para o Nominatim/Google vai **só o endereço/bairro**, sem nome/CPF/matrícula. O cache no banco não vincula pessoa (vinculação fica em `vt_trajetos`).

## 8. Permissões (proposta — confirmar)

- Mesma lógica do VR: quem opera a carga hoje (provável `mesa`/`dp1`/`dp2`/`financeiro`?) — ação `vt.gerenciar` no `PERMISSOES_PADRAO` + tela Permissões + seeds em `permissoes_perfil` + `reset_permissoes_perfil` atualizada.
- Confirmação de trajeto: mesma ação. Visualização: quem vê VR.

## 9. Validações feitas (evidências deste plano)

- **API Alterdata (ao vivo, 21/10/2026)**: 39 atributos por funcionário; **nenhum de VT** (nem flag nem lista de vales), nem por `fields[]` explícito nem por `include`. `salarioBase` e `horarios` existem (horários não usar — gestora). Scripts: `scripts/econtador-probe-vt.mjs`, `scripts/econtador-probe-vt2.mjs`.
- **Auditoria de dados (21/10/2026)**: 320/320 ativos com endereço+CEP+cidade; 62/64 postos ativos idem; 304/320 com cobertura completa casa+posto.
- **Auditoria de geocodificação em escala (21/10/2026, OSM/Nominatim sobre os 324 ativos+afastados; Google tende a resolver MAIS)**: exato+municipal 122 (38%), exato+intermunicipal 36 (11%), bairro+municipal 108 (33% — bairro basta, provado na POC), **bairro+intermunicipal 29 (9% — grupo crítico, confirmação humana com mapa obrigatória)**, sem posto 18, falha total 11 (3% — RH confere o endereço com a pessoa). Script: `scripts/poc-vt-auditoria-geocode.mjs`; dados em `dados-locais/poc_vt_auditoria_geocode.json`. **Conclusão: o esforço humano de implantação é ~29 trajetos uma única vez; o resto é automático.**
- **POC de rotas (21/10/2026)**: 5 pares reais (`dados-locais/poc_vt_rotas.html`): 3 corretos de cara; 1 corrigido pela cascata (CEP do cadastro divergente da rua — Caramujo/Niterói); 1 sem cobertura (Macaé) → fallback declarado. Gestora validou: "os outros estavam corretos".

## 10. Decisões da gestora (respondidas em 21/10/2026)

1. **Quem opera a carga de VT**: a própria empresa (interno — não é o DP/terceirizado). Perfis exatos a detalhar na implementação (proposta: mesa/dp1/dp2, como o VR).
2. **Como a carga é feita**: hoje **na mão**; a gestora **quer automação pelo site da RioCard**. → O módulo gera o arquivo/lista de carga no formato da RioCard Empresas e, como evolução (Fase 4), investigar se a RioCard tem upload em lote ou API para carga automática. Nunca credenciais da RioCard no frontend; automação via Edge Function/robô é ponto de estudo.
3. **Regra de ouro da reconciliação**: **não trabalhou, não recebe — seja qual for o motivo** (falta injustificada, atestado, o que for). O VT é calculado exclusivamente sobre **dias realmente trabalhados** no ponto.
4. **Feristas/faltistas**: recebem VT normalmente, **de acordo com o posto para onde foram a cada dia** — confirma o cálculo por dia × posto do dia (a escala Flit já traz isso).
5. **Fases**: separadas, na ordem aconselhada — Fase 1 (cadastro de optantes/tipo de bilhete + trajetos + custo-dia), Fase 2 (carga mensal + reconciliação + exportação), Fase 3 (eventos "bilhete acabou" + alertas de troca de posto), Fase 4 (automação RioCard).
6. **Cartão VT e tarifa de Niterói (corrigido em 21/10/2026)**: o cartão mostra o CPF do colaborador, **mas a compra é feita pela empresa** — logo vale a tarifa **R$ 5,60** (VT personalizado empresa), NÃO os R$ 4,45 do BUN de pessoa física. Tarifa padrão de Niterói no módulo: **R$ 5,60**. Pendente de verificação prática: se o cartão da empresa tem direito à **integração** (2ª linha em 1h grátis) ou se cada embarque cobra R$ 5,60 — ver §2a.
7. **Sem chave do Google por ora** (21/10/2026): rotas via links gratuitos + confirmação humana; geocode via Nominatim. Se a fila de confirmação se mostrar trabalhosa demais na prática, aí se faz a chave e a leitura das pernas vira automática.
8. **Preço por bilhete nomeado, não por embarque (21/10/2026)**: a operação precifica com o catálogo de 9 bilhetes de valor diário fechado (§2d — ex.: BU NITERÓI R$ 11,20, BUI R$ 18,80), e **um trajeto pode ter até 2 bilhetes** (custo do dia = soma). A maioria usa BU INTERMUNICIPAL ou BU NITERÓI. Isso substitui o motor "conduções × tarifa" como cálculo principal.
9. **Faltista × ferista são problemas diferentes (21/10/2026)**: (a) **faltista** cobre faltas — imprevisível por natureza; recebe **valor cheio** (bilhete abrangente no trajeto-base; os dias vêm da escala) e pronto, sem novidade de sistema; (b) **ferista** cobre férias — planejado com antecedência, mas o Flit não mostra o destino → registro manual mínimo **`vt_coberturas`** (ferista × posto × período, preenchido quando a cobertura é planejada — hoje essa decisão já existe na planilha "Planejamento Operacional"); na carga, o dia dentro de uma cobertura usa o **posto da cobertura**, com prioridade sobre a escala. Quando o módulo Férias for liberado, `ferias_alocacoes` passa a alimentar esse registro automaticamente e o manual se aposenta. (c) **extras + substitutos do calendário de adicionais são dados do período que PASSOU** (preenchidos para a folha) — não servem para a previsão; servem para a **reconciliação** (Fase 2b), junto com o ponto.
10. **Carga dirigida pelas férias do mês (21/10/2026, refinamento do quadro de coberturas)**: o fluxo NÃO começa perguntando "quem cobre" — começa com o sistema **listando quem entra de férias no mês da carga** (lendo `ferias_solicitacoes`, que já existe no banco) e exigindo um destino para cada um: **quem cobre + período** (registra a cobertura já vinculada às férias, posto pré-preenchido com o posto do titular) ou **"sem cobertura" declarado** (caso do ferista que tira férias — ninguém o cobre). **Portão de fechamento da carga**: gravar/computar só com TUDO coberto — cada férias do mês com destino declarado + todo optante com trajeto confirmado para os postos que vai pisar + nenhum dia sem posto identificado — assim **ninguém fica sem VT no mês seguinte**. E o titular de férias tem os dias de gozo **subtraídos da própria carga** (não trabalhou → não recebe — o sistema corta os dias pela `ferias_solicitacoes`, não depende da escala estar certa).

## 11. Fora de escopo (por ora)

- Otimização de rota de fretado/van (problema diferente — VRP).
- App do colaborador (consulta do próprio saldo/trajeto).
- Integração direta com operadora de cartão via API (se existir no futuro, vira Fase 4).
