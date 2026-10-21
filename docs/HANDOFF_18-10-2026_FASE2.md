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
- **Decisões da gestora lançadas** (`dados-locais/importacao_pedidos_outubro_2026-10-17/aplicar_decisoes_2026-10-19.sql`, user_agent `decisoes-gestora-2026-10-19`, backup `dados-locais/backup_decisoes_2026-10-19/`): 12 complementos, 14 linhas de material (extra, com preço) e 16 de uniforme/EPI. Os 6 marcados "Não aprovado" pela gestora significam "o INSPETOR confirma se procede" (não são recusas): lançados em `aplicar_a_confirmar_2026-10-19.sql` (user_agent `a-confirmar-inspetor-2026-10-19`) como extra com justificativa "A CONFIRMAR PELO INSPETOR — ..." — Macedo (Becker floral 1, álcool 1), CNOOC (escova de mão 1, esponja Scotch Brite 1), Enseada (borrifador 3), Matizes (escova p/ vaso 1). Mauro Araujo Silva (equipe Enseada) marcado fora_da_equipe na Vila de Cascais.
- **Vila de Cascais — duplicatas das 2 respostas (14/10 e 15/10) apagadas** a pedido da gestora: 7 linhas de material idênticas + 1 calça social (José Carlos) da resposta de 15/10, e o borrifador de 4 (vale o de 6). Backups `dados-locais/backup_cascais_duplicados_2026-10-19.json` e `..._borrifador_...`. Ficaram os itens que só existiam na 2ª resposta.
- Ainda pendente com a gestora: ajuste do kit (Forever, Novas Cores, Igreja Metodista, Vila de Cascais), itens sem catálogo, discos/vassouras/flanelas/ceras sem variação, texto livre, uniformes sem nome/tamanho, Jorge Luiz EXG e uniforme M do London.

## 19/10/2026 (tarde) — branch `materiais-fase2b`: remanejado, Excel travado, Chegadas, implantação, saldo inicial
Branch `materiais-fase2b` criada a partir da `main` `7cb5583`. **Nada aplicado no banco nem publicado.** Regras completas no AGENTS.md (§8 migration 151; §11 os 5 bullets novos de 19/10).

**O que entrou**
- **Migration 151** (`supabase/migrations/151_materiais_remanejado_implantacao.sql`): destino `remanejado` (posto → posto, fora da compra e do estoque central), confirmação "remanejamento feito", leitura `mat_chegadas`, `mat_desfazer_destino_linha`, e `mat_pedidos.implantacao`/`implantacao_inicio`. Recriadas do `pg_get_functiondef` real de 19/10: `mat_previa_compra`, `mat_gerar_compras` (lote da 150 mantido), `mat_cancelar_compra`, `mat_registrar_chegada`, `mat_registrar_separacao`, `mat_linha_planejada`, `mat_linha_entrega_fechada`, guarda da 147. Testada em transação desfeita (aplicada 2× + `scripts/materiais/testes-fase2/151_testes.sql` → TUDO OK). Backup em `dados-locais/backup_materiais_151_2026-10-19/`.
- **Compras**: coluna "Remanejado" + "De qual posto vem?" + observação; aviso no diálogo de gerar. **Detalhe da compra**: tabela "Remanejados de outro posto nesta geração" e botão "Registrar chegada". **Excel**: todas as abas protegidas (sem senha); aba "Remanejados" só no Excel com valores.
- **Aba Chegadas** (`/materiais/chegadas`): por compra enviada → por contrato, "Chegou tudo" / "Salvar chegada" (menor com motivo, maior recusado) e status dos pedidos; "Remanejamentos entre postos" com "Remanejamento feito". Ação nova `materiais.registrar_chegada` (gestor, mesa).
- **Carta ao líder**: "Vamos enviar: 3 bombonas 5L (remanejado do posto ABAETÉ)".
- **Implantação de contrato**: caixa no Pedido extra (+ início previsto); selo "Implantação" em Pedidos, detalhe, Validação, Painel, Compras e Chegadas; fora da média e do limite (valor à parte no Painel).
- **Saldo inicial**: `scripts/materiais/carregar-saldo-inicial.ts` pronto (dry-run testado contra produção com lista fictícia de 4 linhas: 3 casadas, 1 pendência, contagem de 137 itens, transação desfeita — conferido: 0 contagens e 0 movimentos no banco depois).
- Checks: lint ok, `npx tsc -b` ok, `npm test` 84 arquivos / 1135 testes ok, `npm run build` ok.

**Ordem para aplicar (coordenador)**
1. Conferir se alguém recriou depois de 19/10 13h alguma das funções acima (comparar com `dados-locais/backup_materiais_151_2026-10-19/funcoes/`).
2. `powershell -NoProfile -File scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase/migrations/151_materiais_remanejado_implantacao.sql` (arquivo UTF-8 — nunca inline).
3. Conferir: `select count(*) from pg_constraint where conname in ('mat_pedido_itens_remanejado_ck','mat_pedidos_implantacao_ck')` = 2; nenhuma função `mat_*` com `chr(65533)` (o próprio arquivo aborta se houver); `select status_produtos, count(*) from mat_pedidos group by 1` igual ao de antes.
4. Opcional: rodar `151_testes.sql` de novo (sempre com rollback — montagem no README da pasta).
5. Merge `materiais-fase2b` → `main` e deploy pelo checklist da §10 (Férias segue `false`). **O frontend NÃO pode ir ao ar antes da 151** (lê `mat_pedidos.implantacao`).

