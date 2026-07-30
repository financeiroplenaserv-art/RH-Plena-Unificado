# Auditoria — Divergências permissoes_perfil × PERMISSOES_PADRAO (30/07/2026)

> Origem: pendência arrastada dos handoffs de 29/07 ("33 divergências"). Recontagem
> em 30/07: **34 divergências** (uma nova surgiu desde então). Script reproduzível:
> `npx tsx scripts/auditar-divergencias-permissoes.ts` (compara a tabela do banco
> com o `PERMISSOES_PADRAO` exportado de `src/lib/permissoes.ts`).
>
> Contexto: a tela Permissões grava em `permissoes_perfil` e esse valor **tem
> precedência** sobre o mapa padrão. O backend (RLS/RPC), porém, usa listas fixas
> de perfis (`is_editor()`, `pode_ver_*()`, EXISTS inline). Quando a tela concede
> além do padrão, o banco pode bloquear — e UPDATE/DELETE falham **em silêncio**
> (0 linhas, sem erro; a UI mostra toast de sucesso). Foi o padrão dos 3 bugs de
> 29/07 (migrations 081–083).

## Resultado da avaliação

### A. Concessões da tela que o backend bloqueava — CORRIGIDAS (migration 087)

| Perfil | Permissão | Bloqueio no backend | Correção |
|---|---|---|---|
| dp1, dp2 | departamento.excluir | DELETE só gestor/financeiro/admin/rh — falha silenciosa | policy DELETE inclui dp1/dp2 |
| dp2, mesa | extras.cancelar_recibo | RPC `cancelar_recibo_extras` só admin/adm/financeiro | RPC inclui dp2/mesa |
| dp2, inspetoria | extras.ver_relatorio | `pode_ver_extras()` sem dp2/inspetoria — tela vazia | função inclui dp2/inspetoria |
| dp2 | extras.ver_balanco | idem | idem |
| inspetoria | ocorrencia.criar / editar / aprovar | INSERT/UPDATE sem inspetoria | policies incluem inspetoria |
| dp1 | adicionais.editar_* (dinâmico) e ver_relatorio (já no padrão!) | `pode_ver_adicionais()` sem dp1 — tela vazia | função inclui dp1 |

### B. Mesma falha já no mapa padrão (não eram divergências) — CORRIGIDAS (087)

| Perfil | Permissão (padrão) | Bloqueio | Correção |
|---|---|---|---|
| inspetoria | extras.editar | INSERT/UPDATE de `extras` = `is_editor()` — só funcionava via RPC do mobile | policies incluem inspetoria |
| financeiro, inspetoria | extras.editar_categoria | INSERT/UPDATE de `categorias_extras` = `is_editor()` | policies incluem os dois |
| mesa, financeiro | extras.excluir_categoria | DELETE de `categorias_extras` = `is_admin()` | policy DELETE inclui os dois |

### C. Concessões da tela que já funcionavam no backend — nada a fazer

- dp1 `vr.gerenciar` (policies `pode_ver_vr()` + RPC is_editor + migration 083 no storage)
- dp2 `extras.gerenciar_recibo` (função da 081 inclui dp2) e `extras.marcar_pago` (is_editor)
- mesa `ocorrencia.aprovar`, dp2 `ocorrencia.cancelar` (is_editor)
- financeiro `colaborador.exportar` (SELECT aberto a autenticados)
- rh `departamento.editar` (policy `write_admin_rh`)
- dp1 `configuracoes.configurar_token` (Edge Function permite dp1)
- financeiro, inspetoria `ferias.exportar` (SELECT aberto a autenticados)

### D. Restrições (tela mais restrita que o padrão) — intencionais, seguras

dp2 `adicionais.*` (3), dp2 e rh `colaborador.cadastrar`, dp1/dp2/rh
`departamento.importar`, gestor `ferias.importar`. A UI bloqueia; o backend
permanece mais permissivo (sem caminho de UI, não há ação do usuário).
Nenhuma alteração.

## Observações

- **Inspetoria em ocorrências:** com UPDATE, passa a poder também **cancelar**
  ocorrência via chamada direta à API (a UI não exibe a ação). Policies são por
  comando SQL, não por ação de negócio — mesma granularidade que mesa/dp2 já
  tinham. Se a gestão não quiser isso, desmarcar criar/editar/aprovar da
  inspetoria na tela Permissões e avisar para rever a policy.
- **DELETE de contratos de adicionais:** era só `is_admin()` e a UI já mostrava
  a lixeira para `editar_contrato` — falha silenciosa. **Decidido pela gestão
  em 30/07/2026: gestor, dp2, mesa e financeiro podem excluir** (migration 088).
  DELETE de **vínculos** segue só admin — decisão pendente; o hook agora avisa
  "Sem permissão" em vez de fingir sucesso.
- Linhas de `menu`, `rota` e `escala` (318) não têm contraparte no
  PERMISSOES_PADRAO e são só de UI — fora do escopo.

## Como re-auditar no futuro

```bash
npx tsx scripts/auditar-divergencias-permissoes.ts
```

Novas concessões feitas na tela Permissões devem ser avaliadas contra o
backend (policies da tabela e RPCs envolvidas) antes de serem dadas por certas.
