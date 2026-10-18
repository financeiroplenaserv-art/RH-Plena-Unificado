# Handoff — 18/10/2026 (Materiais Fase 2, branch `materiais-fase2`) — Marco A

Continuação de `docs/HANDOFF_17-10-2026.md`. Plano: `docs/PLANO_MATERIAIS_FASE2.md` (ajustes da gestora na §12).

> Férias continua NÃO liberado (`MODULO_FERIAS_LIBERADO = false`). Deploy de produção só da `main` limpa.
> **Nada desta branch foi aplicado no banco nem publicado.** O frontend só pode ir ao ar DEPOIS das migrations 146 e 147.

## Estado
- Branch `materiais-fase2` (a partir da `main` 7bcc8d1), commits pequenos, enviada ao `origin`.
- Migrations **146** (estoque) e **147** (compras) escritas, testadas em transação desfeita (inclusive aplicadas 2× seguidas = idempotentes) — testes em `scripts/materiais/testes-fase2/`. Backup prévio por SELECT em `dados-locais/backup_materiais_146_147_2026-10-17/`.
- Frontend do Marco A: aba **Compras** (preparar a compra do mês + lista), **detalhe da compra** (matriz por rota, Excel sem/com valores, enviar, cancelar), **carta ao líder** (PDF por contrato, .zip, PDF do malote), destino/entregue no detalhe do pedido, status novos nos filtros. Financeiro entra só na aba Compras.
- Checks: `npm run lint` ok, `npx tsc -b` ok, `npm test` 80 arquivos / 1094 testes ok, `npm run build` ok (`dist/` só com `index.html`).

## Ordem para aplicar (coordenador)
1. Refazer o backup se houve mudança no banco depois de 17/10 22h (as RPCs da Fase 1 são recriadas a partir do `pg_get_functiondef` daquele horário; se alguém recriou `ajustar/incluir/ligar/validar/aprovar/preencher/mat_salvar_config/reset_permissoes_perfil` depois disso, comparar antes).
2. `scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase/migrations/146_materiais_estoque.sql`
3. `... -Arquivo supabase/migrations/147_materiais_compras.sql`
4. Conferir (o bloco final de cada uma já aborta se algo não bater): `select count(*) from mat_itens where preparo_escritorio` = 4; `select count(*) from permissoes_perfil where acao='materiais_compras'` = 18; nenhuma função com `chr(65533)`; `select status_produtos, count(*) from mat_pedidos group by 1` igual ao de antes (nenhum pedido muda de status na aplicação).
5. Opcional: rodar os testes de `scripts/materiais/testes-fase2/` (sempre com rollback) contra o banco já migrado.
6. Merge na `main` + deploy pelo checklist da §10 do AGENTS.md.

## O que a gestora precisa fazer para a compra de outubro (20 a 25/10)
- **Aprovar os pedidos**: 35 de outubro estão "com o inspetor" (220 linhas de extra). O inspetor valida (fila Validação) e o gestor aprova (Painel). O kit (8 linhas) já está aprovado. O que não estiver aprovado quando a compra for gerada fica de fora (o kit vai).
- **Conferir o fornecedor padrão** dos itens no Catálogo (112 de 116 têm; os 4 sem são os itens de portaria do escritório, de propósito). A troca pontual numa compra é na própria tela Compras.
- **Cadastrar preço** dos 3 itens de portaria sem preço (Protocolo, Livro, Planilha de Acessos) se quiser o valor no Excel interno — não bloqueia.
- Na tela Compras (a partir do dia 21, de preferência): conferir a sugestão (em outubro tudo vai ao fornecedor — estoque zerado), gerar os rascunhos, abrir cada compra, conferir a matriz contra a planilha antiga, baixar o Excel, enviar ao fornecedor e marcar "Enviada".
- Gerar as **cartas aos líderes** (Pedidos ou Compras → "Cartas aos líderes (.zip)" e "PDF único (malote)") depois da compra enviada.

## Decisões técnicas a confirmar com a gestora
1. Pedido com todas as linhas "não atendidas" termina como **Entregue** (o plano diz que linha inteira não atendida fecha sem tornar parcial); corte parcial ou falta na chegada = **Entregue parcial**.
2. Carta ao líder no "resumo do mês" do link público: **não incluída** (motivos são texto interno numa página pública).
3. Contagem: a folha abre com TODOS os itens ativos de estoque (o plano dizia só os com saldo/movimento — na 1ª contagem sairia vazia).
4. Chegada acima do comprado é recusada; reposição do estoque só aumenta (reduzir = estorno).

## Pendências / próximos marcos
- **Marco B (até ~25/10)**: tela Chegadas (lista das compras enviadas por rota/entrega prevista; registro por célula com "chegou tudo" por contrato; RPC `mat_registrar_chegada` já pronta e testada).
- **Marco C (novembro)**: Estoque e Contagem (RPCs da 146 prontas), Separação (RPC pronta), compra da Beth (148), permissões finas (149: `registrar_chegada`, `separar_estoque`, `movimentar_estoque`, `contar_estoque`; `ceu.comprar_pedido`).
- Teste com o caso real de junho/2026 (compra Antolimp, 529 un) não foi feito — a planilha não estava no formato de entrada; os testes do Excel usam dados sintéticos.
- Logo da carta: usa `public/logo_plena_cab.jpg` (não lê o logo por empresa da `cracha_config`).
- Prévia no Netlify não publicada: sem as migrations a aba Compras só mostraria "Módulo em preparação".

## Aplicado e publicado (18/10/2026, pelo coordenador)
- Migrations **146** e **147** aplicadas via `executar-arquivo-sql-management-api.ps1`. Conferência: `preparo_escritorio` = 4, 18 linhas `materiais_compras` em `permissoes_perfil`, 0 funções com chr(65533), status dos pedidos inalterados (35 em_validacao, 1 aprovado, 22 nao_se_aplica — o 22º é o pedido do Quincas criado pelos lançamentos do inspetor Augusto).
- `materiais-fase2` mesclada na `main` por fast-forward (`2eee762`) e publicada em produção — bundle `index-K0Gblvbs.js` conferido. Férias segue oculto.
- Próximo: Marco B (tela Chegadas). A gestora faz a compra de outubro entre 21 e 25/10 em paralelo com a planilha antiga.