**Decisões técnicas a confirmar com a gestora**
1. Parte remanejada só conta como entregue depois do "Remanejamento feito" na aba Chegadas (a tela de Separação é do Marco C); levar menos exige motivo (vai para a carta).
2. Excel protegido SEM senha (senha no navegador ficaria pública; a proteção evita alteração por engano). O escritório desprotege em Revisar → Desproteger planilha.
3. A aba Chegadas usa a mesma entrada da aba Compras (sem semente nova em `permissoes_perfil`); quem grava = gestor e mesa.
4. Implantação: `tipo` continua "extra" (fluxo e RPCs iguais); a última entrega dos itens conta a implantação; o pedido aparece no Painel no mesmo contrato, com o valor à parte.
5. Saldo inicial gravado como a CONTAGEM de outubro (movimentos `ajuste_contagem`, motivo "saldo inicial (contagem de outubro)"); item fora da lista = 0; a contagem de outubro fica fechada (a próxima é a de 16–19/11).
6. "Desfazer destino" (novo) só para linha sem compra e sem entrega — antes, uma geração que não criou compra (só estoque/escritório/remanejado) não tinha como ser desfeita.

**Como rodar o saldo inicial quando a lista chegar**
1. Salvar a lista como CSV (`item;variacao;quantidade`) ou Excel (1ª aba, cabeçalho na 1ª linha). O nome do item tem que ser o do Catálogo (ou o "nome para o líder", ou um nome antigo cadastrado); a variação, o rótulo exato.
2. Dry-run: `npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/carregar-saldo-inicial.ts --arquivo=<caminho>` → ler `dados-locais/saldo_inicial_<data>/relatorio.txt` e `pendencias.csv`; corrigir os nomes na lista e repetir até zerar as pendências (ou decidir com a gestora deixá-las de fora).
3. Conferir o `--perfil` (padrão = perfil gestor `6e49ec30-…`; é quem aparece como autor da contagem) e aplicar: `... --arquivo=<caminho> --aplicar` (backup automático em `backup_antes/`).

**Observações**
- Em produção já existe a compra **COMP-2026-10-001 em rascunho** (1 fornecedor, 1 célula) e 5 linhas `escritorio` — gerada pela gestora; a 151 não mexe nela.
- Os testes antigos `147_testes.sql`/`147_testes_cancelamento_envio.sql` falham hoje por dado (a fixture espera pedido de outubro "aprovado", que não existe mais) — igual sem a 151. A 151 tem teste próprio cobrindo gerar → enviar → chegada → confirmar → entregue, cancelar e desfazer.

