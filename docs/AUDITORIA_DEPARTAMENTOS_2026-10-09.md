# AUDITORIA PROFUNDA — Departamentos (dados + código) — 09/10/2026

> Pedido da gestão após problemas de filtro por departamento "em todo o sistema".
> Executada por 3 agentes de auditoria independentes (somente leitura — nada foi alterado):
> **A. Dados** (inventário do banco + revisão das alterações de 09/10), **B. Filtros** (todos os
> caminhos de busca por departamento), **C. Exibição/Seletores** (onde o departamento é mostrado,
> escolhido, exportado ou criado). Método: SELECTs via Management API (UTF-8) + replay da lógica
> real do app (`src/lib/departamentos.ts`) sobre os dados de produção + backups × estado atual
> + `log_auditoria`.

---

## 1. Resumo executivo

- **102 departamentos**: 83 Ativas, 19 Inativas; **30 sem nome_curto** (13 Ativas, 17 Inativas) —
  a premissa "todo departamento tem nome longo E curto" **não se confirma no cadastro real**:
  a maioria das linhas sem nome_curto foi criada **pelo próprio sync do e-Contador** (lotes de
  25/06, 22/07 e 30/07, antes da correção de match fuzzy de 05/09), que até hoje **cria
  departamento novo sem nome_curto** (origem contínua do problema).
- **526 colaboradores** (318 ativos): nenhum aponta por id para linha Inativa; os 51 com id →
  linha sem nome_curto são **todos inativos** (contratos encerrados). 330 só têm texto legado
  (234 ativos) — todos resolvem para alguma linha, **mas 2 casos errados NÃO foram cobertos
  pelas correções de 09/10**: DUOCONNECT (3 ativos → linha **Inativa**) e 3º OFÍCIO (2 ativos →
  linha Ativa **sem nome_curto**, tendo irmã CARTÓRIO).
- **Das 6 alterações de 09/10**: 1, 2, 4 e 6 **conformes**; a 3 (nome_curto numa linha Inativa —
  CBO Macaé) é exceção defensável, sem uso hoje; a 5 (DALIAS) **requer decisão da gestão**
  (fatos no §4). Nenhuma alteração criou ou reativou departamento — foram só updates de
  `nome_curto` em linhas existentes e repoint de colaboradores (conferido no `log_auditoria`).
- **Bugs de CÓDIGO confirmados (independentes das alterações de dados)**:
  - **P0** — a listagem de Colaboradores filtra por id **sem expandir irmãs** → "CARTÓRIO" (2) e
    "DUOCONNECT" (3) retornam **0 sempre** (`useColaboradores.ts:54-68`).
  - **P0** — `DepartamentoAutocomplete` **não deduplica**: BLUE TERMINAL, CNOOC e NUTRINDO IDEAIS
    aparecem 2×; uma das opções retorna 0.
  - **P1** — resolução fuzzy **depende da ordem do array** (27 ativos em 5 textos legados);
    `buscarIdsDoGrupo` exclui irmãs Inativas; `FeriasPage` resolve com a lista errada;
    filtro por departamento de Adicionais compara `===` na FK sem expansão.
- **Exibição está saudável**: 0 divergências hoje — todos os pontos documentados usam
  `nomeCurtoDepartamentoFuzzy` com lista completa.

## 2. Dados — inventário e anomalias

### 2.1 Linhas ATIVAS sem nome_curto (13) — violação da regra

| nome | uso |
|---|---|
| NICE SERVIÇOS COMERCIAIS DE LIMPEZA | 18 inativos |
| CONDOMINIO AVANT GARDE RESIDENCE | 7 inativos |
| CONDOMINIO DO EDIFICIO CHARITAS GOLDEN VIEW | 6 inativos |
| COND EDIF RESID BURLE MARX | 4 inativos |
| CULTURA INGLESA S/A | 4 inativos |
| PINTO DE ALMEIDA ENGENHARIA SA | 4 inativos |
| J P R PROJETOS E CONSTRUCOES LTDA | 4 inativos (texto) |
| NELSON TOMAZ BRAGA ADVOGADOS | 3 inativos |
| COND EDIF JARD. ACACIAS E TULIPAS | 2 inativos |
| **3 OFICIO DE NOTAS DA COMARCA DE NITEROI** | **2 ATIVOS (texto)** ⚠ |
| BANCO BANKPAR S.A. | 1 inativo |
| COND. EDIF. SAINT THOMAS | 1 inativo |
| DOCELAR REPOUSO PARA IDOSO LTDA | 1 inativo |

