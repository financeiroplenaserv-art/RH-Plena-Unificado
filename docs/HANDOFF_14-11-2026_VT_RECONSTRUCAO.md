# HANDOFF 14/11/2026 — Reconstrução do módulo VT

> Para retomar em 15/11/2026. Leia também `docs/VT_ARQUITETURA_ALVO.md` e `docs/VT_REGRAS_TARIFARIAS.md`.

## 1. Estado atual — o que está e o que não está concluído

- **Etapa 0 concluída e verificada.**
- **Etapa 1 concluída e verificada em 14/11/2026.**
- **219 testes do VT e 1.446 testes na suíte completa passaram.** TypeScript do app, ESLint escopado e build também passaram.
- O shadow mode foi executado com 12 casos e gerou `dados-locais/vt_shadow_2026-11-14.md`.
- Nenhum deploy, migration, alteração de banco, trajeto, preço ou carga foi feito.
- O novo código não foi integrado à aba VT nem à `vt-rota`; o comportamento de produção não mudou.

## 2. Como chegamos à decisão

1. A pesquisa inicial sobre VT, BUN, BUI, Jaé e integrações foi confrontada com fontes oficiais.
2. A gestora pediu duas validações independentes. Dois agentes trabalharam separadamente, sem receber as conclusões um do outro nem a síntese do agente principal.
3. Houve uma divergência entre eles sobre BUI + municipal de Niterói. A página atual do Rio Bilhete Único resolveu: **ônibus municipal de Niterói é exceção e integra exclusivamente pelo BUN**.
4. Um arquiteto avaliou reescrita total × refatoração × reescrita parcial. A decisão aprovada foi **reescrita parcial de dois núcleos**, preservando as partes saudáveis e os dados.

### Decisão arquitetural aprovada

Reescrever:

- núcleo de itinerário, regras oficiais, cotação de catraca e pacote Plena;
- núcleo de lote de carga, confirmação, reconciliação e exportação.

Preservar e adaptar:

- optantes e cadastro;
- coberturas e treinamentos;
- parsers Flit/ponto;
- permissões e auditoria;
- telas e funções puras saudáveis;
- dados existentes.

Não fazer big bang, não apagar o módulo, não manter duas arquiteturas permanentes e não fazer dual-write por tempo indeterminado.

## 3. Regras confirmadas que orientam o novo código

A referência completa, com URLs e vigências, está em `docs/VT_REGRAS_TARIFARIAS.md`.

- **VT federal:** tarifa integral, mas reduções por integração contam no deslocamento (Decreto 10.854/2021, especialmente arts. 124–125).
- **BUN:** duas linhas municipais diferentes de Niterói, mesmo sentido, até 1 hora, CPF vinculado; até dois usos/dia com intervalo mínimo entre eles. Tarifa social R$ 4,45; base operacional/legal do VT da Plena R$ 5,60 por sentido, com segunda condução integrada quando elegível.
- **BUI:** até 2 meios por viagem integrada, pelo menos um intermunicipal; em geral até 3h, com exceções específicas; dois usos/dia. Valor vigente R$ 9,40 por viagem integrada.
- **Elegibilidade BUI:** residência RJ, 6–64 anos completos, renda declarada dentro do limite vigente, CPF e **Personalizado Usuário**. No VT vinculado à empresa, a habilitação é do empregador. Personalizado Empresa não habilita.
- **“Suspenso Setrans” não prova renda alta:** também pode ser idade ou uso indevido.
- **Municipal de Niterói não integra pelo BUI:** usa BUN separadamente.
- **Riocard+BUI continua válido nas integrações municipais cobertas no Rio:** não acrescentar Jaé automaticamente.
- **Sem BUI:** a parte municipal do Rio usa Jaé e tarifa separada.
- **MetrôRio:** janelas específicas de 120 minutos; Metrô+BRT/van tem integração somente com Jaé e regras de linha/estação.
- **SG × Niterói:** preço por linha/seção, não sempre R$ 7,10. Exemplos oficiais: 484M R$ 7,10; 483M/492M R$ 9,10; 100D R$ 10,40.
- **Trem R$ 7,60 × metrô R$ 7,90.**
- BUI direto pode reduzir a catraca de uma linha intermunicipal acima de R$ 9,40, mas **a base patronal sem transbordo continua pendente de DP/jurídico/Riocard**.

## 4. Problemas arquiteturais confirmados no código antigo

- `PernaRota` não tem linha, destino, sentido, horários, estações ou tarifas suficientes.
- O classificador antigo impõe BUI+Jaé indevidamente, retorna cedo para trilhos/barcas e generaliza SG.
- O trajeto referencia uma linha de preço, não uma identidade estável do pacote.
- Reajuste imediato desativa a vigência antiga referenciada pelo trajeto (`src/hooks/useVt.ts`).
- A carga escolhe preço por `hojeBrasil()`, não pela competência/data trabalhada (`src/hooks/useVtCarga.ts`).
- O banner compara apenas IDs de colaboradores, não o conteúdo calculado.
- A confirmação atual faz upsert e pode substituir a carga anterior.
- O Excel sai do estado da tela, não de um snapshot confirmado.
- Rascunho/confirmação não são uma transação única com controle de versão.

## 5. Etapa 0 — entregue e verificada

### Documentação

- `docs/VT_ARQUITETURA_ALVO.md`: decisão, domínios, invariantes, migração e critérios de aceite.
- `docs/VT_REGRAS_TARIFARIAS.md`: matriz de regras oficiais, exceções e pendências.
- `AGENTS.md`: atualizado com a decisão e, depois, com o andamento da Etapa 1.

### Contratos e proteção

- `src/lib/vt/contratosTarifarios.ts`
- `src/lib/vt/contratosLoteCarga.ts`
- `src/lib/vt/caracterizacao.test.ts`: 6 testes de caracterização das partes saudáveis.
- `classificarRota.ts` e seu teste foram marcados como **legado experimental**, sem mudança de comportamento.

### Verificação da Etapa 0

- 198 testes do VT passaram.
- Suíte completa: **1.425 testes passaram.**
- TypeScript, ESLint escopado, build e `git diff --check` passaram.

## 6. Etapa 1 — implementação entregue

### Novo núcleo tarifário

- `src/lib/vt/regrasOficiais.ts`
  - IDs estáveis das regras, fontes, vigências e parâmetros.
- `src/lib/vt/cotarCatraca.ts`
  - Compara tarifa integral, BUN e BUI por sentido.
  - Resultados: `confirmavel`, `parcial`, `indeterminado`.
  - Devolve alternativas, cobrança por perna, regras usadas, integrações aceitas/recusadas e pendências.
  - Não decide pacote patronal nem composição do dia.
  - BUN exige linha, sentido, horário e CPF.
  - BUI exige serviços elegíveis, ordem/tarifa das pernas, janela e cartão.
  - Municipal de Niterói é excluído do BUI.
  - Metrô+BRT/van e 3+ pernas ficam parciais.
  - Primeira tarifa BUI acima do teto fica parcial.
  - Tarifa desconhecida não gera preço inventado.
- `src/lib/vt/contratosTarifarios.ts`
  - Ganhou alternativas de cotação, alternativa escolhida e cartões necessários.
  - Vigência inicial da decisão legada pode ser `null` quando desconhecida.

### Adaptadores legados, somente leitura

- `src/lib/vt/adaptadoresLegados.ts`
  - Separa identidade do pacote das versões de preço.
  - Fecha vigência anterior com o dia anterior à nova vigência.
  - Adapta um ou dois pacotes do trajeto antigo.
  - Não inventa `vigenteDesde` quando o dado antigo não existe.
  - Compara valor atual × cotação de ida+volta, sem gravar recomendação.
  - Marca separadamente a pendência patronal do BUI direto.

### Testes novos

- `src/lib/vt/cotarCatraca.test.ts`: **18 testes.**
- `src/lib/vt/adaptadoresLegados.test.ts`: **3 testes.**
- Total do VT agora: **219 testes passando.**

### Shadow mode

- Script: `scripts/vt/shadow-cotacao.ts`.
- Não acessa Supabase nem Google, não grava banco e não contém dados pessoais.
- Relatório: `dados-locais/vt_shadow_2026-11-14.md`.
- Resultado dos 12 casos:
  - 2 valores iguais;
  - 6 divergências explicadas;
  - 3 revisões;
  - 1 caso sem cotação por tarifa desconhecida.

Casos cobertos: BUN válido/mesma linha, BUI SG, exceção Niterói, Rio com/sem BUI, 492M, 100D, trem+metrô, falta de horário, três pernas e tarifa desconhecida.

### Limites assumidos do motor nesta etapa

- Só dá confiança plena para rotas de uma ou duas pernas com evidência completa.
- Três ou mais pernas ficam parciais.
- BUN com barcas ainda exige regra específica, sem confirmação automática.
- BUC/Jaé em todas as suas combinações ainda não está modelado.
- Metrô+BRT/van fica parcial.
- BUI direto na catraca não decide a base patronal.
- A POC antiga de 249 trajetos não preserva horários, tarifas e origem/destino estruturados; **não foi usada para confirmar preços nem para corrigir dados**.

## 7. Verificações da Etapa 1 — estado exato

Passaram:

```bash
npx vitest run src/lib/vt                 # 219 testes
npx tsc -b tsconfig.app.json --pretty false
npx eslint src/lib/vt/regrasOficiais.ts src/lib/vt/cotarCatraca.ts src/lib/vt/adaptadoresLegados.ts src/lib/vt/contratosTarifarios.ts src/lib/vt/cotarCatraca.test.ts src/lib/vt/adaptadoresLegados.test.ts scripts/vt/shadow-cotacao.ts
npx tsx --tsconfig tsconfig.scripts.json scripts/vt/shadow-cotacao.ts
```

Verificação final reexecutada e concluída:

```bash
npm test       # 105 arquivos, 1.446 testes passando
npm run build  # build de produção gerado com sucesso
git diff --check
```

A checagem ampla `npx tsc -b tsconfig.app.json tsconfig.scripts.json` encontrou erros pré-existentes em scripts antigos (`analisar-nao-identificados.ts`, `consolidar-cbo.mts`, `diagnosticar-*`, `teste-adicionais.ts`, `importar-departamentos.ts` etc.). Nenhum erro apontado para os novos arquivos. Não corrigir esses scripts como parte do VT.

## 8. Próxima etapa

A Etapa 1 está verificada. Iniciar a Etapa 2 somente depois de revisar o estado do working tree e preservar os arquivos locais não relacionados.

## 9. Etapa 2 — identidade e temporalidade

Objetivo: impedir que reajuste ou recálculo use o preço errado.

1. Finalizar modelo aditivo para:
   - identidade estável do pacote;
   - versões de preço por vigência;
   - decisões de trajeto versionadas;
   - ajustes manuais com motivo e vigência.
2. Adaptar leitura legada sem perda de referências.
3. Resolver preço pela **data do serviço**, nunca por `hojeBrasil()`.
4. Testar:
   - reajuste imediato não deixa trajeto sem preço;
   - reajuste futuro só entra na vigência correta;
   - competência passada usa preço histórico;
   - snapshot confirmado não muda com reajuste;
   - referências e contagens legadas conferem.
