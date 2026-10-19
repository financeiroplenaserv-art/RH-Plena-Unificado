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

## Ajustes de 18/10/2026 (manhã)
- Contrato **ESCRITÓRIO PLENA** (departamento ADM PLENA, 0 ativos — fica para os faltistas sem posto): decisão da gestora, opção A → `departamentos_equipe_extra` = **PLENA EA FACILITIES** (`a5dcc143-…`, 16 ativos), mesmo recurso do Telex/DuoConnect. Backup em `dados-locais/backup_escritorio_equipe_2026-10-18.json`. PLENA TECH ADMINISTRATIVO (13 ativos) NÃO foi incluído — perguntar se o escritório também atende a equipe Tech.
- Rótulo do status de uniforme/EPI do pedido `enviado` trocado de "A identificar" para "Com o inspetor" (commit 79d3f72; entra no próximo deploy).
- O pedido do Escritório (Erica Rochinha, 09/10) só tem 2 Fibras LT verde; papéis, saco de lixo 40L e descartáveis ficaram na lista "a decidir depois" da importação.

## Estado ao fim de 18/10/2026 (coordenador) — LEIA ISTO PRIMEIRO
**Produção:** `main` = `1bca94e` (+ este commit de docs) publicada; bundle `index-z4vrGIAH.js` conferido. Férias segue oculto. Migrations aplicadas até a **150** (146 estoque, 147 compras, 145 rota 4, 150 cancelar compra completo). **148 e 149 continuam reservadas** (compra da Beth e permissões finas — Marco C).

**Feito hoje:**
- Compra de teste da gestora APAGADA (backup `dados-locais/backup_compra_teste_2026-10-18/`): 0 compras; destinos 'escritorio' limpos; La Rochelle voltou a 'aprovado'. Bug que deixava esses restos corrigido pela **migration 150** (lote de geração; cancelar desfaz a geração inteira e recalcula status) — aplicada e conferida.
- **Kit Mensal completado nos pedidos de outubro (decisão da gestora "opção a" + kit AGUARDA O GESTOR):** `dados-locais/importacao_pedidos_outubro_2026-10-17/completar_kits.sql` aplicado (backup `dados-locais/backup_completar_kits_2026-10-18_v2/`): **315 linhas `parte='kit'`, `aprovado_automatico=false`, `qtd_validada`=kit, `qtd_aprovada` NULL** em 28 pedidos (envios `user_agent='completar-kit-2026-10-18'`), valor ~R$ 10.079,68. Total de linhas de outubro: 543. Status: 35 em_validacao, 3 validado (Business Center, Ida Scarselli, Quincas), 1 aprovado (La Rochelle), 19 nao_se_aplica. Fora: 6 "sem necessidade" e Montreal/Orleans/Quintas (sem pedido). Em novembro, pelo link, o kit volta a ser aprovado automaticamente.
- Gestor PODE negar o que o inspetor validou: "Aprovar com ajustes" aceita qualquer quantidade, inclusive 0; abaixo do pedido exige motivo (que vai para a cartinha).
- Excel da compra com estilo (`exceljs@4.4.0`, import dinâmico) + opção "Agrupar contratos por rota" (ligada por padrão; a gestora vai confirmar com o operacional se rota é necessária — se não for, trocar o padrão para desligado). Exemplos em `dados-locais/exemplo_excel_compra_2026-10-18*.xlsx` (gestora ainda não deu retorno do visual).
- Rótulo do status CEU `enviado` = "Com o inspetor". Contrato ESCRITÓRIO PLENA com equipe extra PLENA EA (Tech fica separada, contrato TECH próprio).
- Push: pelo PowerShell falta credencial; pelo Git Bash funcionou até o login expirar em 18/10 — a gestora refez o login (`git push` no terminal do VS Code). Repositório SEMPRE `financeiroplenaserv-art/RH-Plena-Unificado`.

**Para a compra de outubro (20–25/10):** inspetor valida os extras; gestor aprova (Painel → Aprovar selecionados, ou ajusta/nega no detalhe); mesa/gestor geram a compra em Materiais → Compras, baixam o Excel, enviam ao fornecedor e marcam Enviada; depois geram as cartinhas (.zip / PDF do malote). Comparar com a planilha antiga (decisão: outubro em paralelo).

