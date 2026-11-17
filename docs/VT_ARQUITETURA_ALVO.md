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

**Situação em 15/11/2026: domínio da Etapa 2 concluído e verificado, sem deploy e sem alteração de dados.** `temporalidade.ts` seleciona decisão, preços e ajustes pela data do serviço; o modelo separa decisão versionada de seus componentes e preserva referências legadas não resolvidas como pendência. Os 8 testes novos cobrem reajuste imediato/futuro, competência histórica, snapshot, decisão não confirmada, múltiplos componentes, ajustes por vigência e ambiguidade. **228 testes do VT e 1.455 testes na suíte completa, TypeScript do app, lint escopado, RLS e build passaram.** A migration `169_vt_identidade_temporalidade.sql` está **preparada, NÃO aplicada e ainda não testada no banco**; inclui backfill aditivo e checagens de contagens/referências. Antes de aplicá-la são obrigatórios backup, teste em transação desfeita e autorização da gestora. O caminho de produção permanece legado, sem dual-write.

**Bloco corretivo em 15/11/2026, após revisão independente:** a revisão mais nova passou a ter precedência sobre a vigência, qualquer sobreposição de preços virou pendência e o adaptador passou a exigir data de corte explícita, sem derivar vigência da composição atual a partir de `created_at`. O contrato do lote ganhou totais por colaborador com lançamentos consumidos e excedente truncado, implementados por `totalizarColaboradorLote`. A 169 foi revista como **migration de corte único**: lock das escritas legadas durante a transação, tabelas novas obrigatoriamente vazias e vigência da composição atual somente a partir da aplicação. **235 testes do VT e 1.462 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS e build. Antes do cutover ainda são necessários adaptador SQL/UUID, proteção de decisões confirmadas contra UPDATE, testes SQL reais e hash canônico do snapshot. A Etapa 3 pode ser desenvolvida em domínio/memória sem aplicar a 169.

### Etapa 3 — Lote e confirmação imutável

Novo caso de uso transacional, banner por conteúdo e um único escritor.

**Aceite:** confirmação atômica, concorrência testada e diferenças de valores aprovadas individualmente.

**Situação em 15/11/2026: base de domínio implementada, sem banco e sem produção.** `loteConteudo.ts` define JSON canônico/SHA-256 e o banner por conteúdo e versões. `confirmarLote.ts` confirma atomicamente em memória por versão esperada, com teste de duas operações concorrentes e snapshot protegido por clones. O hash desconsidera `vigenteAte` para não mudar a identidade do histórico quando uma vigência é fechada, mas detecta mudanças financeiras e de pendências. **244 testes do VT e 1.471 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS e build. Na continuação, `divergenciasLote.ts` implementou comparação e aprovação individual por pessoa, com hash do conteúdo exato da divergência: editar a mesma pessoa invalida sua aprovação, enquanto editar outra não invalida. **250 testes do VT e 1.477 testes na suíte completa passaram.** Na sequência, `construirLote.ts` passou a montar o rascunho resolvendo cada data de serviço, e `confirmarSubstitutoLoteCarga` integrou as aprovações à substituição atômica: o antigo é marcado como substituído e o novo só é confirmado com todas as divergências aprovadas. **259 testes do VT e 1.486 testes na suíte completa passaram.** O núcleo da Etapa 3 está completo em memória. Em preparação para a persistência, `adaptadoresSql.ts` mapeia UUIDs reais sem perder origem/referências e recusa IDs locais; a 169 ganhou triggers que tornam decisões confirmadas e seus filhos imutáveis, permitindo somente fechar `vigente_ate`. A suíte SQL e o executor com rollback estão prontos. **262 testes do VT e 1.489 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS estático e build. Em 15/11/2026 a 169 e a suíte SQL foram **executadas com sucesso em transação desfeita**, após backup. O teste revelou grants automáticos a `anon`, corrigidos na migration com `REVOKE ALL ... FROM anon` nas sete tabelas; a checagem final confirmou zero tabelas novas e as contagens originais. A persistência foi implementada na migration 170 com snapshots JSONB e aprovações, escrita somente por RPCs com controle de versão e hash de divergência idêntico ao TypeScript. **169 + 170 foram validadas com sucesso em transação desfeita**, com backup e verificação de que nenhuma tabela permaneceu. **264 testes do VT e 1.491 testes na suíte completa passaram.** Em seguida, `useVtLoteCarga.ts` integrou construção, salvamento, aprovações, confirmação e substituição ao repositório Supabase/memória, com incremento de versão e invalidação de aprovações antigas. **267 testes do VT e 1.494 testes na suíte completa passaram.** As migrations continuam não aplicadas.