5. Preparar migration aditiva somente depois dos testes de domínio.
6. Antes de qualquer aplicação: backup, teste em transação desfeita e autorização da gestora. **Nunca `supabase db push`.**
7. Um único escritor de produção por vez; nada de dual-write permanente.

## 10. Etapas posteriores, nesta ordem

- **Etapa 3:** lote de carga, confirmação atômica e snapshot imutável; banner por conteúdo/versão.
- **Etapa 4:** fechamento ligado ao lote; Excel e TXT Riocard somente do snapshot confirmado; matrícula Riocard exata e idempotência.
- **Etapa 5:** validar um ciclo completo antes de aposentar o caminho antigo.

Antes de integrar rotas à aba ou revisar os 249+ trajetos:

- fazer nova coleta/adaptação com linha, variante, operadora, origem/destino, sentido, paradas, horários e tarifas;
- executar comparação em escala sem gravação;
- obter revisão da gestora por grupos;
- nunca corrigir dados com base na POC antiga.

`vt-rota` permanece congelada. Chave Google nunca no frontend.

## 11. Decisões de negócio pendentes

- BUI direto sem transbordo: integração ou desconto social para a base patronal (DP/jurídico/Riocard).
- Política quando pacote Plena e cotação da catraca divergirem (gestora).
- Reajuste no meio da competência (gestora).
- Evidência do posto real para crédito fora da carga (gestora).
- Compra Riocard separada por CNPJ/empresa (gestora/Riocard).
- Modelo físico/lógico real dos cartões Plena: Personalizado Usuário × Empresa.
- BUN com barcas e combinações BUC/Jaé: detalhar antes de automatizar.

## 12. Estado do Git e arquivos locais

- Branch `main`; as alterações desta sessão formam um único pacote de trabalho das Etapas 0 e 1.
- `docs/LANCAMENTO_MENSAL_EPIS.md` já estava modificado antes do trabalho e **não foi tocado nem incluído no pacote**.
- Há diversos arquivos não versionados pré-existentes em `.claude/`, `docs/` e `scripts/`; foram preservados e ficaram fora do pacote.
- O único relatório shadow criado fica em `dados-locais/`, fora do versionamento normal.
- Não fazer deploy a partir de um working tree com arquivos não relacionados. O checklist de produção continua exigindo `main` limpa.

## Retomada rápida

> “Continue o VT pelo handoff `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`. As Etapas 0 e 1 estão verificadas. Comece a Etapa 2 de identidade e temporalidade, sem alterar banco ou produção.”


---

## 13. Continuação em 15/11/2026 — Etapa 2

### Entregue

- `src/lib/vt/temporalidade.ts`: resolve decisão, preços e ajustes pela **data do serviço**, sem consultar `hojeBrasil()`.
- `contratosTarifarios.ts`: separa `DecisaoTrajetoVT` dos `ComponenteDecisaoTrajetoVT`; não há mais limite estrutural de dois pacotes.
- `adaptadoresLegados.ts`: adapta a decisão e seus componentes, preserva IDs sem pacote em `referenciasLegadasNaoResolvidas` e carrega o valor extra como ajuste com motivo/vigência.
- `contratosLoteCarga.ts`: a futura linha do lote guarda revisão da decisão, todos os preços/componentes e ajustes usados.
- `temporalidade.test.ts`: 8 testes de aceite; adaptadores agora têm 4 testes. Cobrem reajuste imediato/futuro, histórico, snapshot imutável, decisão não confirmada, múltiplos componentes, ajustes por vigência, referência ausente e preço ambíguo.
- `supabase/migrations/169_vt_identidade_temporalidade.sql`: **preparada, NÃO aplicada e ainda não testada no banco**. Cria sete tabelas aditivas com RLS/GRANTs/auditoria, backfill do legado e aborta se houver vigência ambígua ou divergência de contagens/referências.

### Verificação

- 228 testes do VT passaram.
- Suíte completa: **106 arquivos e 1.455 testes passaram** na execução final.
- TypeScript do app, lint escopado, RLS, `git diff --check` e build de produção passaram.
- Na primeira execução completa, um teste de Excel de Materiais estourou 5 s enquanto o lint global rodava; ele passou isolado e a suíte completa passou na repetição. Nenhum arquivo de Materiais foi alterado.
- O lint global encontrou a worktree não versionada `.claude/` já existente e falhou por múltiplos `tsconfigRootDir`; o lint de todos os arquivos desta etapa passou. Não apagar nem alterar essa worktree.

### Limites e próxima ação

- Nenhum deploy, acesso à Management API, alteração de banco ou integração à aba foi feito.
- O caminho de produção continua legado e não há dual-write. `vt-rota` permanece congelada.
- A migration 169 ainda precisa de **backup, teste em transação desfeita e autorização da gestora** antes de qualquer aplicação.
- Depois da revisão/validação da 169, iniciar a **Etapa 3: lote de carga, confirmação atômica, snapshot imutável e banner por conteúdo/versão**.
- `docs/LANCAMENTO_MENSAL_EPIS.md` e os demais arquivos locais não relacionados continuam preservados e fora do pacote.

## Retomada rápida atual

> “Continue o VT pelo handoff `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`, seção 13. O domínio da Etapa 2 está verificado e a migration 169 está preparada, não aplicada e não testada no banco. Não altere banco/produção; depois da revisão da 169, comece a Etapa 3 de lote e confirmação imutável.”


---

## 14. Revisão independente e bloco corretivo — 15/11/2026

Um agente de arquitetura revisou a Etapa 2 e respondeu **"seguir com ajustes"**. Os quatro achados prioritários foram corrigidos:

1. **Precedência:** revisão mais nova primeiro, vigência depois. Correção retroativa não confirmada não deixa mais a decisão antiga vencer. Preços sobrepostos, mesmo com inícios diferentes, viram `preco_ambiguo`.
2. **Corte histórico:** `adaptarDecisaoTrajetoLegado` exige `dataCorte`; não usa mais `created_at` como início da composição atual.
3. **Totais por pessoa:** `TotalColaboradorLoteCargaVT` e `totalizarColaboradorLote` guardam necessidade, ajuste, valor final, excedente truncado, pendências e lançamentos consumidos. Coberto: pessoa sem dias, desconto no piso zero e subtotal parcial sem total confirmável.
4. **Migration de corte:** a 169 exige as tabelas novas vazias, bloqueia escritas legadas com LOCK SHARE e grava a composição atual somente a partir da data de aplicação. Não é sincronização incremental e não deve ser reaplicada.

Verificação final: **235 testes do VT, 1.462 testes na suíte completa, TypeScript, lint escopado, RLS e build passaram.**

Continuam fora do banco e pendentes para o cutover: adaptador das linhas SQL/UUIDs, proteção contra UPDATE de decisões confirmadas, testes SQL reais e definição do hash canônico do snapshot. A Etapa 3 pode ser feita em domínio/memória sem aplicar a 169.


---

## 15. Pausa segura em 15/11/2026

O trabalho foi pausado pela usuária **antes de começar a implementação da Etapa 3**. Não há código da Etapa 3 pela metade: houve somente o planejamento inicial de conteúdo canônico/banner e confirmação atômica em memória.

### Estado preservado

- Etapas 0 e 1 concluídas.
- Etapa 2 e o bloco corretivo da revisão independente concluídos e documentados nas seções 13 e 14.
- Última verificação completa depois das correções: **235 testes do VT e 1.462 testes na suíte completa passaram**; TypeScript do app, lint escopado, RLS estático, `git diff --check` e build de produção também passaram.
- Migration `169_vt_identidade_temporalidade.sql` revista como corte único, mas continua **NÃO aplicada e NÃO testada no banco**.
- Nenhum deploy, alteração de produção, Management API ou dual-write foi feito. `vt-rota` segue congelada.
- As alterações estão no working tree da `main`, sem commit desta sessão. `docs/LANCAMENTO_MENSAL_EPIS.md` e os demais arquivos locais não relacionados continuam preservados; não foram incluídos no pacote.

### Ao retomar

1. Ler as seções 13–15 deste handoff e `docs/VT_ARQUITETURA_ALVO.md`.
2. Conferir `git status --short` antes de editar, preservando os arquivos alheios.
3. Iniciar a Etapa 3 **somente em domínio/memória**: conteúdo canônico e hash do snapshot, banner por conteúdo/versão, confirmação atômica com versão esperada, concorrência e imutabilidade.
4. Não aplicar a 169 para desbloquear a Etapa 3. Antes do cutover ainda faltam adaptador SQL/UUID, proteção contra UPDATE de decisões confirmadas, testes SQL reais e autorização da gestora.

### Retomada rápida

> “Continue o VT pelo handoff `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`, seções 13–15. A Etapa 2 e suas correções estão verificadas (235 testes VT/1.462 no total). A Etapa 3 ainda não foi implementada. Comece por hash canônico, banner e confirmação atômica em memória, sem banco ou produção.”


---

## 16. Base da Etapa 3 — 15/11/2026

A Etapa 3 foi iniciada somente em domínio/memória, conforme a revisão independente. Não houve alteração de banco ou produção.

### Implementado

- `src/lib/vt/loteConteudo.ts`
  - JSON canônico com chaves e coleções ordenadas.
  - SHA-256 do conteúdo financeiro do lote.
  - Inclui competência, regras, fonte, dias, decisões, preços, ajustes, totais por pessoa e pendências.
  - Exclui id/status/versão do lote, carimbo de importação e `vigenteAte`; fechar uma vigência antiga não muda o hash histórico, mas mudar preço/ajuste/dia/pendência muda.
  - `avaliarBannerLote` retorna `nao_salvo`, `divergente`, `parcial`, `rascunho` ou `confirmado`, com versões atual/salva/confirmada.
- `src/lib/vt/confirmarLote.ts`
  - Repositório em memória que sempre devolve/grava clones.
  - Confirmação atômica por `versaoEsperada`, com lote completo e hash íntegro.
  - Recusa versão antiga, pendências, hash adulterado, lote inexistente e duplicidade.
  - Teste de duas confirmações concorrentes: exatamente uma vence.
  - Mutar o objeto retornado não altera o snapshot no repositório.
- `LoteCargaVT.conteudoHash` adicionado ao contrato.

### Verificação

- 14 testes desta fatia passaram nos arquivos novos/relacionados.
- **244 testes do VT e 1.471 testes na suíte completa passaram.**
- TypeScript do app, lint escopado, RLS estático, `git diff --check` e build passaram.

### O que ainda falta na Etapa 3

- Aprovação individual de divergências de valores.
- Construção do lote chamando a resolução para cada data de serviço no pipeline.
- Adaptador SQL/UUID e persistência transacional real.
- Proteção contra UPDATE de decisões confirmadas e testes SQL em transação desfeita.

A migration 169 continua preparada, **não aplicada e não testada no banco**. Produção permanece no caminho legado, sem dual-write.

### Retomada rápida