Todas criadas pelo sync e-Contador em 22/07/2026. Só 3º OFÍCIO tem ativos. As **17 Inativas sem
nome_curto** têm **zero uso** (lixo de duplicadas: ALIANCA×2, BANKPAR, ACACIAS, BURLE MARX,
SAINT THOMAS, AVANT GARDE, CARMO CAMPANELLA, CHARITAS, MATIZES ICARAI, CULTURA INGLESA, DOCELAR,
DUOCONNECT, JPR, NELSON TOMAZ, NICE, PINTO DE ALMEIDA).

### 2.2 nome_curto compartilhado por nomes longos diferentes (4 casos, todos de 09/10)

1. BLUE TERMINAL: `bd44119a` (Ativa, 0 colabs) × `8fa6b81f` (Ativa, 1 ativa)
2. CBO MACAÉ: `5e42bb43` (**Inativa**) × `7503715c` (Ativa, 11 colabs)
3. CNOOC PETROLEUM BRASIL LTDA: `b6a07cb5` (Ativa, 0) × `87027244` (Ativa typo "CNOCC", 3 ativos + 1 inativo)
4. NUTRINDO IDEAIS: `307e0f7b` (Ativa LTDA — **dona do contrato de adicionais**) × `bcfa7570` (Ativa, Luzia)

Pares de grafia parecida que são **postos distintos** (não fundir): ADRIANA/THATIANA/CRISTIANA/JARDINS;
DALIAS/ROSAS/QUATRE/LAGOA MAR; MACEDO/NISE.

### 2.3 Resoluções erradas não cobertas em 09/10

- **DUOCONNECT** — 3 ativos (ELIANA SILVINO DOS SANTOS, FABIANA LIMA DA SILVA, REJANE CHAGAS DA
  SILVA) resolvem para a linha **Inativa** `a0215f64` (match exato vence); a Ativa `3c68d824`
  (curto DUOCONNECT) fica sem uso. Única violação ativa de "somente ativos".
- **3º OFÍCIO** — 2 ativos (ISABEL PEREIRA DE SOUSA, JOANE RODRIGUES DOS SANTOS) resolvem para a
  Ativa sem curto `7618eb6a`; a irmã `796b1a1e` tem curto CARTÓRIO.

### 2.4 Outras tabelas

FKs para `departamentos`: só `colaboradores`, `contratos_adicionais` e `extras` — **0 referências**
a inativas/sem-curto/órfãs nos contratos e extras. Escalas usa tabela própria (`locais_trabalho`),
sem FK. `testemunhas.departamento` e `extras.departamento_nome` são texto livre (por desenho).

## 3. Código — mapa de conformidade (B + C consolidados)

### Filtros

| Caminho | Arquivo:linha | Status |
|---|---|---|
| **Listagem Colaboradores (filtro)** | `useColaboradores.ts:54-68` | **FALHO** — id exato, sem expansão de irmãs → CARTÓRIO/DUOCONNECT = 0; opção duplicada "errada" = 0 |
| Listagem (por termo) | `useColaboradores.ts:69-91` | Conforme (`idsColaboradoresDoDepartamento`) |
| AutocompleteColaborador (grupo) | `AutocompleteColaborador.tsx:82-107` | **RISCO** — expansão só entre Ativas |
| CEU Relatórios / Movimentações | `useFiltrosRelatorio.ts:38-48`; `useCEUEntregas.ts:114-124` | Conforme |
| Extras (formulários, balanço, mobile) | vários | Conforme (seletores com dedup; snapshot histórico) |
| Adicionais (contratos/vínculos/calendário/relatório) | `AdicionaisContratosPage.tsx:195` etc. | **RISCO** — `===` na FK sem expansão (caso NUTRINDO IDEAIS) |
| Escalas (inferência) | `inferirLocalTrabalho.ts` | Conforme (mecanismo próprio) |
| Férias (lista) | `FeriasPage.tsx:126,166-176` | **RISCO** — resolve com `useDepartamentos.listar()` (filtra nome_curto — uso proibido pelo AGENTS.md) |
| Quadro | `QuadroColaboradoresPage.tsx` | Conforme |

### Seletores

| Seletor | Status |
|---|---|
| `DepartamentoAutocomplete` (usado em Colaboradores, CEU, Adicionais) | **FALHO** — não deduplica (3 nomes 2×) |
| Quadro / Extras / Falta Mobile | Conforme (dedup por nome_curto) |
| Tela Departamentos (cadastro) | **FALHO** — lista só linhas COM nome_curto: 17 Ativas sem curto invisíveis e sem caminho de correção na UI |

### Criação/duplicação de departamentos