## 19/10/2026 (noite) — ESTADO PARA O PRÓXIMO AGENTE
- **Produção:** `main` = `50c0d5c` publicada (bundle `index-BUg5whau.js`). Migration **151** aplicada (remanejado de outro posto, implantação de contrato, desfazer destino; constraints `mat_pedido_itens_remanejado_ck`/`mat_pedidos_implantacao_ck` conferidas, 0 chr(65533)). Aba **Chegadas** no ar; Excel da compra protegido (sem senha).
- **Compra COMP-2026-10-001 em RASCUNHO** (gerada pela gestora em 19/10; deixou La Rochelle "em_compra" por causa dos itens do escritório). Perguntado se é teste — se for, ela cancela pela tela (a 150/151 desfaz tudo).
- **SALDO INICIAL DO ESTOQUE — PENDENTE de confirmação da gestora** (foto da folha do Maciel de 16/10): CSV em `dados-locais/saldo_inicial_2026-10-19/estoque_maciel_16-10.csv`; dry-run OK (25 de 26 casados, 106 unidades; pendência: Mop Cabeleira Pequena sem variação). Dúvidas enviadas à gestora: esponja dupla face = 7?; detergente Dazzehome = Detergente Neutro 5L?; Kit Limpa Vidros "4 sem lavador" = 4?; Sapólio 40 = Sapólio cremoso Cif 250mL?; Mop Cabeleira Pequena Max Teck ou Starclean?; discos verde/preto "510" e "2x" — quantos (510 mm existe)?; flanela branca 5 (variação não existe — cadastrar?); "CJ 24 — 1 BB" (não identificado). Depois das respostas: ajustar o CSV e rodar `npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/carregar-saldo-inicial.ts --arquivo=dados-locais/saldo_inicial_2026-10-19/estoque_maciel_16-10.csv --aplicar` (o push/escrita no banco pede permissão da gestora na tela). Precisa estar gravado ANTES de ela gerar a compra de verdade (20–25/10).
- Rotina real: todo mês o mesário (Maciel) lista o estoque do depósito em papel para abater da compra → a tela de Contagem (Marco C, novembro) substitui a folha.
- Documento para inspetores/Beth: "Pendências de outubro — atualizado em 19/10" (https://claude.ai/artifact/MtpHs55gcDRi9vRx99LE8m) — só o que falta + passo a passo. A gestora vai compartilhar.
- **Ainda pendente:** Marco C (Estoque/Contagem/Separação, compra da Beth 148, permissões 149); ambiente de TREINAMENTO (opção A aprovada, não iniciado); QR codes dos contratos antes de 01/11 (incl. LEIRIA); respostas da gestora (visual do Excel, rota necessária?, preço dos itens de portaria, dia de entrega das rotas, LUVA LÁTEX VERDE). **Férias: backfill de `ferias_solicitacoes.departamento_id` antes de liberar.**

## 19/10/2026 (fim) — PRÓXIMA SESSÃO: COMECE POR AQUI
**Feito nesta sessão (tudo conferido no banco):**
- **Saldo inicial do estoque GRAVADO** (rodado pela gestora no terminal): contagem de outubro `e409d8ce-…` fechada, 29 movimentos `ajuste_contagem`, **113 unidades**. Arquivos em `dados-locais/saldo_inicial_2026-10-19/` (CSV final, `cadastrar_itens_novos.sql`, backups).
- Catálogo: **Flanela branca de algodão** (nova, exclusiva CNOOC, R$ 1,80/un, Compra Avulsa — vem em kit de 100); **Saponáceo em pó** oculto da CNOOC (`contratos_ocultos`); **CJ24** = bombona 5L; **Starclean** substituída pela Max Teck em todos os kits (pela tela; 20 kits com Max Teck, Starclean inativa) e a Max Teck segue **oculta para o líder** (o líder vê só "Mop Cabeleira Pequena" — decisão da gestora; o selo no Catálogo é esperado).
- **Sacos de lixo**: unidade do item = `embalagem`; rótulos "20L/40L/60L (pacote c/ 50)" (20L criado, sem preço) e "100L/200L/240L (fardo c/ 100)". SQL em `dados-locais/ajustes_catalogo_2026-10-19/`.
- **LEIRIA**: `recebe_limpeza = false` (só portaria).
- Permissões do projeto (`.claude/settings.local.json`): a gestora liberou o `executar-arquivo-sql-management-api.ps1` e o `carregar-saldo-inicial.ts`; mesmo assim o modo automático barrou a gravação feita por SUBAGENTE — gravação em produção, fazer na sessão principal com ordem explícita da gestora (ou ela roda no terminal).

**1º — Comentários dos inspetores na planilha do Drive (pedido da gestora):**
- A planilha "PEDIDO DE MATERIAIS POR CLIENTE" (Google Sheets, uma aba por contrato) foi comentada pelos inspetores DEPOIS do download de 16/10: o `docs/PEDIDO DE MATERIAIS POR CLIENTE.xlsx` tem **0 comentários** (conferido com openpyxl). A gestora não consegue baixar de novo e vai **conectar o Google Drive** no claude.ai.
- Passos: (1) carregar as ferramentas do conector Google Drive (ToolSearch "google drive"); (2) achar a planilha pelo nome e ler **os comentários** (texto, autor, célula/aba, respostas, resolvido ou não) — se o conector não trouxer comentários, avisar a gestora e pedir prints/cópia; (3) para cada comentário, cruzar com o que já foi lançado: pedidos de outubro em `mat_pedidos`/`mat_pedido_itens` (envios com `user_agent` `importado-planilha-2026-10-17`, `completar-kit-2026-10-18`, `decisoes-gestora-2026-10-19`, `a-confirmar-inspetor-2026-10-19`), decisões em `dados-locais/importacao_pedidos_outubro_2026-10-17/` (`decisoes_colunas.json`, `decisoes_linhas.json`, `revisao.xlsx`, `revisao2.xlsx`) e o documento "Pendências de outubro — atualizado em 19/10" (https://claude.ai/artifact/MtpHs55gcDRi9vRx99LE8m — também pode ter comentários; ler com o skill de docs); (4) entregar à gestora uma lista: comentário → o que já está no sistema → o que muda (separando "posso lançar" de "precisa decisão"). **Nada é gravado sem ela aprovar** (dry-run/backup, regra "importação nunca grava palpite").

**2º — Fornecedores antigos (OBRIGATÓRIO antes de gerar/enviar a compra de outubro):** a gestora disse que Contecom, Bralimpia, Espaço Limp(eza), Spartan, Loja das Bombas e Districent NÃO são mais fornecedores. Hoje 35 itens ativos têm um deles como padrão (Contecom 16, Bralimpia 11, Loja das Bombas 6 — piscina, Spartan 1 = CJ24, Espaço Limpeza 1 = cera Start). O Maciel vai mandar a lista atualizada; aplicar por UPDATE com backup assim que chegar.

**3º — Múltiplo de compra (aprovado pela gestora, NÃO implementado):** no item, "unidade de compra" + "quantas unidades do pedido vêm nela" (padrão 1); na compra arredonda para cima e a sobra vira célula de reposição (estoque) na MESMA compra; item "fracionado no escritório" (Lustro: compra bombona 5L, a mesa separa frascos 1L → sai do estoque); campo "comprar a mais para o estoque" na tela Compras (pedido da gestora: no dia a dia compram além do que os líderes pediram). Casos conhecidos: Flanela branca (kit 100), RZK 101 (caixa c/ 4 — Alklin = Essex, mesma empresa), Lustro (BB 5L → 5 frascos). Sacos já resolvidos no rótulo. Levantamento das NFs em `dados-locais/multiplos_compra_2026-10-19/levantamento.csv`. Será a migration 152 (148/149 seguem reservadas).

## 19/10/2026 (sessão seguinte) — tentativa de ler os comentários do Drive: BLOQUEADA
**Nada foi alterado** (arquivos, banco ou Drive). Só leitura.
- Link da planilha comentada (enviado pela gestora): https://docs.google.com/spreadsheets/d/1PjXIRP9NS-cmIaITjzG-OrcNnTXbnhjwY7nHrxGArZQ/edit?gid=1269131331 (ID `1PjXIRP9NS-cmIaITjzG-OrcNnTXbnhjwY7nHrxGArZQ`).
- O conector Google Drive está na conta **financeiroplenaserv@gmail.com** (a gestora confirmou que essa conta é **Editor** da planilha), mas `get_file_metadata`, `read_file_content` (includeComments) e `download_file_content` devolvem **"Requested entity was not found"**. A planilha não aparece em busca por nome nem em "compartilhados comigo"; só aparece o **atalho** `1c5vkl8ETJb3rc_4A23y8s_t3Fe5Dn0iq` (criado em 09/10), que o conector não resolve. Hipótese: a planilha é de outra conta (inspetor/domínio plenaserv.com) e o conector não segue o atalho.
- O dono **bloqueou cópia e download** — "Fazer uma cópia" e "Fazer download .xlsx" não funcionam para a gestora.
- Lido no lugar: o docx "Pendências sobre a planilha de material.docx" (Drive `1Aen4yubQJjs2P7MB4-6GL3OIlhdIr_n1`, mod. 19/10 12:57) — mesmo conteúdo do "Pendências de outubro — atualizado em 19/10", sem anotações novas; o conector não traz comentários de .docx.

**Para destravar (escolher um):**
1. A gestora abre o painel de comentários da planilha (ícone de balão, ao lado de "Compartilhar"), filtro "Todos" (inclui resolvidos), seleciona e cola o texto no chat — ou manda prints.
2. Pedir ao DONO da planilha (provável Elisangela ou Maciel) para compartilhar direto com financeiroplenaserv@gmail.com e/ou liberar download — aí o conector lê tudo (autor, célula, data).

Com os comentários em mãos, seguir o passo "1º" da seção "19/10/2026 (fim)" acima (cruzar com `mat_pedidos`/`mat_pedido_itens` de 2026-10 só com SELECT, com `decisoes_*.json` e o docx de Pendências; lista "posso lançar" × "precisa decisão" × "já resolvido"; nada gravado sem aprovação). Os passos 2º (fornecedores antigos — aguarda lista do Maciel) e 3º (múltiplo de compra, migration 152) seguem pendentes, sem mudança. Compra COMP-2026-10-001 continua em rascunho — a gestora ainda não disse se é teste.

**Feito no fim da sessão (19/10, pedido da gestora):** no detalhe do pedido (Materiais), a data da coluna "Última entrega" dos itens EXTRAS virou link que abre a caixa **"Histórico de entregas"** (todas as competências anteriores do item ao contrato, mais recente primeiro, com total; mesma fonte da última entrega: `mat_historico_consumo` + pedidos aprovados, com cadeia de substituição). Função pura `historicoEntregasDoItem` em `src/lib/materiais/ultimaEntrega.ts` (com testes). **Commitado na `main`, NÃO publicado** — entra no próximo deploy (checklist do §10 do AGENTS.md). Linhas do KIT seguem sem o link (lá a coluna só mostra o aviso de validade); a fila CEU → Pedidos também não tem a caixa — estender se a gestora pedir.

**ACHADO (19/10, conferido no banco) — histórico de consumo para em junho/2026:** `mat_historico_consumo` vai de 2025-01 a **2026-06** (9.108 linhas, 18 meses, ~35 contratos/mês). **Julho, agosto e setembro/2026 NUNCA foram importados**, e não há pedido aprovado pelo sistema antes de outubro. Efeito: "Última entrega", a caixa "Histórico de entregas" e a média de consumo (6/12 meses do Painel/Kit Mensal) ficam desatualizados — a gestora viu item mensal com última entrega em abril. **Não é bug da tela.**
- **A fazer:** importar jul/ago/set/2026 para `mat_historico_consumo` (mesmo formato/origem da carga das planilhas 2025-01..2026-06 — achar o script dessa carga em `scripts/materiais/` antes de escrever outro; dry-run padrão, só casamento exato, backup). A gestora precisa ENTREGAR as planilhas desses 3 meses (candidata: pasta do Drive "PLANILHAS UTILIZANDO NOVO MODELO", zip de 19/10 `1aInMxxJMUzcOdiOgfunUnfwzTwCTuxoB` — conteúdo NÃO conferido).
- Opcional pequeno: aviso na caixa "histórico das planilhas importado até <último mês>" (calcular o max(competencia) na leitura).

### O QUE A GESTORA PRECISA ENTREGAR AO PRÓXIMO AGENTE
1. **Comentários dos inspetores** — colar o painel de comentários da planilha (ou prints), ou pedir ao dono que compartilhe com financeiroplenaserv@gmail.com.
2. **Planilhas de pedido de julho, agosto e setembro/2026** (ou confirmar que estão na pasta "PLANILHAS UTILIZANDO NOVO MODELO").
3. **Lista atualizada de fornecedores do Maciel** (35 itens com fornecedor antigo).
4. **Resposta: a COMP-2026-10-001 é teste?** (se for, cancelar pela tela).
5. Decidir quando publicar (deploy) a caixa de histórico já commitada (`3a7d267`).

## 21/10/2026 — comentários dos inspetores APLICADOS
A gestora mandou prints do painel de comentários (34 comentários, 14 a 17/10). Transcrição, backups e script em `dados-locais/comentarios_drive_2026-10-21/` (`comentarios_transcritos.json`, `backup_linhas_A.json`, `backup_cracha_D.json`, `aplicar_comentarios_2026-10-21.sql`). Gravado em produção com `user_agent` `comentarios-inspetores-2026-10-21` e conferido:
- **Quantidade trocada "como se o líder tivesse pedido" (decisão da gestora)**: CNOOC Detergente Neutro 2→1; CBO NITERÓI Neutralizador Floral 3→1; CARVALHO NETO Cloro 2→1; MÉRITO Limpa Alumínio 4→1 e Use Pronto 3→1. **Linhas apagadas** ("desconsiderar"): SPLÊNDIDO Pincel; CBO NITERÓI Becker Floral (8) e Vulcan Lavanda (3); MÉRITO Borrifador (4) e Kit LT (1).
- **Lançados (complemento via `mat_registrar_envio`)**: ITAGUAÍ discos 350 mm branco/verde/preto ×2; MÉRITO Cera 5L preta ×1, Vassoura Especial Gari ×1 e EPI por pessoa (avental, máscara = respirador c/ válvula, luva PVC M, nitrílica M/M/G — Ana Bela, Cristiane Cardoso, Paulo Roberto M. Theodoro); PRIDE disco verde **400 mm** ×1 (líder escreveu 410); CBO MACAÉ luva látex Casiane M ×3, Carlos Alexandre G ×3.
- **Crachá do Dagno (Abaeté) apagado da fila** — entregue em 14/10.
- **Ficam como estão até decidirem**: ABAETÉ Neutralizador Floral extra 2 (pergunta do Maciel); LA RESERVE Becker Floral extra 1 ("Kit Mensal", mas o kit tem Talco). SUMMER BAY (comentário na resposta de setembro) ignorado — só outubro.
- **Compra avulsa × fornecedor**: a gestora vai dizer quais itens são de compra avulsa (ex.: Abaeté lábio da catadeira ×3 e espanador de teto de melhor qualidade). Aguardar antes de gerar a compra desses itens.

## 21/10/2026 — branch `materiais-multiplo`: múltiplo de compra (migration 152)
Branch `materiais-multiplo` criada a partir da `main` `05f9a9f`. **Nada aplicado no banco nem publicado.** Regras completas no AGENTS.md (§8 migration 152; §11 "Materiais — múltiplo de compra").

**O que entrou**
- **Migration 152** (`supabase/migrations/152_materiais_multiplo_compra.sql`): no item, `unidade_compra` + `fator_compra` (padrão 1) + `fracionado_escritorio`; na célula da compra, snapshot da unidade/fator + `qtd_arredondamento` (sobra) + `qtd_fracionar`; interna `mat_arredondar_compra`; `mat_gerar_compras` com `p_reposicao` (a mais para o estoque), fracionado e arredondamento (lote da 150 e remanejado da 151 mantidos); `mat_gerar_compra_reposicao` arredonda; `mat_previa_compra` devolve fator/unidade/fracionado; `mat_cancelar_compra` devolve as linhas fracionadas. Recriadas do `pg_get_functiondef` real de 21/10 (backup em `dados-locais/backup_materiais_152_2026-10-21/`).
- **Testes em transação desfeita**: migration aplicada 2× seguidas + `scripts/materiais/testes-fase2/152_testes.sql` → **TUDO OK** (constraints; prévia com fator; travas do "a mais"; 3 flanelas-tipo → sobra no estoque e total múltiplo de 100; fracionado sem célula de posto e linha em "estoque"; fator 1 sem sobra; 2ª geração no mesmo rascunho recalcula sem acumular; envio congela mesmo mudando o fator; chegada põe a bombona no estoque e a separação baixa a linha; cancelar com lote dividido devolve só a linha fracionada; reposição avulsa arredonda; função interna não exposta). Conferido depois: banco sem as colunas e com as mesmas compras (rollback).
- **Catálogo** → detalhe do item → seção "Compra ao fornecedor" (como vende, quantas unidades vêm, fracionado; exemplo "pediram 3 unidades → compra 1 kit c/ 100, 97 para o estoque").
- **Compras**: selos "compra em kit c/ 100" e "fracionado no escritório"; coluna **"A mais p/ estoque"** por item; sob "Do fornecedor" a prévia "compra 100 = 1 kit c/ 100 · sobra 97 → estoque"; a confirmação mostra a sobra por fornecedor.
- **Excel**: aba "Compra" com a coluna "Embalagem (como comprar)" só quando há múltiplo; "Entrega" marca o fracionado como "Escritório (a mesa separa para os postos)". **Detalhe da compra** e **Chegadas** explicam a sobra e o fracionamento na célula de estoque.
- Checks: `npm run lint` ok, `npx tsc -b` ok, `npm test` 86 arquivos / 1157 testes ok, `npm run build` ok.

**Ordem para aplicar (coordenador)**
1. Conferir se alguém recriou depois de 21/10 alguma das funções (comparar com `dados-locais/backup_materiais_152_2026-10-21/funcoes/`).
2. `powershell -NoProfile -File scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase/migrations/152_materiais_multiplo_compra.sql` (arquivo UTF-8 — nunca inline).
3. Conferir: `select count(*) from pg_proc where proname = 'mat_gerar_compras'` = 1; as 4 constraints (`mat_itens_fator_compra_ck`, `mat_itens_unidade_compra_ck`, `mat_itens_fracionado_ck`, `mat_compra_itens_multiplo_ck`); nenhuma função `mat_*` com `chr(65533)` (o arquivo aborta sozinho).
4. Com o OK da gestora, os dados iniciais (abaixo).
5. Merge `materiais-multiplo` → `main` e deploy pelo checklist da §10 (Férias segue `false`). A ordem migration × frontend não quebra nada (leitura com fallback), mas o "A mais p/ estoque" e a seção do Catálogo só gravam com a 152 aplicada.

**Decisões técnicas a confirmar com a gestora**
1. O arredondamento é feito na COMPRA INTEIRA do fornecedor (soma de todos os postos + estoque), não posto a posto: 3 flanelas na Abaeté + 2 na Telex = 5 → 1 kit (95 para o estoque). O fornecedor entrega os 3 e os 2 nos postos e o resto do kit no escritório.
2. Item fracionado (Lustro): o posto passa a ser atendido pelo ESTOQUE (a mesa enche os frascos e separa); o fornecedor entrega as bombonas no escritório. Na chegada a quantidade é contada em frascos (1 bombona = 5).
3. O fator vale para o item inteiro (todas as variações). Se algum item tiver embalagem diferente por variação (ex.: cor), avisar — dá para mudar depois.
4. "A mais p/ estoque" vai para o fornecedor escolhido para o item nesta compra (ou o padrão) e também é arredondado.
5. Excel: a quantidade continua na unidade do pedido (100 flanelas) e a coluna nova diz como pedir ("1 kit c/ 100"). Preço e valor seguem por unidade do pedido (o valor do kit = 100 × preço da flanela).
6. Sem múltiplo cadastrado, nada muda (fator 1). Compra já enviada nunca é recalculada.

**Dados iniciais sugeridos (NÃO aplicados)** — arquivo `dados-locais/multiplos_compra_2026-10-19/dados_iniciais_152.sql` (testado dentro de transação desfeita depois da 152). Fonte: `levantamento.csv` (NFs) + casos da gestora. Ficam com fator 1 os vendidos avulsos (Ambientador Fresno 5L, cloro, desinfetantes, neutralizador, Clean Grease, Use Pronto, papel toalha — o catálogo já pede por caixa —, panos em pacote) e os sacos (resolvidos no rótulo). "Dazzle Home 5L" não está no catálogo.
```sql
begin;
UPDATE public.mat_itens SET unidade_compra = 'kit', fator_compra = 100
 WHERE id = '919897ce-19d2-4f61-8e9a-70a73abf60db';   -- Flanela branca de algodão (gestora: kit de 100)
UPDATE public.mat_itens SET unidade_compra = 'caixa', fator_compra = 4
 WHERE id = '7ecad68a-1849-448d-a554-b7442d2029a2';   -- RZK 101 5L (NF 54.391 Alklin = Essex: só caixa c/ 4 — confirmar)
UPDATE public.mat_itens SET unidade_compra = 'bombona 5L', fator_compra = 5, fracionado_escritorio = true
 WHERE id = 'e4cf3555-c866-411f-a020-f4ced328a7d4';   -- Lustro 1L (compra bombona 5L, a mesa enche 5 frascos)
DO $$ BEGIN
  IF (SELECT count(*) FROM public.mat_itens WHERE fator_compra > 1) <> 3 THEN RAISE EXCEPTION 'esperava 3 itens com fator > 1'; END IF;
  IF (SELECT count(*) FROM public.mat_itens WHERE fracionado_escritorio) <> 1 THEN RAISE EXCEPTION 'esperava 1 item fracionado'; END IF;
END $$;
commit;
```

### 21/10 — respostas da gestora ao múltiplo de compra
- **Pendente (ela vai consultar):** o arredondamento pela compra inteira do fornecedor (3 + 2 = 1 kit) e se o fornecedor abre o kit para entregar posto a posto. Hoje a 152 arredonda pela compra do fornecedor; mudar depois é ajuste pequeno.
- **Confirmados:** Lustro sai do estoque, com a mesa enchendo os frascos; embalagem vale para o item inteiro (nenhum item tem embalagem por cor); "a mais p/ estoque" vai ao fornecedor do item na compra; preço por unidade no Excel; valores iniciais (Flanela branca kit 100, RZK 101 caixa 4, Lustro bombona 5L c/ 5 fracionado).
- **Dazzle Home 5L = Detergente Neutro 5L** (Alklin/Essex, mesma empresa): NÃO foi criado item novo. Gravado em produção em 21/10 (backup em `dados-locais/comentarios_drive_2026-10-21/backup_detergente_neutro.json`): o nome virou "Detergente Neutro Dazzle Home 5L", o `nome_lider` ficou "Detergente Neutro 5L" e entraram 5 aliases (dazzle home etc.). Preço NÃO mudou: o catálogo (R$ 44,76 desde 06/2026) é mais recente que a NF 54.391 (10/2025, R$ 48,38). Fator = 1 (vendem a bombona avulsa).
- **Migration 152 e dados iniciais APLICADOS em 21/10/2026** (a gestora rodou os 2 comandos no terminal; o modo automático barrou o agente). Conferido no banco: 7 colunas novas, `mat_arredondar_compra` criada, `mat_gerar_compras(date, text, jsonb, text, jsonb)`, 0 chr(65533), status dos pedidos idêntico ao de antes (aprovado 1, em_validacao 35, nao_se_aplica 19, validado 3), Flanela branca kit c/ 100, RZK 101 caixa c/ 4, Lustro bombona 5L c/ 5 (fracionado). O frontend publicado (main) segue funcionando: chama `mat_gerar_compras` com 4 nomes e o 5º tem DEFAULT. **Falta:** a gestora testar no localhost e o merge `materiais-multiplo` → `main` + deploy (junto com a caixa de histórico `3a7d267`).

## 21/10/2026 — dois orçamentos por contrato (branch `materiais-orcamento-ceu`, migration 153 NÃO aplicada)

- Decisão da gestora: cada contrato tem Material (`limite_mensal`, 138) e Uniforme/EPI/crachá (`limite_mensal_ceu`, novo). Só aviso, nunca bloqueia. Regras completas no AGENTS.md §11 ("dois orçamentos por contrato").
- Código: `src/lib/materiais/orcamento.ts` (+ teste), `painel.ts` (campo `ceu` por linha), `useMateriaisPedidos` (lê `ceu_pedido_itens`, `ceu_itens_precos_vigentes`, `itens.valor` e a config), Painel (duas colunas + custo do crachá editável), Contratos (campo e coluna novos).
- Migration `153_materiais_orcamento_ceu.sql` + `scripts/materiais/testes-fase2/153_testes.sql` (aplicada 2x em transação desfeita = TUDO OK). Aplicar por arquivo UTF-8 (`scripts/lib/executar-arquivo-sql-management-api.ps1`), antes ou depois do deploy.
- Dados NÃO aplicados: `dados-locais/orcamentos_2026-10-21/` (`mapa_contratos.csv`, `dados_orcamentos_153.sql`). 57 exatos, 2 sugeridos (CBO Niterói, Ida Scarsell), Telex/Duoconnect ambíguos, MB LOFTS sem par; ABAETÉ mantém o limite manual de 2000 até a gestora decidir. Equipamentos fora do limite de material (decisão da gestora). Testado em transação desfeita após a 153.
- Ordem para publicar: aplicar a 153; rodar os dados (com OK da gestora); merge na main; deploy.

## 21/10/2026 — fornecedor que entrega no depósito Plena (branch `materiais-deposito`, migration 154 NÃO aplicada)

Branch criada de `materiais-multiplo` (ff5dc0f). **Nada aplicado no banco nem publicado.** Regras completas no AGENTS.md (§8 migration 154; §11 "fornecedor que entrega no depósito da Plena").

**Contexto (planilha `Pedido_Antolimp_e_Separacao_Oper_...xlsx`, confirmado pela gestora):** Antolimp entrega posto a posto na rota; Essex/RZK e Compra Avulsa entregam tudo no depósito, os inspetores separam por contrato e a Antolimp leva junto; alguns contratos (Montreal, Orleans, 3 Telex de lojas) não recebem em rota — a Plena leva. Rotas 1 a 4 (4 = só CBO MACAÉ).

**O que entrou**
- **Migration 154** (`supabase/migrations/154_materiais_entrega_deposito.sql`): `fornecedores.entrega_deposito`; snapshot `mat_compras.entrega_deposito` (rascunho + envio); **rota 0 = "Depósito Plena"** (CHECKs 0..4 + `definir_rota_*`; as RPCs de compra/chegada leem a rota como número e não mudaram); `mat_pedido_itens.via_deposito/qtd_separada/separado_em/separado_por`; chegada de depósito não conta como entregue; RPC `mat_registrar_separacao_deposito`; leituras `mat_separacao_deposito` e `mat_levar_do_deposito`. Funções recriadas do `pg_get_functiondef` real de 21/10 (backup em `dados-locais/backup_materiais_154_2026-10-21/`, conferido igual ao de 152).
- **Testes em transação desfeita**: migration aplicada 2× + `scripts/materiais/testes-fase2/154_testes.sql` -> **TUDO OK** (constraints de rota; rota 0 pela RPC e recusa de 5; snapshot do flag no rascunho e depois do envio; `via_deposito` só nas linhas de depósito; "levar do depósito" lê o rascunho; separar antes de chegar recusado; financeiro sem permissão; chegada no depósito deixa `qtd_entregue` vazio e a linha aberta; compra comum inalterada; inspetoria separa — menos sem motivo e mais que o recebido recusados; reduzir a chegada abaixo do separado recusado; UPDATE direto de `qtd_separada` não altera). Conferido depois: banco sem as colunas (rollback). Dados sugeridos também testados em transação desfeita.
- **Telas**: Fornecedores (caixa + coluna "Entrega"); Compras (aviso "entrega no depósito" por fornecedor); detalhe da compra (selo + texto + Excel conforme o tipo); **Chegadas** (compra de depósito pede o total por item); **nova aba Separação** (`/materiais/separacao`); seletores/rótulos de rota mostram "Depósito Plena" em Contratos, Pedidos, Validação, Sem pedido, Kit, Compras, Chegadas.
- **Excel**: fornecedor de depósito = só total por item + "Entregar no depósito Plena" (aba Compra); versão interna com valores mantém a matriz; Antolimp ganha aba "Levar do depósito"; lista de separação em Excel. Todos protegidos (sem senha).
- Permissão nova `materiais.separar_deposito` (gestor, mesa, inspetoria; espelha `pode_movimentar_estoque_materiais`) no `PERMISSOES_PADRAO` e na tela Permissões.
- Checks: `npm run lint` ok, `npx tsc -b` ok, `npm test` ok, `npm run build` ok (números no relatório final).

**Ordem para aplicar (coordenador)**
1. Conferir se alguém recriou depois de 21/10 alguma função listada (comparar com `dados-locais/backup_materiais_154_2026-10-21/funcoes/`).
2. `powershell -NoProfile -File scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase/migrations/154_materiais_entrega_deposito.sql` (arquivo UTF-8). O arquivo aborta sozinho se houver `chr(65533)` ou faltar coluna/RPC.
3. Com o OK da gestora: `dados-locais/deposito_2026-10-21/dados_iniciais_154.sql` (marca Essex e Compra Avulsa; rota 0 em MONTREAL, ORLEANS e os 3 TELEX de lojas — por id, com conferência de contagem).
4. Merge na `main` e deploy pelo checklist da §10 (Férias segue `false`).

**Decisões a confirmar com a gestora**
1. **Separada = entregue.** Hoje a linha de depósito vira "entregue" quando o inspetor a marca separada; não há confirmação de que a Antolimp levou na rota nem de que a Plena levou aos contratos de "Depósito Plena". Se quiser um 2º passo ("levada"), é acréscimo pequeno (coluna + botão).
2. **Divisão do total da chegada**: ao informar "chegou 6 de 9", a falta recai nos últimos postos (postos por rota e nome primeiro, reposição do estoque por último). O inspetor pode corrigir na Separação (separa menos, com motivo).
3. **Sobra no depósito** (separou menos do que chegou) não entra no estoque central.
4. **Datas de entrega por rota** (1º, 2º, 3º dia útil, com exceções) não foram implementadas.
5. Marcar Essex e Compra Avulsa como "entrega no depósito" vale para TODA compra futura a eles (o snapshot é na criação do rascunho e no envio).

## 21/10/2026 (fim) — RESUMO DO DIA E PENDÊNCIAS — LEIA ISTO PRIMEIRO
**Branch com tudo:** `materiais-multiplo` (inclui a 152, a carta corrigida, a 153 e a 154; `materiais-orcamento-ceu` e `materiais-deposito` já foram juntadas nela por fast-forward). Tudo commitado; 1.200 testes passando. **Nada disso foi publicado.** A `main` tem só o commit `3a7d267` (caixa "Histórico de entregas") ainda não publicado.

**Feito em produção (banco) hoje — todos conferidos:**
- Comentários dos inspetores aplicados (seção acima) e crachá do Dagno removido da fila.
- Dazzle Home 5L = Detergente Neutro (renomeado, `nome_lider` mantido, 5 aliases; preço NÃO mudou).
- COMP-2026-10-001 já estava cancelada; teste do fluxo da gestora no Abaeté (COMP-002 a 005) DESFEITO e apagado — banco igual ao de antes (status: aprovado 1, em_validacao 35, nao_se_aplica 19, validado 3; 29 movimentos de estoque).
- **Migration 152 + dados iniciais** (Flanela branca kit 100, RZK 101 caixa 4, Lustro bombona 5L c/ 5 fracionado).
- **Migration 153 + `dados_orcamentos_153.sql`** (63 contratos com limite uniforme/EPI/crachá, 46 com limite de material, ABAETÉ 1851,54 — o 2000 era teste e não deixou rastro; crachá R$ 6 sem / R$ 8 com cordinha).
- **13 preços Antolimp** (vigentes desde 01/10) em `mat_precos` — `dados-locais/precos_antolimp_2026-10-21/aplicar_13_precos_antolimp.sql`.

**NÃO aplicado ainda:** migration **154** (depósito Plena) e `dados-locais/deposito_2026-10-21/dados_iniciais_154.sql`. **O frontend da branch exige a 154 aplicada ANTES do deploy** (sem ela a aba Separação mostra "Módulo em preparação" e a rota "Depósito Plena" não grava). Os dados iniciais da 154 dependem da confirmação da gestora (item 17 abaixo).

**Ordem para o deploy de hoje (gestora autorizou deploy em 21/10, depois de outro agente mexer em outro módulo):**
1. `git push origin materiais-multiplo materiais-deposito` — em 21/10 o GitHub pediu login de novo (credencial expirada); o agente não consegue autenticar.
2. Aplicar a 154: `powershell -NoProfile -File scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase/migrations/154_materiais_entrega_deposito.sql` (o modo automático barra o agente — a gestora roda no terminal). Conferir: coluna `fornecedores.entrega_deposito`, 0 chr(65533), status dos pedidos igual.
3. Merge de `materiais-multiplo` na `main` (junto com o que o outro agente fizer no outro módulo — resolver conflitos em AGENTS.md/handoff se houver) e deploy pelo checklist do AGENTS §10 (branch main limpa; `MODULO_FERIAS_LIBERADO = false`; conferir o hash do bundle depois).
4. Só com o OK da gestora nos 5 pontos do item 17: `dados_iniciais_154.sql`.

**PENDÊNCIAS (todas precisam ser resolvidas — lista viva também na memória `pendencias-gestora`):**
1. Lista atualizada de fornecedores do Maciel — 35 itens com fornecedor padrão antigo (Contecom 16, Bralimpia 11, Loja das Bombas 6, Spartan 1, Espaço Limpeza 1). Corrigir ANTES de gerar/enviar a compra de outubro (prazo 25/10).
2. Quais itens são compra avulsa × fornecedor (ex.: Abaeté — lábio da catadeira ×3, espanador de teto "de melhor qualidade").
3. Múltiplo de compra: arredondar pela compra inteira do fornecedor (3 + 2 = 1 kit) e o fornecedor abrir o kit para entregar posto a posto — a gestora vai consultar.
4. Abaeté — Neutralizador Floral extra ×2: necessidade real (Maciel × Patrícia). Atenção: o pedido do Abaeté voltou para "em validação".
5. La Reserve — Becker Floral extra ×1 ("Kit Mensal" pelo inspetor, mas o kit tem Becker Talco).
6. Preço dos itens de portaria (Livro de Ocorrências, Protocolo, Planilhas de Controle) — sem preço, o gasto de material fica menor no Painel.
7. Preços Antolimp: decidir os 6 itens com fornecedor padrão antigo (Kit LT, Vulcan Floral 5L, Kit Limpa Vidros, Disco verde 400, Rodo 1 m, Limpol 500 mL — linhas ATENÇÃO em `atualizar_precos_antolimp.sql`); conferir embalagem dos sacos de lixo 40/60/100/240L e do papel higiênico c/12; confirmar os casamentos sugeridos (Sabão Surf, Mazocresol Uso Geral, balde espremedor completo, palha de aço grossa, espremedor Bettanin, cabo de mop 1,40); itens sem valor (Caneca, Pincel, Vaselina) e sem item no catálogo (Becker Pine 5L, Saco de lixo 20L).
8. Depósito Plena (154) — confirmar: (a) entregue ao posto quando o inspetor marca "separado" (sem passo "levado na rota"); (b) falta na chegada cai nos últimos postos e o inspetor corrige; (c) sobra no depósito não vai ao estoque central; (d) datas das rotas (1º/2º/3º dia útil, com exceções) só documentadas; (e) MONTREAL (hoje rota 3) e ORLEANS (hoje rota 1) + 3 TELEX de lojas passam a "Depósito Plena"; Essex e Compra Avulsa = entrega no depósito.
9. Números do Maciel para Estoque/Contagem/Separação (Marco C; contagem 16–19/11).
10. Planilhas de pedido de julho, agosto e setembro/2026 (histórico de consumo para em junho).
11. QR codes dos contratos (incl. LEIRIA) antes de 01/11.
12. Preço atual do Detergente Neutro Dazzle Home (Essex), se mudou (catálogo R$ 44,76 desde 06/2026).
13. Antigas: visual do Excel, rota é necessária?, dia de entrega das rotas, LUVA LÁTEX VERDE.
14. Férias: backfill de `ferias_solicitacoes.departamento_id` antes de liberar o módulo.