> “Continue pela seção 16 do handoff. A base da Etapa 3 (hash, banner e confirmação atômica em memória) está verificada. Complete primeiro a aprovação individual de divergências e a construção do lote por data, ainda sem banco; depois faça o adaptador/persistência somente após validação da 169.”


---

## 17. Aprovação individual de divergências — 15/11/2026

`src/lib/vt/divergenciasLote.ts` completa mais uma parte da Etapa 3, ainda somente no domínio:

- `compararTotaisPorColaborador` une as pessoas dos dois lotes e classifica `incluido`, `removido`, `alterado` ou `inalterado`.
- Mostra diferença de valor somente quando os dois valores são conhecidos; `null` nunca vira zero.
- Informa alterações de situação, necessidade, ajuste, valor, excedente, lançamentos e pendências.
- `aprovarDivergenciaColaborador` grava autor, data e SHA-256 do conteúdo exato da divergência daquela pessoa.
- `verificarAprovacoesDivergencias` separa aprovações válidas e divergências pendentes.
- Editar a mesma pessoa depois da aprovação exige nova revisão; editar outra pessoa não invalida a aprovação anterior.

Seis testes novos cobrem igualdade com IDs em outra ordem, inclusão/remoção/alteração, pendência sem valor, aprovação válida, aprovação obsoleta e independência entre pessoas.

Verificação: **250 testes do VT e 1.477 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS e build. Nenhum banco ou produção foi alterado.

Próxima ação: **construir o lote chamando o resolvedor para cada data de serviço** e integrar a verificação das aprovações ao fluxo de substituição/confirmação. A migration 169 continua não aplicada.


---

## 18. Construção diária e substituição com aprovações — 15/11/2026

O núcleo da Etapa 3 foi concluído em memória, ainda sem banco ou produção.

### Construção do lote

`src/lib/vt/construirLote.ts`:

- chama `resolverCustoDiarioNaData` para cada dia de trabalho;
- aplica preço e decisão vigentes em cada data, inclusive reajuste no meio do mês;
- deduplica pessoa/posto/data/origem e recusa dia fora da competência;
- guarda todos os componentes, ajustes e pendências de cada linha;
- inclui pessoas sem dias que têm ajuste anterior;
- soma os valores com piso zero por pessoa e deixa o total `null` quando há pendência.

Cinco testes cobrem reajuste mensal, duplicidade, múltiplos pacotes, preço ausente, pessoa sem dias e competência errada.

### Substituição com aprovações

`confirmarSubstitutoLoteCarga` em `src/lib/vt/confirmarLote.ts`:

- compara os totais do lote confirmado anterior com o novo rascunho;
- exige aprovações válidas para todas as divergências;
- recusa mudança feita depois da aprovação;
- impede que a confirmação comum contorne o fluxo de substituição;
- marca o antigo como `substituido` e o novo como `confirmado` na mesma operação;
- permite somente uma vencedora entre duas substituições concorrentes.

Quatro testes cobrem aprovação ausente, confirmação atômica dos dois lados, tentativa de contorno, aprovação obsoleta e concorrência.

### Verificação e próxima ação

**259 testes do VT e 1.486 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS e build. Nenhum banco ou produção foi alterado.

Próxima etapa: adaptador SQL/UUID e persistência transacional, proteção contra UPDATE de decisões confirmadas e testes reais da migration 169 em transação desfeita com backup e autorização. A 169 continua não aplicada.


---

## 19. Adaptador SQL/UUID e imutabilidade — 15/11/2026

Preparação concluída, **sem executar nenhuma migration ou teste no banco**.

### Implementado

- `src/lib/vt/adaptadoresSql.ts`: conversão das linhas das 7 tabelas da 169 para o domínio e vice-versa, preservando UUID, `origem` e `bilhete_legado_id`. As funções de escrita recusam IDs locais (`legado_*`, `trajeto:decisao:1`), evitando persistência acidental dos objetos usados em testes.
- Tipos das 7 tabelas em `src/types/vt.ts` e registros em `src/types/database.ts`.
- Triggers na 169, instalados depois do backfill:
  - decisão confirmada não pode ser alterada nem excluída; somente `vigente_ate` pode ser fechado;
  - componentes e ajustes de decisão confirmada não podem ser incluídos, alterados ou excluídos;
  - correção acontece por nova revisão.
- `scripts/vt/testes/169_testes.sql`: verifica conteúdo e vigências do backfill, valores extras, travas, fechamento de vigência, nova revisão, auditoria e grants.
- `scripts/vt/testar-169-transacao.ps1`: monta migration + testes + `ROLLBACK`; sintaxe PowerShell validada. **Não executar sem backup e autorização.**

### Verificação e pendências

**262 testes do VT e 1.489 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS estático e build. A suíte SQL real continua **não executada**.

Próxima ação: com autorização da gestora, fazer backup e rodar `powershell scripts/vt/testar-169-transacao.ps1` (sempre termina em rollback). Depois implementar a persistência transacional dos lotes e aprovações. A migration 169 continua não aplicada.


---

## 20. Migration 169 validada com rollback — 15/11/2026

Com autorização para seguir, foi feito backup e executada a validação real da migration 169 em transação desfeita.

### Backup

- Arquivo: `dados-locais/backup_vt_169_2026-11-15/vt_dados.json`.
- Contagens: 9 bilhetes, 256 trajetos, 238 cargas, 0 fechamentos, 39 coberturas e 0 geocaches.

### Execução

`powershell scripts/vt/testar-169-transacao.ps1` terminou com sucesso. A suíte `scripts/vt/testes/169_testes.sql` verificou:

- conteúdo dos pacotes, preços e fechamento das vigências no backfill;
- data de corte das decisões e preservação dos valores extras;
- bloqueio de alteração/exclusão de decisão confirmada e de seus componentes/ajustes;
- fechamento permitido de `vigente_ate`;
- nova revisão aceitando componentes e gerando auditoria;
- grants de `authenticated` e `service_role`, sem grant explícito para `anon`.

Foram corrigidos durante a preparação da suíte: dois SELECTs sem destino em blocos DO, a leitura dos grants por papel e o tratamento de `$LASTEXITCODE` nulo no executor.

### Achado real do Supabase

O default atual do projeto concedeu automaticamente a `anon` os privilégios `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` nas tabelas novas. A migration 169 agora executa **`REVOKE ALL ... FROM anon` nas sete tabelas**. A regra de grants em `AGENTS.md` §8 foi atualizada: toda tabela nova não pública deve incluir o revoke explícito.

### Prova do rollback

`dados-locais/backup_vt_169_2026-11-15/verificacao_rollback.json` confirma:

- **0 tabelas novas** após o rollback;
- 9 bilhetes, 256 trajetos, 238 cargas e 39 coberturas, iguais ao backup.

A migration continua **NÃO APLICADA em produção**. Próxima etapa: persistência transacional dos lotes/aprovações, sem antecipar a aplicação da 169.


---

## 21. Persistência transacional da migration 170 validada — 15/11/2026

A persistência real dos lotes e aprovações foi implementada e validada com backup e rollback. Nenhuma das migrations 169/170 foi aplicada em produção.

### Implementado

- `supabase/migrations/170_vt_lotes_carga_transacionais.sql`:
  - `vt_carga_lotes`: competência, status, versão, hash, regras, fonte, linhas, totais por pessoa, pendências, valores e vínculo de substituição, tudo em JSONB conforme o domínio.
  - `vt_lote_aprovacoes`: pessoa, hash da divergência, autor e data.
  - SELECT para autenticados, escrita somente por RPCs SECURITY DEFINER com `is_editor()`, grants para service_role, REVOKE de anon e auditoria.
  - `vt_salvar_rascunho_lote`: versão esperada, incremento de versão e recusa de edição de lote já confirmado.
  - `vt_aprovar_divergencia`: calcula no banco a divergência atual e grava a aprovação vinculada a ela.
  - `vt_confirmar_lote`: lock, versão, lote completo e bloqueio de substituição sem fluxo próprio.
  - `vt_confirmar_substituto`: lock dos dois lotes, aprovações obrigatórias e mudança atômica do antigo para substituído e do novo para confirmado.
- `src/lib/vt/repositorioLoteSupabase.ts`: implementa o contrato já usado em memória, além de salvar rascunho e aprovar divergência.
- Tipos das tabelas e das quatro RPCs em `src/types/vt.ts` e `src/types/database.ts`.

### Provas da validação

- O vetor `5009cb5f...` confirma que `vt_divergencia_hash` no PostgreSQL produz o mesmo SHA-256 da função TypeScript.
- Substituição sem aprovação é recusada; a confirmação comum não contorna a revisão.
- Editar o novo lote depois da aprovação exige nova aprovação.
- Segunda substituição, versão antiga, lote parcial e INSERT direto são recusados.
- Confirmação e substituição geram auditoria e grants não ficam com anon.
- Backup: `dados-locais/backup_vt_170_2026-11-15/vt_dados.json`.
- Executor: `scripts/vt/testar-170-transacao.ps1` (169 + 170 + testes + rollback).
- `verificacao_rollback.json`: zero tabelas novas; contagens originais preservadas.

Ajustes encontrados pelo teste e corrigidos: canonicalização de array vazio, parênteses do `COALESCE`, schema `extensions.digest` e a asserção da mensagem de bloqueio por RLS.

### Verificação final

**264 testes do VT e 1.491 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS estático e build. Próxima etapa: integrar telas/casos de uso sem ativar o caminho novo em produção.


---

## 22. Casos de uso do lote integrados — 15/11/2026

`src/hooks/useVtLoteCarga.ts` liga o domínio ao repositório, ainda sem nenhuma tela ou ativação em produção.

### Fluxo disponível

- `construir`: monta o lote por dia, incrementa a versão, salva o rascunho e, se for substituição, carrega as divergências com o lote anterior.
- `confirmar`: confirma pela versão esperada e guarda autor/data.
- `aprovar`: chama a RPC de aprovação por pessoa e registra a aprovação no estado do hook.
- `substituir`: confirma o novo lote e marca o anterior como substituído somente com todas as aprovações válidas.
- Uma nova construção do mesmo lote zera as aprovações antigas: edição depois da aprovação exige nova revisão.

O hook aceita tanto `RepositorioLoteCargaSupabase` quanto `RepositorioLoteCargaEmMemoria`. Este último ganhou `salvarRascunho` e `aprovarDivergencia` com as mesmas regras, permitindo testar o fluxo inteiro sem banco.

### Testes e limites

`src/hooks/useVtLoteCarga.test.tsx` cobre construir/confirmar, substituir somente depois de aprovar e impedir aprovação obsoleta. **267 testes do VT e 1.494 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS e build.

Nenhuma tela chama o hook. As migrations 169/170 continuam não aplicadas. Próxima ação: avaliar a integração visual em modo shadow, mantendo produção no caminho legado.


---

## 23. PAUSA TEMPORÁRIA — estado completo para retomada

A usuária pediu pausa em 15/11/2026. O trabalho está em um ponto seguro: **não há implementação pela metade e nenhuma tela ou produção foi ativada**.

### Resumo de tudo que foi concluído

