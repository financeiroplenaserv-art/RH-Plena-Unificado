# Plano técnico — Módulo Materiais, Fase 2 (compra e estoque)

> Base: §10 do `docs/PLANO_MATERIAIS_FASE1.md` ("Fase 2 — compra e estoque"), liberada pela gestora em 17/10/2026, + o que já está no banco e no código (migrations 121–144, `src/lib/materiais/`, hooks `useMateriais*`, telas `src/pages/materiais/`, aba CEU → Pedidos), + o processo atual descrito em `docs/passo a passo de como fazemos hoje.docx` e as abas "Pedido e Estoque", "Pedido ao Fornecedor por Cliente", "Compra ao Fornecedor" e "Quantidade Entregue" da `docs/Pedido de material/Planilha completa de material eu mexendo.xlsx`.
> Documento de planejamento: **nada foi alterado no código, no banco ou em produção.** As consultas ao banco foram só de leitura (17/10/2026).
> As 14 perguntas foram respondidas pela gestora em 17/10/2026 — decisões na **seção 11**. O que a gestora ainda precisa informar para começar (etapa 0) está na **seção 9**, com a planilha-modelo em `dados-locais/fase2_etapa0/etapa0_cadastro_para_gestora.xlsx`.

---

## 1. Resumo para a gestão

- Hoje a Fase 1 termina quando o gestor **aprova** o pedido. A Fase 2 continua daí: **entre os dias 20 e 25** o comprador (gestor ou mesa) vê **tudo o que foi aprovado no mês — kit e extras juntos, numa compra só** —, desconta **o que já tem no estoque** e o sistema monta o **pedido de cada fornecedor**, igual à aba "Pedido ao Fornecedor por Cliente" (itens nas linhas, contratos nas colunas, total), com o resumo "Compra ao Fornecedor".
- Para caber antes do dia 20: o líder pede até o dia 15, o **inspetor valida até o dia 17**, o **gestor aprova até o dia 19** e a **mesa conta o estoque até o dia 19**. O que não estiver aprovado quando a compra for enviada fica para o mês seguinte ou, se for urgente, vira **compra avulsa**.
- Cada linha aprovada ganha um destino: **"fornecedor entrega no posto"** ou **"sai do estoque (o inspetor leva)"**. O sistema sugere (primeiro usa o que tem no estoque), o comprador confirma. Livro de Ocorrências, Protocolo de Correspondências e as Planilhas de Controle **nunca vão ao fornecedor**: são comprados e encapados no escritório e saem na separação.
- O **estoque de materiais** passa a existir no CORH, **um estoque central só**: entrou (compra, sobra, devolução), saiu (separado para um contrato), ajuste da contagem. O saldo é a soma desses movimentos — ninguém digita o saldo à mão. Todo mês a **mesa conta o estoque** e o sistema registra a diferença com motivo.
- Quando o fornecedor entrega, a **mesa registra o que chegou** em cada contrato. Faltou algo, registra a quantidade menor e o motivo. O pedido fica **"Entregue"** ou **"Entregue parcial"**; o que faltou não volta sozinho para a próxima compra.
- Depois que a compra foi enviada, o pedido não muda; o que surgir é **compra avulsa**.
- A **Beth** ganha, na aba CEU → Pedidos, a **lista de compra de uniforme/EPI** do que ela não tem para entregar, no mesmo formato de planilha. O estoque do CEU continua manual.
- O **financeiro** passa a consultar as compras com valores (sem alterar).
- Ficam para a Fase 3: o relatório de entrega único assinado pelo líder e o lançamento automático das entregas no CEU.
- **Antes de começar** a gestora precisa informar a **rota (1, 2 ou 3) dos 64 contratos** — hoje todas estão vazias — e o **fornecedor padrão das peças do CEU** (seção 9, planilha pronta para preencher).

---

## 2. O que já existe e será reaproveitado

| O quê | Onde | Situação em 17/10/2026 | Uso na Fase 2 |
|---|---|---|---|
| Pedidos e linhas de produto | `mat_pedidos`, `mat_pedido_itens` (122, 135, 139) | 57 pedidos de outubro; 228 linhas (8 kit aprovadas automaticamente + 220 extras aguardando validação) | Fonte do "aprovado". A linha já tem `qtd_entregue` (vazia) desde a 122 |
| Status do pedido | `status_produtos`: `nao_se_aplica, rascunho, enviado, em_validacao, validado, aprovado, cancelado` | 35 em validação, 1 aprovado, 21 não se aplica | Ganha `em_compra`, `entregue`, `entregue_parcial` (já previstos na Fase 1 §3.3) |
| Constante na Edge Function | `supabase/functions/pedido-materiais/index.ts`: `STATUS_PRODUTOS_ENTREGUE = ['aprovado','em_compra','entregue','entregue_parcial']` | já prevê os estados novos | Nada a mudar na function, só conferir |
| Mescla de envios | `mat_registrar_envio` (143) mescla só antes de `aprovado`; depois cria pedido extra | — | Os estados novos ficam fora da mescla automaticamente (não estão na lista) — o envio do líder depois da compra vira pedido extra, como hoje depois da aprovação |
| Rota | `mat_contratos.rota` (1/2/3) + `mat_pedidos.rota_override` | **as 64 rotas estão vazias** | Rota efetiva `coalesce(rota_override, rota)` separa o Excel e a lista de separação |
| Fornecedores | `fornecedores` (cadastro único, 121) | 16 fornecedores | Fornecedor da compra |
| Fornecedor padrão do item | `mat_itens.fornecedor_id` | 112 de 116 itens ativos têm (Antolimp 67, Contecom 16, Bralimpia 11, Loja das Bombas 6, Essex 5, Compra Avulsa 5, outros 2). Sem fornecedor: os 4 de portaria (Livro de Ocorrências, Protocolo de Correspondências, Planilhas de Controle de Acessos e de Veículos) — **ficam sem fornecedor de propósito** (decisão 1: preparados no escritório) | Fornecedor padrão de cada item na compra; o comprador troca pontualmente numa compra (decisão 12) |
| Preços com histórico | `mat_precos` (item, variação, **fornecedor**, preço, vigente desde) + `precoVigente()` em `src/lib/materiais/precos.ts` | 188 preços, todos com fornecedor; 4 itens sem preço; 15 linhas de outubro sem preço | Preço da compra = vigente na data da compra (snapshot) |
| CEU — itens | `itens` (`estoque`, `estoque_minimo`, `fornecedor_id`, `valor` em centavos, `ultima_compra`, `compra_na_loja`) | **`estoque` = 0 e `fornecedor_id` vazio nos 130 itens**; ninguém mantém o saldo (entregas não baixam) | Só a lista de compra da Beth (seção 3.4); o saldo do CEU não muda nesta fase |
| CEU — preços | `ceu_itens_precos` (134) | 153 linhas, 29 com fornecedor | Preço e fornecedor sugerido para a compra de uniforme/EPI |
| Fila da Beth | `ceu_pedido_itens` + RPCs `conferir_itens_pedido_ceu`, `atender_linhas_pedido_ceu` (122/124) | 109 linhas pendentes (55 uniforme, 45 EPI, 9 crachá) | Já tem o cálculo "falta comprar" (`faltaComprar` em `src/lib/materiais/filas.ts`), hoje só na tela |
| Leitura em lotes | `selecionarTudo` em `src/lib/materiais/paginar.ts` (lotes de 1.000) | — | Toda leitura de linhas do mês, movimentos e compras |
| Datas | `hojeBrasil()`, `parseDataLocal()`, `formatarData()` (`src/lib/utils.ts`); competência em `src/lib/materiais/datas.ts` | — | Datas de compra, chegada, contagem |
| Excel | `@e965/xlsx` (já no projeto) | — | Exportação por fornecedor |
| Plural de unidade | `quantidadeComUnidade` (`src/lib/materiais/unidades.ts`) | — | Textos de tela ("3 bombonas 5L") |

