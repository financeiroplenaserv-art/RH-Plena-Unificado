# Handoff — 28/08/2026 (tarde)

## Objetivo

Dois problemas relatados no **Adicionais → Calendário**:

1. O alerta "precisa de substituto" continuava aparecendo para o Alcemir
   (escala 12×36) mesmo com o substituto já definido nos dias de escala.
2. O campo "Não gerar adicional (controle interno)" (migration 105) "não
   estava funcionando" — segundo a usuária, "o campo não grava".

## Diagnóstico

### 1. Alerta de substituto (bug real — corrigido)

Consulta ao banco mostrou: Alcemir de férias de 11 a 19/08 nos dois vínculos,
com o substituto (Marcio) registrado **só nos dias de escala** (11, 13, 15, 17,
19). Os 4 alertas restantes (12, 14, 16, 18) eram as **folgas do 12×36** dentro
das férias — dias em que ninguém trabalha e que já transferem pelo pareamento
(dia de escala coberto transfere a folga seguinte). A função
`precisaSubstituto` exigia substituto em TODO dia ferias/afastado, inclusive
folgas.

**Correção:** novo helper `diaExigeSubstituto` em
`src/lib/adicionais/calculoAdicionais.ts` — férias/afastado só exigem
substituto em dia de escala (`escaladoParaTrabalhar`); falta e
folga_substituicao continuam sempre exigindo. Aplicado em
`AdicionaisCalendarioPage.tsx` (alertas e modal de lote usam o mesmo helper).
Testes adicionados em `calculoAdicionais.test.ts`. Confirmado com o usuário
antes de implementar.

### 2. "Sem adicional" não grava (sem defeito encontrado)

Verificado de ponta a ponta:

- A coluna `substituto_sem_adicional` existe em produção (migration 105).
- O bundle em produção (`index-BGeq_OVK.js`, conferido contra o site)
  **já contém** o código do checkbox e do upsert.
- A API aceita escrita na coluna (teste via REST retorna erro de RLS para
  anônimo, não de coluna inexistente).
- Os caminhos de gravação (modal dia único e modal em lote) passam o flag
  corretamente (`salvarSubstituicao`).

Provável causa do relato: a feature foi commitada em 27/08 à noite e o
**deploy só aconteceu na manhã de 28/08** — o teste da usuária foi antes do
deploy (ou com bundle antigo do PWA). Agravante: **reimportar o ponto apaga os
substitutos do período** (comportamento intencional, 01/08) — houveram
reimportações hoje, então substituições feitas antes sumiram.

**Pendente:** pedir à operadora Ctrl+Shift+R e refazer o teste do checkbox.
Se ainda assim não gravar, investigar com ela ao vivo.

## Validações

- `npm test`: 343 testes passam (33 arquivos) — inclui os novos testes de
  `diaExigeSubstituto`.
- `npm run lint`: passa.
- `npm run build`: passa.

## Docs atualizados

- `docs/REGRAS_NEGOCIO.md` — regra do alerta só em dia de escala.
- `AGENTS.md` — mesma nota na seção de regras de negócio.