1. **Fundação e regras (Etapas 0/1)**
   - Regras oficiais de VT, BUN, BUI, Jaé, integrações, tarifas e exceções revisadas.
   - Arquitetura aprovada: reescrita parcial dos núcleos tarifário e de lote/carga, preservando cadastro, coberturas, parsers, telas e dados.
   - Novo motor de cotação em shadow mode, sem integração à aba e sem corrigir trajetos por POC.

2. **Identidade e temporalidade (Etapa 2)**
   - Pacotes estáveis separados de versões de preço.
   - Preço e decisão resolvidos pela **data do serviço**, nunca por `hojeBrasil()`.
   - Revisão nova tem precedência; decisão não confirmada não deixa a antiga vencer.
   - Preços sobrepostos, referências ausentes e dados insuficientes viram pendência, nunca total confiante.
   - Legado adaptado somente a partir de uma **data de corte**, sem inventar histórico por `created_at`.
   - Totais por pessoa com ajustes anteriores, excedente truncado e piso zero.

3. **Lote e confirmação (Etapa 3, domínio)**
   - JSON canônico e SHA-256 do conteúdo; fechamento de vigência antiga não muda o hash histórico.
   - Banner por conteúdo e versões.
   - Construção do lote chamando o resolvedor para **cada dia**, inclusive reajuste no meio do mês.
   - Divergências por pessoa: inclusão, remoção, alteração e pendências.
   - Aprovação vinculada ao hash exato da divergência: editar a mesma pessoa invalida; editar outra não invalida.
   - Confirmação atômica em memória, controle de versão, concorrência com uma única vencedora e snapshots protegidos por clones.
   - Substituição atômica: antigo substituído + novo confirmado somente com todas as aprovações.

4. **Persistência e integração de aplicação**
   - `adaptadoresSql.ts`: UUIDs reais, origem e referências preservadas; IDs locais recusados.
   - Migration **169**: sete tabelas de pacotes/preços/decisões/ajustes, backfill de corte e imutabilidade de decisões confirmadas.
   - Migration **170**: `vt_carga_lotes` e `vt_lote_aprovacoes`, escrita somente por RPCs com editor, controle de versão, locks e hash de divergência idêntico ao TypeScript.
   - `repositorioLoteSupabase.ts`: mesmo contrato do repositório em memória.
   - `useVtLoteCarga.ts`: construir, salvar, aprovar, confirmar e substituir, com aprovações antigas zeradas após nova edição.
   - **Nenhuma tela chama o hook.** Não há caminho novo ativo nem dual-write.

### Provas no banco, tudo desfeito

- **169 validada com ROLLBACK**: backfill, vigências, valores extras, imutabilidade, nova revisão, auditoria e grants.
- **170 validada com ROLLBACK**: rascunho, confirmação, substituição, aprovações, conflitos, RLS, grants e vetor de hash igual ao TypeScript.
- O teste revelou grants automáticos de `anon`; as migrations agora contêm `REVOKE ALL ... FROM anon` e `AGENTS.md` §8 foi atualizado.
- O hash usa `extensions.digest` no Supabase.
- Verificações pós-rollback: **zero tabelas novas** e contagens originais preservadas.

Backups:

- `dados-locais/backup_vt_169_2026-11-15/vt_dados.json`
- `dados-locais/backup_vt_169_2026-11-15/verificacao_rollback.json`
- `dados-locais/backup_vt_170_2026-11-15/vt_dados.json`
- `dados-locais/backup_vt_170_2026-11-15/verificacao_rollback.json`

Contagens preservadas: 9 bilhetes, 256 trajetos, 238 cargas, 39 coberturas, 0 fechamentos e 0 geocaches.

### Verificação mais recente

- **267 testes do VT passaram.**
- **1.494 testes na suíte completa passaram.**
- TypeScript do app, lint escopado, RLS estático, build de produção e `git diff --check` passaram.

### Estado do Git e limites

- Branch `main`, alterações desta sessão ainda sem commit.
- `docs/LANCAMENTO_MENSAL_EPIS.md` e demais arquivos locais não relacionados foram preservados e não fazem parte do pacote.
- Migrations 169 e 170 estão **testadas em transação desfeita, mas NÃO aplicadas em produção**.
- Nenhum deploy, alteração de produção, correção de trajetos em lote ou dual-write foi feito.
- `vt-rota` permanece congelada.

### Como retomar

1. Ler as seções 20–23 deste handoff e `docs/VT_ARQUITETURA_ALVO.md`.
2. Conferir `git status --short` e preservar os arquivos alheios.
3. Avaliar a **integração visual em modo shadow**, usando `useVtLoteCarga`, sem ativar o novo caminho.
4. Só depois da validação visual e de um ciclo completo, discutir cutover com backup e autorização da gestora. Não aplicar 169/170 antecipadamente para desbloquear telas.

### Retomada rápida

> “Continue o VT pelo handoff `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`, seção 23. O domínio, a persistência 169/170 e o hook estão prontos e testados (267 VT/1.494 total), tudo sem aplicação em produção e sem telas. Próxima ação: avaliar a integração visual em modo shadow, mantendo o caminho legado.”


---

## 24. Integração visual shadow concluída — 16/11/2026

### Implementado

- `src/pages/vt/VtLoteCargaShadow.tsx`: painel para exercitar `useVtLoteCarga` com `RepositorioLoteCargaEmMemoria`, sem Supabase e sem dados pessoais.
- `src/pages/vt/vtLoteShadowFixture.ts`: três pessoas fictícias e cenários com lote inicial, alteração de preço, inclusão/remoção de pessoas e preço ausente.
- O painel aparece na aba Carga somente com `import.meta.env.DEV`. Não há rota nova, flag de produção, dual-write ou alteração no fluxo legado.
- A tela mostra versão, SHA-256, totais por pessoa, pendências e divergências. A substituição só é liberada depois das aprovações individuais.

### Fluxo verificado

1. Construir e confirmar o lote inicial de R$ 21,20.
2. Recalcular para R$ 26,00, gerando uma alteração, uma remoção e uma inclusão.
3. Aprovar as três divergências separadamente e confirmar a substituição atômica.
4. Simular preço ausente: total indeterminado, pendência visível e confirmação bloqueada.
5. Reiniciar o cenário com repositório novo.

### Provas

- `src/pages/vt/VtLoteCargaShadow.test.tsx`: 2 testes de interface que executam o fluxo por cliques reais no DOM.
- **269 testes do VT e 1.496 testes na suíte completa passaram.**
- TypeScript do app, lint escopado e build de produção passaram.
- O bundle de produção não contém os textos, IDs ou pessoas fictícias do painel shadow.
- O fluxo também foi exercitado no Chrome em página temporária e isolada: pendência, divergências e substituto confirmado foram inspecionados visualmente. A página, o servidor e as imagens temporárias foram removidos.

### Limites e próxima ação

- A validação cobre o lote em memória, não o ciclo com Supabase, exportação, ponto e fechamento. As migrations 169/170 continuam **NÃO aplicadas**; nenhum deploy ou alteração de dados foi feito e `vt-rota` segue congelada.
- Próxima etapa: **Etapa 4 — fechamento e exportação vinculados ao lote confirmado**, sem ativar o caminho novo. O cutover só deve ser discutido depois do ciclo completo, com backup e autorização da gestora.

### Retomada rápida

> “Continue o VT pela seção 24 do handoff. A integração visual shadow está concluída e verificada no DOM e no Chrome (269 VT/1.496 total), somente em memória e fora do bundle de produção. Comece a Etapa 4 de fechamento/exportação pelo lote confirmado, sem aplicar 169/170, sem deploy e sem ativar o caminho novo.”


---

## 25. Caso Alcemir e endereço do e-Contador — 16/11/2026

- O trajeto GREAT foi criado como `sugerido` em 29/10, quando o cadastro ainda dizia Niterói. O sync alterou o endereço para Neves, São Gonçalo (`24425-700`) em 30/10, deixando o trajeto desatualizado.
- O escopo foi corrigido para `intermunicipal`, mantido `sugerido` e marcado para revisão obrigatória. Nenhuma tarifa nova foi escolhida por inferência; o BU consta “Suspenso Setrans”. Backup e verificação: `dados-locais/backup_vt_trajeto_alcemir_2026-11-16.json` e `verificacao_vt_trajeto_alcemir_2026-11-16.json` (`corrompido=false`).
- A carga de dezembro está como rascunho de R$ 0, sem detalhe. Não houve alteração de carga nem de código.
- Foi confirmado que o e-Contador mapeia endereço/cidade/CEP diretamente da Alterdata nos dois caminhos (manual e diário). “Travessa Travessa” já vem na fonte. CEP e cidade são coerentes; o aviso de bilhete municipal agora aparece corretamente.
- A auditoria ampliada encontrou 71 avisos (5 escopo/cidades e 66 integração/BU), não erros confirmados. Estão em `dados-locais/auditoria_vt_trajetos_desalinhados_2026-11-16.json` para revisão humana, sem correção em lote.
- Verificação: 61 testes de `enderecos.test.ts` e `trajetos.test.ts` passaram. As migrations 169/170 continuam não aplicadas; nenhum deploy foi feito.


---

## 26. Amanda e limpeza da aba Trajetos — 16/11/2026

- O “Intermunicipal” da Amanda era o fallback de `escopoSugerido` para cidade ausente: PLENA TECH ADMINISTRATIVO não tem cidade/endereço cadastrados. Não era fato tarifário. O escopo antigo não foi trocado por suposição e não participa do preço.
- A tabela deixou de mostrar Escopo e o cartão ao lado do nome. Posto mostra a cidade ou o aviso de ausência; Endereço informa “Rua e número”/“Somente bairro” sem chamar de validação; Status diz “Confirmado pelo RH”; edição de bilhetes e Extra/dia ficou sob “Editar composição”.
- Regras preservadas: custo por bilhete(s) + extra, edição, desconfirmação ao trocar preço, confirmação humana, avisos de CEP/cidades/integração, Maps e exclusão.
- Testes: 3 novos na página, **272 VT e 1.499 no total**, TypeScript, lint e build passaram. Revisão visual no Chrome em página temporária, removida depois.
- Pendência: cadastrar a cidade/endereço do posto para revisar a classificação com evidência. Nenhum dado foi alterado, nenhum deploy e migrations 169/170 continuam não aplicadas.


---

## 27. Verificação ao vivo da Google Routes API — 16/11/2026

- A chave `corh-vt` foi registrada no ambiente do Windows e testada com duas chamadas diretas a `directions/v2:computeRoutes`, sem nomes/documentos e sem gravar dados. Cada caso devolveu 6 alternativas com linhas, operadoras, paradas e horários.
- Acacio: a melhor rota tem só 39A municipal, compatível com R$ 11,20/dia se for a rota real. Outra alternativa tem OC3A + 1910D intermunicipal, então a alternativa real precisa ser escolhida antes de precificar.
- Alcemir: a melhor rota tem 536R intermunicipal + 35 municipal de Niterói. Com BU suspenso, falta confirmar a tarifa oficial da 536R e calcular a parte municipal separadamente; outra alternativa tem 3 conduções e permanece parcial.
- Os horários chegam em UTC e precisam ser convertidos para `America/Sao_Paulo` antes da revisão das janelas de integração.
- Nenhuma Edge Function foi criada, nenhum dado foi alterado e o classificador legado não foi usado para confirmar preços. Próximo passo: usar a API para sugerir alternativas na revisão assistida e persistir a alternativa escolhida antes de `cotarCatraca`/`temporalidade`.


