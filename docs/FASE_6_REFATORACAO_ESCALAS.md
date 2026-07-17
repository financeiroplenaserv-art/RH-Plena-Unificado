# Fase 6 — Refatoração de Manutenibilidade: EscalasPage

## Status
Concluída — primeira página da Fase 6 refatorada com sucesso.

## O que foi feito
- Extraída a aba `AbaEscalasDiario` para `src/pages/escalas/AbaEscalasDiario.tsx`.
- Extraída a aba `AbaEscalasLocais` para `src/pages/escalas/AbaEscalasLocais.tsx`.
- Extraída a aba `AbaEscalasMapeamento` para `src/pages/escalas/AbaEscalasMapeamento.tsx`.
- Extraída a aba `AbaEscalasImportar` para `src/pages/escalas/AbaEscalasImportar.tsx`.
- Criado `src/pages/escalas/escalas.constants.ts` para constantes compartilhadas (`FONTES_INFO`, `TIPOS_MATCH`).
- `EscalasPage.tsx` reduzida de 881 para 45 linhas: agora é apenas orquestrador de tabs, sem lógica de negócio nem JSX de abas.
- Lógica e JSX das abas mantidos intocados — a refatoração foi mecânica e de baixo risco.

## Validação
- `npm run build`: ✅ passou
- `npm run test`: ✅ 96 testes passando
- `npm run lint`: ✅ sem erros

## Padrão estabelecido
1. Cada aba vira um arquivo `AbaEscalas<Nome>.tsx` em `src/pages/escalas/`.
2. Constantes compartilhadas ficam em `escalas.constants.ts`.
3. `EscalasPage.tsx` mantém apenas:
   - Estado da aba ativa.
   - Renderização do `Tabs`/`TabsContent`.
   - Handler de navegação para trás (`handleBack`).
4. Cada aba continua responsável por seus próprios hooks e estado local.

## Próximos passos
1. **Segunda rodada em `EscalasPage` (opcional):** avaliar se há lógica repetida entre as abas que mereça virar hooks dedicados (ex.: filtros input/aplicado, exportação Excel/PDF). Isso pode ser feito depois, se necessário.
2. **Aplicar o mesmo padrão em outras páginas grandes**, começando por `CeuRelatoriosPage.tsx` (837 linhas, 5 abas independentes).
3. Continuar a Fase 6 em outras páginas grandes: `MobileFaltaPage.tsx`, `OcorrenciaFormPage.tsx`, `OcorrenciaDetailPage.tsx`, `EscalasPage.tsx` (já feita).

## Notas
- As abas extraídas ainda carregam lógica própria significativa. Isso é esperado; a prioridade desta rodada foi separar as abas em arquivos. A extração de hooks pode vir na segunda rodada.
- Nenhuma alteração de comportamento foi introduzida; apenas reorganização de código.
- A redução drástica de `EscalasPage.tsx` demonstra o valor do padrão: um arquivo gigante virou um orquestrador legível.

## Pausa para testes práticos
A Fase 6 foi pausada após a refatoração de `EscalasPage` e `CeuRelatoriosPage` para que o usuário valide manualmente se as telas continuam funcionando como antes. Antes de continuar com outras páginas, testar:
- Navegação entre as abas.
- Filtros, exportações e confirmações manuais/em lote.
- Importação de Excel do Flit.
- Relatórios CEU em todas as 5 abas.