**Próximo (Marco B, antes de 25/10):** tela **Chegadas** (RPC pronta e testada na 147). Depois Marco C (novembro): Estoque, Contagem, Separação (só para o que sai do estoque — o fornecedor entrega ponto a ponto), compra da Beth (148), permissões finas (149).

**Pendências da gestora:** retorno do visual do Excel; rota obrigatória ou não (operacional); preço dos itens de portaria (Protocolo, Livro, Planilha de Acessos — hoje sem preço); dia de entrega de cada rota; LUVA LÁTEX VERDE marcada sem selo; itens "a decidir depois" da importação (sacos de lixo, papéis, Perfex, descartáveis, cabos de mop; Jorge Luiz EXG do Miraflores; uniforme M do London); Cidade de Leiria (gerar QR quando for usar); 36 uniformes + 1 crachá para a Beth conferir. **Férias: backfill de `ferias_solicitacoes.departamento_id` obrigatório antes de liberar.**

## Fim do dia 18/10/2026 (tarde) — últimos itens
- **CEU → Pedidos** (fila da Beth), publicado em produção (bundle `index-DOxVouYB.js`, commit da troca de colunas logo após `770f788`):
  - nova coluna **"Penúltima entrega"**, ANTES da "Última entrega" (ordem cronológica, pedido da gestora); as duas mostram data + quantidade + tamanho. Entregas da mesma pessoa e da mesma PEÇA (qualquer tamanho) no mesmo dia contam como UMA, com quantidade somada — última e penúltima são sempre datas diferentes (motivo: peças com direito a 2 por período). Selo "antes do prazo" só na Última. Lógica pura em `src/lib/materiais/entregasPeca.ts` (+ testes).
  - novo filtro **"Peça"** (texto com sugestões das peças da fila + "Crachá"; "contém", sem acento/maiúscula; rascunho + Aplicar, `useFiltroPersistente`, `FiltrosAtivosBadge`); as ações em lote agem só sobre o filtrado.
- Testes: 1107 passando (82 arquivos) na última bateria completa; lint/tsc/build ok.
- GitHub: tudo enviado (`main` = `origin/main`). O login do Git Credential Manager expira com frequência nesta máquina; quando o push der timeout, pedir à gestora para rodar `git push origin main` no terminal do VS Code.
- **Nada pendente de deploy.** Próximo agente: começar pelo **Marco B (tela Chegadas)** antes de 25/10 e acompanhar a compra de outubro (20–25/10) — ver a seção "Estado ao fim de 18/10/2026" acima e a lista de pendências da gestora.

## 19/10/2026 — pendências da importação de outubro
- Documentos para a gestora (Claude Docs): "Pendências da importação dos pedidos de outubro" (anotado por ela) e o atualizado "Pendências de outubro — atualizado em 19/10" — lista viva do que ainda falta lançar antes da compra.
- **Camisa social branca com logo (cód. 323) NÃO é compra na loja** (correção da gestora): flag desligado; 3 pedidos ganharam o tamanho da planilha (Business Center GG, Jardins M, La Rochelle G). Backup `dados-locais/backup_camisa_323_2026-10-19.json`.
- **Decisões da gestora lançadas** (`dados-locais/importacao_pedidos_outubro_2026-10-17/aplicar_decisoes_2026-10-19.sql`, user_agent `decisoes-gestora-2026-10-19`, backup `dados-locais/backup_decisoes_2026-10-19/`): 12 complementos, 14 linhas de material (extra, com preço) e 16 de uniforme/EPI. Não aprovados: Macedo (Becker, álcool), CNOOC (escova nylon, esponja), Enseada (borrifador), Matizes (escova de vaso). Mauro Araujo Silva (equipe Enseada) marcado fora_da_equipe na Vila de Cascais.
- **Vila de Cascais — duplicatas das 2 respostas (14/10 e 15/10) apagadas** a pedido da gestora: 7 linhas de material idênticas + 1 calça social (José Carlos) da resposta de 15/10, e o borrifador de 4 (vale o de 6). Backups `dados-locais/backup_cascais_duplicados_2026-10-19.json` e `..._borrifador_...`. Ficaram os itens que só existiam na 2ª resposta.
- Ainda pendente com a gestora: ajuste do kit (Forever, Novas Cores, Igreja Metodista, Vila de Cascais), itens sem catálogo, discos/vassouras/flanelas/ceras sem variação, texto livre, uniformes sem nome/tamanho, Jorge Luiz EXG e uniforme M do London.