---

## 28. Revisão assistida com Google Routes em shadow — 16/11/2026

### Entregue

- `src/lib/vt/googleRoutes.ts`: adapta alternativas da Routes API para `ItinerarioVT`, sem inventar tarifa ou classificação desconhecida. `googleRoutesFixture.ts` contém as respostas reais de Acacio e Alcemir.
- `supabase/functions/vt-rota/index.ts`: preparada, **não deployada nem testada ao vivo**. JWT, perfis de gestão, CORS, rate limit e secret no servidor. VerifyJwt true no deploy futuro.
- `src/pages/vt/VtRevisaoRotaShadow.tsx`: somente desenvolvimento; nenhuma alternativa pré-selecionada. A cotação ocorre somente após a escolha humana, usando `cotarCatraca`, com valor por sentido e ida+volta marcado como estimativa da catraca, não pacote patronal.

### Casos verificados

- Acacio/39A: R$ 11,20 por dia.
- OC3A + 1910D: indeterminado por tarifa ausente.
- Alcemir 536R + 35: indeterminado por tarifa ausente e BU suspenso.
- 2590R + 584 + 35: três conduções, pendência explícita.

### Verificação e limites

- 5 testes do adaptador + 4 da tela. **281 VT e 1.508 no total**, TypeScript, lint (inclusive da function) e build passaram.
- Fluxo inspecionado no Chrome; bundle de produção sem textos/dados shadow. Deno não instalado, portanto sem `deno check`.
- Nenhum dado, migration ou deploy foi alterado. Próximos: revisão da vertical slice com a gestora, secret no Supabase e teste controlado da function antes de ligar a tela real; persistência segue dependendo de 169/170 e autorização.


---

## 29. `vt-rota` publicada e tela ligada — 16/11/2026

- Secret `GOOGLE_MAPS_API_KEY` registrada no Supabase, sem exibição. `vt-rota` versão 1 ACTIVE com `verify_jwt: true`; ausência de Authorization respondeu 401 corretamente. Nenhum frontend foi deployado.
- `src/services/vtRotaApi.ts` envia o JWT da sessão. A tela shadow tem “Consultar Google agora” e mantém os exemplos arquivados como fallback em erro.
- Verificação: 3 testes do cliente + 2 da tela; **1.513 testes no total**, TypeScript, lint e build passaram.
- **Pendente:** a gestora clicar em “Consultar Google agora” no localhost e informar o resultado. Até então, o retorno autenticado da function ainda não foi confirmado. Não houve alteração de dados, migrations ou deploy de frontend.


---

## 30. Alternativas por custo — 16/11/2026

- A primeira alternativa do Google era a mais rápida, não a mais barata. Foram cadastradas as tarifas oficiais: 536R R$ 9,10, 542R R$ 7,10, 770D/771D R$ 14,25, pela Portaria DETRO/PRES 1.960/2026.
- Comparação do Alcemir: atual 536R + 35 = R$ 14,70/sentido; 542R + 39A = R$ 12,70; **62 + 39A = R$ 11,20 e é a mais em conta**; 62 + 771D/770D = R$ 19,85. Duração total de 62 + 39A corrigida para 60 minutos, somando os dois trechos.
- A tela calcula e ordena todas as alternativas somente por custo, sem priorizar status nem escolher sozinho. Indeterminado fica por último.
- A alternativa inicialmente avaliada como 62 + 46 foi refeita porque os horários não simulavam uma transferência válida. A segunda consulta foi feita após a chegada da 62 e a alternativa corrigida é **62 + 39A**: transferência de 18 minutos, duração total de 60 minutos. Com BUN ativo, a segunda perna é coberta pela integração e o sentido fica R$ 5,60; com o “Suspenso Setrans” atual do Alcemir, fica parcial e vale a tarifa integral de R$ 11,20.
- Verificação: **1.517 testes**, TypeScript, lint, build e inspeção no Chrome passaram. Nenhuma escolha foi persistida e nenhum frontend foi deployado. Próximo: gestora confirmar se desembarque/caminhada/horário da alternativa 62 + 39A atendem à operação antes de qualquer persistência.


---

## 31. PAUSA SEGURA — migration 171 validada com rollback — 16/11/2026

- `171_vt_itinerarios_evidencia.sql` está **preparada, validada e NÃO aplicada**. Guarda a alternativa completa e suas conduções, hash e idempotência, com RLS, auditoria e `itinerario_id` na decisão.
- Append-only: `REVOKE UPDATE FROM authenticated` e `REVOKE ALL FROM anon`; SELECT autenticado, INSERT editor, DELETE admin. Decisão confirmada não troca a evidência; correção exige nova revisão.
- Suíte `scripts/vt/testes/171_testes.sql`: duplicidade, rota vazia, revisão sugerida, imutabilidade, grants e auditoria. `scripts/vt/testar-171-transacao.ps1` executou 169+170+171 com sucesso e rollback.
- Backup: `dados-locais/backup_vt_171_2026-11-16/vt_dados.json`.
- Prova pós-rollback: `verificacao_rollback.json` mostra **0 tabelas 170/171** e contagens originais: 9 bilhetes, 256 trajetos, 474 cargas, 39 coberturas.
- Nenhum dado foi alterado, nenhum deploy foi feito. A escolha feita na tela continua apenas em memória até a implementação do repositório e a aplicação autorizada da migration.

### Como retomar

Implementar o repositório/gravação da escolha na aplicação, sem ativar o botão Salvar até que a gestora autorize aplicar a 171. Depois: teste de idempotência no app, revisão visual e, só então, backup e aplicação autorizada. Não aplicar 169/170/171 antecipadamente para desbloquear a tela.



---

## 32. Repositório da escolha do itinerário implementado — 17/11/2026

- `src/lib/vt/itinerarioEvidencia.ts` gera SHA-256 sobre o conteúdo canônico da evidência e uma chave de idempotência por colaborador, posto, alternativa e hash. Recusa rota sem conduções e IDs locais que não sejam UUIDs do banco; não altera a alternativa em memória.
- `src/lib/vt/repositorioItinerarioSupabase.ts` confere se a decisão pertence ao colaborador/posto, grava a evidência e liga `vt_trajeto_decisoes.itinerario_id` somente em decisão ainda não confirmada. Decisão confirmada com outra evidência exige nova revisão.
- Reenvio após duplicidade (`23505`) recupera a evidência pela chave única e confere o hash. Se a ligação tiver falhado, a nova tentativa reutiliza o registro e conclui somente a ligação. O UPDATE termina em SELECT e exige linha afetada, sem falso sucesso.
- Tipos de `vt_itinerarios` e `itinerario_id` adicionados em `src/types/vt.ts` e `src/types/database.ts`.
- A tela shadow mostra **“Salvar itinerário escolhido” desabilitado**, com aviso de que a gravação só será liberada após autorização e aplicação da migration 171. Nenhum callback de escrita foi ligado aos cenários fictícios.

### Verificação

- 16 testes focados cobrem hash estável, alteração de conteúdo, UUID/rota vazia, primeira gravação, reenvio idempotente, retomada após falha, imutabilidade e bloqueio do botão.
- **299 testes do VT e 1.526 testes na suíte completa passaram** (122 arquivos), além de TypeScript do app, lint escopado, build de produção e `git diff --check`.
- O repositório foi testado com cliente Supabase simulado; não houve chamada ao banco, Management API, migration ou deploy. A revisão visual no Chrome e a validação real após a migration continuam pendentes.

### Próxima ação

Revisar o fluxo com a gestora. Somente com autorização expressa: fazer backup, aplicar a migration 171 já validada com rollback e então ligar o botão a uma decisão real. As migrations 169/170/171 continuam **NÃO aplicadas** e nenhum dado de produção foi alterado.



---

## 33. Migrations 169/171 aplicadas e revisão real integrada — 17/11/2026

Com autorização da gestora para continuar, foram feitos backup e aplicação das migrations necessárias. A 171 depende da 169; a 170 não foi necessária para este fluxo e continua **NÃO aplicada**.

### Banco

- Backup válido antes da escrita: `dados-locais/backup_vt_171_aplicacao_2026-11-17/vt_dados.json` — 9 bilhetes, 256 trajetos, 475 cargas, 39 coberturas e 0 fechamentos.
- `169_vt_identidade_temporalidade.sql` e `171_vt_itinerarios_evidencia.sql` foram **APLICADAS com sucesso via Management API**.
- Verificação final: 9 pacotes, 256 decisões, 0 trajetos sem decisão, `itinerario_id` presente, 0 grants para `anon`, 0 funções `vt_*` com U+FFFD e **0 itinerários gravados**.
- Comprovantes: `estado_antes.json`, `verificacao_depois.json` e `verificacao_final.json` na mesma pasta do backup.
- Nenhuma escolha foi gravada pelo agente; a primeira gravação autenticada continua para a gestora na tela.

### Aplicação

- `VtRevisaoRota.tsx` é o painel de produção, sem nomes, endereços ou respostas dos cenários fictícios. `VtRevisaoRotaShadow.tsx` ficou apenas como invólucro de desenvolvimento com os dados arquivados.
- A aba Trajetos mostra **“Revisar itinerário com Google”** somente para editor em trajeto gravado ainda não confirmado.
- O diálogo usa os endereços reais do cadastro e busca a revisão mais recente por `vt_trajeto_decisoes.trajeto_legado_id`.
- Após a escolha humana da alternativa, **Salvar** chama o repositório com os IDs reais. Cenários shadow seguem com o botão desabilitado.
- O bundle de produção contém a ação real e não contém os textos/endereços shadow.

### Verificação

- 19 testes focados da integração; **302 testes do VT e 1.529 testes na suíte completa passaram**, além de TypeScript, lint escopado, RLS, build e `git diff --check`.
- Na primeira execução completa, `excelCompraArquivo.test.ts` repetiu o timeout intermitente de 5 s já conhecido; passou isolado e a suíte completa passou na repetição. Nenhum arquivo de Materiais foi alterado.
- Nenhum deploy de frontend foi feito. A validação visual autenticada e a primeira gravação real pela gestora continuam pendentes.

### Retomada rápida

A 169 e a 171 estão aplicadas; a 170 não. O próximo passo é a gestora abrir um trajeto “A confirmar”, clicar em “Revisar itinerário com Google”, consultar, escolher a alternativa real e salvar. Conferir então `vt_itinerarios` e `vt_trajeto_decisoes.itinerario_id`. Deploy somente depois dessa validação e do checklist da `main` limpa.



---

## 34. Evidência existente passa a reaparecer ao abrir — 17/11/2026

