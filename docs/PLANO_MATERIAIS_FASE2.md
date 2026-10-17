# Plano técnico — Módulo Materiais, Fase 2 (compra e estoque)

> Base: §10 do `docs/PLANO_MATERIAIS_FASE1.md` ("Fase 2 — compra e estoque"), liberada pela gestora em 17/10/2026, + o que já está no banco e no código (migrations 121–144, `src/lib/materiais/`, hooks `useMateriais*`, telas `src/pages/materiais/`, aba CEU → Pedidos), + o processo atual descrito em `docs/passo a passo de como fazemos hoje.docx` e as abas "Pedido e Estoque", "Pedido ao Fornecedor por Cliente", "Compra ao Fornecedor" e "Quantidade Entregue" da `docs/Pedido de material/Planilha completa de material eu mexendo.xlsx`.
> Documento de planejamento: **nada foi alterado no código, no banco ou em produção.** As consultas ao banco foram só de leitura (17/10/2026).
> As perguntas para a gestora estão na **seção 11**. Enquanto elas não forem respondidas, vale a recomendação de cada uma.

---

## 1. Resumo para a gestão

- Hoje a Fase 1 termina quando o gestor **aprova** o pedido. A Fase 2 continua daí: o comprador vê **tudo o que foi aprovado no mês**, desconta **o que já tem no estoque** e o sistema monta o **pedido de cada fornecedor**, igual à aba "Pedido ao Fornecedor por Cliente" (itens nas linhas, contratos nas colunas, total), com o resumo "Compra ao Fornecedor".
- Cada linha aprovada ganha um destino: **"fornecedor entrega no posto"** ou **"sai do estoque (o inspetor leva)"**. O sistema sugere (primeiro usa o que tem no estoque), o comprador confirma. O destino fica visível para o inspetor e, na Fase 3, para o líder.
- O **estoque de materiais** passa a existir no CORH: entrou (compra, sobra, devolução), saiu (separado para um contrato), ajuste da contagem. O saldo é a soma desses movimentos — ninguém digita o saldo à mão. Uma vez por mês a mesa (ou quem a gestora indicar) **conta o estoque** e o sistema registra a diferença com motivo.
- Quando o fornecedor entrega, a **mesa registra o que chegou** em cada contrato. Faltou algo, registra a quantidade menor e o motivo ("fornecedor sem estoque", "enviado no próximo mês"). O pedido fica **"Entregue"** ou **"Entregue parcial"**.
- A **Beth** ganha, na aba CEU → Pedidos, o **pedido ao fornecedor de uniforme/EPI** do que ela não tem para entregar, no mesmo formato de planilha. O controle de estoque do CEU **não** muda nesta fase (recomendação — pergunta 9).
- Ficam para a Fase 3: o relatório de entrega único assinado pelo líder e o lançamento automático das entregas no CEU.
- **Antes de começar** é preciso preencher a **rota (1, 2 ou 3) dos 64 contratos** — hoje todas estão vazias — e o fornecedor/preço dos 4 itens de portaria que não têm (pergunta 1 e seção 9).

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
| Fornecedor padrão do item | `mat_itens.fornecedor_id` | 112 de 116 itens ativos têm (Antolimp 67, Contecom 16, Bralimpia 11, Loja das Bombas 6, Essex 5, Compra Avulsa 5, outros 2). Sem fornecedor: os 4 de portaria (Livro de Ocorrências, Protocolo de Correspondências, Planilhas de Controle de Acessos e de Veículos) | Sugestão do fornecedor de cada item na compra |
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

Perfis conferidos em `PERMISSOES_PADRAO` (`src/lib/permissoes.ts`) e nas `pode_*` da 121. As listas abaixo são a **recomendação**; os nomes de quem compra e de quem conta dependem das perguntas 2 e 5.

| Função | Perfis (recomendação) | Uso |
|---|---|---|
| `pode_comprar_materiais()` | admin, adm, gestor, mesa | Definir destino das linhas, gerar/enviar/cancelar compra, compra de reposição do estoque |
| `pode_movimentar_estoque_materiais()` | admin, adm, gestor, mesa, inspetoria | Registrar separação (saída), sobra e devolução; inspetoria só saída/devolução dos seus contratos não é distinguível no banco — ver risco 10.6 |
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
- `mat_registrar_movimento_estoque(p_tipo, p_item, p_variacao, p_quantidade, p_data, p_motivo, p_contrato)` — sobra, devolução, saída avulsa (com motivo). Recusa saída maior que o saldo? **Não** — só avisa (o estoque físico manda; o sistema registra e a contagem acerta). Ver pergunta 6.
- `mat_estornar_movimento(p_movimento, p_motivo)` — cria o movimento inverso; recusa estornar um estorno ou um movimento de contagem fechada.
- `mat_abrir_contagem(p_competencia, p_data)` — cria a contagem com a foto do saldo de todos os itens com saldo ≠ 0 ou com movimento nos últimos 6 meses; itens novos podem ser incluídos depois.
- `mat_salvar_contagem(p_contagem, p_itens jsonb)` — grava as quantidades contadas (pode salvar várias vezes enquanto `aberta`).
- `mat_fechar_contagem(p_contagem)` — exige todas as linhas contadas e motivo nas diferenças; **recalcula o saldo do sistema no momento do fechamento** (houve movimento entre abrir e fechar) e grava um `ajuste_contagem` por diferença; muda para `fechada`.

