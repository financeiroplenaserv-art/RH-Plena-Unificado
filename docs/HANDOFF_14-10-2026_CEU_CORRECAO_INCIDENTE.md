# HANDOFF 14/10/2026 — Incidente do histórico CEU: revisão, prevenção e correção

## O incidente (resumo)

Em 13/07/2026 a importação do histórico do sistema antigo (`importar-movimentacoes-ceu.mjs`)
ligou **1.918 entregas ao item errado** (1.129 "LUVA LATEX G/M/P" → 719 "LUVA DE CORTE";
663 "CAMISA MALHA AZUL - ASG" + 115 "CAMISA MALHA POLO BEGE" → 331; 6 casos pequenos).
Em 04/08/2026 um lote de recibos ainda gravou números de 03/08 em 18 entregas de 01/07
(7 números em duas datas). Revisão independente completa (com reprodução da causa e
linha do tempo pelo log de auditoria):
`dados-locais/investigacao_revisao_independente_2026-10-14/relatorio_revisao.md`.

**Conferência física (gestora + PDFs do programa de assinatura): nenhum recibo assinado
está errado.** Dos 7 gerados na tela com "LUVA DE CORTE", 4 nunca foram assinados e os 3
assinados mostram só as peças corretas de 03/08. Detalhes:
`docs/VERIFICACAO_RECIBOS_LUVA_DE_CORTE_2026-10-14.md`.

## O que foi feito hoje (tudo verificado: 895 testes, lint, build e validador RLS verdes)

**Etapa 1 — contenção:**
- 6 scripts aposentados em `scripts/_aposentados/` com bloqueio (`throw` no topo):
  importar-movimentacoes-ceu, resolver-pendencia-rafael-ceu, reimportar-itens-ceu,
  deletar-itens-inativos, lancar-epis-setembro, reverter-recibos-2026-09-01.
- Regra permanente no AGENTS.md (§11 CEU + §12): importação nunca grava palpite sem
  confirmação humana; entrega com recibo emitido é imutável; script que escreve em
  entregas/itens exige dry-run e backup.

**Etapa 2 — código (sem banco):**
- CEU → Importar (`importarEntregas.ts` + `CeuImportarPage.tsx`): casamento classificado
  `exato`/`regra`/`palpite`; só exato nasce marcado; inferidos nascem desmarcados com
  seletor sempre visível; bug do "pu" (espuma/capuz→luva de eletricista) corrigido;
  candidato único com tamanho divergente vira não resolvido; CSV de não resolvidos.
- `scripts/lancar-epis-mensal.mjs`: mesma regra (dry-run lista "LINHAS A CONFIRMAR";
  `--aplicar` recusa inferidas sem `--confirmar-inferidos`). A alteração local do usuário
  (coluna `codigo` = match exato) foi preservada e entra neste commit.
- Recibos (`emissaoRecibos.ts` + páginas): emissão sempre agrupada por
  **colaborador + data + tipo**; `numeroDoGrupo` nunca herda número de outra data/tipo;
  nome/subgrupo do recibo e relatórios vêm do **snapshot** (mesma regra do CA).

**Etapa 3 — banco (migration 130, aplicada via Management API):**
- Trigger `trg_entregas_recibo_imutavel`: entrega com recibo emitido é imutável
  (item/snapshot/quantidade/colaborador/data) e não pode ser apagada — vale para
  service_role. Validado ao vivo (UPDATE/DELETE de teste bloqueados).
- RPC auditada `corrigir_item_entrega` (admin/adm ou service_role; motivo obrigatório;
  log em `entregas_correcoes_log`). Limpeza parcial do drift de policies
  (`write_admin_rh`, `gestor_entregas` removidas de entregas/itens).
- **Correção dos dados aplicada**: 1.912 entregas via RPC (0 erros; log completo).
  Luvas → 617/618/619 com CA por data (10.695 até 05/2026; 45.629 em 01/06 e 01/07 —
  comprovado pelo REC-00002 do sistema antigo; 3 de 08–12/06 SEM CA por decisão da
  gestão); camisas → 312/314; 5 casos pequenos → 645/673/677. Item 719 ficou só com as
  2 luvas de corte verdadeiras. Backups em `dados-locais/correcao_itens_ceu_2026-10-14/`.
- **7 números duplicados desfeitos**: as 18 entregas de 01/07 voltaram a "emitida sem
  número" (recibo_emitido=true, numero_recibo=NULL); os recibos assinados de 03/08
  intactos. Hoje há 0 números em mais de uma data.
- `rota.ceu` do perfil **dp1** corrigida para true (estava false com menu.ceu=true —
  o menu mostrava o CEU e a rota bloqueava; o mapa padrão sempre deu CEU ao dp1).

## Pendências

- **Gestor**: `rota.*` está false para várias rotas com menu true (ceu, adicionais,
  alertas, auditoria, extras, vr, importar_econtador) — mesma inconsistência do dp1,
  mas a gestão só autorizou corrigir o dp1. Revisar com ela.
- `select_autenticado` (SELECT aberto em entregas/itens) mantida de propósito: o
  financeiro depende dela nas telas CEU concedidas. Decisão pendente: incluir
  financeiro em `pode_ver_ceu()` (migration) e então dropar a policy.
- 10 entregas sem prova aguardando conferência no papel:
  `docs/CONFERIR_ENTREGAS_SEM_PROVA_2026-10-14.md`.
- Futuro (não autorizado): guarda do documento emitido/log de impressão; situação do
  recibo gravada na emissão; exibir tipo de casamento aproximado no VR/e-Contador.
- A troca de certificado das luvas látex (CA 10.695 → 45.629 / 16.312 verde) aconteceu
  entre 05 e 07/2026 — a coluna CA do relatório do sistema antigo é desatualizada
  (não serve para datar); a prova confiável é o recibo impresso.