A gestora escolheu 62 → 39A e relatou “não salvou”, embora o botão mostrasse “Itinerário salvo”. A consulta ao banco comprovou que a gravação tinha ocorrido: `vt_itinerarios` continha a alternativa `google-4`, id `73b37210-1ba3-4b6b-974f-e0a0fcea7c26`, criada em 17/11/2026 12:23 UTC, e `vt_trajeto_decisoes.itinerario_id` apontava para ela (`vinculo_confere=true`). Diagnóstico em `dados-locais/backup_vt_171_aplicacao_2026-11-17/diagnostico_gravacao.json`.

A causa era de interface, não de persistência: ao reabrir o diálogo, o app lia a decisão mas não buscava a evidência ligada nem mostrava que já existia uma escolha salva.

### Correção

- Novo `RepositorioItinerarioSupabase.buscarItinerarioPorId`.
- Ao abrir a revisão, se `decisao.itinerario_id` existir, a evidência é carregada do banco.
- Cartão verde **“Itinerário salvo neste trajeto”** mostra conduções, alternativa, data da consulta e SHA-256. Uma nova consulta/escolha continua possível enquanto a decisão estiver aberta.
- Teste de reabertura confirma 62 → 39A e nenhuma nova chamada ao Google.

Verificação: 20 testes focados, **303 testes do VT e 1.530 na suíte completa passaram**, além de TypeScript, lint, build e `git diff --check`. Nenhuma migration ou deploy novo foi feito. A evidência original continua gravada; não é necessário salvá-la de novo.



---

## 35. Remoção manual de uma condução da proposta — 17/11/2026

A gestora pediu retirar um dos ônibus sugeridos pelo Google quando a operação souber que ele não é necessário. Foi implementada a ação **“Tirar condução N”** por perna da alternativa selecionada.

- A proposta é recalculada imediatamente somente com as conduções restantes; a escolha e o salvamento continuam humanos.
- `removerPernaAlternativa` reindexa as pernas e grava em `itinerario.ajustesManuais` a condução original retirada, preservando a evidência da edição no mesmo JSON e no hash da escolha.
- Distância e duração totais viram `null`, pois os valores originais do Google não valem mais; um aviso pede revisão da caminhada e dos horários.
- Não é permitido retirar a única condução restante. Consultar o Google de novo ou trocar o cenário limpa as edições locais.
- Nenhuma migration ou alteração de dados foi necessária; nenhum deploy foi feito.

Verificação: 24 testes focados, **306 testes do VT e 1.533 na suíte completa passaram**, além de TypeScript, lint, build e `git diff --check`. O teste de interface tira o segundo ônibus, confere o novo valor e bloqueia a remoção da última condução.



---

## 36. Revisão de itinerário em trajeto confirmado — 17/11/2026

O trajeto da Edna estava confirmado, então o botão de revisão não aparecia. A aba Trajetos agora mostra **“Revisar itinerário com Google”** para qualquer trajeto gravado de quem pode editar, inclusive confirmado.

- Ao salvar, `salvarEscolhaComRevisao` reutiliza a decisão aberta ou, se a última estiver confirmada, cria a revisão seguinte com status `sugerida`, origem `manual`, vigência a partir do dia de Brasília e `itinerario_id` vazio.
- Pacotes e ajustes manuais da decisão anterior são copiados para a nova revisão. A decisão confirmada, seus componentes e seus ajustes não são alterados.
- A cópia é idempotente: reabrir ou repetir após falha completa apenas o que falta; conflito de revisão (`23505`) reutiliza a revisão aberta criada pela outra tentativa.
- O diálogo informa que a nova revisão só será criada ao salvar. O botão continua fora para somente leitura e para sugestões ainda não gravadas.
- Nenhuma migration, alteração de dados ou deploy foi feita; nenhuma revisão real foi criada pelo agente.

Verificação: 25 testes focados, **310 testes do VT e 1.537 na suíte completa passaram**, além de TypeScript, lint, build e `git diff --check`. O teste de banco simulado prova preservação da decisão confirmada e ausência de duplicidade de revisão, componentes, ajustes e evidência na repetição.



---

## 37. Catálogo oficial de tarifas por linha — 17/11/2026

Foi criado `src/lib/vt/tarifasOficiais.ts` para ler as tarifas intermunicipais da regra oficial versionada, eliminando a duplicidade que existia em `cotarCatraca.ts`.

- `REGRA_DETRO_2026` mantém, no mesmo lugar: valores por linha, vigência desde 15/02/2026 e link da Portaria DETRO/PRES 1.960/2026.
- Novas linhas cadastradas da Portaria: **416M R$ 15,10; 414M R$ 15,10; 5721D R$ 11,70; 587M R$ 7,10; 721D R$ 14,25**.
- Tarifa integral, BUN e BUI agora recebem as regras vigentes na data do serviço; a tarifa nova não é aplicada retroativamente.
- A tela da alternativa selecionada mostra os links das fontes tarifárias e a vigência.
- Teste confirma **416M R$ 30,20/dia × 5721D + 62 R$ 34,60/dia**, e indeterminação antes de 15/02/2026. Linha sem prova continua indeterminada.
- Nenhuma migration, alteração de dados ou deploy foi feita.

Verificação: 42 testes focados, **313 testes do VT e 1.540 na suíte completa passaram**, além de TypeScript, lint, RLS, build e `git diff --check`.



---

## 38. FECHAMENTO DE SESSÃO — estado completo para retomada — 17/11/2026

Este é o ponto de partida para a próxima sessão. As seções 1–31 documentam as Etapas 0–3 e a preparação; as seções 32–37 detalham o trabalho desta continuação. Nada neste fechamento exige alteração adicional de banco ou deploy.

### 1. O que foi implementado nesta continuação

1. **Persistência da evidência do itinerário**
   - `src/lib/vt/itinerarioEvidencia.ts`: JSON canônico, SHA-256 e chave de idempotência por colaborador/posto/alternativa/hash; valida UUID e recusa rota vazia.
   - `src/lib/vt/repositorioItinerarioSupabase.ts`: valida colaborador/posto, grava `vt_itinerarios`, liga `vt_trajeto_decisoes.itinerario_id`, recupera duplicidade (`23505`) e permite repetir após falha sem duplicar. UPDATE sempre retorna e exige linha.
   - Tipos de `vt_itinerarios` e `itinerario_id` adicionados em `src/types/vt.ts` e `src/types/database.ts`.

2. **Restauração visual da escolha**
   - `buscarItinerarioPorId` recupera a evidência ao abrir o diálogo.
   - O cartão **“Itinerário salvo neste trajeto”** mostra conduções, alternativa, data e hash, sem consultar o Google novamente.
   - A suspeita inicial de “não salvou” era falta de restauração na UI, não falha de gravação.

3. **Edição humana da proposta do Google**
   - `removerPernaAlternativa` em `src/lib/vt/googleRoutes.ts` permite **“Tirar condução N”** antes de salvar.
   - Recalcula o custo, reindexa pernas e guarda a perna original em `itinerario.ajustesManuais`, incluída no JSON e no hash.
   - Distância/duração totais ficam indeterminadas; a tela pede revisão da caminhada/horários. Não permite remover a última condução. Nova consulta limpa as edições.

4. **Revisão de trajeto confirmado**
   - O botão **“Revisar itinerário com Google”** aparece também em trajeto confirmado para editores.
   - `salvarEscolhaComRevisao` cria, somente ao salvar, a próxima revisão `sugerida`, origem `manual`, vigência do dia de Brasília, copiando pacotes e ajustes da decisão anterior.
   - A decisão confirmada e seus filhos permanecem intactos. Revisões abertas são reutilizadas e cópias são idempotentes; conflito `23505` recupera a revisão concorrente.
   - `src/lib/vt/itinerarioRevisao.ts` concentra a montagem da nova revisão e a detecção de componentes/ajustes faltantes.

5. **Separação entre produção e shadow**
   - `src/pages/vt/VtRevisaoRota.tsx` é o painel real, sem dados fictícios.
   - `VtRevisaoRotaShadow.tsx` é apenas o invólucro de desenvolvimento com os cenários arquivados.
   - O bundle de produção contém a ação real e não contém nomes/endereços dos cenários shadow.

6. **Catálogo oficial de tarifas**
   - `src/lib/vt/tarifasOficiais.ts` lê `REGRA_DETRO_2026`, que concentra linha, valor, vigência e fonte, eliminando a tabela duplicada do motor.
   - Novas linhas da Portaria DETRO/PRES 1.960/2026: 416M R$ 15,10; 414M R$ 15,10; 5721D R$ 11,70; 587M R$ 7,10; 721D R$ 14,25.
   - Tarifa integral, BUN e BUI usam as regras vigentes na data do serviço. Tarifa nova não é usada retroativamente e linha sem prova continua indeterminada.
   - A tela mostra os links das fontes. Comparação testada: **416M R$ 30,20/dia × 5721D + 62 R$ 34,60/dia**; 416M é a mais em conta entre essas alternativas.
   - Fontes orientadoras para expansão: Riocard Mais/Tarifas, Prefeitura de Niterói/BUN, Prefeitura de SG/SETRANS/Semove, Prefeitura do Rio/Integrações e portarias DETRO. Notícias servem só para localizar a fonte oficial.

### 2. Banco e migrations

- Backup anterior à escrita: `dados-locais/backup_vt_171_aplicacao_2026-11-17/vt_dados.json` — 9 bilhetes, 256 trajetos, 475 cargas, 39 coberturas e 0 fechamentos.
- **Migrations 169 e 171 APLICADAS via Management API com autorização da gestora.** A 171 exigia a 169.
- **Migration 170 continua NÃO aplicada** e fica para a Etapa 4.
- Backfill verificado: 9 pacotes, 256 decisões na aplicação, 0 trajetos sem decisão, coluna `itinerario_id` presente, 0 grants para `anon`, 0 funções `vt_*` com U+FFFD.
- Estado final consultado neste fechamento: **4 itinerários, sendo 3 vinculados às decisões e 1 evidência sem vínculo** (`49.2 → 49.2`, tentativa anterior a `67 → 45`). A última evidência vinculada pertence a uma revisão 2 sugerida. Não apagar a evidência sem vínculo sem revisão/decisão da gestora.
- Comprovantes: `estado_final_sessao.json`, `diagnostico_gravacao_confirmacao.json`, `diagnostico_sem_vinculo.json`, `confirmacao_linhas.json` e `ultima_evidencia.json` na pasta do backup.
- Nenhuma correção de dados em lote, nenhuma nova migration nesta continuação depois da 171 e nenhum deploy de frontend.

### 3. Verificações mais recentes

- **313 testes do VT e 1.540 testes na suíte completa passaram** (125 arquivos).
- TypeScript do app, ESLint escopado, RLS estático, build de produção e `git diff --check` passaram.
- O timeout intermitente conhecido de `excelCompraArquivo.test.ts` ocorreu em uma execução anterior; passou isolado e nas repetições completas. Nenhum arquivo de Materiais foi alterado.
- Testes cobrem: hash/idempotência, retomada após falha, restauração, remoção de condução, revisão confirmada sem duplicidade, composição copiada, fonte/vigência e comparação da alternativa mais barata.
- O Jev foi usado apenas como apoio à triagem dos próximos passos, nunca como autoridade de negócio ou autorização de ações.