### 3.3 Compra de materiais (migration 146)

**`mat_compras`** — um pedido a um fornecedor ("o Excel que vai para a Antolimp").
- `competencia date not null`, `fornecedor_id → fornecedores not null`, `numero text unique` (sequencial legível "COMP-2026-10-001", gerado na RPC), `tipo check in ('mensal','complementar','reposicao_estoque')`, `status check in ('rascunho','enviada','recebida_parcial','recebida','cancelada')`, `data_corte timestamptz` (até quando as linhas aprovadas entraram), `entrega_prevista date null`, `enviada_em/por`, `cancelada_em/por/motivo`, `observacao`, `criado_por`, `created_at`.
- RLS: SELECT `pode_ver_compras_materiais()`; escrita só RPC.

**`mat_compra_itens`** — uma linha por **item × variação × contrato** dentro da compra (é exatamente a célula do Excel).
- `compra_id → mat_compras on delete cascade`, `item_id`, `variacao_id null`, `contrato_id → mat_contratos null` (**null = reposição do estoque**, coluna "Estoque" do Excel), `rota smallint null` (snapshot da rota efetiva na geração), `quantidade numeric(12,2) not null check (> 0)`, `preco_unitario numeric(12,2) null` (vigente na data da compra; null = item sem preço, ver 9.3), `qtd_recebida numeric null check (>= 0)`, `motivo_recebimento text` (obrigatório quando recebida < quantidade), `recebido_em date`, `recebido_por uuid`, `entrega_local check in ('posto','escritorio')` (posto quando há contrato; escritório na reposição).
- Único `(compra_id, item_id, coalesce(variacao_id, zero), coalesce(contrato_id, zero))`.

**Colunas novas em `mat_pedido_itens`** (o "destino" de cada linha aprovada):
- `atendimento text null check in ('fornecedor','estoque','nao_atendido')`.
- `qtd_estoque numeric null`, `qtd_compra numeric null` — a linha pode ser dividida (parte sai do estoque, parte vem do fornecedor); check: `coalesce(qtd_estoque,0) + coalesce(qtd_compra,0) <= qtd aprovada`.
- `compra_item_id → mat_compra_itens null` (de qual célula de compra vem a parte do fornecedor).
- `motivo_entrega text` (já existe `qtd_entregue`), `entregue_em date`, `entregue_por uuid`.
- `motivo_nao_atendido text` (obrigatório com `nao_atendido`).

**Alteração do CHECK de `mat_pedidos.status_produtos`**: acrescenta `em_compra`, `entregue`, `entregue_parcial`. Sem mudança de dados (nenhum pedido nesses estados).

**Quando o pedido muda de estado** (função interna `mat_recalcular_status_entrega(p_pedido)`, chamada pelas RPCs de compra, separação e chegada; nunca pelo frontend):
- `aprovado` → `em_compra`: todas as linhas aprovadas com quantidade > 0 já têm destino (`atendimento` preenchido).
- `em_compra` → `entregue`: todas as linhas com destino têm `qtd_entregue` = quantidade aprovada (fornecedor + estoque) ou estão `nao_atendido`.
- `em_compra` → `entregue_parcial`: todas fechadas, mas alguma com `qtd_entregue` menor que a aprovada.
- Pedido ainda em `em_validacao`/`validado` cujo **kit** já foi comprado (o kit é aprovado na hora — §13 da Fase 1): o status do pedido **não muda** (ele ainda é a fila do que depende do inspetor/gestor); as linhas do kit carregam o destino individualmente. Depende da pergunta 7.