**Como era feito (planilha):** a aba "Pedido e Estoque" tinha uma linha por item × contrato × mês, com as colunas Item, Descrição, Fornecedor, Quant. Solicitada, **Estoque Atual**, Média de Consumo, Valor, Contrato e Mês. O "Estoque Atual" era preenchido **só nas linhas "Modelo"** (419 linhas, uma por item por mês, de 02/2025 a 04/2026) — ou seja, **um estoque central único, contado por mês**, não por contrato nem por rota. As abas "Pedido ao Fornecedor por Cliente" e "Compra ao Fornecedor" eram tabelas dinâmicas sobre essa aba, filtradas por Fornecedor e Mês (formato na seção 6). Os relatórios de entrega do mês traziam o aviso "Materiais e Produtos serão entregues diretamente pelo nosso fornecedor ANTOLIMP" — o fornecedor entregava no posto — e as respostas do escritório nos formulários ("Resposta Plena: enviada 01 bombona") registravam o atendimento menor que o pedido.

---

## 3. Modelo de dados

Convenções da Fase 1 mantidas: prefixo `mat_`; `id uuid default gen_random_uuid()`; `created_at timestamptz default now()`; colunas `date` lidas com `parseDataLocal()`; **toda tabela nova com RLS e GRANT explícito no mesmo arquivo** (regra do Supabase de 30/10/2026, AGENTS.md §8):

```sql
grant select, insert, update, delete on public.<tabela> to authenticated;
grant select, insert, update, delete on public.<tabela> to service_role;
-- nunca para anon
```

**Regra de escrita da Fase 2:** as tabelas novas de movimento, compra e contagem **não têm policy de INSERT/UPDATE/DELETE para `authenticated`** (e o GRANT de escrita é revogado logo depois, como a 144 fez em `mat_pedidos`). Toda gravação passa por RPC `SECURITY DEFINER` que reconfere perfil e status — o mesmo desenho da 144 ("`mat_pedidos` só muda por RPC"). O frontend chama a RPC e confere o retorno (padrão anti-falso-sucesso: a RPC devolve o que mudou ou levanta erro; nunca "0 linhas e sucesso").

### 3.1 Funções de permissão novas (migration 145)

Perfis conferidos em `PERMISSOES_PADRAO` (`src/lib/permissoes.ts`) e nas `pode_*` da 121; quem compra (gestor e mesa), quem conta (mesa) e o acesso do financeiro (só consulta) foram confirmados pela gestora (decisões 2, 5 e 14).

| Função | Perfis | Uso |
|---|---|---|
| `pode_comprar_materiais()` | admin, adm, gestor, mesa | Definir destino das linhas, gerar/enviar/cancelar compra, compra avulsa, compra de reposição do estoque |
| `pode_movimentar_estoque_materiais()` | admin, adm, gestor, mesa, inspetoria | Registrar separação (saída), sobra e devolução (a inspetoria registra a devolução que ela mesma trouxe — decisão 6); o banco não distingue "os contratos do inspetor" — ver risco 8.6 |
| `pode_contar_estoque_materiais()` | admin, adm, gestor, mesa | Abrir, preencher e fechar a contagem mensal |
| `pode_registrar_chegada_materiais()` | admin, adm, gestor, mesa | Registrar o que o fornecedor entregou (produtos) |
| `pode_ver_compras_materiais()` | `pode_ver_materiais()` + financeiro | SELECT de compras e itens de compra (o financeiro confere a nota fiscal) |

`pode_ver_materiais()` (admin, adm, gestor, mesa, inspetoria, dp2) **não muda**. O financeiro entra só na aba Compras, pelo mesmo molde da aba Fornecedores (`menu/rota.materiais_compras`).

Para a fila da Beth reaproveita-se `pode_atender_pedido_ceu()` (admin, adm, gestor, dp2).

### 3.2 Estoque de materiais (migration 145)

**`mat_estoque_movimentos`** — o diário do estoque. Imutável: nunca UPDATE nem DELETE; erro se corrige com um movimento de estorno.
- `item_id → mat_itens not null`, `variacao_id → mat_item_variacoes null`.
- `tipo text check in ('entrada_compra','entrada_sobra','entrada_devolucao','saida_pedido','saida_avulsa','ajuste_contagem','estorno')`.
- `quantidade numeric(12,2) not null check (quantidade <> 0)` — **com sinal**: entradas positivas, saídas negativas, ajuste e estorno com o sinal da diferença. Um check amarra o sinal ao tipo (entrada > 0, saída < 0).
- `data date not null` (dia do movimento, `hojeBrasil()` por padrão), `motivo text` (obrigatório em sobra, devolução, saída avulsa, ajuste e estorno — check), `contrato_id → mat_contratos null` (de onde veio a devolução/sobra ou para onde foi a saída), `pedido_item_id → mat_pedido_itens null` (saída para uma linha de pedido), `compra_item_id → mat_compra_itens null` (entrada de compra), `contagem_id → mat_estoque_contagens null`, `estorna_id → mat_estoque_movimentos null`, `criado_por uuid default auth.uid()`.
- Índices: `(item_id, variacao_id, data)`, `(pedido_item_id)`, `(compra_item_id)`.
- RLS: SELECT `pode_ver_materiais()`; sem policy de escrita (só RPC).

**View `mat_estoque_saldos`** (`security_invoker = true`): `item_id, variacao_id, saldo = sum(quantidade), ultimo_movimento`. Saldo é por **item + variação** (o disco 350 mm e o 410 mm são saldos diferentes; a flanela amarela e a azul também). Item com marca oculta para o líder (`oculta_lider`, 136) segue com saldo por variação — a marca importa para a diluição.

**`mat_estoque_contagens`** — a contagem do mês.
- `competencia date not null` (1º dia do mês), `data date not null`, `status check in ('aberta','fechada','cancelada')`, `aberta_por`, `fechada_por`, `fechada_em`, `observacao`.
- Índice único parcial: uma contagem `aberta` por vez; uma `fechada` por competência.

