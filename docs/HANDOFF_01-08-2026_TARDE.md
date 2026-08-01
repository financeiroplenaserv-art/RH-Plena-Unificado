# Handoff — 01/08/2026 (tarde: nova regra de insalubridade/periculosidade, financeiro em ocorrências, filtro de adicional)

> Passagem para o próximo agente. Sessão da tarde de 01/08. **Migration 098 APLICADA via `db query --linked` em 01/08/2026 e verificada** (linhas do financeiro e função `pode_ver_ocorrencias` confirmadas no banco). Deploy Netlify pendente (há também as mudanças da manhã sem deploy).

## 1. Nova regra de insalubridade/periculosidade (decisão da gestão, 01/08/2026)

Substitui a regra anterior ("12×36 sempre 30 dias cheios"). Texto completo em `docs/REGRAS_NEGOCIO.md`.

- **Titular (qualquer escala):** `30 − faltas − dias de férias/afastado cobertos por substituto`.
  - Trabalhou tudo → 30 (12×36 ou não).
  - Férias/afastado **sem substituto registrado** não transferem dias (titular mantém 30 − faltas).
  - Falta antes das férias desconta da parte dele (confirmado).
  - Afastado (atestado/INSS) segue a mesma regra de férias (confirmado).
  - No 12×36, a conta equivale a "trabalhados + folgas" da parte ativa; nas demais escalas, aos **dias corridos** da parte dele no mês (confirmado).
- **Substituto puro** (linha criada só por cobertura, sem vínculo próprio no contrato):
  - **Insalubridade:** todos os dias cobertos (falta/folga_substituicao + férias/afastado).
  - **Periculosidade:** **apenas** os dias de férias/afastado cobertos — cobertura de falta NÃO gera periculosidade.
- Implementação: funções puras em `src/lib/adicionais/calculoAdicionais.ts` (`adicionalTitular30`, `insalubridadeSubstituto`, `periculosidadeSubstituto`, 12 testes novos) + fechamento em `AdicionaisRelatorioPage.tsx` (mapas `transferidosPorChave`, `cobertosFeriasAfastPorChave`, `cobertosFaltaFolgaPorChave`, `chavesSubstitutoPuro`).
- **Premissas operacionais documentadas:** o substituto deve ser registrado em TODOS os dias do bloco de férias/afastado (a tela já tem definição em lote); `folga_substituicao` coberta conta insalubridade para o substituto sem descontar o titular (comportamento pré-existente); base fixa de 30 dias mantida.
- Edge case conhecido: substituto que TAMBÉM tem vínculo próprio no mesmo contrato é tratado como titular (fórmula 30 − faltas − transferidos); não separado.

## 2. Financeiro: quadro do colaborador + criar ocorrências (migration 098)

- Decisão da gestão (01/08/2026). O detalhe do colaborador já abria para financeiro (rota + SELECT de colaboradores existiam) — a seção de ocorrências é que zerava em silêncio (RLS).
- **Migration 098** (`supabase/migrations/098_financeiro_ocorrencias.sql`): `pode_ver_ocorrencias()` +financeiro; INSERT de `ocorrencias` +financeiro (UPDATE/DELETE não); linhas dinâmicas `rota.ocorrencias`, `menu.rh`, `ocorrencia.criar`, `ocorrencia.ver_detalhes` e `colaborador.ver_cpf_completo` = true. ✅ **Aplicada via `db query --linked` em 01/08/2026 e verificada** (linhas e função confirmadas no banco).
- `PERMISSOES_PADRAO` espelhado (`ocorrencia.criar` e `ver_detalhes` +financeiro) e teste de permissões atualizado.
- UI (`ColaboradorDetailPage`): botão "Nova Ocorrência" passou de `ocorrencia.editar` para `ocorrencia.criar`.
- **CPF completo para o financeiro** (pedido na mesma sessão): nova ação `colaborador.ver_cpf_completo` no mapa padrão (gestor/rh/dp1/dp2/financeiro) + linha dinâmica na 098 + entrada na tela Permissões; listagem (`ColaboradoresPage`) e ficha (`ColaboradorDetailPage`) usam o helper `podeVerCPFCompleto` (antes: `editar_completo`). Mesa/inspetoria/visualizador seguem com CPF mascarado.
- Limitação conhecida: `reset_permissoes_perfil` (054) tem lista fixa — "Restaurar padrão" do financeiro remove as concessões (mesma limitação das migrations 069/089).

## 3. Filtro de adicional nas páginas Contratos e Vínculos

- Mesmo Select do Relatório (Todos, Noturno, Periculosidade, Insalubridade, Intrajornada, Feriado).
- **Contratos**: filtra pelo flag do contrato (`c.adicionais[key]`); lista filtrada extraída em `contratosFiltrados`.
- **Vínculos**: filtra pela lista de adicionais **do próprio vínculo** (pode ser subconjunto do contrato); vínculo antigo sem lista cai no flag do contrato.

## Estado final

- `npm run lint` — limpo · `npm test` — **234 passando, 1 skipped** (rls.test, sem Python) · `npm run build` — ok
- Migration 098 **aplicada e verificada em produção** (01/08/2026). Deploy Netlify **não feito** (acumulou manhã + tarde).

## Pendências

- **Deploy Netlify** desta sessão (1 deploy agrupando tudo).
- Validar com um usuário financeiro: abre ficha do colaborador (CPF completo agora), vê a seção de ocorrências preenchida, cria uma ocorrência.
- Validar em produção a nova regra de adicionais num caso real (ex.: titular 12×36 com férias cobertas — conferir titular = trabalhados+folgas e substituto = outra parte; titular com falta coberta — insalubridade do substituto = dias cobertos, periculosidade = 0).
- Validar filtro de adicional nas três telas (Contratos, Vínculos, Relatório).
- Pendências antigas (handoff da manhã): validações de produção (feriados, assinatura, "Lançado em"), recibo do Ricardo, importação unificada (~60 ocorrências), revisão visual dos menus por perfil, casos ambíguos da varredura anti-falso-sucesso.