| Caminho | Match antes de criar? | Grava nome_curto? |
|---|---|---|
| e-Contador manual (`useEContador.ts:143-163`) | Sim (fuzzy, só Ativas) | **NÃO** ⚠ |
| Edge Function `sync-econtador` (:361-409) | Sim | **NÃO** ⚠ (fonte contínua — roda agendado) |
| Importação CSV (DepartamentosPage:242-278) | **NENHUM** ⚠ | Aceita null |
| Formulário manual | Não, mas exige nome_curto | Sim |

### Riscos latentes

1. **Ordem do array decide a resolução** — `encontrarDepartamentoFuzzy` não desempata por
   status/nome_curto; 27 ativos (CARMO ×8, DALIAS ×10, 3 OFICIO ×2, DUOCONNECT ×3, JPR ×4)
   resolvem diferente conforme a ordenação — e as telas carregam a lista com ordenações
   diferentes (`order('nome_curto')`, `order('nome')`, sem ordenação).
2. **Substring cruzada CBO × CBO MACAÉ** — "CBO" é substring de "CBO ..."; hoje nenhum texto real
   cai nesse passo, mas um futuro "CBO LOGISTICA" poderia resolver para a Aliança (Niterói).
3. **Expansão exige grafia normalizada idêntica** — duplicada futura com grafia divergente E sem
   nome_curto fica invisível.
4. **Filtro persistido órfão** — id salvo em `useFiltroPersistente` que deixa de existir →
   tela vazia sem explicação.
5. nome_curto "longo": CNOOC PETROLEUM BRASIL LTDA, PLENA TECH ADMINISTRATIVO e QUINCAS
   PATRIMONIAL têm o nome longo repetido no campo curto.

## 4. O caso Dalias (fatos, sem decisão)

- A folha/e-Contador/Flit traz **10 colaboradores ativos** com departamento "CONDOMINIO DO
  EDIFICIO RESIDENCIAL DALIAS" (nenhum inativo).
- A linha com curto DALIAS (`97806df1`) foi **deliberadamente inativada em 18/07/2026**; a Ativa
  atual (`52e9ab9f`) foi **criada pelo sync do e-Contador em 22/07** e ficou sem curto até 09/10.
- Em **08/10 a gestão validou** o quadro com ITAGUAÍ (12) + DALIAS (10) = 22 (handoff + PDFs).
- **Escalas** trata Dalias e Rosas como UM local (mapeamentos "DALIAS"/"ROSAS" → CHÁCARA ITAGUAÍ);
  **Adicionais** só tem contrato para Rosas/ITAGUAÍ; a planilha da gestão não cita Dalias.

Opções: **(a)** manter DALIAS (coerente com folha e quadro aprovado); **(b)** fundir os 10 em
ITAGUAÍ — repoint para `8eb83a32`, inativar `52e9ab9f`, curto volta a só existir na Inativa
`97806df1` (alinha com Escalas/Adicionais/planilha; risco: novos textos "…DALIAS" do e-Contador
resolvem para a Inativa por match exato — mitigável); **(c)** reverter a alteração 5 (não
recomendado — os 10 voltam a ficar invisíveis).

## 5. Correções propostas

### Código (P0 → P3)

1. **P0** `useColaboradores.montarQuery`: caminho `departamentoId` deve expandir irmãs (delegar a
   `idsColaboradoresDoDepartamento`), com teste.
2. **P0** `DepartamentoAutocomplete`: dedup por `normalizarDepartamento(nome_curto)` (padrão do
   quadro/extras — candidato a helper único `departamentosSelecionaveis`).
3. **P1** `encontrarDepartamentoFuzzy`: desempate determinístico (Ativo > tem nome_curto > nome
   mais longo) em cada passo — remove a dependência da ordem do array.
4. **P1** `buscarIdsDoGrupo`: remover `.eq('status','Ativo')` da expansão (alvo segue Ativo).
5. **P2** `FeriasPage`: fonte de resolução = consulta completa (padrão das demais telas).
6. **P2** Filtro persistido órfão: resetar para 'todos' quando o id não existe mais.
7. **P2** Adicionais: filtro por departamento pelo grupo (expandir irmãs).
8. **P3** Guarda de substring (nome_curto muito mais curto que o texto não casa — blinda CBO × CBO MACAÉ).
9. **P3** e-Contador (manual + job): gravar nome_curto provisório ou sinalizar para revisão ao criar.
10. **P3** Importação CSV de departamentos: match + exigir nome_curto. Tela Departamentos: listar
    linhas sem nome_curto (seção de pendências).

