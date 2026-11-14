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