**`mat_estoque_contagem_itens`** — `contagem_id`, `item_id`, `variacao_id null`, `saldo_sistema numeric` (foto do saldo ao abrir), `quantidade_contada numeric null check (>= 0)`, `diferenca numeric generated always as (quantidade_contada - saldo_sistema) stored`, `motivo text` (obrigatório quando a diferença ≠ 0 — o check vale no fechamento, pela RPC). Único `(contagem_id, item_id, coalesce(variacao_id, zero-uuid))`.

**RPCs da 145** (todas `SECURITY DEFINER`, `search_path = public`, `REVOKE ... FROM PUBLIC, anon`, `GRANT EXECUTE ... TO authenticated`):
- `mat_registrar_movimento_estoque(p_tipo, p_item, p_variacao, p_quantidade, p_data, p_motivo, p_contrato)` — sobra, devolução, saída avulsa (com motivo). Sobra e devolução entram no estoque central com motivo (decisão 6). Saída maior que o saldo **não** é recusada — só avisa (o estoque físico manda; o sistema registra e a contagem acerta).
- Itens **preparados no escritório** (`mat_itens.preparo_escritorio`, seção 3.3) não entram na contagem nem têm saldo.
- `mat_estornar_movimento(p_movimento, p_motivo)` — cria o movimento inverso; recusa estornar um estorno ou um movimento de contagem fechada.
- `mat_abrir_contagem(p_competencia, p_data)` — cria a contagem com a foto do saldo de todos os itens com saldo ≠ 0 ou com movimento nos últimos 6 meses; itens novos podem ser incluídos depois.
- `mat_salvar_contagem(p_contagem, p_itens jsonb)` — grava as quantidades contadas (pode salvar várias vezes enquanto `aberta`).
- `mat_fechar_contagem(p_contagem)` — exige todas as linhas contadas e motivo nas diferenças; **recalcula o saldo do sistema no momento do fechamento** (houve movimento entre abrir e fechar) e grava um `ajuste_contagem` por diferença; muda para `fechada`.

### 3.3 Compra de materiais (migration 146)

**`mat_compras`** — um pedido a um fornecedor ("o Excel que vai para a Antolimp").
- `competencia date not null`, `fornecedor_id → fornecedores not null`, `numero text unique` (sequencial legível "COMP-2026-10-001", gerado na RPC), `tipo check in ('mensal','avulsa','reposicao_estoque')` (decisão 8: o que surge depois da compra enviada é **compra avulsa**), `status check in ('rascunho','enviada','recebida_parcial','recebida','cancelada')`, `data_corte timestamptz` (até quando as linhas aprovadas entraram), `entrega_prevista date null`, `enviada_em/por`, `cancelada_em/por/motivo`, `observacao`, `criado_por`, `created_at`.
- RLS: SELECT `pode_ver_compras_materiais()`; escrita só RPC.

**`mat_compra_itens`** — uma linha por **item × variação × contrato** dentro da compra (é exatamente a célula do Excel).
- `compra_id → mat_compras on delete cascade`, `item_id`, `variacao_id null`, `contrato_id → mat_contratos null` (**null = reposição do estoque**, coluna "Estoque" do Excel), `rota smallint null` (snapshot da rota efetiva na geração), `quantidade numeric(12,2) not null check (> 0)`, `preco_unitario numeric(12,2) null` (vigente na data da compra; null = item sem preço, ver 9.3), `qtd_recebida numeric null check (>= 0)`, `motivo_recebimento text` (obrigatório quando recebida < quantidade), `recebido_em date`, `recebido_por uuid`, `entrega_local check in ('posto','escritorio')` (posto quando há contrato; escritório na reposição).
- Único `(compra_id, item_id, coalesce(variacao_id, zero), coalesce(contrato_id, zero))`.

**Coluna nova em `mat_itens`**: `preparo_escritorio boolean not null default false` — item comprado e preparado (encapado) no escritório, que **nunca entra no pedido ao fornecedor** (decisão 1). A migration marca por id, com conferência de contagem = 4, os itens Livro de Ocorrências, Protocolo de Correspondências, Planilha de Controle de Acessos e Planilha de Controle de Veículos; editável no Catálogo. **Recomendação: sem controle de estoque para esses itens** — são poucos, feitos em lote conforme a necessidade e o custo de contá-los todo mês não se paga. Eles saem da compra, aparecem numa **"lista do escritório"** (total do mês por item, para saber quanto preparar) e na separação; marcar "Separado" registra a entrega sem movimento de estoque. Se um dia a gestora quiser saldo deles, basta desmarcar o flag: passam a ser itens de estoque comuns.

**Colunas novas em `mat_pedido_itens`** (o "destino" de cada linha aprovada):
- `atendimento text null check in ('fornecedor','estoque','escritorio','nao_atendido')` (`escritorio` = item com `preparo_escritorio`; sugerido automaticamente e nunca vai a compra).
- `qtd_estoque numeric null`, `qtd_compra numeric null` — a linha pode ser dividida (parte sai do estoque, parte vem do fornecedor); check: `coalesce(qtd_estoque,0) + coalesce(qtd_compra,0) <= qtd aprovada`.
- `compra_item_id → mat_compra_itens null` (de qual célula de compra vem a parte do fornecedor).
- `motivo_entrega text` (já existe `qtd_entregue`), `entregue_em date`, `entregue_por uuid`.
- `motivo_nao_atendido text` (obrigatório com `nao_atendido`).

**Alteração do CHECK de `mat_pedidos.status_produtos`**: acrescenta `em_compra`, `entregue`, `entregue_parcial`. Sem mudança de dados (nenhum pedido nesses estados).

**Quando o pedido muda de estado** (função interna `mat_recalcular_status_entrega(p_pedido)`, chamada pelas RPCs de compra, separação e chegada; nunca pelo frontend):
- `aprovado` → `em_compra`: todas as linhas aprovadas com quantidade > 0 já têm destino (`atendimento` preenchido).
- `em_compra` → `entregue`: todas as linhas com destino têm `qtd_entregue` = quantidade aprovada (fornecedor + estoque) ou estão `nao_atendido`.
- `em_compra` → `entregue_parcial`: todas fechadas, mas alguma com `qtd_entregue` menor que a aprovada.
- **Kit e extras vão na mesma compra** (decisão 7): o kit é aprovado na hora (§13 da Fase 1), e a compra normal acontece na janela dos dias 20–25. **A compra NÃO é travada antes do dia 20 (decisão da gestora, 17/10/2026: "pode haver exceções")**: o botão de gerar existe o mês todo; antes de `materiais_config.dia_inicio_compra` (padrão 20, por `hojeBrasil()`) ele pede confirmação com aviso — "Ainda não é o dia da compra. N pedidos do mês ainda não foram aprovados e ficarão de fora." — e a compra registra que foi gerada antes da janela.
- **Extra ainda não aprovado quando a compra é gerada** (pedido em `em_validacao`/`validado`): a tela avisa "N contratos com extras aguardando inspetor/gestor" e o comprador pode esperar até o dia 25. Ao gerar a compra, **o kit desses contratos vai** (o posto não fica sem o material de rotina por causa de um extra) e **o extra pendente fica de fora**. Se for aprovado depois, entra na **compra do mês seguinte** (a prévia lista também linhas aprovadas e sem destino de competências anteriores, com o selo "do mês anterior") ou, se for urgente, numa **compra avulsa**. O status desse pedido segue a fila do inspetor/gestor; as linhas do kit carregam o destino individualmente e o pedido só vira `em_compra` quando todas as linhas aprovadas tiverem destino.