### Dados (SQL sugerido, NÃO executado — backups antes)

- **P1 DUOCONNECT**: repoint dos 3 ativos para `3c68d824` (Ativa).
- **P1 3º OFÍCIO**: repoint dos 2 ativos para `796b1a1e` (CARTÓRIO); inativar `7618eb6a`.
- **P2 Consolidação das 3 duplicadas Ativas**: Blue Terminal (Maria → `bd44119a`, inativar
  `8fa6b81f`), CNOOC (4 → `b6a07cb5`, inativar `87027244`), Nutrindo Ideais (Luzia → `307e0f7b`,
  inativar `bcfa7570`). Verificado com a lógica real: o sync do e-Contador (só Ativas) resolve os
  textos antigos para a linha mantida — não recria duplicada.
- **P2 Lixo**: 17 Inativas sem curto sem uso → delete (precedente: migrations 021/022/024/025).
- **P2 12 Ativas sem curto sem ativos**: inativar (precedente: migration 038) — confirmar que são
  contratos encerrados.
- **P3 CBO Macaé Inativa** (alteração 3): manter ou voltar nome_curto=null — impacto só cosmético.

## 6. Decisões pendentes da gestão

1. **Dalias**: manter (a), fundir em ITAGUAÍ (b) — ver §4.
2. Autorizar correções de dados do §5 (P1 imediatas; P2 consolidação/limpeza).
3. Autorizar correções de código P0/P1 (e janela de deploy).
4. Manter ou reverter o nome_curto da Inativa CBO Macaé (alteração 3).
5. As 12 Ativas sem curto sem ativos são contratos encerrados? (inativar?)

---

*Auditoria somente leitura. Backups das alterações de 09/10 em `dados-locais/`.*

## 7. Execução das correções (09/10/2026, noite) — APLICADO

Decisões da gestão: **Dalias fundida em ITAGUAÍ**; **aplicar correções de código**; **executar todo o
plano de dados**; **inativar as 12 Ativas sem nome_curto** (contratos encerrados).

**Dados (Management API, backups antes de cada bloco — `dados-locais/backup_departamentos_completo_2026-10-09_noite.json`,
`backup_colabs_fusoes_2026-10-09_noite.json`, `backup_lixo_departamentos_deletados_2026-10-09.json`):**
1. Dalias → ITAGUAÍ: 10 colaboradores repontados para `8eb83a32`; `52e9ab9f` inativada (ITAGUAÍ = 22).
2. Blue Terminal: Maria → `bd44119a`; `8fa6b81f` inativada.
3. CNOOC: 4 colaboradores → `b6a07cb5`; `87027244` (typo CNOCC) inativada.
4. Nutrindo Ideais: Luzia → `307e0f7b`; `bcfa7570` inativada.
5. DUOCONNECT: 3 ativos → `3c68d824` (saíram da linha Inativa).
6. 3º OFÍCIO: 2 ativos → `796b1a1e` (CARTÓRIO).
7. Inativadas 13 Ativas sem nome_curto (as 12 autorizadas + 3º OFÍCIO `7618eb6a`).
8. Deletadas 17 Inativas sem nome_curto — zero referências verificado antes (colaboradores,
   contratos_adicionais, extras).

**Verificação final (lógica real do app sobre produção):**
- 0 linhas Ativas sem nome_curto · 0 nome_curto duplicado entre Ativas
- 318/318 colaboradores ativos resolvem para linha Ativa com nome_curto (0 sem resolução,
  0 para Inativa, 0 para sem-curto)
- Quadro: ITAGUAÍ 22 · CBO 16 · CBO MACAÉ 7 · CARTÓRIO 2 · DUOCONNECT 3 · BLUE TERMINAL 1 ·
  CNOOC 3 · NUTRINDO IDEAIS 1 · 0 ativos fora de posto; postos com 0 só os 4 legítimos.

**Código (mesmo commit da documentação):** os 4 bugs do §3 corrigidos — ver bullet
"Departamentos — auditoria profunda e consolidação" no AGENTS.md §11. 583 testes passando
(14 novos), tsc/ESLint/build verdes. Deploy único em produção ao final.

**⚠️ Ressalva registrada:** enquanto a Alterdata/e-Contador continuar mandando departamento
"…RESIDENCIAL DALIAS" (e demais textos de linhas inativadas), novos colaboradores só-texto
resolverão para a linha Inativa (exibição sai pelo nome_curto dela, mas não entram no grupo da
Ativa). Correção definitiva é na fonte (e-Contador) ou a dívida P3 (sync gravar/sinalizar
nome_curto ao criar).
