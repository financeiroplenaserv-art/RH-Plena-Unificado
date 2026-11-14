# VT — Arquitetura-alvo e migração controlada

> Decisão de arquitetura em 14/11/2026, após revisão das regras tarifárias por dois validadores independentes e análise estática do módulo por um arquiteto. Este documento orienta a reconstrução parcial do módulo. Não autoriza correção em lote de trajetos, cargas ou preços nem deploy.

## 1. Decisão

Reescrever dois núcleos:

1. **Itinerário, regras oficiais, cobrança estimada na catraca e escolha do pacote Plena.**
2. **Lote de carga, confirmação, reconciliação e exportação.**

Preservar e adaptar gradualmente:

- optantes e dados cadastrais;
- coberturas e treinamentos;
- parsers do Flit e do ponto;
- permissões e auditoria;
- telas e funções puras saudáveis;
- dados existentes, sem reescrita de histórico.

Não será uma reescrita total nem apenas uma refatoração do `classificarRota`. A coexistência entre modelo antigo e novo será temporária, com um único escritor de produção por vez e critério formal de encerramento.

## 2. Problemas que a arquitetura precisa eliminar

### Regras e modelo tarifário

- O classificador experimental decide com dados insuficientes: `PernaRota` só contém modal, município e indicador intermunicipal.
- Há regras incorretas sobre BUI × Jaé, municipal de Niterói, trilhos, barcas, VLT e tarifas de São Gonçalo.
- Cobrança na catraca, base legal do VT e pacote operacional Plena estão misturados.
- `bilhete_id`/`bilhete_2_id` ligam o trajeto a versões de preço e impõem uma composição rígida de até dois campos.

### Temporalidade e ciclo financeiro

- Reajuste imediato desativa vigências anteriores que já são referenciadas por trajetos (`src/hooks/useVt.ts`).
- A carga escolhe preços pela data de hoje, não pela competência/data trabalhada (`src/hooks/useVtCarga.ts`).
- O banner compara apenas conjuntos de colaboradores, não o conteúdo calculado (`src/lib/vt/carga.ts`).
- A confirmação atual faz upsert e pode substituir uma carga anterior.
- O Excel é gerado do estado corrente da tela, não de uma carga confirmada recuperada do banco.
- Rascunho e confirmação não formam uma transação única com controle de versão.

## 3. Forma da solução

Manter um **monólito modular**: um único sistema, com domínios internos explícitos. Sem microserviços.

```text
UI → casos de uso → domínio puro ← adaptadores Supabase/Flit/Google/Riocard
```

O domínio não conhece React, Supabase, XLSX, PDF ou Google.

### A. Cadastro e elegibilidade

Dados separados para optação, modelo do cartão, situação BUI/BUN com data da consulta, disponibilidade de Jaé e matrícula Riocard. A matrícula de exportação nunca é derivada da matrícula Alterdata.

### B. Itinerário e evidência

Pernas ordenadas com linha, variante, operadora, modal, origem, destino, sentido, categoria do serviço, pontos e horários de validação. A rota registra provedor, data da consulta, precisão e hash da evidência.

O Google fornece candidatos e evidências, nunca preço ou decisão final.

### C. Regras oficiais

Conjunto versionado de tarifas, integrações, elegibilidade e exceções, sempre com fonte e vigência. Não contém nomes de pacotes Plena.

### D. Cobrança estimada na catraca

Contrato implementado em `src/lib/vt/contratosTarifarios.ts`:

```text
cotarCatraca(itinerario, cartao, regras, dataServico) → CotacaoCatraca
```

A cotação traz cobrança por perna, integrações aceitas/recusadas, regras utilizadas e pendências. Resultado: `confirmavel`, `parcial` ou `indeterminado`.

### E. Catálogo operacional Plena

Identidade do pacote, componentes, versões de preço, requisitos de cartão e decisão do trajeto são independentes. Não há limite estrutural de dois componentes.

O simulador pode recomendar ou questionar um pacote; a política confirmada pela Plena define o valor carregado.

### F. Lote de carga e livro de ajustes

Contratos em `src/lib/vt/contratosLoteCarga.ts`.

Cada lote guarda fonte e hash, competência, versão do cálculo e das regras, linhas por pessoa/dia/posto, preços e decisões usados, pendências e hash do conteúdo.

A confirmação usa versão esperada e cria um snapshot imutável. Correções geram nova versão ou lote substituto.

A reconciliação gera débitos, créditos e pendências ligados ao lote original. A carga seguinte consome esses lançamentos sem recalcular o passado com preços novos.

### G. Exportação

Excel operacional e TXT Riocard são adaptadores distintos sobre o mesmo lote confirmado. A exportação não recalcula dias ou valores, exige matrícula Riocard exata e registra layout, hash e idempotência.