**RPCs da 146:**
- `mat_previa_compra(p_competencia)` — **somente leitura**, devolve as linhas aprovadas e ainda sem destino da competência **e das anteriores** (com contrato, rota efetiva, item, variação, quantidade aprovada, fornecedor padrão do item, preço vigente, saldo do estoque). Agregação no servidor: evita o corte de 1.000 linhas do PostgREST e garante que tela e Excel leiam a mesma coisa. A distribuição sugerida (estoque × fornecedor) é lógica pura no front (`src/lib/materiais/compra.ts`, com testes).
- `mat_definir_atendimento(p_linhas jsonb)` — grava o destino de cada linha (fornecedor/estoque/dividida/não atendido com motivo). Recusa linha não aprovada, de pedido cancelado, ou que já tem compra enviada.
- `mat_gerar_compra(p_competencia, p_fornecedor, p_tipo, p_linhas jsonb)` — cria a compra em `rascunho` e as `mat_compra_itens` agregando as linhas com destino "fornecedor" daquele fornecedor; liga cada `mat_pedido_itens.compra_item_id`; grava o preço vigente na data. Para `reposicao_estoque`, as linhas vêm do comprador (item, variação, quantidade), sem contrato.
- `mat_enviar_compra(p_compra)` — `rascunho` → `enviada` (congela as quantidades; o Excel daquela compra passa a ser sempre o mesmo). Recalcula o status dos pedidos ligados.
- `mat_cancelar_compra(p_compra, p_motivo)` — só `rascunho` ou `enviada` sem nada recebido; desfaz os destinos das linhas (voltam para "sem destino").
- `mat_registrar_chegada(p_compra, p_itens jsonb)` — mesa: por célula, a quantidade recebida e o motivo se menor. Entrega no posto: grava `qtd_recebida` na célula e distribui para `qtd_entregue` das linhas de pedido ligadas (uma célula pode juntar o kit e o extra do mesmo contrato — a distribuição preenche primeiro o kit, depois os extras, por ordem de criação); reposição: cria `entrada_compra` no estoque. Atualiza `mat_compras.status` e o status dos pedidos.
- `mat_registrar_separacao(p_linhas jsonb)` — saída do estoque: para cada linha com destino "estoque", cria `saida_pedido` (negativo) e grava `qtd_entregue` (parte do estoque), `entregue_em/por` — a baixa acontece aqui (decisão 4). Linhas com destino `escritorio` são marcadas entregues sem movimento de estoque.

**RPCs da Fase 1 que precisam ser recriadas na 146** (a partir do `pg_get_functiondef` real, como na 135, e com backup):

| RPC | Mudança |
|---|---|
| `ajustar_linha_kit_materiais` (135) | Recusar quando a linha já tem destino (`atendimento` não nulo) ou o pedido está em `em_compra`/`entregue`/`entregue_parcial` (a 135 aceita `aprovado` — hoje a lista é `em_validacao, validado, aprovado`) |
| `incluir_linha_pedido_materiais` (139) | Em `em_compra` ou depois: recusar (decisão 8 — o pedido não muda depois da compra enviada) e orientar a criar pedido extra, que vai para uma compra avulsa |
| `ligar_linha_catalogo_materiais` (139) | Recusar linha que já tem destino |
| `aprovar_pedido_materiais` / `validar_pedido_materiais` (135) | Recusar linha com destino (só pode acontecer com o kit, que já sai aprovado) |
| `preencher_pedido_pelo_kit` (135, linha 472) | A periodicidade olha pedidos `status_produtos = 'aprovado'` — passar a aceitar `aprovado, em_compra, entregue, entregue_parcial` |
| `definir_rota_pedido` (122) | Permitida sempre; se a linha já está numa compra **enviada**, a compra não muda (a rota da célula é a do envio) e a tela avisa |
| `mat_registrar_envio` (143) | Nenhuma: a mescla já só acontece antes de `aprovado` |

**Front que olha `'aprovado'` e precisa aceitar os estados novos** (mesmo commit da 146): `src/hooks/useMateriaisPedidos.ts` (linhas 232 e 397 — última entrega e média), `src/lib/materiais/media.ts` (linha 88), `src/lib/materiais/painel.ts` (linha 102), `src/lib/materiais/inclusaoPedido.ts`, `src/pages/materiais/MateriaisPedidoDetalhePage.tsx` (linhas 125 e 489) e o tipo `StatusProdutos` em `src/types/materiais.ts`. Criar uma constante única `STATUS_APROVADO_OU_DEPOIS` em `src/lib/materiais/` (espelho da constante da Edge Function) para não espalhar listas. Na "última entrega" dos extras (`ultimaEntregaDoItem`), passar a usar `qtd_entregue` quando existir (hoje usa a aprovada — "Fase 1: aprovado = entregue").

### 3.4 Compra da Beth — uniforme e EPI (migration 147)

Decisão 9: **a mesma compra, com outra origem**, sem mexer no saldo do CEU (o estoque do CEU continua manual).
- `mat_compras.origem check in ('materiais','ceu') default 'materiais'`.
- `mat_compra_itens.ceu_item_id → itens null` (check: exatamente um entre `item_id` e `ceu_item_id`), `colaborador_id` **não** é gravado na compra (o fornecedor recebe item × tamanho × quantidade; a pessoa fica no pedido).
- `ceu_pedido_itens.compra_item_id → mat_compra_itens null` e `ceu_pedido_itens.qtd_recebida`/`recebido_em` (o que chegou para aquela linha).
- RPCs: `ceu_gerar_compra(p_fornecedor, p_linhas jsonb)` e `ceu_registrar_chegada(p_compra, p_itens jsonb)` com `pode_atender_pedido_ceu()`. A chegada **não** altera `itens.estoque` (o saldo do CEU continua manual — decisão da Fase 1) e **não** marca a linha como atendida: a Beth continua atendendo pela tela como hoje.
- Peças "compra na loja" (`itens.compra_na_loja`, 141: blazer, calça social, camisa social branca bordada) **não entram** na compra ao fornecedor — o colaborador compra com autorização; a tela as lista à parte.
- Crachá não entra (é impresso na aba Crachás).
- Fornecedor sugerido = `itens.fornecedor_id` (hoje vazio nos 130 — preenchido na etapa 0) ou, sem ele, o do último preço em `ceu_itens_precos` (24 das 98 peças ativas têm).