**Integração visual shadow concluída em 16/11/2026:** `VtLoteCargaShadow.tsx` exercita `useVtLoteCarga` com repositório em memória e dados sintéticos, dentro da aba Carga somente quando `import.meta.env.DEV`. O painel cobre rascunho, confirmação, recálculo, divergências de alteração/inclusão/remoção, aprovações individuais, substituição atômica e bloqueio por preço ausente. Dois testes de interface executam os fluxos por cliques; o cenário também foi validado no Chrome em página temporária isolada. **269 testes do VT e 1.496 testes na suíte completa passaram**, além de TypeScript, lint escopado e build. Os dados e textos shadow não aparecem no bundle de produção. A validação não cobre o ciclo com banco, exportação, ponto ou fechamento; 169/170 seguem não aplicadas, sem deploy ou dual-write. Próxima etapa: fechamento e exportação vinculados ao lote confirmado, ainda sem ativar o caminho novo.

**Revisão assistida com Google Routes em shadow, 16/11/2026:** `googleRoutes.ts` adapta as alternativas reais para `ItinerarioVT`, sem completar lacunas por suposição. A Edge Function `vt-rota` está preparada, não deployada nem testada ao vivo, com JWT, CORS e rate limit. `VtRevisaoRotaShadow.tsx` permite escolher a alternativa real antes de chamar `cotarCatraca`: 39A produz R$ 11,20/dia; 1910D e 536R ficam indeterminados por tarifa ausente; três conduções ficam pendentes. **281 testes do VT e 1.508 na suíte completa passaram**, além de TypeScript, lint e build. Nenhum dado/migration/deploy foi alterado; o conteúdo shadow não aparece no bundle. Antes de ligar a tela real: revisão da vertical slice, secret no Supabase e teste controlado da function.

**Persistência da evidência preparada em 16/11/2026, sem aplicar:** a migration `171_vt_itinerarios_evidencia.sql` foi validada com rollback junto de 169/170. `vt_itinerarios` guarda alternativa/conduções/fonte/hash com idempotência e se liga a `vt_trajeto_decisoes.itinerario_id`. É append-only (`REVOKE UPDATE FROM authenticated`, `REVOKE ALL FROM anon`), com auditoria; decisão sugerida permite revisão e decisão confirmada não troca a evidência. A verificação pós-rollback confirmou zero tabelas novas e as contagens originais preservadas. Nenhum dado foi alterado. Em 17/11/2026 o repositório da aplicação foi implementado com hash canônico, chave de idempotência, recuperação após duplicidade e retomada da ligação após falha; o botão Salvar da tela shadow segue desabilitado e sem callback até autorização e aplicação da 171. **299 testes do VT e 1.526 na suíte completa passaram**, além de TypeScript, lint escopado e build.

**Aplicação controlada e integração real em 17/11/2026:** com backup e autorização da gestora, as migrations **169 e 171 foram aplicadas**; a 170 continua não aplicada. O backfill ficou com 9 pacotes e 256 decisões, um para cada trajeto, sem grants para `anon` e sem itinerários gravados pelo agente. `VtRevisaoRota.tsx` passou a ser o painel real, separado dos dados shadow: a aba Trajetos abre a revisão somente para editor em trajeto gravado ainda não confirmado, resolve a decisão por `trajeto_legado_id` e permite salvar a alternativa escolhida. **302 testes do VT e 1.529 na suíte completa passaram**, além de TypeScript, lint, RLS e build; o bundle não contém os dados fictícios. Nenhum deploy tinha sido feito até essa etapa; a primeira gravação autenticada pela gestora foi feita logo em seguida.

**Restauração comprovada em 17/11/2026:** a primeira escolha real foi persistida corretamente, mas a interface não a recuperava ao reabrir. O repositório agora lê a evidência por `itinerario_id` e o painel mostra conduções, data e hash com o selo “Itinerário salvo neste trajeto”. **303 testes do VT e 1.530 na suíte completa passaram**, além de TypeScript, lint e build.

**Edição humana da proposta em 17/11/2026:** a revisão permite retirar uma condução sugerida pelo Google antes de salvar. A cotação é refeita somente com as pernas restantes, a perna original fica registrada em `ajustesManuais` na evidência e distância/duração totais deixam de ser presumidas. Não é permitido remover a última condução. **306 testes do VT e 1.533 na suíte completa passaram**, além de TypeScript, lint e build.

**Revisão de decisão confirmada em 17/11/2026:** trajetos confirmados também podem abrir a revisão assistida. Ao salvar, uma nova revisão sugerida é criada com os mesmos pacotes e ajustes; a decisão confirmada permanece imutável. Reutilização de revisão aberta e cópias idempotentes evitam duplicidades em repetições ou concorrência. **310 testes do VT e 1.537 na suíte completa passaram**, além de TypeScript, lint e build.

**Catálogo tarifário oficial em 17/11/2026:** `tarifasOficiais.ts` lê valores, vigência e fonte da `REGRA_DETRO_2026`, sem duplicar a tabela no motor. Foram cadastradas 416M, 414M, 5721D, 587M e 721D pela Portaria DETRO/PRES 1.960/2026. Tarifa integral, BUN e BUI usam as regras vigentes na data do serviço, e a tela mostra os links das fontes. **313 testes do VT e 1.540 na suíte completa passaram**, além de TypeScript, lint, RLS e build.

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
