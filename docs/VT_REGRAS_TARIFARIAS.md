# VT — Regras tarifárias oficiais (pesquisa na web, 28/10/2026)

> Referência para o motor de classificação de bilhetes do módulo VT.
> As regras da operação (valores dos 9 bilhetes do catálogo `vt_bilhetes`,
> definidos pela gestora) continuam valendo — este documento registra o que as
> fontes oficiais dizem, para fundamentar a classificação automática a partir
> da rota real (Google Routes API).

## Niterói (municipal)

- Fonte oficial: MobNit (prefeitura de Niterói) — <https://mobnit.niteroi.rj.gov.br/itinerarios>
- Tarifa normal e bilhete municipal com **1 integração grátis em até 1 hora**.
- Na operação Plena, o cartão é VT personalizado **empresa**: vale a tarifa da
  gestora, **R$ 5,60 por perna** (não os R$ 4,45 de pessoa física) — regra já
  registrada no plano (§10.6).

## BUI — Bilhete Único Intermunicipal (Região Metropolitana do RJ)

- Lei estadual 5.628/2009 (institui o BUI na RM-RJ).
- **Valor máximo R$ 9,40 por perna desde 19/12/2025** (antes R$ 8,55) —
  [Revista Ferroviária](https://revistaferroviaria.com.br/2026/01/passagem-de-trem-nao-tera-reajuste-em-2026-confirma-supervia/).
- **Integração: até 2 integrações em até 3 horas, desde que pelo menos 1 seja
  intermunicipal** — [VTA Benefícios](https://vtabeneficios.com.br/bilhete-unico-intermunicipal-bui-o-beneficio-que-barateia-o-trajeto-de-quem-cruza-cidades/).
- **Teto de renda do benefício: R$ 3.205,20** (quem passa disso perde o BUI) —
  mesma fonte. **Isto explica os 11 "Suspenso Setrans" da Riocard** (28/10/2026):
  a Setrans suspende o BUI quando a renda declarada passa do teto ou o
  cadastro vence — por isso a reativação é na Setrans.
- Ônibus + Metrô no RJ aceita Jaé **ou Riocard habilitado no BUI**, janela de
  120 min — [MetrôRio — Meios e Tarifas](https://www.metrorio.com.br/como-pagar/meios-e-tarifas).

## Jaé (Rio de Janeiro, municipal)

- **Desde ago/2025 o Jaé é OBRIGATÓRIO nos modais municipais do Rio** (ônibus,
  BRT, VLT, vans autorizadas); o Riocard saiu dos modais municipais —
  [Agenda do Poder](https://agendadopoder.com.br/jae-obrigatorio-filas-duvidas-e-correria-marcam-vespera-de-mudanca-nos-transportes-do-rio/),
  [Folha da Terra](https://folhadaterradigital.com.br/geral/implementacao/).
- A integração do Bilhete Único Carioca (ônibus × BRT) **exige o Jaé**.
- Tarifa de referência R$ 5,00 (site oficial) — <https://jae.com.br/integracoes/>.
- **Consequência para o módulo:** quem trabalha no Rio precisa de Jaé — o
  bilhete "CARTÃO JAE RJ" do catálogo cobre isso. Quem vai de Niterói/SG para o
  Rio e pega modal municipal no Rio precisa de **2 bilhetes** (ex.: BUI + JAE).

## Trem / Metrô / VLT

- Trem SuperVia: sem reajuste em 2026 (fonte Revista Ferroviária, acima).
- MetrôRio: R$ 7,90 com Jaé; integrações ônibus municipal (Jaé ou Riocard+BUI,
  120 min), BRT e vans — [MetrôRio](https://www.metrorio.com.br/como-pagar/meios-e-tarifas).

## Google Routes API (a "roteirização de verdade")

- Endpoint `computeRoutes` com `travelMode: TRANSIT` devolve as pernas da
  rota: linhas de ônibus, modais (ônibus/trem/metrô/VLT/barca) e municípios
  cruzados — é o MESMO dado do link do Google Maps, mas estruturado.
- Preço: Compute Routes Basic ~US$ 5/1.000, Advanced ~US$ 10/1.000; desde
  mar/2025 há franquia gratuita por produto (milhares de chamadas/mês) —
  [blog.afi.io](https://blog.afi.io/blog/a-developers-guide-to-the-google-routes-api/),
  [scrap.io](https://scrap.io/google-routes-api-pricing).
  **Nosso volume (~250 trajetos na 1ª carga, depois só novos/mudanças) cabe na
  franquia gratuita** — mas exige conta de faturamento (cartão) no Google Cloud.
- As tarifas NÃO vêm do Google (não confiável no Brasil): o motor classifica
  bilhetes pelas regras acima a partir das pernas; o valor vem do nosso
  catálogo `vt_bilhetes`.
- Limite conhecido: cobertura do Google Transit no RJ é boa na capital e
  Niterói/SG, fraca no interior (POC de 21/10/2026: Macaé sem cobertura) —
  trajeto sem cobertura cai para confirmação humana, como hoje.