### 3.5 Migration 148 — permissões

Sementes em `permissoes_perfil` e `reset_permissoes_perfil` recriada a partir da **129** (última versão; = 123 + linhas da 129) + as linhas novas, para "Restaurar padrão" não revogar nada (padrão 104/115/117/123/129). Sem tabela nova — sem GRANT de tabela.

---

## 4. Telas no CORH e quem acessa

Todas no `MateriaisShell` (abas novas), com componentes de `src/components/corh/`, filtros com `FiltrosAtivosBadge` quando persistidos, tabelas `min-w-[720px]` e números `tabular-nums`.

| Rota | Tela | Quem usa |
|---|---|---|
| `/materiais/compras` (aba **Compras**) | **Preparar a compra do mês** (botão de gerar disponível o mês todo — antes do dia 20 pede confirmação com aviso, sem travar; aviso dos contratos com extras pendentes e da data da última contagem): tabela de tudo o que foi aprovado e ainda não tem destino — kit e extras juntos, mais o que sobrou de meses anteriores —, agrupada por item; colunas aprovado, saldo do estoque, sugestão "do estoque" × "do fornecedor", fornecedor; o comprador confirma ou ajusta linha a linha (dividir, trocar fornecedor, não atender com motivo). Botão "Gerar pedidos aos fornecedores" (um rascunho por fornecedor). Abaixo, a lista de compras do mês com status | comprador (gestor, mesa); financeiro e inspetoria só leitura |
| `/materiais/compras/:id` | Detalhe de uma compra: matriz itens × contratos (por rota), total por item e por contrato, valor; botões **Baixar Excel**, **Marcar como enviada**, **Cancelar**; depois de enviada, **Registrar chegada** | comprador; mesa registra a chegada; financeiro só leitura |
| `/materiais/chegadas` (aba **Chegadas**) | Lista das compras enviadas aguardando entrega, por rota e data prevista; abre o registro por contrato (quantidade recebida, motivo se menor). Atalho "chegou tudo" por contrato | mesa (+ gestor) |
| `/materiais/separacao` (aba **Separação**) | O que **sai do estoque** e os **itens do escritório**, por rota e contrato — lista para o inspetor levar; botão "Separado" registra a saída (itens do escritório sem movimento de estoque). Mostra o saldo antes/depois. Inclui a "lista do escritório": total do mês de cada item preparado no escritório | mesa, inspetoria (+ gestor) |
| `/materiais/estoque` (aba **Estoque**) | Saldo por item/variação, último movimento, histórico de movimentos com filtro; botões "Entrada de sobra", "Devolução", "Saída avulsa", "Estornar" (com motivo) | mesa, gestor; inspetoria só leitura + registrar a devolução que ela trouxe |
| `/materiais/estoque/contagem` | Contagem do mês: abre, imprime a folha (itens na ordem do catálogo), digita as quantidades, motivo nas diferenças, fecha | mesa (+ gestor) — contar e fechar entre os dias 16 e 19 |
| `/materiais/pedidos/:id` (existente) | Ganha as colunas **Destino** ("fornecedor — Antolimp, compra COMP-…", "estoque", "não atendido: motivo") e **Entregue**; selo do status novo. Ações de ajuste/inclusão somem quando a linha já tem destino | todos do módulo |
| `/materiais/pedidos` (existente) | Status novos nos filtros e selos ("Em compra", "Entregue", "Entregue parcial") | todos |
| `/ceu/pedidos` (existente) | Novo bloco **"Pedir ao fornecedor"** sobre o "falta comprar" que já existe: a Beth informa, se quiser, "tenho em mãos" por peça (não é gravado como estoque), escolhe o fornecedor e gera a compra; Excel no mesmo formato (peças × contratos); depois registra a chegada | dp2 (Beth), gestor |

Painel do gestor (`/materiais/painel`): sem mudança de regra; o valor "aprovado" passa a considerar os estados novos.

### 4.1 Permissões (`PERMISSOES_PADRAO` e as mesmas linhas na `PermissoesPage` — regra do AGENTS.md §12)

```ts
materiais: {
  // ... existentes
  comprar:             ['gestor', 'mesa'],               // destino das linhas, gerar/enviar/cancelar compra
  registrar_chegada:   ['gestor', 'mesa'],
  separar_estoque:     ['gestor', 'mesa', 'inspetoria'],
  movimentar_estoque:  ['gestor', 'mesa'],               // sobra, devolução, saída avulsa, estorno
  contar_estoque:      ['gestor', 'mesa'],
  ver_compras:         ['gestor', 'mesa', 'inspetoria', 'financeiro'],
},
ceu: {
  // ... existentes
  comprar_pedido: ['gestor', 'dp2'],                     // pedido ao fornecedor da fila da Beth
},
```

`permissoes_perfil` (148): `menu/rota.materiais_compras` = true para financeiro (só a aba Compras, como `materiais_fornecedores`); as ações acima semeadas. Banco × tela: as `pode_*` têm listas fixas — concessão nova pela tela Permissões exige migration (limitação conhecida, Fase 1 §5.2).

---

## 5. Fluxo mensal passo a passo

**Calendário do mês** (decisões 3 e 5; dias configuráveis em `materiais_config` — `dia_limite_validacao` 17, `dia_limite_aprovacao` 19, `dia_inicio_compra` 20, `dia_fim_compra` 25; `mat_salvar_config` passa a aceitar essas chaves na 146):

| Dias | O quê | Quem |
|---|---|---|
| 1–15 | Líder faz o pedido (Fase 1, sem mudança). O kit sai aprovado na hora; os extras vão para o inspetor | líder |
| 16–17 | Inspetor valida os extras (a fila já existe) | inspetoria |
| 18–19 | Gestor aprova os extras no Painel | gestor |
| 16–19 | Mesa conta o estoque e fecha a contagem (até o dia 19) | mesa |
| 20–25 | Compra: destino de cada linha, pedido aos fornecedores, Excel, "Enviada" | gestor ou mesa |
| depois do envio | Separação do estoque, entrega pelo fornecedor e pelo inspetor, registro da chegada | mesa, inspetoria |

Os prazos dos dias 17 e 19 são **avisos, não travas** (mesmo desenho do "dia de aviso" da Fase 1): a partir do dia 18 a fila do inspetor e o Painel do gestor mostram em âmbar "faltam N dias para a compra"; no dia 20, em vermelho. Contagem fora do prazo também só gera aviso na tela Compras ("estoque contado há N dias").

**Pedido não aprovado até a compra:** o comprador pode esperar até o dia 25. Quando a compra é gerada, entram o **kit de todos os contratos** e os **extras aprovados**; o extra ainda pendente fica de fora e, quando for aprovado, entra na compra do mês seguinte (a prévia traz o que sobrou dos meses anteriores, com selo) ou, se for urgente, numa **compra avulsa**. Contrato sem kit e só com extras pendentes: nada dele vai nessa compra.