### 4. Estado do Git

- Branch `main`, pacote do VT ainda **sem commit**.
- `docs/LANCAMENTO_MENSAL_EPIS.md` já estava modificado antes e foi preservado.
- Há muitos arquivos locais não relacionados em `.claude/`, `docs/`, `scripts/` e demais pastas; não incluí-los no pacote.
- Não fazer deploy da árvore atual sem antes organizar o commit e deixar a `main` limpa, conforme o checklist do projeto.

### 5. Próximos passos, nesta ordem

1. Validar visualmente o fluxo atual: revisar um trajeto, remover condução quando necessário, salvar, fechar/reabrir e conferir evidência e fonte.
2. Organizar commit somente com os arquivos do VT e documentação correspondente, preservando todos os arquivos alheios.
3. Com autorização, deploy a partir da `main` limpa e conferência do hash do bundle em produção.
4. Validar gravação/reabertura em produção.
5. Iniciar a **Etapa 4 — fechamento e exportação vinculados ao lote confirmado**, quando faz sentido aplicar a migration 170.
6. Expandir o catálogo tarifário apenas com fonte e vigência comprovadas; revisar a evidência sem vínculo separadamente, sem exclusão automática.

### Retomada rápida

> “Continue o VT pelo handoff `docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md`, seção 38. Migrations 169/171 aplicadas; 170 não. Persistência, restauração, remoção de condução, revisão de confirmados e catálogo oficial estão prontos (313 VT/1.540 total). Há 4 evidências, 3 vinculadas. Sem commit/deploy. Primeiro validar visualmente, depois organizar o pacote VT e o deploy controlado.”



---

## 39. Commit e deploy de produção verificados — 17/11/2026

- Pacote revisado com 66 arquivos do VT e validado: **1.540 testes**, TypeScript, lint, RLS e build.
- Commit criado na `main`: **`9488de4 — VT: revisa itinerários e cataloga tarifas oficiais`**.
- Deploy de produção no site correto `plena-corh`: **6afc84e6ce817fae7ba1c46e**.
- URL: https://plena-corh.netlify.app
- Bundle publicado e conferido: **`assets/index-BZl17evq.js`**, idêntico local e remoto (`confere: true`).
- `MODULO_FERIAS_LIBERADO = false` foi conferido; `MODULO_VT_LIBERADO = true` mantido.
- O deploy foi feito de uma árvore temporária limpa no commit da `main`, removida ao final. Arquivos locais não relacionados foram preservados.
- A `main` está 1 commit à frente de `origin/main`; **não houve push**. As tentativas anteriores de configuração falharam antes de publicar e não geraram deploy.
- Migration 170 continua NÃO aplicada. Próximo: validar a revisão de itinerários em produção e só depois iniciar a Etapa 4.



---

## 40. Vertical financeira mínima pronta para piloto — 17/11/2026

Quatro revisões independentes foram feitas depois da percepção de correções isoladas sem avanço. O diagnóstico convergiu: o problema não era cada dado, mas duas escritas sem reconciliação (`vt_trajetos`/`vt_bilhetes` × `vt_trajeto_decisoes`/`vt_itinerarios`), além de ausência de ciclo real integrado. Foi escolhida uma vertical curta em vez de mais análise ou reset: **Flit → lote confirmado → Excel do snapshot**. Sem reset geral, sem reescrita e sem TXT Riocard/fechamento ainda.

### Infraestrutura

- Backup: `dados-locais/backup_vt_170_aplicacao_2026-11-17/vt_dados.json`.
- **Migration 170 APLICADA**, com índice único parcial `vt_carga_lotes_competencia_confirmada_unica_idx`: uma única carga confirmada por competência.
- Suíte SQL com rollback passou, inclusive recusa de segunda confirmação independente. Executor novo para não reaplicar a 169: `scripts/vt/testar-170-somente-transacao.ps1`.
- Verificação: **0 lotes, 0 aprovações, índice presente**.

### Aplicação

- `useVtCarga` agora expõe os dias já resolvidos do relatório/coberturas como `diasLote`.
- `carregarDominioLote` lê decisões, componentes, preços e ajustes da 169.
- `selecionarProntosLote` exclui pessoas com qualquer pendência de decisão/preço sem escondê-las; `construirRascunhoLoteCarga` aceita IDs elegíveis para manter optantes sem dias com **R$ 0**.
- `useVtLoteCarga.carregar` e `obterUltimoPorCompetencia` restauram o lote ao abrir.
- `VtLoteCargaReal` constrói/confirma o lote no Supabase, mostra pendências fora do snapshot e relê o banco após confirmar.
- `excelLote` relê o lote pelo ID, exige `confirmado` e recalcula o hash antes de gerar Excel. Nunca usa o cálculo da tela.
- A aba Carga tem o botão **“Usar novo fluxo”**. Quando ativo, as ações financeiras legadas da competência ficam desabilitadas para evitar dois escritores.
- A primeira versão não recalcula lote já confirmado nem exporta TXT; fechamento/ajustes ficam para depois do piloto.

### Verificação

- Testes de seleção de prontos, valor zero, hash/adulteração e fluxo completo da interface (construir → confirmar → liberar Excel).
- **1.548 testes na suíte completa passaram**, além de TypeScript, lint, RLS e build.
- O piloto real com relatório da operação ainda precisa ser feito pela gestora em produção. Não foi apagado nenhum dado.



---

## 41. Vertical publicada para o piloto real — 17/11/2026

- Commit: **`3ea5dc6 — VT: integra lote real e exporta snapshot confirmado`**.
- Deploy `6afc9f59415ff2a404125b61` no site `plena-corh`.
- Bundle local/remoto: **`assets/index-AK0p2BWB.js`** (`confere: true`).
- Suíte final: **1.548 testes**, TypeScript, lint, RLS e build passaram.
- Migration 170 aplicada e índice único ativo; nenhuma carga foi criada pelo agente.
- A `main` está 2 commits à frente do origin, **sem push**. Arquivos alheios preservados e árvore temporária removida.

### Roteiro do piloto real

1. Em VT → Carga, importar o relatório “Gestão de escalas” do Flit.
2. Clicar em **“Usar novo fluxo”**. As ações financeiras legadas ficam desabilitadas nessa competência.
3. Clicar em **“Construir rascunho”** e conferir pessoas, pendências e total.
4. Clicar em **“Confirmar lote”**, depois em **“Baixar Excel do lote”**.
5. Fechar/reabrir a aba e conferir que o lote e o hash reaparecem.
6. Conferir no banco `vt_carga_lotes`: status `confirmado`, competência correta e totais iguais ao Excel.

Só depois desse aceite: fechamento/ajustes e TXT Riocard. Não apagar dados nem voltar a usar os dois fluxos na mesma competência.



---

## 42. Fronteira do trajeto estabilizada — 17/11/2026

A fronteira foi tratada antes de continuar a carga, seguindo a reclamação central e as revisões independentes.

### Modelo e apresentação

- `escopoSugerido` retorna **desconhecido** quando falta cidade; nunca mais intermunicipal presumido. Migration **172 APLICADA**, com CHECK atualizado e correção do metadado inválido.
- `avisoIntegracaoDoTrajeto` aceita quantidade de conduções: **uma condução não gera alerta obrigatório**; sem quantidade conhecida, a mensagem é cautelosa (“pode exigir”), não afirma dependência.
- A visão padrão esconde inativos e tem checkbox **“Mostrar histórico e inativos”**.
- Trajeto de outro posto é tratado como possível histórico/cobertura, sem orientação automática de exclusão.

### Decisão unificada

- Salvar itinerário grava também `cotacao_id` na revisão.
- Nova ação **“Confirmar trajeto e preço”** confirma a mesma revisão que contém evidência, pacotes e cotação. A decisão confirmada permanece imutável.
- A interface legada está em leitura (`LEGADO_TRAJETO_SOMENTE_LEITURA`): edição, confirmação e vigências antigas não escrevem no caminho antigo.
- Revisões abertas são reutilizadas e a confirmação exige linha retornada pelo banco.

### Casos reais

- **Aluisio:** cadastro já estava EXCLUSIVE; criado novo trajeto sugerido para EXCLUSIVE, com decisão revisão 1 e composição copiada. O trajeto antigo PLENA EA permanece confirmado como histórico.
- **Amanda e Alessandra:** PLENA TECH recebeu cidade Niterói e seus escopos foram corrigidos para `niteroi_municipal`, com BU Niterói. O alerta de integração de uma condução foi corrigido pela regra.
- **Anderson:** inativo fica fora da visão padrão, mas continua consultável como histórico.
- Backup antes das correções: `dados-locais/backup_vt_172_2026-11-17/`. Teste com rollback e verificação pós-aplicação concluídos.

### Verificação

- **1.551 testes na suíte completa passaram**, TypeScript, lint, RLS e build.
- Próximo: validação visual pela gestora antes de retomar a carga. Nenhum reset foi feito.



---

## 43. Fronteira do trajeto publicada — 17/11/2026

- Commit: **`c112e90 — VT: unifica trajetos, escopos e confirmação`**.
- Deploy `6afcad3c65e2b6209fa1c220` no site `plena-corh`.
- Bundle local/remoto: **`assets/index-CsOmvIa2.js`** (`confere: true`).
- Suíte final: **1.551 testes**, TypeScript, lint, RLS e build.
- Migration 172 aplicada; Aluisio → EXCLUSIVE criado como sugerido e PLENA TECH com Niterói; decisões antigas preservadas.
- `main` 3 commits à frente do origin, **sem push**. Arquivos alheios preservados e árvore temporária removida.

Próximo passo: a gestora revisar os quatro casos e o botão **“Confirmar trajeto e preço”** em produção. A carga só deve ser retomada depois dessa validação visual. Fechamento/ajustes e TXT continuam fora desta etapa.



---

## 44. Situação do BU em coluna curta — 17/11/2026

A apresentação longa “o pacote pode exigir integração...” foi substituída pela coluna **BU na Riocard** em Trajetos. Ela mostra o fato oficial de forma curta: por exemplo, **Suspenso Setrans**, Ativado ou “não consultado”. O alerta longo equivalente foi removido da coluna Bilhete.

Motivo: situação oficial do cartão não deve ser confundida com o tipo de bilhete usado para precificar. O status continua vindo de `colaboradores.vt_bu_situacao` e `vt_bu_ativado`, com data de consulta separada.

Teste adicionado para “Suspenso Setrans” e ausência do aviso longo. Sem alteração de dados ou regra de cálculo.



---

## 45. Coluna BU na Riocard publicada — 17/11/2026

- Commit: **`7b1adb6 — VT: mostra situação do BU na Riocard em coluna curta`**.
- Deploy `6afcb7e40b92f2cc53b33c3f` no site `plena-corh`.
- Bundle local/remoto: **`assets/index-4iZttGhx.js`** (`confere: true`).
- A aba Trajetos mostra “Suspenso Setrans”, Ativado ou “não consultado” na coluna **BU na Riocard**, sem o aviso longo.
- Suíte final: **1.552 testes**, TypeScript, lint, RLS e build.
- `main` 4 commits à frente do origin, **sem push**. Árvore temporária removida e arquivos alheios preservados.