**RPCs da 146:**
- `mat_previa_compra(p_competencia)` — **somente leitura**, devolve as linhas aprovadas e ainda sem destino do mês (com contrato, rota efetiva, item, variação, quantidade aprovada, fornecedor padrão do item, preço vigente, saldo do estoque). Agregação no servidor: evita o corte de 1.000 linhas do PostgREST e garante que tela e Excel leiam a mesma coisa. A distribuição sugerida (estoque × fornecedor) é lógica pura no front (`src/lib/materiais/compra.ts`, com testes).
- `mat_definir_atendimento(p_linhas jsonb)` — grava o destino de cada linha (fornecedor/estoque/dividida/não atendido com motivo). Recusa linha não aprovada, de pedido cancelado, ou que já tem compra enviada.
- `mat_gerar_compra(p_competencia, p_fornecedor, p_tipo, p_linhas jsonb)` — cria a compra em `rascunho` e as `mat_compra_itens` agregando as linhas com destino "fornecedor" daquele fornecedor; liga cada `mat_pedido_itens.compra_item_id`; grava o preço vigente na data. Para `reposicao_estoque`, as linhas vêm do comprador (item, variação, quantidade), sem contrato.
- `mat_enviar_compra(p_compra)` — `rascunho` → `enviada` (congela as quantidades; o Excel daquela compra passa a ser sempre o mesmo). Recalcula o status dos pedidos ligados.
- `mat_cancelar_compra(p_compra, p_motivo)` — só `rascunho` ou `enviada` sem nada recebido; desfaz os destinos das linhas (voltam para "sem destino").
- `mat_registrar_chegada(p_compra, p_itens jsonb)` — mesa: por célula, a quantidade recebida e o motivo se menor. Entrega no posto: grava `qtd_recebida` na célula e distribui para `qtd_entregue` das linhas de pedido ligadas (uma célula pode juntar o kit e o extra do mesmo contrato — a distribuição preenche primeiro o kit, depois os extras, por ordem de criação); reposição: cria `entrada_compra` no estoque. Atualiza `mat_compras.status` e o status dos pedidos.
- `mat_registrar_separacao(p_linhas jsonb)` — saída do estoque: para cada linha com destino "estoque", cria `saida_pedido` (negativo) e grava `qtd_entregue` (parte do estoque), `entregue_em/por`. Ver pergunta 4 (baixa na separação × na entrega).

**RPCs da Fase 1 que precisam ser recriadas na 146** (a partir do `pg_get_functiondef` real, como na 135, e com backup):

| RPC | Mudança |
|---|---|
| `ajustar_linha_kit_materiais` (135) | Recusar quando a linha já tem destino (`atendimento` não nulo) ou o pedido está em `em_compra`/`entregue`/`entregue_parcial` (a 135 aceita `aprovado` — hoje a lista é `em_validacao, validado, aprovado`) |
| `incluir_linha_pedido_materiais` (139) | Em `em_compra` ou depois: recusar no pedido e orientar a criar pedido extra (ou aceitar e voltar o pedido para `validado`? — ver pergunta 8; recomendação: recusar) |
| `ligar_linha_catalogo_materiais` (139) | Recusar linha que já tem destino |
| `aprovar_pedido_materiais` / `validar_pedido_materiais` (135) | Recusar linha com destino (só pode acontecer com o kit, que já sai aprovado) |
| `preencher_pedido_pelo_kit` (135, linha 472) | A periodicidade olha pedidos `status_produtos = 'aprovado'` — passar a aceitar `aprovado, em_compra, entregue, entregue_parcial` |
| `definir_rota_pedido` (122) | Permitida sempre; se a linha já está numa compra **enviada**, a compra não muda (a rota da célula é a do envio) e a tela avisa |
| `mat_registrar_envio` (143) | Nenhuma: a mescla já só acontece antes de `aprovado` |

**Front que olha `'aprovado'` e precisa aceitar os estados novos** (mesmo commit da 146): `src/hooks/useMateriaisPedidos.ts` (linhas 232 e 397 — última entrega e média), `src/lib/materiais/media.ts` (linha 88), `src/lib/materiais/painel.ts` (linha 102), `src/lib/materiais/inclusaoPedido.ts`, `src/pages/materiais/MateriaisPedidoDetalhePage.tsx` (linhas 125 e 489) e o tipo `StatusProdutos` em `src/types/materiais.ts`. Criar uma constante única `STATUS_APROVADO_OU_DEPOIS` em `src/lib/materiais/` (espelho da constante da Edge Function) para não espalhar listas. Na "última entrega" dos extras (`ultimaEntregaDoItem`), passar a usar `qtd_entregue` quando existir (hoje usa a aprovada — "Fase 1: aprovado = entregue").

### 3.4 Compra da Beth — uniforme e EPI (migration 147)

Recomendação (pergunta 9): **a mesma compra, com outra origem**, sem mexer no saldo do CEU.
- `mat_compras.origem check in ('materiais','ceu') default 'materiais'`.
- `mat_compra_itens.ceu_item_id → itens null` (check: exatamente um entre `item_id` e `ceu_item_id`), `colaborador_id` **não** é gravado na compra (o fornecedor recebe item × tamanho × quantidade; a pessoa fica no pedido).
- `ceu_pedido_itens.compra_item_id → mat_compra_itens null` e `ceu_pedido_itens.qtd_recebida`/`recebido_em` (o que chegou para aquela linha).
- RPCs: `ceu_gerar_compra(p_fornecedor, p_linhas jsonb)` e `ceu_registrar_chegada(p_compra, p_itens jsonb)` com `pode_atender_pedido_ceu()`. A chegada **não** altera `itens.estoque` (o saldo do CEU continua manual — decisão da Fase 1) e **não** marca a linha como atendida: a Beth continua atendendo pela tela como hoje.
- Peças "compra na loja" (`itens.compra_na_loja`, 141: blazer, calça social, camisa social branca bordada) **não entram** na compra ao fornecedor — o colaborador compra com autorização; a tela as lista à parte.
- Crachá não entra (é impresso na aba Crachás).
- Fornecedor sugerido = o do último preço em `ceu_itens_precos` (29 com fornecedor) ou `itens.fornecedor_id` (hoje vazio nos 130 — cadastrar).