1. **Dias 1–19 — pedido, validação e aprovação** (Fase 1).
2. **Até o dia 19 — contagem do estoque.** A mesa abre a contagem, imprime a folha, conta a prateleira, digita, explica as diferenças e fecha. O saldo do sistema passa a ser o contado.
3. **Dias 20–25 — preparar a compra.** O comprador abre Materiais → Compras: o sistema lista tudo o que está aprovado e ainda sem destino (kit e extras juntos), soma por item e mostra o saldo. Sugestão automática: **usa o estoque primeiro** (até o saldo), o resto vai para o **fornecedor padrão do item** (o comprador pode trocar numa compra). Itens preparados no escritório já vêm como "escritório" e não entram em pedido a fornecedor. O comprador confirma ou ajusta.
4. **Gerar os pedidos aos fornecedores.** Um rascunho por fornecedor. O comprador abre o detalhe, confere a matriz, baixa o Excel, envia ao fornecedor (e-mail/WhatsApp — fora do sistema) e marca **"Enviada"**. A partir daqui as linhas não mudam e os pedidos passam para **"Em compra"**.
5. **Separação.** A mesa/inspetoria abre Materiais → Separação, separa por rota (o que sai do estoque e os itens do escritório) e marca "Separado" — o saldo baixa na hora (decisão 4) e as linhas ficam como entregues pelo estoque/escritório.
6. **Entrega.** O fornecedor entrega no posto (por rota); o inspetor leva o que saiu do estoque e do escritório.
7. **Registrar a chegada.** A mesa abre Materiais → Chegadas e registra, por contrato, o que o fornecedor entregou. Faltou: quantidade menor + motivo. O pedido vira **"Entregue"** ou **"Entregue parcial"**. O que faltou **não volta sozinho** para a próxima compra (decisão 10): se chegar depois, a mesa completa o registro na mesma compra; se não vier, o comprador decide entre compra avulsa e o mês seguinte.
8. **Depois da compra enviada.** Nada muda no pedido (decisão 8). O que surgir — extra aprovado depois, pedido extra urgente, faltante que não veio — é **compra avulsa** (mesmo fluxo, `tipo = 'avulsa'`) ou espera a compra do mês seguinte.
9. **Reposição do estoque.** Quando quiser, o comprador faz uma compra `reposicao_estoque` (itens sem contrato, entrega no escritório); a chegada vira entrada no estoque central.
10. **Beth (uniforme/EPI).** Depois de conferir a fila, ela vê "falta comprar", gera a lista de compra ao fornecedor, registra a chegada e continua atendendo e lançando no CEU como hoje (estoque do CEU manual).

### 5.1 Diagrama do fluxo

```
 DIAS 1-15                 DIAS 16-19                        DIAS 20-25 (COMPRADOR: gestor/mesa)
 ─────────                 ──────────                        ───────────────────────────────────
 líder envia ──► kit: aprovado na hora ─────────────────────┐
             └─► extras: inspetor (até 17) ► gestor (até 19) ┐
                           mesa conta o estoque (até 19)     │
                                                        ▼    ▼
                    ┌──── PREPARAR COMPRA: kit + extras aprovados − saldo ────┐
                    │      (extra pendente: mês seguinte ou compra avulsa)    │
                    │                                                          │
       destino "estoque" / "escritório"                          destino "fornecedor"
                    │                                                          │
                    ▼                                                          ▼
       SEPARAÇÃO (baixa do estoque)                    COMPRA por fornecedor (rascunho)
       inspetor leva ao posto                             │ Excel → fornecedor
                    │                                     ▼
                    │                                 ENVIADA ⇒ pedido "em_compra"
                    │                                     │  (depois disso: só compra avulsa)
                    │                                     │ fornecedor entrega no posto
                    │                                     ▼
                    │                          CHEGADA registrada pela mesa
                    │                          (qtd recebida + motivo se menor)
                    └───────────────┬─────────────────────┘
                                    ▼
                  pedido "entregue" ou "entregue_parcial"
                                    │
                   (Fase 3: recibo único assinado pelo líder)

 ESTOQUE CENTRAL (um só): + entrada_compra (reposição) + sobra + devolução
                          − saida_pedido (separação) − saída avulsa
                          ± ajuste_contagem (contagem mensal fechada)   saldo = soma dos movimentos
 Itens do escritório (livro, protocolo, planilhas de controle): fora da compra e sem saldo.
```

---

## 6. Formato do Excel ao fornecedor

Reproduz as duas tabelas dinâmicas da planilha atual (abas "Pedido ao Fornecedor por Cliente" e "Compra ao Fornecedor", filtradas por Fornecedor e Mês). Um arquivo por compra (`Pedido_<Fornecedor>_<MM-AAAA>_<numero>.xlsx`), gerado no navegador com `@e965/xlsx`, lógica pura em `src/lib/materiais/excelCompra.ts` (testada sem arquivo):

**Aba 1 — "Pedido por Cliente"**
```
Fornecedor | Antolimp
Mês        | 10/2026
Compra     | COMP-2026-10-001

Item                       | Abaeté | Back Art | ... | Telex Sede | Estoque | Total
Álcool 70% 1L              |   6    |          | ... |     3      |         |  36
Borrifador UN              |   4    |    3     | ... |            |    2    |  26
...
Total                      |  83    |   12     | ... |            |         | 529
```
- Linhas = itens do catálogo com o **nome padronizado e a unidade** (como na planilha: "Cloro 5L", "Disco preto 350 UN"); variação no nome ("Flanela Microfibra amarela"). Só itens com quantidade > 0 (a planilha atual listava os zerados — decisão 11).
- Colunas = contratos com quantidade > 0, **agrupados por rota** (uma linha de cabeçalho "Rota 1 / Rota 2 / Rota 3" acima dos nomes; contratos sem rota no fim em "Sem rota"); coluna "Estoque" só quando há reposição; coluna "Total".
- Nome do contrato = `mat_contratos.nome` (o nome curto, como na planilha).
- Sem preço (o fornecedor tem a própria tabela) — decisão 11.

**Aba 2 — "Compra ao Fornecedor"**: Item | Quantidade total (e, só na versão interna, Preço unitário e Valor), com "Total Geral".

**Aba 3 — "Entrega por Rota"** (opcional, recomendação): uma lista por rota → contrato → itens, para o motorista/fornecedor separar as caixas.

A versão **interna** do mesmo Excel (botão "Baixar com valores") inclui preço e valor por célula — é a que o financeiro confere contra a nota.

---

## 7. Etapas de implementação

Cada etapa deixa o sistema funcionando. Migrations aplicadas pela Management API **com arquivo UTF-8** (`scripts/lib/executar-arquivo-sql-management-api.ps1`; nunca SQL com acento inline — incidente da 131), com backup antes em `dados-locais/backup_materiais_<n>_<data>/`, nunca `db push`. Deploy no Netlify só nos marcos (15 créditos cada), sempre da `main` limpa e com `MODULO_FERIAS_LIBERADO = false` conferido (AGENTS.md §10). Tamanho relativo: P (pequeno) / M / G.