---

## 46. Pausa para retomada — dúvidas de apresentação, BU e Alcemir — 17/11/2026

A gestora pediu para interromper e retomar no dia seguinte. Também pediu explicitamente menos rodeio e resolução objetiva. **Não iniciar nova arquitetura, deploy ou alteração de dados ao retomar: responder primeiro às perguntas pendentes e apresentar a correção concreta.**

### O que foi feito nesta continuação

- Foram consultados, sem alteração de dados, os oito casos das capturas da aba Trajetos: Andressa, Angelo, Cleonice, Everaldo, José Robson, Rejane, Ronald e Vanderlei.
- Foi explicado que o aviso “o cadastro atual aponta outro posto” pode indicar histórico ou cobertura; não significa, por si só, erro.
- Foi confirmado que “Confirmado pelo RH” se refere ao trajeto/composição, não à ativação do BU.
- A coluna **BU na Riocard** mostra o último arquivo importado, não uma consulta ao vivo. Nos oito casos, `vt_bu_consultado_em = 2026-10-28`.
- José Robson e Ronald estavam com `vt_optante = false` na consulta; portanto, não entram na carga enquanto não optantes.
- Vanderlei tinha trajeto atual ABAETÉ confirmado com BU Niterói, mas BU “Suspenso Setrans” no arquivo de 28/10: precisa de revisão antes da próxima carga.
- Foi recomendada rotina mensal da Riocard antes da carga: arquivo completo → dry-run → relatório de mudanças/exceções → aplicação com backup → revisão humana. Sem trocar bilhete, preço ou carga automaticamente e sem cron enquanto a origem for um Excel exportado manualmente.
- Melhorias propostas, **não implementadas**: exigir a data do arquivo no importador, relatar optantes ausentes do arquivo, mostrar a data da consulta na tela e marcar consulta com mais de 31 dias.

Consultas e resultados preservados em:

- `dados-locais/vt_producao_2026-11-17/casos_revisao_final.sql` e `.json`;
- `dados-locais/vt_producao_2026-11-17/alcemir_recorrencia_endereco.sql` e `.json`;
- `dados-locais/vt_producao_2026-11-17/alcemir_itinerario.sql` e `.json`.

### Alcemir — fatos confirmados

- Cadastro consultado: **ALCEMIR BRAZ GENTIL**, matrícula 000852, ativo.
- O banco está hoje com endereço “Travessa Travessa Cosme e Damião, 0, CASA 05, Neves (Neves)”, cidade **São Gonçalo**, CEP 24425-700.
- A auditoria mostra que, antes de 30/10, o cadastro estava em Niterói, Travessa Cosme Damião, Fonseca, CEP 24130-330. Em **30/10/2026 às 06:30 UTC**, um UPDATE com `usuario_id = null` no horário do sync gravou São Gonçalo/Neves/24425-700.
- O sync mapeia diretamente `f.rua + f.numero + f.complemento + f.bairro` para `endereco` e `f.cidade/f.cep` para os demais campos, tanto em `useEContador` quanto na Edge Function. A API da Alterdata **não foi consultada ao vivo nesta continuação**; portanto, a origem atual na Alterdata ainda deve ser confirmada antes de afirmar que ela continua errada.
- Não há na auditoria posterior uma correção do cadastro de volta para Niterói. Em 16/11, o agente anterior alterou somente o escopo do trajeto para `intermunicipal` e a observação; **o endereço não foi corrigido**. Assim, não se deve dizer que o dado foi corrigido no banco e “voltou”: a correção anterior foi apenas do trajeto, e a resposta sobre São Gonçalo repetiu o cadastro sem validar o endereço real.
- O trajeto GREAT e a decisão nova continuam **sugeridos**, sem confirmação de preço.
- Existe evidência Google salva em 17/11 às 12:23 UTC com as linhas **62 → 39A**. A captura apresentada pela gestora mostra outra origem em Niterói e as linhas **15 → 48**. São evidências divergentes; a captura não é a rota gravada.
- A evidência persistida guarda as pernas, mas não grava explicitamente o texto de origem/destino enviado ao Google. Isso dificulta provar qual endereço gerou a alternativa e precisa ser tratado na revisão da solução.
- Nenhum dado foi alterado nesta investigação.

### Pergunta deixada pela gestora e ainda NÃO respondida

Na aba **VT → Colaboradores**, ela perguntou: **“De onde vem a informação da última coluna (‘Tipo de bilhete’)? Ela é fidedigna?”**

Ao retomar, verificar no código (`VtColaboradoresTab`, `useVt` e a carga inicial) e explicar diretamente a origem exata, quem altera o campo e sua relação — ou falta de relação — com a situação oficial `vt_bu_situacao`. Não presumir que seja dado ao vivo da Riocard nem que comprove o bilhete necessário para o trajeto.

### Retomada objetiva sugerida

1. Responder primeiro à pergunta sobre **Tipo de bilhete**, com origem e limites de confiabilidade comprovados no código/dados.
2. Confirmar com a gestora qual é o endereço verdadeiro do Alcemir. Se for Niterói, corrigir na **Alterdata** e reimportar; alterar apenas o CORH permitiria que o sync sobrescrevesse novamente.
3. Revisar a evidência GREAT depois do endereço correto e não confirmar preço com as evidências divergentes atuais.
4. Para impedir repetição, avaliar guarda objetiva: persistir origem/destino usados na consulta e exigir nova revisão quando o endereço mudar ou quando a evidência contrariar o município cadastral.
5. Só depois retomar a rotina mensal da Riocard e a carga.

Estado anterior mantido: `main` 4 commits à frente de `origin/main`, sem push; migrations 169–172 aplicadas; último deploy `6afcb7e40b92f2cc53b33c3f`, bundle `assets/index-4iZttGhx.js`. Nesta continuação houve apenas consultas e este registro documental, sem testes, build ou deploy.



---

## 47. Limpeza estática dos experimentos — 17/11/2026

Com autorização da gestora, foi feita uma limpeza fechada, sem alterar cálculo, tarifas, migrations, banco ou produção:

- removidas as telas e fixtures shadow de lote e revisão de rota, junto com seus testes de interface;
- removidos `classificarRota.ts` e seu teste, além dos scripts de POC `poc-rotas-api.ts`, `triagem-poc.ts` e `shadow-cotacao.ts`;
- removido o helper `compararPacoteLegadoComCotacao`, que só era usado pela POC;
- `VtRevisaoRota` agora recebe somente o contexto real, sem cenários fictícios ou ramificações shadow;
- as abas Carga e Trajetos não montam mais painéis experimentais;
- `googleRoutesFixture.ts` permanece porque é usado pelos testes do adaptador Google e dos repositórios reais.

Nenhum arquivo local não relacionado foi tocado. Verificação final: **125 arquivos e 1.522 testes passaram**, além de TypeScript do app, lint escopado, build de produção e `git diff --check`. O bundle não contém referências shadow nem ao classificador removido. Sem commit, deploy ou alteração de banco.



---

## 48. Preço da revisão passa a alimentar a carga — 17/11/2026

Foi corrigida a ruptura apontada de forma independente pelos cinco revisores: a revisão exibia uma cotação, mas o lote continuava usando somente os pacotes antigos.

### Implementado

- `vt_trajeto_decisoes.custo_diario_centavos` recebe o custo diário ida+volta da alternativa escolhida;
- salvar exige cotação `confirmavel` e preço inteiro positivo;
- confirmar exige itinerário e preço;
- nova revisão começa com preço NULL, sem herdar o da anterior;
- `resolverCustoDiarioNaData` prioriza o preço da revisão e usa os pacotes somente quando ele não existe, preservando o fallback legado;
- ajustes manuais vigentes continuam sendo somados ao preço confirmado.

### Provas

- teste de integração salva/confirma a revisão e verifica o mesmo valor no resolvedor do lote;
- preço revisado de 2.940 centavos vence pacote antigo mesmo sem componentes;
- ajuste vigente é somado ao preço revisado;
- cotação parcial é recusada antes de gravar evidência;
- confirmação sem preço é recusada;
- **125 arquivos e 1.526 testes passaram**, além de TypeScript, lint escopado, RLS, build e `git diff --check`.

### Banco e limites

`173_vt_preco_confirmado_decisao.sql` foi **APLICADA via Management API em 17/11/2026**, com autorização específica da gestora. Backup prévio em `dados-locais/backup_vt_173_2026-11-17/vt_dados.json` (9 bilhetes, 257 trajetos, 475 cargas, 263 decisões, 9 itinerários, 0 lotes). Antes, `scripts/vt/testar-173-transacao.ps1` executou migration + testes + rollback com sucesso: preço positivo aceito e zero recusado; `verificacao_rollback.json` confirmou coluna ausente e contagens preservadas. Depois, `verificacao_aplicacao.json` confirmou coluna e CHECK presentes, 0 decisões com preço revisado e todas as contagens preservadas. Nenhum trajeto, preço ou carga recebeu valor automaticamente. Nenhum commit ou deploy foi feito.



---

## 49. Limpeza e ligação de preço publicadas — 17/11/2026

- Commit do pacote VT: **`4083a92 — VT: limpa experimentos e liga preco revisado a carga`**.
- Deploy de produção no site correto `plena-corh`: **`6afde17f7aabdf44f6bf7666`**.
- Bundle local/remoto conferido: **`assets/index-DOdylkzC.js`**.
- Deploy feito uma única vez, com `--no-build`, a partir de árvore temporária limpa no commit da `main`; a árvore foi removida depois.
- `MODULO_FERIAS_LIBERADO = false` e `MODULO_VT_LIBERADO = true` conferidos.
- A migration 173 já estava aplicada antes do frontend; nenhum trajeto, preço ou carga recebeu valor automaticamente.
- A `main` está 6 commits à frente de `origin/main`, **sem push**. Arquivos alheios continuam preservados e fora do pacote.



---

## 50. Primeira confirmação real preço → carga — 18/11/2026

Foi validada em produção a revisão `c4b4370e-42de-4a17-8657-f6cf3bd7058e` (Acacio, uma condução municipal 39A), já sugerida e com itinerário salvo pela operação. O caso Alcemir não foi usado porque o endereço continua pendente.

- Executor: `scripts/vt/validar-preco-revisao-producao.ts`, via `npx vite-node` (o `tsx` não fornece `import.meta.env` aos módulos).
- Dry-run sem escrita: cotação `confirmavel`, custo **1.120 centavos/dia**, sem pendências.
- Backup anterior à escrita em `dados-locais/validacao_preco_revisao_173/`.
- Depois de `--aplicar`: status `confirmada`, `cotacao_id = tarifa_integral`, `custo_diario_centavos = 1120`.
- Uma segunda consulta ao banco conferiu status e preço; `resolverCustoDiarioNaData` devolveu **1.120**, com **0 componentes antigos** e **0 pendências**.
- Nenhum outro trajeto foi alterado. O script é repetível e preserva backup antes da escrita.