### 3.5 Migration 148 — permissões

Sementes em `permissoes_perfil` e `reset_permissoes_perfil` recriada a partir da **129** (última versão; = 123 + linhas da 129) + as linhas novas, para "Restaurar padrão" não revogar nada (padrão 104/115/117/123/129). Sem tabela nova — sem GRANT de tabela.

---

## 4. Telas no CORH e quem acessa

Todas no `MateriaisShell` (abas novas), com componentes de `src/components/corh/`, filtros com `FiltrosAtivosBadge` quando persistidos, tabelas `min-w-[720px]` e números `tabular-nums`.

| Rota | Tela | Quem usa |
|---|---|---|
| `/materiais/compras` (aba **Compras**) | **Preparar a compra do mês**: tabela de tudo o que foi aprovado e ainda não tem destino, agrupada por item; colunas aprovado, saldo do estoque, sugestão "do estoque" × "do fornecedor", fornecedor; o comprador confirma ou ajusta linha a linha (dividir, trocar fornecedor, não atender com motivo). Botão "Gerar pedidos aos fornecedores" (um rascunho por fornecedor). Abaixo, a lista de compras do mês com status | comprador (gestor, mesa); financeiro e inspetoria só leitura |
| `/materiais/compras/:id` | Detalhe de uma compra: matriz itens × contratos (por rota), total por item e por contrato, valor; botões **Baixar Excel**, **Marcar como enviada**, **Cancelar**; depois de enviada, **Registrar chegada** | comprador; mesa registra a chegada; financeiro só leitura |
| `/materiais/chegadas` (aba **Chegadas**) | Lista das compras enviadas aguardando entrega, por rota e data prevista; abre o registro por contrato (quantidade recebida, motivo se menor). Atalho "chegou tudo" por contrato | mesa (+ gestor) |
| `/materiais/separacao` (aba **Separação**) | O que **sai do estoque**, por rota e contrato — lista para o inspetor levar; botão "Separado" registra a saída. Mostra o saldo antes/depois | mesa, inspetoria (+ gestor) |
| `/materiais/estoque` (aba **Estoque**) | Saldo por item/variação, último movimento, histórico de movimentos com filtro; botões "Entrada de sobra", "Devolução", "Saída avulsa", "Estornar" (com motivo) | mesa, gestor; inspetoria só leitura (+ devolução, se a pergunta 6 confirmar) |
| `/materiais/estoque/contagem` | Contagem do mês: abre, imprime a folha (itens na ordem do catálogo), digita as quantidades, motivo nas diferenças, fecha | quem conta (pergunta 5) |
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

1. **Dias 1–15 — pedido do líder (Fase 1, sem mudança).** O kit sai aprovado na hora; os extras vão ao inspetor e ao gestor.
2. **Até o dia ~15 — contagem do estoque** (pergunta 5). Quem conta abre a contagem, imprime a folha, conta a prateleira, digita, explica as diferenças e fecha. O saldo do sistema passa a ser o contado.
3. **Dia do corte (pergunta 3; recomendação: dia 16, depois do fim da janela) — preparar a compra.** O comprador abre Materiais → Compras: o sistema lista tudo o que está aprovado e ainda sem destino, soma por item e mostra o saldo. Sugestão automática: **usa o estoque primeiro** (até o saldo), o resto vai para o fornecedor padrão do item. Itens que sempre saem do escritório (os de portaria, se a pergunta 1 confirmar) já vêm como "estoque". O comprador confirma ou ajusta.
4. **Gerar os pedidos aos fornecedores.** Um rascunho por fornecedor. Abre o detalhe, confere a matriz, baixa o Excel, envia ao fornecedor (e-mail/WhatsApp — fora do sistema) e marca **"Enviada"**. A partir daqui as linhas não mudam e os pedidos passam para **"Em compra"**.
5. **Separação do estoque.** A mesa/inspetoria abre Materiais → Separação, separa por rota e marca "Separado" — o saldo baixa e as linhas ficam como entregues pelo estoque.
6. **Entrega.** O fornecedor entrega no posto (por rota); o inspetor leva o que saiu do estoque.
7. **Registrar a chegada.** A mesa abre Materiais → Chegadas e registra, por contrato, o que o fornecedor entregou. Faltou: quantidade menor + motivo. O pedido vira **"Entregue"** ou **"Entregue parcial"**. O que não chegou: pergunta 10.
8. **Depois do corte.** Extras aprovados depois do dia 16 e pedidos extras entram numa **compra complementar** (mesmo fluxo, `tipo = 'complementar'`) ou esperam o mês seguinte (pergunta 3).
9. **Reposição do estoque.** Quando quiser, o comprador faz uma compra `reposicao_estoque` (itens sem contrato, entrega no escritório); a chegada vira entrada no estoque.
10. **Beth (uniforme/EPI).** Depois de conferir a fila, ela vê "falta comprar", gera o pedido ao fornecedor, registra a chegada e continua atendendo e lançando no CEU como hoje.