| # | Entrega | Como testar | Tam. |
|---|---|---|---|
| 0 | **Etapa 0 — cadastro da gestora** (seção 9): planilha `dados-locais/fase2_etapa0/etapa0_cadastro_para_gestora.xlsx` preenchida → script grava as rotas (`definir_rota_contrato`) e o `itens.fornecedor_id` do CEU, com dry-run e backup. Sem código de tela | Consulta: 0 contratos ativos sem rota; peças do CEU com fornecedor = as preenchidas | P |
| 1 | **Migration 145** — estoque (movimentos, view de saldo, contagens, `pode_*` novas, RPCs de movimento e contagem) + tipos em `src/types/materiais.ts`/`database.ts` | Teste de fumaça em transação desfeita (como na 135/144): INSERT direto como `authenticated` = permission denied; movimento com sinal errado recusado; saída sem motivo recusada; contagem fecha e gera os ajustes certos; fechar com linha sem quantidade recusado; estorno de estorno recusado; varredura `chr(65533)` nas funções | M |
| 2 | Lógica pura `src/lib/materiais/estoque.ts` (saldo, diferença, ordem da folha) + telas **Estoque** e **Contagem** | Vitest; smoke das páginas; contagem real de teste com 3 itens | M |
| **D1** | Deploy: estoque e contagem no ar até 15/11 — **a 1ª contagem real (16 a 19/11) vira o saldo inicial** (não há saldo para importar: a planilha só tinha as linhas "Modelo" até 04/2026) | hash do bundle = `dist/` | — |
| 3 | **Migration 146** — compras, `mat_itens.preparo_escritorio` (marca os 4 itens por id, conferência = 4), colunas novas em `mat_pedido_itens`, CHECK de status, chaves novas de `materiais_config`, RPCs de compra/chegada/separação, recriação das RPCs da Fase 1 (tabela da 3.3) | Fumaça em transação desfeita: prévia lista só aprovadas sem destino (inclusive de mês anterior); item do escritório nunca entra em compra; gerar compra antes do dia 20 aceito e marcado como "antes da janela"; dividir linha acima do aprovado recusado; gerar compra liga as linhas; enviar congela; `ajustar_linha_kit` em linha com destino recusado; `incluir_linha` em pedido `em_compra` recusado; chegada parcial sem motivo recusada; chegada total → `entregue`; uma célula com kit + extra distribui certo; cancelar compra devolve as linhas; envio do líder depois de `em_compra` vira pedido extra; periodicidade do "preencher pelo kit" conta `em_compra`/`entregue` | G |
| 4 | Front dos estados novos (constante única, `media.ts`, `painel.ts`, `useMateriaisPedidos`, detalhe/lista) + lógica pura `compra.ts` (agregação, sugestão estoque-primeiro, divisão) e `excelCompra.ts` (matriz por rota, totais) | Vitest com o caso real de junho/2026 (compra Antolimp: 107 itens listados, 58 zerados, 529 unidades no total; total por contrato da aba); `npm test`, lint, build | M |
| 5 | Telas **Compras** (preparar + detalhe + Excel), **Separação** e **Chegadas** | Mês de teste completo num contrato fictício: aprovado → destino → compra → Excel → enviada → separação → chegada parcial → entregue_parcial | G |
| **D2** | Deploy: primeira compra real (20 a 25/11/2026) **em paralelo com a planilha** — o comprador confere o Excel do sistema contra a planilha antes de enviar | Totais por fornecedor batem com a planilha | — |
| 6 | **Migration 147** — compra da Beth (origem `ceu`, `ceu_item_id`, `ceu_pedido_itens.compra_item_id`, RPCs) + bloco "Pedir ao fornecedor" na aba CEU → Pedidos | Fumaça: compra CEU não altera `itens.estoque`; "compra na loja" não entra; chegada não marca atendido | M |
| 7 | **Migration 148** — permissões (sementes + `reset_permissoes_perfil` = 129 + linhas novas) + `PERMISSOES_PADRAO` + `PermissoesPage` + `permissoes.test.ts` | "Restaurar padrão" do financeiro mantém a aba Compras; dp1 não vê Compras | P |
| 8 | Documentação: AGENTS.md §8 (145–148) e §11 (regras de compra/estoque), `docs/REGRAS_NEGOCIO.md`, guia de treinamento | — | P |
| **D3** | Deploy: planilha desligada para compras | — | — |

> Ordem das migrations: 148 (permissões) pode ir junto com a 146 se as telas forem publicadas no mesmo marco; ela só precisa estar aplicada antes do deploy que mostra as abas novas. Toda migration nova é aplicada **também no banco de treinamento**, quando ele existir (HANDOFF 17/10, pendência 2).

---

## 8. Riscos e pontos de atenção

1. **Rotas vazias.** Os 64 contratos estão sem rota. Sem rota, o Excel junta tudo em "Sem rota" e a separação não tem ordem. Bloqueio suave: a tela Compras avisa "N contratos sem rota" e não impede.
2. **Estado misto no mesmo pedido.** O kit sai aprovado na hora e o extra espera o inspetor/gestor. O status do pedido é "a fila do que falta decidir" (Fase 1 §13). Por isso o destino e a entrega ficam **por linha**, e o status do pedido só vira `em_compra` quando todas as linhas aprovadas têm destino. Extra pendente na data da compra fica de fora sem segurar o kit (decisão 7).
3. **Linhas que não podem ser compradas.** Texto livre não ligado ao catálogo (`item_id` nulo — hoje 0, mas o líder pode mandar "Não achei, enviar assim") e item sem preço (15 linhas de outubro). A prévia lista à parte: texto livre exige "Ligar ao catálogo" antes; sem preço vai para a compra com valor "—" e aviso.
4. **Preço da compra ≠ preço do pedido.** O pedido guarda o preço do dia do envio; a compra, o do dia da compra. A tela mostra os dois quando diferem; o painel do gestor segue com o do pedido.
5. **Preço por fornecedor.** `mat_precos` guarda o fornecedor, mas o preço vigente não depende dele (vale o mais recente do item). Se o comprador trocar o fornecedor de uma compra, o preço exibido pode ser de outro fornecedor — aviso na tela e "atualize o preço no Catálogo" (decisão 12: fornecedor padrão por item, troca pontual).
6. **Quem mexe no estoque.** O banco não sabe "de qual inspetor" é cada contrato (não há vínculo inspetor × contrato). Se a inspetoria registrar saídas, ela poderá registrar de qualquer contrato. Aceitável (auditoria pelo `criado_por`).
7. **Saldo negativo.** O sistema registra a saída mesmo sem saldo (o físico manda) e mostra o saldo negativo em vermelho; a contagem acerta. Bloquear criaria "não consigo registrar o que já saiu".
8. **Contagem com movimento no meio.** Entre abrir e fechar a contagem pode haver separação; por isso o ajuste é calculado no **fechamento** (contado − saldo naquele instante), não na abertura.
9. **Paginação.** Linhas do mês, movimentos e compras passam de 1.000 com o tempo: prévia agregada no servidor (RPC) e leituras com `selecionarTudo`.
10. **Datas e fuso.** `data`, `recebido_em`, `entregue_em`, `entrega_prevista` são `date` (lidas com `parseDataLocal`, padrão `hojeBrasil()`); carimbos `timestamptz` exibidos com `formatarDataHora`. A competência da compra é a do pedido, não a do dia da compra.
11. **Rota trocada depois do envio da compra.** A célula guarda a rota do momento do envio; o Excel enviado não muda. A tela avisa quando a rota efetiva atual difere.
12. **CEU.** O saldo do CEU (`itens.estoque`) é manual, está zerado e não baixa com as entregas. A Fase 2 não o usa como verdade (decisão 9) — senão o "falta comprar" vira "comprar tudo" ou "não comprar nada"; a Beth informa "tenho em mãos" na própria lista.
13. **Acentos.** SQL com acento só por arquivo UTF-8 (incidente da 131); conferir `chr(65533)` nas funções depois de cada migration.
14. **Falso sucesso.** Nenhuma escrita direta nas tabelas novas; cada RPC devolve o que mudou; a tela confere o retorno antes do toast.
15. **Fase 3.** A baixa do estoque fica na separação (Fase 2). Na Fase 3 o recibo assinado só se liga a ela — não pode haver segunda baixa.

