# Débito Técnico — Type Assertions (`as X`)

## Contexto
Durante as Fases 5 e 7 de revisão de type assertions, reduzimos o número de casts no projeto, mas alguns permanecem por limitações técnicas legítimas. Este documento lista os casts remanescentes, a justificativa para mantê-los e o que precisa ser feito para eliminá-los no futuro.

## Motivo do débito técnico principal
O arquivo `src/types/database.ts` define o tipo `Database` usado pelo `createClient<Database>`, mas as propriedades `Relationships` de todas as tabelas estão vazias (`Relationships: []`).

Sem as relações declaradas, o Supabase client TypeScript não consegue inferir corretamente:
- Joins com colunas específicas (`tabela!coluna_fk(col1, col2)`).
- Consultas simples com `.select('col1, col2')` em alguns cenários (retornam tipos intermediários que não casam diretamente com o tipo de domínio).

O runtime continua funcionando, mas o type-checker emite `SelectQueryError` ou tipos incompatíveis, o que impede o build sem casts.

## Casts de Supabase que permanecem

### 1. Joins com colunas específicas (`as unknown as T[]`)
Esses casts só podem ser removidos após as `Relationships` serem declaradas no `Database`.

- `src/hooks/useOcorrencias.ts` — join `colaborador:colaborador_id(...)` na listagem de ocorrências.
- `src/hooks/useCEUEntregas.ts` — joins `colaborador:colaborador_id(...)` e `item:item_id(...)`.
- `src/hooks/useAlertas.ts` — join `colaborador:colaborador_id(...)` e `ocorrencias(...)`.
- `src/hooks/useEscalasDiario.ts` — join de colaboradores com escala.
- `src/hooks/useEscalasMapeamento.ts` — join de colaboradores e escalas.

### 2. Selects simples sem joins (`data as T[]`)
Esses casts também dependem de uma tipagem mais precisa do `Database`. Em muitos casos, o retorno do Supabase vem como `T[] | null`, mas o tipo inferido não casa com o tipo de domínio (especialmente quando há `enum` ou campos opcionais mapeados manualmente).

- `src/hooks/useEmpresas.ts`
- `src/hooks/useColaboradores.ts`
- `src/hooks/useDepartamentos.ts`
- `src/hooks/useEscalasLocais.ts`
- `src/hooks/useCEUItens.ts`
- `src/hooks/useCEUFornecedores.ts`
- `src/hooks/useAnexos.ts`
- `src/hooks/useExtras.ts`
- `src/hooks/useExtrasRecibos.ts`
- `src/hooks/useProjetosVR.ts`
- `src/hooks/useResultadosVR.ts`
- `src/hooks/useTestemunhas.ts`
- `src/hooks/useAuditoria.ts`
- `src/hooks/usePermissoes.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useConfiguracaoVR.ts`

## Casts legítimos que devem permanecer

### 3. Bibliotecas externas sem tipos precisos
- `src/lib/pdf.ts` e `src/lib/extrasRecibos.ts`: `doc as JsPDFWithAutoTable` — necessário porque a extensão `jspdf-autotable` adiciona métodos em runtime que não estão no tipo base do `jsPDF`.

### 4. Eventos e DOM
- `src/components/AutocompleteColaborador.tsx`: `e.target as Node` — cast necessário para que `Node.contains` aceite o event target tipado como `EventTarget`.

### 5. Mocks e testes
- `src/lib/escalas/importarFlit.test.ts`: `as Colaborador` — mock de teste com dados parciais, seguro em contexto de teste.

### 6. Estados temporários inválidos (valores literais)
Alguns formulários usam string vazia como estado inicial para selects obrigatórios, o que conflita com tipos de enum. O build não aceita a string vazia sem cast.

- `src/pages/extras/ExtrasFormPage.tsx`: `'' as CategoriaOcorrencia`
- `src/pages/extras/ExtrasPlantaoPage.tsx`: `'' as MotivoExtra`

> Esses casts devem ser eliminados quando os formulários forem refatorados para usar um valor padrão válido do enum (ex: `'padrao' as CategoriaOcorrencia`) ou quando o tipo permitir um estado vazio explícito (`null` ou `undefined`).

## O que fazer para quitar o débito
1. Gerar/atualizar o tipo `Database` a partir do schema real do Supabase (ex: `supabase gen types typescript --project-id ... --schema public > src/types/database.ts`).
2. Se a geração automática não preencher as `Relationships`, adicionar manualmente as foreign keys conhecidas no tipo `Database`.
3. Após as relações estarem declaradas, remover os casts de Supabase (`as unknown as T[]` e `data as T[]`) nos hooks listados acima.
4. Revisar formulários com estados iniciais inválidos e substituir por valores padrão válidos ou tipos que permitam vazio.
5. Reavaliar os casts de bibliotecas externas e DOM quando atualizar as dependências; eles podem se tornar desnecessários se novas versões dos pacotes trouxerem tipos mais precisos.

## Impacto de quitar o débito
- Redução do número de type assertions (`as X` / `as unknown as X`) no projeto.
- Segurança de tipos melhorada em todas as consultas do Supabase.
- Menos risco de erros silenciosos quando novas colunas forem adicionadas ou quando os tipos de domínio forem alterados.
- Build mais confiável e mensagens de erro do TypeScript mais úteis.

## Quando fazer
Recomendado após as fases de alto impacto imediato (segurança, performance, manutenibilidade). Pode ser feita em paralelo a testes de regressão.

## Relacionado
- Prioridade #5 da análise externa: revisar as 253 type assertions (`as X`) no projeto.
- Fase 5: otimização de queries Supabase.
- Fase 7: revisão de type assertions.