### 5.1 Diagrama do fluxo

```
 LÍDER (link)                 INSPETOR / GESTOR              COMPRADOR (mesa/gestor)
 ───────────                  ──────────────────             ───────────────────────
 envia pedido ──► kit: aprovado na hora ─────────────┐
              └─► extras: em_validacao ► validado ► aprovado ┐
                                                     │       │
                                                     ▼       ▼
                                   ┌──── PREPARAR COMPRA (aprovado − saldo) ────┐
                                   │                                             │
                        destino "estoque"                             destino "fornecedor"
                                   │                                             │
                                   ▼                                             ▼
                      SEPARAÇÃO (saída do estoque)          COMPRA por fornecedor (rascunho)
                      inspetor leva ao posto                   │ Excel → fornecedor
                                   │                            ▼
                                   │                       ENVIADA  ⇒ pedido "em_compra"
                                   │                            │ fornecedor entrega no posto
                                   │                            ▼
                                   │                   CHEGADA registrada pela mesa
                                   │                     (qtd recebida + motivo se menor)
                                   └──────────────┬─────────────┘
                                                  ▼
                                    pedido "entregue" ou "entregue_parcial"
                                                  │
                                   (Fase 3: recibo único assinado pelo líder)

 ESTOQUE:  + entrada_compra (reposição) + sobra + devolução
           − saida_pedido (separação) − saída avulsa
           ± ajuste_contagem (contagem mensal fechada)      saldo = soma dos movimentos
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
- Linhas = itens do catálogo com o **nome padronizado e a unidade** (como na planilha: "Cloro 5L", "Disco preto 350 UN"); variação no nome ("Flanela Microfibra amarela"). Só itens com quantidade > 0 (a planilha atual listava os zerados — sugestão de limpeza, pergunta 11).
- Colunas = contratos com quantidade > 0, **agrupados por rota** (uma linha de cabeçalho "Rota 1 / Rota 2 / Rota 3" acima dos nomes; contratos sem rota no fim em "Sem rota"); coluna "Estoque" só quando há reposição; coluna "Total".
- Nome do contrato = `mat_contratos.nome` (o nome curto, como na planilha).
- Sem preço (o fornecedor tem a própria tabela) — pergunta 11.

**Aba 2 — "Compra ao Fornecedor"**: Item | Quantidade total (e, só na versão interna, Preço unitário e Valor), com "Total Geral".

**Aba 3 — "Entrega por Rota"** (opcional, recomendação): uma lista por rota → contrato → itens, para o motorista/fornecedor separar as caixas.

A versão **interna** do mesmo Excel (botão "Baixar com valores") inclui preço e valor por célula — é a que o financeiro confere contra a nota.

---

## 7. Etapas de implementação

Cada etapa deixa o sistema funcionando. Migrations aplicadas pela Management API **com arquivo UTF-8** (`scripts/lib/executar-arquivo-sql-management-api.ps1`; nunca SQL com acento inline — incidente da 131), com backup antes em `dados-locais/backup_materiais_<n>_<data>/`, nunca `db push`. Deploy no Netlify só nos marcos (15 créditos cada), sempre da `main` limpa e com `MODULO_FERIAS_LIBERADO = false` conferido (AGENTS.md §10). Tamanho relativo: P (pequeno) / M / G.

| # | Entrega | Como testar | Tam. |
|---|---|---|---|
| 0 | **Dados antes de tudo**: rota dos 64 contratos (tela Contratos, gestor/mesa), fornecedor e preço dos 4 itens de portaria, fornecedor dos itens do CEU que a Beth compra. Sem código | Consulta: 0 contratos ativos sem rota; 0 itens ativos sem fornecedor | P |
| 1 | **Migration 145** — estoque (movimentos, view de saldo, contagens, `pode_*` novas, RPCs de movimento e contagem) + tipos em `src/types/materiais.ts`/`database.ts` | Teste de fumaça em transação desfeita (como na 135/144): INSERT direto como `authenticated` = permission denied; movimento com sinal errado recusado; saída sem motivo recusada; contagem fecha e gera os ajustes certos; fechar com linha sem quantidade recusado; estorno de estorno recusado; varredura `chr(65533)` nas funções | M |
| 2 | Lógica pura `src/lib/materiais/estoque.ts` (saldo, diferença, ordem da folha) + telas **Estoque** e **Contagem** | Vitest; smoke das páginas; contagem real de teste com 3 itens | M |
| **D1** | Deploy: estoque e contagem no ar — **a 1ª contagem real vira o saldo inicial** (não há saldo para importar: a planilha só tinha as linhas "Modelo" até 04/2026) | hash do bundle = `dist/` | — |
| 3 | **Migration 146** — compras, colunas novas em `mat_pedido_itens`, CHECK de status, RPCs de compra/chegada/separação, recriação das RPCs da Fase 1 (tabela da 3.3) | Fumaça em transação desfeita: prévia lista só aprovadas sem destino; dividir linha acima do aprovado recusado; gerar compra liga as linhas; enviar congela; `ajustar_linha_kit` em linha com destino recusado; `incluir_linha` em pedido `em_compra` recusado; chegada parcial sem motivo recusada; chegada total → `entregue`; uma célula com kit + extra distribui certo; cancelar compra devolve as linhas; envio do líder depois de `em_compra` vira pedido extra; periodicidade do "preencher pelo kit" conta `em_compra`/`entregue` | G |
| 4 | Front dos estados novos (constante única, `media.ts`, `painel.ts`, `useMateriaisPedidos`, detalhe/lista) + lógica pura `compra.ts` (agregação, sugestão estoque-primeiro, divisão) e `excelCompra.ts` (matriz por rota, totais) | Vitest com o caso real de junho/2026 (compra Antolimp: 107 itens listados, 58 zerados, 529 unidades no total; total por contrato da aba); `npm test`, lint, build | M |
| 5 | Telas **Compras** (preparar + detalhe + Excel), **Separação** e **Chegadas** | Mês de teste completo num contrato fictício: aprovado → destino → compra → Excel → enviada → separação → chegada parcial → entregue_parcial | G |
| **D2** | Deploy: primeira compra real (novembro/2026) **em paralelo com a planilha** — o comprador confere o Excel do sistema contra a planilha antes de enviar | Totais por fornecedor batem com a planilha | — |
| 6 | **Migration 147** — compra da Beth (origem `ceu`, `ceu_item_id`, `ceu_pedido_itens.compra_item_id`, RPCs) + bloco "Pedir ao fornecedor" na aba CEU → Pedidos | Fumaça: compra CEU não altera `itens.estoque`; "compra na loja" não entra; chegada não marca atendido | M |
| 7 | **Migration 148** — permissões (sementes + `reset_permissoes_perfil` = 129 + linhas novas) + `PERMISSOES_PADRAO` + `PermissoesPage` + `permissoes.test.ts` | "Restaurar padrão" do financeiro mantém a aba Compras; dp1 não vê Compras | P |
| 8 | Documentação: AGENTS.md §8 (145–148) e §11 (regras de compra/estoque), `docs/REGRAS_NEGOCIO.md`, guia de treinamento | — | P |
| **D3** | Deploy: planilha desligada para compras | — | — |

> Ordem das migrations: 148 (permissões) pode ir junto com a 146 se as telas forem publicadas no mesmo marco; ela só precisa estar aplicada antes do deploy que mostra as abas novas. Toda migration nova é aplicada **também no banco de treinamento**, quando ele existir (HANDOFF 17/10, pendência 2).

---

## 8. Riscos e pontos de atenção

1. **Rotas vazias.** Os 64 contratos estão sem rota. Sem rota, o Excel junta tudo em "Sem rota" e a separação não tem ordem. Bloqueio suave: a tela Compras avisa "N contratos sem rota" e não impede.
2. **Estado misto no mesmo pedido.** O kit sai aprovado na hora e o extra espera o inspetor/gestor. O status do pedido é "a fila do que falta decidir" (Fase 1 §13). Por isso o destino e a entrega ficam **por linha**, e o status do pedido só vira `em_compra` quando todas as linhas aprovadas têm destino. Ver pergunta 7.
3. **Linhas que não podem ser compradas.** Texto livre não ligado ao catálogo (`item_id` nulo — hoje 0, mas o líder pode mandar "Não achei, enviar assim") e item sem preço (15 linhas de outubro). A prévia lista à parte: texto livre exige "Ligar ao catálogo" antes; sem preço vai para a compra com valor "—" e aviso.
4. **Preço da compra ≠ preço do pedido.** O pedido guarda o preço do dia do envio; a compra, o do dia da compra. A tela mostra os dois quando diferem; o painel do gestor segue com o do pedido.
5. **Preço por fornecedor.** `mat_precos` guarda o fornecedor, mas o preço vigente não depende dele (vale o mais recente do item). Se o comprador trocar o fornecedor de uma compra, o preço exibido pode ser de outro fornecedor — aviso na tela e "atualize o preço no Catálogo". Ver pergunta 11.
6. **Quem mexe no estoque.** O banco não sabe "de qual inspetor" é cada contrato (não há vínculo inspetor × contrato). Se a inspetoria registrar saídas, ela poderá registrar de qualquer contrato. Aceitável (auditoria pelo `criado_por`).
7. **Saldo negativo.** O sistema registra a saída mesmo sem saldo (o físico manda) e mostra o saldo negativo em vermelho; a contagem acerta. Bloquear criaria "não consigo registrar o que já saiu".
8. **Contagem com movimento no meio.** Entre abrir e fechar a contagem pode haver separação; por isso o ajuste é calculado no **fechamento** (contado − saldo naquele instante), não na abertura.
9. **Paginação.** Linhas do mês, movimentos e compras passam de 1.000 com o tempo: prévia agregada no servidor (RPC) e leituras com `selecionarTudo`.
10. **Datas e fuso.** `data`, `recebido_em`, `entregue_em`, `entrega_prevista` são `date` (lidas com `parseDataLocal`, padrão `hojeBrasil()`); carimbos `timestamptz` exibidos com `formatarDataHora`. A competência da compra é a do pedido, não a do dia da compra.
11. **Rota trocada depois do envio da compra.** A célula guarda a rota do momento do envio; o Excel enviado não muda. A tela avisa quando a rota efetiva atual difere.
12. **CEU.** O saldo do CEU (`itens.estoque`) é manual, está zerado e não baixa com as entregas. A Fase 2 não o usa como verdade (recomendação) — senão o "falta comprar" vira "comprar tudo" ou "não comprar nada". Controlar o estoque do CEU de verdade é decisão separada (pergunta 9).
13. **Acentos.** SQL com acento só por arquivo UTF-8 (incidente da 131); conferir `chr(65533)` nas funções depois de cada migration.
14. **Falso sucesso.** Nenhuma escrita direta nas tabelas novas; cada RPC devolve o que mudou; a tela confere o retorno antes do toast.
15. **Fase 3.** A baixa do estoque fica na separação (Fase 2). Na Fase 3 o recibo assinado só se liga a ela — não pode haver segunda baixa.

---

## 9. Pendências de dados antes da implementação

1. **Rota dos 64 contratos** (tela Contratos, gestor/mesa). Pela planilha de junho, as rotas são os **3 dias de entrega** (HANDOFF 09/10: "Rotas 1/2/3 = 3 dias de entrega").
2. **Fornecedor e preço** dos 4 itens de portaria (Livro de Ocorrências, Protocolo de Correspondências, Planilha de Controle de Acessos, Planilha de Controle de Veículos) — ou a marca "sai sempre do estoque" (pergunta 1).
3. **Fornecedor dos itens do CEU** que a Beth compra (hoje 0 de 130 com `fornecedor_id`; `ceu_itens_precos` tem 29 com fornecedor — Justo, Multi Stilo, Kaufmann).
4. **Primeira contagem** do estoque de materiais (vira o saldo inicial).

---

## 10. Fora desta fase

- Relatório de entrega único por contrato assinado pelo líder e lançamento automático das entregas de uniforme/EPI no CEU (Fase 3).
- Envio do pedido ao fornecedor por e-mail pelo sistema (o Excel é baixado e enviado pelo comprador).
- Estoque por rota ou por inspetor (recomendação: estoque central único — pergunta 2).
- Controle de estoque do CEU com baixa automática nas entregas.
- Conferência da nota fiscal (financeiro só consulta a compra com valores).

---

## 11. Perguntas para a gestora

Cada pergunta tem a recomendação e o porquê. Respondendo "pode seguir a recomendação" em todas, o plano já está pronto para começar.

1. **Livro de Ocorrências, Protocolo de Correspondências e as Planilhas de Controle (portaria) são comprados de fornecedor ou feitos/guardados no escritório?**
   Recomendação: marcar esses itens como **"sai sempre do estoque"**. Porquê: são os únicos 4 itens sem fornecedor e sem preço; se forem impressos ou guardados no escritório, o sistema já os manda para a separação e eles nunca aparecem num pedido a fornecedor.

2. **Quem é o comprador?** (quem olha o aprovado, desconta o estoque e faz o pedido aos fornecedores)
   Recomendação: **gestor e mesa** (Elisangela e Maciel). Porquê: o Maciel já cadastra fornecedores e respondeu os preços; a gestora aprova. Se for outra pessoa/perfil, só muda a lista de quem pode.

3. **A compra é uma vez por mês, com data de corte? Qual dia? O que fica para depois do corte?**
   Recomendação: **uma compra principal por mês no dia 16** (o pedido do líder vai até o dia 15) e **compras complementares quando precisar** (extras aprovados depois e pedidos extras). Porquê: casa com a janela do pedido e com o histórico da planilha (compra mensal); a complementar evita que um extra urgente espere o mês seguinte. Se preferir quinzenal, o sistema é o mesmo — só muda o costume.

4. **Quando o material sai do estoque, a baixa acontece na separação (quando sai da prateleira) ou quando o inspetor confirma que entregou no posto?**
   Recomendação: **na separação**. Porquê: é o momento em que o material deixa de estar no escritório — a contagem do mês só bate assim. A confirmação da entrega no posto fica para o recibo assinado da Fase 3.

5. **A contagem do estoque é obrigatória todo mês? Quem conta e até que dia?**
   Recomendação: **obrigatória, feita pela mesa, até o dia 15** (antes da compra do dia 16). Porquê: a compra desconta o saldo; sem contagem recente, o sistema pode comprar a mais ou a menos. O sistema não trava a compra sem contagem, mas avisa.

6. **O que fazer com sobra e devolução?** (material que voltou de um contrato, contrato encerrado, fornecedor que mandou a mais)
   Recomendação: **entra no estoque central com o motivo**, registrada pela mesa; a inspetoria pode registrar a devolução que ela mesma trouxe. Porquê: é o que já se faz na prática (vira estoque e sai no próximo pedido) e fica rastreado.

7. **O kit de um contrato pode ser comprado antes do inspetor e do gestor decidirem os extras desse mesmo contrato?**
   Recomendação: **sim**. Porquê: o kit já sai aprovado na hora (decisão de 16/10). Se ele esperar os extras, um contrato com um extra pendente atrasa o material de rotina. O extra que for aprovado depois entra na compra complementar ou na do mês seguinte.

8. **Depois que a compra foi enviada ao fornecedor, o inspetor/gestor ainda pode incluir ou ajustar itens naquele pedido?**
   Recomendação: **não no mesmo pedido** — o que surgir depois vira **pedido extra** (que entra na compra complementar). Porquê: o Excel já foi para o fornecedor; mexer no pedido criaria diferença entre o que foi pedido e o que vai chegar. O botão "Adicionar item" e o "Ajustar" do kit somem quando a linha já tem destino.

9. **A compra de uniforme e EPI da Beth entra nesta fase? E o estoque do CEU: o sistema passa a controlar ou continua manual?**
   Recomendação: **entra a lista de compra da Beth no mesmo formato de Excel, e o estoque do CEU continua manual** (o sistema não soma nem baixa sozinho). Porquê: hoje o saldo do CEU está zerado nos 130 itens e as entregas não baixam o saldo; se o sistema passar a somar as chegadas sem baixar as entregas, o número fica errado em poucas semanas. Controlar o estoque do CEU de verdade pede a baixa automática das entregas — melhor junto com a Fase 3.

10. **Quando o fornecedor entrega menos do que foi pedido, o que acontece com o que faltou?**
   Recomendação: **a mesa registra a quantidade recebida e o motivo; o que faltou fica como "entregue parcial" e NÃO volta sozinho para a próxima compra** — o comprador decide incluir na complementar ou deixar para o mês seguinte. Porquê: muitas vezes o faltante chega dias depois na mesma compra (aí a mesa só completa o registro); voltar automaticamente geraria compra em dobro.

11. **O Excel que vai ao fornecedor leva preço? E a lista mostra os itens zerados, como a planilha?**
   Recomendação: **sem preço e só com os itens pedidos** na versão do fornecedor; uma versão interna "com valores" para o financeiro conferir a nota. Porquê: o fornecedor tem a própria tabela; os itens zerados deixam a planilha longa à toa (na de junho, mais da metade das linhas estava zerada).

12. **O fornecedor é sempre o mesmo para cada item, ou um mesmo item pode vir de fornecedores diferentes conforme o contrato?** (ex.: os itens exclusivos da CNOOC)
   Recomendação: **um fornecedor padrão por item** (como já está no catálogo), com a possibilidade de o comprador trocar o fornecedor de um item numa compra específica. Porquê: 112 dos 116 itens já têm fornecedor padrão; fornecedor por item × contrato multiplicaria o cadastro sem caso real conhecido. Se a CNOOC tiver fornecedor próprio, avise e o plano inclui.

13. **O estoque de materiais é um só (escritório), ou cada rota/inspetor tem o seu?**
   Recomendação: **um estoque central único**. Porquê: era assim na planilha (o "Estoque Atual" só nas linhas "Modelo", um por item por mês) e é o mais simples de contar. Estoque por inspetor exigiria transferências entre estoques e uma contagem por pessoa.

14. **O financeiro precisa ver as compras com valores?**
   Recomendação: **sim, só para consultar** (aba Compras, sem poder alterar). Porquê: é quem confere a nota fiscal do fornecedor contra o que foi pedido e o que chegou; hoje o financeiro não vê o módulo Materiais.