---

## 9. Etapa 0 — o que a gestora precisa informar para começar

Nada de código começa antes disso. Está tudo numa planilha só, já com os contratos e as peças listados (sem dados pessoais): **`dados-locais/fase2_etapa0/etapa0_cadastro_para_gestora.xlsx`**. Basta preencher as colunas amarelas e devolver; o agente grava com prévia, backup e conferência (nada por palpite).

1. **Rota de cada contrato** (aba "Contratos"): colocar 1, 2 ou 3 em cada um dos **64 contratos ativos** — hoje todos estão sem rota. A rota separa o Excel ao fornecedor e a lista de separação do inspetor. Para ajudar, a planilha mostra o departamento, se o contrato recebe limpeza, quantos itens tem no kit e se pediu em outubro.
2. **O que cada rota significa** (aba "Rotas"): pela planilha de junho, as rotas são os 3 dias de entrega. Escrever o dia e/ou a região de cada uma (aparece no cabeçalho do Excel e na tela de chegadas).
3. **Fornecedor padrão de cada peça do CEU que a Beth compra** (aba "Itens CEU", 98 peças ativas): hoje nenhuma tem fornecedor. A coluna "último fornecedor" mostra o que já está no histórico de preços (24 peças). As peças "compra na loja" (3) e crachá/cordinha podem ficar vazias. Fornecedor que não está na lista vai na aba "Fornecedores" (nome, CNPJ se souber, contato).
4. **Quatro respostas curtas** (aba "Outras decisões"): data da primeira contagem do estoque (proposta: entre 16 e 19/11, antes da primeira compra de 20 a 25/11 — ela vira o saldo inicial); confirmar os prazos do inspetor (dia 17) e do gestor (dia 19); confirmar que os itens preparados no escritório são só Livro de Ocorrências, Protocolo de Correspondências, Planilha de Controle de Acessos e Planilha de Controle de Veículos.

O que **não** precisa: preço e fornecedor desses 4 itens (decisão 1 — eles ficam fora da compra); fornecedor dos itens de materiais (112 de 116 já têm; os 4 que faltam são justamente os do escritório); saldo inicial do estoque (sai da primeira contagem).

---

## 10. Fora desta fase

- Relatório de entrega único por contrato assinado pelo líder e lançamento automático das entregas de uniforme/EPI no CEU (Fase 3).
- Envio do pedido ao fornecedor por e-mail pelo sistema (o Excel é baixado e enviado pelo comprador).
- Estoque por rota ou por inspetor (decisão 13: um estoque central só).
- Controle de estoque do CEU com baixa automática nas entregas (decisão 9: continua manual).
- Saldo dos itens preparados no escritório (decisão 1; basta desmarcar o flag se um dia quiser).
- Conferência da nota fiscal (o financeiro só consulta a compra com valores).

---

## 11. Decisões confirmadas pela gestora (17/10/2026)

1. **Livro de Ocorrências, Protocolo de Correspondências e Planilhas de Controle (portaria)**: "compramos e encapamos no escritório. Não precisa entrar na compra." → `mat_itens.preparo_escritorio`; nunca entram no pedido ao fornecedor; saem na separação; **sem controle de estoque** (recomendação do agente, seção 3.3), só uma "lista do escritório" com o total do mês.
2. **Comprador = gestor e mesa.** `pode_comprar_materiais()` = admin, adm, gestor, mesa.
3. **Compra entre os dias 20 e 25** de cada mês. Para caber: inspetor valida até o dia 17 e gestor aprova até o dia 19 (avisos, não travas). O que não estiver aprovado quando a compra for enviada vai para o mês seguinte ou para compra avulsa.
4. **Baixa do estoque na separação** (quando sai da prateleira). A confirmação da entrega no posto fica com o recibo da Fase 3, sem segunda baixa.
5. **Contagem mensal obrigatória, feita pela mesa.** Prazo revisto por causa da compra 20–25: **contar e fechar entre os dias 16 e 19**, para o saldo estar fresco no dia da compra. Sem contagem recente, a compra avisa, mas não trava.
6. **Sobra e devolução entram no estoque central com motivo**, registradas pela mesa; a inspetoria registra a devolução que ela mesma trouxe.
7. **"É comprado tudo junto"**: kit e extras do mês vão na **mesma compra**; o kit não é comprado antes da janela 20–25. Extra ainda não aprovado na data da compra fica de fora (o kit do contrato vai) e entra na compra do mês seguinte ou numa compra avulsa.
8. **Depois de enviada, a compra e o pedido não mudam; o que surgir é "compra avulsa"** (`mat_compras.tipo = 'avulsa'`). "Adicionar item" e "Ajustar" somem quando a linha já tem destino.
9. **Beth: lista de compra de uniforme/EPI no mesmo formato de Excel; o estoque do CEU continua manual** (a chegada não soma no `itens.estoque`).
10. **Entrega menor que o pedido**: a mesa registra a quantidade recebida e o motivo; o pedido fica "entregue parcial"; o que faltou **não volta sozinho** para a próxima compra — o comprador decide.
11. **Excel ao fornecedor sem preço e só com os itens pedidos**; versão interna "com valores" para o financeiro.
12. **Um fornecedor padrão por item** (como já está no catálogo), com troca pontual pelo comprador numa compra específica.
13. **Um estoque central só** (escritório).
14. **Financeiro consulta as compras com valores, sem alterar** (aba Compras, `menu/rota.materiais_compras`).
