# HANDOFF 28/10/2026 (noite) — VT: rascunho no banco, fim do portão, auditoria, caso Joyce

> Escrito para o próximo agente. Sessão da noite de 28/10/2026 (continuação do
> handoff da auditoria). Working copy na branch `vt-fase1`.

## 1. O pedido da gestora

"Não estou satisfeita com esse módulo. Onde está a carga que o mesário fez?
Apagou tudo." + "Pode fazer a recomendação e aprovo: **grave o que está pronto
sem bloquear**." + reclamação do Google roteirizando mal e do caso Joyce
("o programa deu bilhete Niterói, mas é intermunicipal").

## 2. Diagnóstico confirmado no banco

- `vt_cargas`: **0 linhas** — a carga de novembro NUNCA foi gravada (não foi
  apagada). Em 25/10 o botão "Gravar carga" estava bloqueado pelo portão
  (15 coberturas em postos sem trajeto confirmado). A gestora fez novembro
  na mão.
- `vt_coberturas`: 39 gravadas (o trabalho dela estava salvo).
- `vt_trajetos`: 249 confirmados + 7 sugeridos.
- Nenhuma tabela vt_* tinha trigger de auditoria → incidente sem rastro.

## 3. O que foi implementado (migration 168 + código)

- **Migration 168** (`168_vt_carga_rascunho_e_auditoria.sql`, APLICADA via
  Management API em 28/10/2026; backup `dados-locais/backup_vt_168_2026-10-28/`;
  testada em transação desfeita): `vt_cargas.status` ('rascunho'/'gravada',
  default 'rascunho') + `confirmada_em`/`confirmada_por` + triggers
  `auditar_operacao` nas 5 tabelas vt_*.
- **Rascunho automático** (`salvarRascunho` em `useVtCarga.ts`): logo após o
  cálculo (importar / restaurar / reprocessar), a carga é salva no banco como
  'rascunho'. Nunca rebaixa linha 'gravada'; apaga rascunho de quem saiu do
  cálculo; optante fora do relatório não é salvo; falha avisa por toast sem
  derrubar a tela.
- **Gravar sem bloquear**: "Gravar carga" confirma (status 'gravada' +
  carimbos) só `prontaParaGravar`; com pendência o botão vira "Gravar quem
  está pronto (N)" e NUNCA mais fica desabilitado pelo portão. O banner de
  pendências virou aviso ("não bloqueiam — a gravação salva só quem está
  pronto"). Pendentes ficam como rascunho até resolver.
- **Banner de situação** com 4 estados (`situacaoGravacaoCarga` mudou de
  assinatura: `(idsGravados, idsRascunho, idsCalculados)`): nao_gravada /
  rascunho / parcial / gravada. beforeunload só quando nada foi para o banco.
- **Fechamento lê só 'gravada'** (`useVtFechamento`: listarCompetencias e
  carregarCargas com `.eq('status','gravada')`).
- **Aviso no dialog de cobertura**: ferista × posto sem trajeto confirmado
  mostra aviso âmbar na hora (não só na carga).
- `VtCarga` (types/vt.ts) ganhou status/confirmada_em/confirmada_por.

## 4. Caso Joyce e o lote de 24/10

- Joyce Souza Rodrigues: trajeto JÁ está com BUI intermunicipal — corrigido
  manualmente em 31/10 13:56 por financeiroplenaserv@gmail.com (adm). O erro
  veio do lote de 24/10 (casa+posto Niterói → BU Niterói). Sobra: `escopo`
  ainda 'niteroi_municipal' e a observação contraditória — deixado como está
  (o aviso `avisoBilheteIncompativel` vai marcá-la; é aviso, não bloqueia).
- Thiago Lontra: também voltou para BUI (30/10); a cidade cadastral está
  errada (Jardim Catarina é São Gonçalo, cadastro diz Niterói) — correção de
  cidade é na Alterdata.
- **José Orlando Targino**: ainda BU Niterói, mas CEP 24750-235 = Tribobó, SG
  → provável intermunicipal; E é um dos 11 críticos Riocard (BU suspenso
  Setrans) — talvez o certo seja "SEM INTEGRAÇÃO BU" até reativar. PENDENTE
  de decisão da gestora.
- 30 restantes do lote têm CEP de Niterói — revisão da gestora.

## 5. Estado verificado

- `npx vitest run src/lib/vt src/hooks`: 203 testes passam (6 novos do banner).
- Suíte completa: 1385 passam, **1 falha PRÉ-EXISTENTE e não relacionada**:
  `MateriaisCompras.smoke.test.tsx` espera o aviso "Ainda não é o dia da
  compra" (dia_inicio_compra=20); hoje é 28/10, o aviso não aparece. O teste
  depende do dia do mês — corrigir depois (mockar a data).
- `tsc -b tsconfig.app.json`: passa. `npm run build`: passa.

## 6. Pendências

- Deploy (NÃO feito nesta sessão): seguir o checklist do AGENTS.md §10
  (main limpa, verificar bundle). Migration 168 já está aplicada — o deploy
  pode ir quando a gestora quiser.
- Decisão da gestora: José Orlando Targino; revisão dos 30 do lote 24/10;
  os 11 críticos Riocard; coberturas duplas (Everaldo, José Ricardo); cidade
  do DUOCONNECT; valor extra da Andressa.
- Carga de dezembro/2026: importar o relatório ~25/11 — o rascunho agora é
  salvo sozinho; conferir banner e clicar "Gravar carga".
- Google Maps "não roteiriza bem": pedir à gestora exemplos concretos de
  trajetos errados para avaliar (os links já levam UF+CEP desde 27/10).
- Teste do MateriaisCompras quebrado por data (mockar `hojeBrasil`).