## 4. Invariantes obrigatórias

1. Nenhum preço confirmado sem dados suficientes e regras vigentes identificadas.
2. Nenhuma confirmação ou gravação de trajeto por inferência.
3. Preço sempre resolvido pela data do serviço e por identidade estável do pacote.
4. Reajuste nunca altera carga confirmada nem apaga seu fundamento histórico.
5. Confirmação é atômica e usa controle de versão.
6. O banner compara conteúdo e versão, não apenas colaboradores.
7. Fechamento nunca desconta sem evidência.
8. Crédito ambíguo vira pendência, nunca fato comprovado.
9. Exportação lê somente snapshot confirmado.
10. Um único caminho de escrita de produção por vez.
11. Nenhuma alteração em lote decorrente de POC ou comparação automática.
12. O desconto legal de 6% fica fora do motor tarifário enquanto essa for a decisão operacional.

## 5. Migração e critérios de aceite

### Etapa 0 — Fundação

- Matriz de regras oficiais e pendências.
- Contratos dos dois núcleos.
- Testes de caracterização das partes saudáveis.
- Classificador antigo identificado como legado experimental, sem integração à aba.

**Aceite:** testes VT, suíte completa, lint e build verificados; nenhum comportamento de produção alterado.

### Etapa 1 — Núcleo tarifário em shadow mode

Implementar cotação e adaptadores de leitura dos pacotes/trajetos legados, sem gravar recomendações.

**Aceite:** toda divergência explicada; dados insuficientes nunca produzem total confiante; nenhum dado alterado.

**Situação em 14/11/2026: Etapa 1 concluída e verificada, sem deploy e sem alteração de dados.** Implementados `regrasOficiais.ts`, `cotarCatraca.ts` e `adaptadoresLegados.ts`, com 21 testes novos (18 da cotação e 3 dos adaptadores). A cotação compara tarifa integral, BUN e BUI por sentido e devolve `confirmavel`, `parcial` ou `indeterminado`; a escolha do pacote patronal e a composição do dia ficam fora desse núcleo. O relatório `dados-locais/vt_shadow_2026-11-14.md` cobre 12 casos estruturados: 2 valores iguais, 6 divergências explicadas, 3 revisões e 1 caso sem cotação. **219 testes do VT, 1.446 testes na suíte completa, TypeScript do app, lint escopado e build passaram.** A POC antiga de 249 trajetos não preserva evidências suficientes (horários, tarifas e origem/destino das pernas), portanto **não foi usada para confirmar preços**. A comparação em escala exige nova coleta/adaptação antes de qualquer integração à aba ou revisão dos dados reais. Handoff completo: `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`.

### Etapa 2 — Identidade e temporalidade

Introduzir identidade estável de pacote, preços por vigência e decisões de trajeto versionadas, de forma aditiva.

**Aceite:** reajuste não deixa trajeto sem preço; competência passada usa vigência correta; referências legadas conferem.

### Etapa 3 — Lote e confirmação imutável

Novo caso de uso transacional, banner por conteúdo e um único escritor.

**Aceite:** confirmação atômica, concorrência testada e diferenças de valores aprovadas individualmente.

### Etapa 4 — Fechamento e exportação

Vincular ajustes ao lote confirmado e gerar Excel/Riocard somente dele.

**Aceite:** trailer confere, matrícula ausente bloqueia e repetição não duplica efeitos.

### Etapa 5 — Encerramento da duplicidade

Validar um ciclo completo `carga → confirmação → exportação → ponto → fechamento → ajuste seguinte` antes de desativar o caminho antigo. Dados legados permanecem consultáveis.

## 6. Decisões de negócio ainda pendentes

- BUI em linha intermunicipal direta, sem transbordo: redução por integração ou desconto social para a base patronal do VT.
- Política de pacote fixo da Plena versus valor estimado na catraca quando divergirem.
- Reajuste tarifário no meio da competência.
- Evidência necessária para creditar dia trabalhado em posto diferente do planejado.
- Compra Riocard separada por empresa/CNPJ.

Essas pendências ficam fora da automação até decisão expressa da gestora, DP/jurídico ou operadora, conforme o caso.

## 7. O que não fazer

- Integrar o classificador atual à aba Trajetos.
- Adicionar novas exceções em `if`s do classificador antigo.
- Corrigir trajetos/cargas em lote com base em POC.
- Usar nome do bilhete como identidade ou `hojeBrasil()` como data do preço.
- Exportar da tela, do rascunho ou do cálculo corrente.
- Manter dual-write ou duas fontes financeiras permanentes.
- Reescrever telas, parsers e coberturas saudáveis junto com os núcleos.
