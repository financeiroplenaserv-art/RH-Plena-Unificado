# Plano técnico — Módulo Materiais, Fase 1 (fim dos Google Forms)

> Base: proposta aprovada "Pedido de Materiais no CORH" (rodadas 1 a 4 de decisões da gestão) + respostas da gestão às decisões técnicas (09/10/2026, seção 11). Todas as decisões estão fechadas (o link do líder é sem PIN — seção 4.0).
> Documento de planejamento: nada foi alterado no código, no banco ou em produção.

---

## 1. Resumo para a gestão

- O líder de cada contrato faz o pedido do mês pelo celular, com um **link exclusivo do contrato** (também em QR code no quadro do posto), sem login e sem PIN. O pedido já vem preenchido com o Kit Mensal. Como o link é público, a tela não mostra nenhum dado pessoal: o líder digita nome, peça e tamanho de cada colaborador, e a conferência com o cadastro acontece dentro do CORH.
- Pedir acima do kit, ou antes de vencer a validade do item, exige justificativa (não bloqueia). O prazo é do dia 1 ao dia 15. **Nada é gerado automaticamente**: a partir do dia 10 o painel "Contratos que ainda não pediram" avisa o inspetor e o gestor, que cobram o líder; se for preciso, o escritório ou o inspetor preenche pelo kit, marcado "preenchido pelo escritório".
- Ao enviar, o pedido se divide: **produtos** vão para o novo módulo Materiais (inspetor só nas exceções, gestor aprova no painel pedido × limite × média dos últimos 6 meses); **uniformes, EPIs e crachás** vão para a nova aba **CEU → Pedidos** (inspetor confere tamanho e quantidade, Beth vê o saldo do estoque do CEU e atende).
- Elisangela (gestor) e a administração cadastram: catálogo com nomes padronizados, variações, fornecedores, preços com histórico, Kit Mensal e links. A rota padrão de cada contrato pode ser alterada pelo gestor e pela mesa, e a mesa pode trocar a rota de um pedido só.
- Os dados iniciais e **o histórico de consumo desde 12/2022** saem das planilhas atuais, mas **só entram no sistema depois da sua conferência** numa planilha de revisão.
- Compra por fornecedor e estoque de materiais ficam para a Fase 2; recibo único assinado e lançamento automático no CEU, para a Fase 3. Até lá, a Beth continua lançando as entregas no CEU como hoje.

---

## 2. O que já existe e será reaproveitado

| O quê | Onde | Uso na Fase 1 |
|---|---|---|
| Contrato = departamento | `departamentos` (`nome_curto`), `src/lib/departamentos.ts` (`departamentosSelecionaveis`, `idsGrupoDepartamento`, `idsColaboradoresDoDepartamento`, `nomeCurtoDepartamentoFuzzy`) | `mat_contratos.departamento_id` aponta para a linha **Ativa com nome_curto**; a equipe do líder é resolvida por `idsColaboradoresDoDepartamento` (expande linhas irmãs; **nunca ILIKE**) |
| Fornecedores | tabela `fornecedores` (id, nome, cnpj, telefone, email), hook `src/hooks/useCEUFornecedores.ts`, `itens.fornecedor_id` | **Vira o cadastro único** — a tabela é mantida (o CEU já referencia), ganha colunas e a tela muda para Materiais. Sai a aba `CeuFornecedoresPage` (`/ceu/fornecedores`, `CeuShell.tsx`, `App.tsx`) e a ação `ceu.gerenciar_fornecedores` (mapa + `PermissoesPage`) |
| Itens de uniforme/EPI | tabela `itens` (`ItemCEU`: nome, tipo, ca, subgrupo, `estoque`, `estoque_minimo`, `prazo_uso_dias`, `situacao`), `src/hooks/useCEUItens.ts` | Catálogo da parte de uniformes/EPI do pedido do líder. **Não** duplicar no catálogo de materiais. `itens.estoque` é o "saldo do CEU" mostrado à Beth (campo mantido à mão — entregas não baixam o saldo hoje; serve só como referência, como decidido) |
| Tamanhos | `ceu_tamanhos` (migration 096), `src/lib/ceu/tamanhosPuro.ts` (`tamanhoParaItem`, `tamanhoDoNomeItem`) | Só do lado interno: destaca divergência entre o tamanho digitado pelo líder e o cadastro na conferência do inspetor (mesma regra do Lançamento Rápido). O link público não mostra tamanhos |
| Entregas do CEU | `entregas` (`colaborador_id`, `item_id`, `data_entrega`, `situacao`) | Alerta "peça entregue há pouco tempo" (última entrega do mesmo item dentro de `prazo_uso_dias`) |
| Crachás | `CeuCrachasPage` aceita `location.state.colaboradorIds` | Botão "Abrir na aba Crachás" na fila da Beth leva os colaboradores do pedido para a fila de impressão |
| Fuso | `hojeBrasil()` / `agoraBrasil()` em `src/lib/utils.ts` | Janela 1–15 e competência. No Deno/SQL: `America/Sao_Paulo` |
| Configuração | tabela `configuracoes` (padrão `vr_configuracao_padrao`, `cracha_config`) | Chave `materiais_config` (`{ dia_limite: 15, dia_aviso: 10, aviso_recibo: "..." }`) |
| Posto dos faltistas | departamento **ADM PLENA** (nome_curto existente) | Contrato dos pedidos de faltistas sem posto (recibo "PLENA ADM") |
| Padrões de Edge Function | `supabase/functions/econtador` e `sync-performancelab` (CORS, guarda), `scripts/lib/implantar-edge-function.ps1` | Nova function pública com o mesmo bloco CORS; deploy com `verify_jwt: false` |
| Permissões | `PERMISSOES_PADRAO` (`src/lib/permissoes.ts`), `permissoes_perfil`, `reset_permissoes_perfil` (última versão: 117) | Novo recurso `materiais` + ações novas em `ceu`; sementes e reset recriado (padrão 104/115/117) |
| Componentes | `src/components/corh/` (`PageHeader`, `Filters`, `DataTable`, `StatusBadge`, `ConfirmDialog`, `ModuleTabs`, `FiltrosAtivosBadge`) | Todas as telas internas |

Funções RLS existentes usadas: `is_admin()`, `is_editor()`, `pode_ver_ceu()` (admin/adm/gestor/dp1/dp2/mesa/inspetoria), `pode_ver_colaboradores()`.

---

## 3. Modelo de dados

Convenções: prefixo `mat_` para o módulo Materiais e `ceu_pedido_` para a fila da Beth; `id uuid default gen_random_uuid()`; `created_at timestamptz default now()`; datas `date` parseadas com `parseDataLocal()` no front. **Toda tabela nova tem RLS habilitado e GRANT explícito** no mesmo arquivo (AGENTS.md §8):

```sql
grant select, insert, update, delete on public.<tabela> to authenticated;
grant select, insert, update, delete on public.<tabela> to service_role;
-- NUNCA grant para anon: o líder só fala com a Edge Function (service_role)
```

### 3.1 Funções de permissão novas (migration 121)

| Função | Perfis | Uso |
|---|---|---|
| `pode_ver_materiais()` | admin, adm, gestor, mesa, inspetoria, dp2 | SELECT nas tabelas `mat_*` e `ceu_pedido_*` (dp2 precisa ver o cabeçalho do pedido e fornecedores) |
| `pode_editar_cadastro_materiais()` | admin, adm, gestor | Escrita em catálogo, variações, preços, fornecedores, aliases, histórico; geração de links |
| `pode_aprovar_materiais()` | admin, adm, gestor | Aprovação final, edição direta do kit, decisão de alteração de kit |
| `pode_alterar_rota_materiais()` | admin, adm, gestor, mesa | Rota padrão do contrato e rota de um pedido específico (RPCs da seção 3.3) |
| `pode_validar_materiais()` | admin, adm, gestor, inspetoria | Validação de exceções (produtos) e conferência (uniformes) |
| `pode_atender_pedido_ceu()` | admin, adm, gestor, dp2 | Atendimento da fila da Beth |

Todas `SECURITY DEFINER`, `STABLE`, `search_path = public`, `GRANT EXECUTE ... TO authenticated` (mesmo molde de `pode_ver_ceu()` na 065). As mudanças de estado (identificar, validar, aprovar, decidir alteração de kit) passam por **RPCs** que reconferem perfil e status no banco (padrão da 115) — UPDATE direto só para rascunhos/cadastros, sempre com `.select('id')`.

### 3.2 Tabelas — migration 121 (`121_materiais_cadastro.sql`)

**`fornecedores` (existente)** — `ALTER TABLE add column if not exists`: `contato text`, `observacao text`, `ativo boolean default true`. Policies: SELECT passa a `pode_ver_ceu() OR pode_ver_materiais()`; INSERT/UPDATE `pode_editar_cadastro_materiais()`; DELETE `is_admin()`. Remover as policies antigas de escrita que existirem (conferir `pg_policies` antes; backup das policies em `dados-locais/`).

**`mat_itens`** — catálogo de produtos (limpeza, kit portaria, outros).
- `nome text not null` (nome padronizado, `unique` sobre `lower(nome)`), `categoria text check in ('limpeza','portaria','outros')`, `unidade_pedido text not null` ("bombona 5L", "pacote", "unidade"), `fornecedor_id uuid → fornecedores`, `validade_meses int null` (balde 6, doblô 24, escova 3, kit limpa vidros 18), `tem_variacao boolean default false`, `ativo boolean default true`, `ordem int`.
- RLS: SELECT `pode_ver_materiais()`; INSERT/UPDATE `pode_editar_cadastro_materiais()`; DELETE `is_admin()` (no dia a dia, inativar).

**`mat_item_variacoes`** — `item_id → mat_itens on delete cascade`, `rotulo text` ("350 mm", "410 mm", "amarela", "vassoura de pelo"), `ativo`, `ordem`; `unique(item_id, rotulo)`. Mesma RLS de `mat_itens`.

**`mat_precos`** — histórico (nunca UPDATE do valor; nova linha a cada mudança).
- `item_id`, `variacao_id null`, `fornecedor_id null`, `preco numeric(12,2) not null check (preco >= 0)`, `vigente_desde date not null`, `criado_por uuid default auth.uid()`.
- Índice `(item_id, variacao_id, vigente_desde desc)`. Preço vigente = linha mais recente com `vigente_desde <= data`; preço da variação, se existir, prevalece sobre o do item.
- View `mat_precos_vigentes` com `security_invoker = true` (respeita a RLS de quem consulta).
- RLS: SELECT `pode_ver_materiais()`; INSERT `pode_editar_cadastro_materiais()`; sem UPDATE; DELETE `is_admin()`.

**`mat_aliases`** — nome antigo → item do catálogo (os ~141 nomes de 2026 e as grafias desde 12/2022; usado na carga do kit e do histórico). `nome_legado text unique` (normalizado), `item_id`, `variacao_id null`, `fator numeric default 1` (conversão de unidade, ex.: "Cloro 1L" → bombona 5L = 0,2). RLS = `mat_itens`.

**`mat_historico_consumo`** — histórico das planilhas (desde 12/2022), base da média do painel.
- `departamento_id`, `item_id`, `variacao_id null`, `competencia date` (1º dia do mês), `quantidade numeric not null`, `valor numeric(12,2) null` (valor da época, quando a planilha tiver), `nome_legado text` (como veio), `fonte text` ("planilha_completa", "corh").
- Índice único `(departamento_id, item_id, coalesce(variacao_id, zero-uuid), competencia, fonte)`; índice `(departamento_id, competencia desc)`.
- RLS: SELECT `pode_ver_materiais()`; escrita só `pode_editar_cadastro_materiais()` (carga por script com service role).
- A partir do primeiro mês no CORH, a média lê os pedidos **aprovados** de `mat_pedido_itens`; a tabela de histórico cobre os meses anteriores (sem sobreposição: a carga para no último mês da planilha).
- **Média do painel: últimos 6 meses fechados** (exclui o mês corrente; mês sem pedido conta como zero), em quantidade e em R$ ao **preço vigente atual** — comparável ao limite (kit × preço atual). O painel mostra também a média de 12 meses como referência de sazonalidade. Função pura em `src/lib/materiais/media.ts`.

**`mat_contratos`** — configuração do contrato no módulo.
- `departamento_id uuid primary key → departamentos`, `rota smallint check (rota in (1,2,3))` (rota **padrão**), `recebe_limpeza boolean default true` (os 28 contratos só de uniforme/EPI/crachá/portaria ficam `false`), `ativo boolean default true`, `observacao text`.
- RLS: SELECT `pode_ver_materiais()`; INSERT/UPDATE `pode_aprovar_materiais()`; DELETE `is_admin()`. A mesa altera só a rota, pela RPC `definir_rota_contrato(p_departamento, p_rota)` (`pode_alterar_rota_materiais()`).
- **Faltistas sem posto**: o departamento existente **ADM PLENA** (nome_curto já cadastrado; sem ativos alocados — auditoria de 09/10/2026) entra como contrato do módulo, sem kit e sem link; pedidos de uniforme/EPI de faltistas feitos pela mesa/inspetoria vão para ele e o recibo sai como "PLENA ADM". Ferista segue no contrato onde está trabalhando (o líder do posto o inclui como "fora da equipe"). Confirmar a linha Ativa de ADM PLENA na carga.

**`mat_contrato_acesso`** — segredos do link (tabela separada para nunca chegar ao navegador do escritório).
- `departamento_id pk → mat_contratos`, `token_hash text unique not null` (SHA-256 do token), `token_cifrado text` (AES-256-GCM com `ENCRYPTION_KEY`, para o escritório poder reexibir o link), `versao int not null default 1`, `gerado_em`, `gerado_por`, `ativo boolean default true`.
- RLS habilitado **sem nenhuma policy** e **sem GRANT para authenticated** — só `service_role` (Edge Function). O escritório vê apenas "link gerado em dd/mm por X" via RPC `mat_status_links()` (SECURITY DEFINER, `pode_ver_materiais()`), que devolve datas e situação, nunca o token nem o hash.

**`mat_acesso_log`** — `departamento_id`, `evento text check in ('carregar','envio','envio_recusado','limite_ip','link_gerado')`, `ip inet`, `user_agent text`, `created_at`. Índices `(departamento_id, created_at desc)` e `(ip, created_at desc)`. Escrita só service_role; SELECT `is_admin()` ou `pode_aprovar_materiais()`. Retenção 180 dias (purge oportunista na própria function).

**`mat_kit_itens`** — Kit Mensal (limite).
- `departamento_id → mat_contratos`, `item_id`, `variacao_id null`, `quantidade numeric(10,2) not null check (quantidade >= 0)`, `periodicidade_meses smallint default 1` (casos da planilha como "pede 2 latas a cada 2 meses"), `observacao`, `atualizado_por`, `updated_at`.
- `unique (departamento_id, item_id, coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'))` (índice único por expressão).
- Limite em R$ do contrato = Σ quantidade × preço vigente (calculado, não gravado).
- RLS: SELECT `pode_ver_materiais()`; INSERT/UPDATE/DELETE `pode_aprovar_materiais()` (edição direta do escritório = gestor; mesa/inspetoria usam a solicitação abaixo).

**`mat_kit_alteracoes`** — pedido de alteração do kit (inspetoria/mesa), vale só após aprovação.
- `departamento_id`, `item_id`, `variacao_id null`, `quantidade_nova numeric` (0 = retirar), `motivo text not null`, `solicitado_por default auth.uid()`, `status check in ('pendente','aprovada','rejeitada')`, `decidido_por`, `decidido_em`, `comentario_decisao`.
- RLS: SELECT `pode_ver_materiais()`; INSERT `pode_validar_materiais() OR pode_editar_cadastro_materiais()` com `status = 'pendente'`; sem UPDATE direto — a decisão é a RPC `decidir_alteracao_kit(id, aprovar bool, comentario)` (`pode_aprovar_materiais()`), que aplica o upsert em `mat_kit_itens` na mesma transação.

### 3.3 Tabelas — migration 122 (`122_materiais_pedidos.sql`)

**`mat_pedidos`** — o envio único do líder (cabeçalho das duas filas).
- `departamento_id`, `competencia date not null` (1º dia do mês), `tipo check in ('mensal','extra')`, `origem check in ('lider','escritorio','operacional')`, `preenchido_pelo_escritorio boolean default false` (pedido preenchido pelo kit porque o posto não pediu — substitui o "Preenchido por Elisangela por média"), `rota_override smallint null check (rota_override in (1,2,3))` + `rota_override_motivo`, `rota_override_por` (rota do dia definida pela mesa, sem mudar o padrão do contrato; **rota efetiva = `coalesce(rota_override, mat_contratos.rota)`** — é ela que as Fases 2/3 usam para compra e recibo), `responsavel_nome text` ("Seu nome" do 1º envio; os demais ficam em `mat_pedido_envios`), `observacao text`, `termos_aceitos jsonb` (caixas de confirmação dos termos de responsabilidade), `status_produtos text`, `status_ceu text`, `enviado_em timestamptz` (1º envio), `reaberto_por/reaberto_em` (reabertura após o dia 15 pelo escritório), `criado_por uuid null` (null quando veio do link).
- `status_produtos`: `rascunho → enviado → em_validacao → validado → aprovado`, mais `cancelado` (`rascunho` só existe em pedido interno; o link não guarda rascunho) (Fase 2 acrescenta `em_compra`, `entregue`, `entregue_parcial`). Pedido sem exceção pula `em_validacao` (vai direto para `validado`). Contrato sem limpeza: `status_produtos = 'nao_se_aplica'`.
- `status_ceu`: `enviado → em_identificacao → conferido → em_atendimento → atendido`, mais `cancelado`; `nao_se_aplica` se não houver linhas.
- Índice único parcial: `(departamento_id, competencia) where tipo = 'mensal' and status_produtos <> 'cancelado'` — **um pedido mensal por contrato e mês** (envios repetidos são mesclados — ver `mat_pedido_envios` e regra na seção 4.1).

**`mat_pedido_envios`** — cada envio pelo link (ou registro interno), para rastrear mesclas.
- `pedido_id → mat_pedidos on delete cascade`, `sequencia smallint` (1 = original), `origem check in ('original','complemento')`, `seu_nome text not null`, `enviado_em timestamptz default now()`, `ip inet`, `user_agent text`; `unique(pedido_id, sequencia)`.
- RLS: SELECT `pode_ver_materiais()`; escrita só service_role (link) e RPCs internas. GRANT explícito.
- RLS: SELECT `pode_ver_materiais()`; INSERT `pode_validar_materiais() OR pode_editar_cadastro_materiais()` (pedido extra/operacional); UPDATE só em `rascunho` pelo autor ou `pode_aprovar_materiais()`; transições de status por RPC; DELETE `is_admin()`.

**`mat_pedido_itens`** — fila de produtos.
- `pedido_id → mat_pedidos on delete cascade`, `envio_id → mat_pedido_envios` (de qual envio veio a linha; a origem original/complemento, data/hora e "Seu nome" vêm dele), `possivel_repeticao boolean default false` + `repete_linha_id uuid null` (mesmo item e mesma variação já pedidos em outro envio do mesmo pedido), `decisao_repeticao text null check in ('somar','descartar')` (opcional — o aviso pode ser ignorado), `item_id null`, `variacao_id null`, `descricao_livre text null` ("outros materiais" — exige `item_id is null`), `qtd_kit numeric` (snapshot do kit no envio), `qtd_pedida numeric not null`, `qtd_validada numeric null`, `qtd_aprovada numeric null`, `qtd_entregue numeric null` (Fase 2/3), `preco_unitario numeric(12,2)` (snapshot do vigente no envio), `justificativa text`, `excecao_acima_kit bool`, `excecao_validade bool`, `excecao_fora_kit bool`, `ultima_entrega_em date null` (base do alerta de validade), `motivo_ajuste text` (obrigatório quando aprovada < pedida — check), `ajustado_por`, `ajustado_em`.
- Check: `qtd_* >= 0`; exceção marcada ⇒ `justificativa` não vazia (o servidor recalcula as exceções; nunca confia no flag do cliente).

**`ceu_pedido_itens`** — fila da Beth (uniforme, EPI, crachá).
- `pedido_id`, `envio_id → mat_pedido_envios`, `possivel_repeticao boolean default false` (só aviso: mesmo nome digitado normalizado + mesma peça + mesmo tamanho, ou crachá da mesma pessoa no mês), `nome_digitado text not null` (como o líder escreveu), `colaborador_id → colaboradores null` (preenchido só na identificação interna — seção 4.3), `identificado_por/em`, `fora_da_equipe boolean default false` (calculado na identificação: colaborador de outro posto, ex.: ferista), `tipo check in ('uniforme','epi','cracha')`, `item_id → itens null` (null para crachá), `tamanho text` (digitado), `tamanho_cadastro text` (snapshot de `ceu_tamanhos` na identificação), `qtd_pedida int`, `qtd_conferida int null`, `alerta_tamanho bool`, `ultima_entrega_em date null` (snapshot de `entregas` na identificação), `cracha_nome text`, `cracha_motivo text`, `cracha_cordao bool`, `status check in ('a_identificar','pendente','conferido','ajustado','atendido','cancelado')`, `conferido_por/em`, `atendido_por/em`, `motivo_ajuste text`.
- RLS: SELECT `pode_ver_materiais() OR pode_ver_ceu()`; UPDATE via RPCs `identificar_linhas_pedido_ceu`, `conferir_itens_pedido_ceu` (`pode_validar_materiais()`) e `atender_itens_pedido_ceu` (`pode_atender_pedido_ceu()`); INSERT por service_role (link) ou `pode_validar_materiais() OR pode_editar_cadastro_materiais()` (pedido operacional de ferista/faltista); DELETE `is_admin()`.

**`mat_comentarios`** — substitui as anotações nas células ("esclarecer…", "ver célula AO10").
- `pedido_id`, `linha_tabela text check in ('mat_pedido_itens','ceu_pedido_itens') null`, `linha_id uuid null`, `autor_id uuid not null`, `autor_nome text`, `texto text not null`.
- RLS: SELECT `pode_ver_materiais()`; INSERT `pode_ver_materiais()` com `autor_id = auth.uid()`; sem UPDATE/DELETE (histórico).

**RPCs da 122** (todas SECURITY DEFINER, reconferem perfil + status):
- `validar_pedido_materiais(p_pedido, p_itens jsonb, p_comentario)` — inspetor; valida, corta (com motivo), descarta linhas e pode tratar os avisos de repetição (`somar` = a quantidade conta; `descartar` = linha zerada com motivo "repetição") ou ignorá-los — **o aviso não trava a validação** (ignorado = a linha conta normalmente). Não há devolução pelo link (o inspetor liga para o líder).
- `identificar_linhas_pedido_ceu(p_linhas jsonb)` — inspetoria/dp2; grava `colaborador_id` e os snapshots de tamanho/última entrega.
- `aprovar_pedido_materiais(p_pedido, p_itens jsonb)` — gestor; "aprovar tudo" = `qtd_aprovada := coalesce(qtd_validada, qtd_pedida)`; ajuste item a item exige `motivo_ajuste`.
- `aprovar_lote_materiais(p_competencia, p_departamentos uuid[])` — aprovação em massa do painel.
- `conferir_itens_pedido_ceu`, `atender_itens_pedido_ceu` (acima).
- `reabrir_pedido_materiais(p_departamento, p_competencia, p_ate date, p_motivo)` — gestor/mesa; libera o link do contrato para novo envio fora da janela até `p_ate`.
- `definir_rota_contrato(p_departamento, p_rota)` e `definir_rota_pedido(p_pedido, p_rota, p_motivo)` — `pode_alterar_rota_materiais()`; a segunda grava o override (rota null volta ao padrão).
- `preencher_pedido_pelo_kit(p_departamento, p_competencia)` — gestor/admin/inspetoria (ver seção 6); cria o pedido `origem = 'escritorio'`, `preenchido_pelo_escritorio = true`, linhas = kit; recusa se já houver pedido mensal enviado na competência.
- `mat_contratos_sem_pedido(p_competencia)` — lista para o painel da seção 6 (`pode_ver_materiais()`).

### 3.4 Migration 123 (`123_permissoes_materiais.sql`)

Sementes em `permissoes_perfil` + `reset_permissoes_perfil` recriada (= 117 + linhas novas). Detalhe na seção 5. Sem tabela nova — sem GRANT de tabela.

> Backups antes de aplicar (regra de ouro): policies de `fornecedores` e `permissoes_perfil` em `dados-locais/backup_*_121..123_<data>.json`. Aplicação via Management API (`scripts/lib/executar-sql-arquivo.ps1`, que preserva UTF-8 — acentos em SQL inline corrompem).

---

## 4. Edge Function do líder e tela pública

### 4.0 Acesso do líder — DECIDIDO: link sem PIN (opção a)

Decisão da gestão (09/10/2026): **sem PIN e sem login**. O link de cada contrato vira um **QR code afixado no quadro do contrato** (local de acesso público) e também é enviado aos líderes; qualquer pessoa que leia o QR pode preencher, e isso é aceito por ora. Consequência de projeto: como o link é público, **a tela pública não exibe nenhum dado pessoal** (seção 4.2) e todo pedido passa pela conferência interna antes de virar compra ou entrega.

Mantidos: token longo por contrato, **revogável** (gerar link novo invalida o antigo na hora — reimprimir o QR); limite de requisições por IP; registro de data/hora, IP e user agent de cada envio.

### 4.1 Function `pedido-materiais`

- Local: `supabase/functions/pedido-materiais/index.ts`. Deploy: `powershell scripts/lib/implantar-edge-function.ps1 -Slug pedido-materiais -Arquivo supabase/functions/pedido-materiais/index.ts` (sai com `verify_jwt: false` — a chamada pública não tem JWT).
- Usa a service role internamente (cliente Supabase do Deno); **nenhuma tabela é exposta ao `anon`**.
- Secret: `ENCRYPTION_KEY` (já existe; cifra o token para reexibição do link/QR no CORH). Nenhum secret novo.
- CORS: bloco igual ao `econtador`/`sync-performancelab` (OPTIONS + `Access-Control-Allow-Origin` refletindo a origem, lista `ALLOWED_ORIGINS` com `https://plena-corh.netlify.app` e localhost). **Não remover ao editar.**
- Uma rota POST, campo `acao`; todas recebem o `token` do link:

| Ação | Entrada | Retorno |
|---|---|---|
| `carregar` | `token` | contrato (nome_curto), janela (`aberta`, prazo, hoje), `recebe_limpeza`, itens do kit e do catálogo ativo (nome, variações, unidade, quantidade do kit, `validade_meses`, data da última entrega do item **ao contrato**) — **sem preço, sem nomes, sem tamanhos**; itens CEU de uniforme/EPI ativos (só nome do item); se já houve envio no mês: mês, data/hora e "Seu nome" de cada envio, a **lista de produtos já pedidos com quantidades** e, de uniforme/EPI/crachá, **só a contagem** de linhas |
| `enviar` | `token`, `seu_nome` (obrigatório), produtos, linhas de uniforme/EPI/crachá digitadas, termos | `{ ok, protocolo }`; grava `enviado_em`, IP (`x-forwarded-for`/`cf-connecting-ip`), user agent; registra em `mat_acesso_log` |

- **Sem rascunho no servidor** (um rascunho salvo seria visível a qualquer um que abrisse o link): o rascunho fica só no aparelho (`localStorage`, try/catch).
- **Validação no servidor** (o cliente é não confiável): token existente e ativo; itens pertencem ao kit do contrato ou ao catálogo ativo; quantidades ≥ 0 e ≤ teto de sanidade (ex.: 10× o kit ou 999); textos com tamanho máximo (nome 120, observação/justificativa 500); exceções recalculadas (acima do kit, validade não vencida — última entrega + `validade_meses` > hoje, fora do kit) e justificativa exigida; `seu_nome` e termos obrigatórios; contrato `recebe_limpeza = false` ignora linhas de produto que não sejam de portaria.
- **Mais de um envio no mês** (comum e aceito — decisão da gestão): **um pedido por contrato e mês**. Cada envio gera uma linha em `mat_pedido_envios` e a regra vale **por fila**:
  - produtos: enquanto `status_produtos` está antes de `aprovado`, as linhas novas são **mescladas** ao pedido do mês (envio `complemento`); se o complemento tiver exceção, o pedido volta para `em_validacao` (repetição sozinha só gera aviso);
  - uniformes/EPI/crachá: enquanto `status_ceu` está antes de `conferido`, idem;
  - depois disso (aprovado/em compra, ou conferido), as linhas da fila vão para um **pedido extra** novo (`tipo = 'extra'`, `origem = 'lider'`), que segue na próxima rota ou sai do estoque.
  - **Repetição = só aviso** (`possivel_repeticao = true`, destaque na tela interna; o inspetor soma, descarta ou ignora — nunca trava): **produtos** — mesmo item e mesma variação já presentes em outro envio do pedido; **uniformes/EPI** — só quando coincidem nome digitado normalizado + mesma peça + mesmo tamanho (peças iguais para pessoas diferentes **nunca** geram aviso; repetir peça é normal); **crachá** — mesmo nome digitado normalizado com crachá já pedido no mês.
  - A mescla é feita numa transação (RPC `mat_registrar_envio`, SECURITY DEFINER, chamada só pela function com service role; `REVOKE` de `authenticated`), com lock no pedido do mês para dois envios simultâneos não criarem dois pedidos.
- **Rate limit por IP** (contagem em `mat_acesso_log`): > 30 chamadas/min ou > 5 envios/h no mesmo IP → 429; > 20 envios/dia no mesmo contrato → aviso no CORH.
- **Ações internas** (chamadas pelo CORH com JWT do usuário, validado com `auth.getUser()` + `perfis.nivel_acesso`, como o "Atualizar agora" do BI): `gerar_link` (novo token, `versao++`, invalida o anterior; devolve o link e o QR), `ver_link` (decifra e devolve o link para reimprimir o QR). Perfis: **admin, adm e gestor** (`materiais.gerenciar_links`), conferidos também no servidor.
- Hora: "hoje" calculado com `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` — nunca o relógio UTC cru.

### 4.2 Tela pública `/pedido/:token`

- `src/pages/materiais/PedidoLiderPage.tsx`, carregada via `lazyNamed`. Em `src/App.tsx` a rota precisa ser tratada **antes** de `if (loading)` / `if (!user)` (hoje o gate de login vem primeiro) — mesmo truque do `isMobileFalta`, mas **sem `ProtectedRoute`** e sem o layout (sidebar/header). Não usar o cliente Supabase autenticado: só `fetch` para a function (`src/services/pedidoMateriaisApi.ts`).
- `<meta name="referrer" content="no-referrer">` e `noindex`.
- **Nenhum dado pessoal na tela**: nada de lista da equipe, tamanhos cadastrados, CPF, matrícula, foto, nem autocomplete de colaboradores (que revelaria nomes).
- Mobile-first: etapas **Produtos | Uniformes e EPI | Crachás | Portaria | Revisar e enviar**, cabeçalho fixo com o contrato e "Prazo: até 15/MM". Produtos: campos numéricos (`inputMode="numeric"`) com a unidade ao lado, botões −/+, variação em lista, justificativa automática na linha com exceção (bloqueia o envio até preencher), "Outros materiais" com texto livre + quantidade (sempre exceção).
- Uniformes/EPI: o líder **digita** o nome do colaborador (texto livre), escolhe a peça na lista de itens e **digita/escolhe o tamanho** numa lista genérica (P/M/G/GG/EG, numeração) + quantidade; "ferista no posto" é só um nome a mais. Crachá: nome digitado, nome curto do crachá, motivo, cordão novo (sim/não). Termos como checkboxes.
- Campo obrigatório **"Seu nome"** (quem preencheu) na etapa final.
- Depois do envio: tela de confirmação com protocolo. Ao reabrir o link no mesmo mês, o topo mostra **"Pedido de <mês> enviado em dd/mm por <nome>"** (e os complementos), a **lista de produtos já pedidos com quantidades** e, para uniformes/EPI/crachá, **só a contagem** ("3 itens de uniforme/EPI já pedidos") — sem nomes. Abaixo, o formulário para um novo envio, que será mesclado ou virará pedido extra (seção 4.1); o aviso diz qual dos dois acontecerá. Fora da janela: "o prazo terminou; fale com o inspetor".

### 4.3 Resolução e conferência internas

- Na fila da inspetoria/Beth (CORH, autenticado), cada linha de uniforme/EPI/crachá chega com o **nome digitado**. O sistema sugere o colaborador (busca fuzzy entre os ativos do contrato — `idsColaboradoresDoDepartamento` — e depois entre todos os ativos, para feristas) e o inspetor confirma ou escolhe; só então `colaborador_id` é gravado.
- Com o colaborador identificado, o CORH compara o tamanho digitado com `ceu_tamanhos` e mostra a última entrega do mesmo item (`entregas`) — destaques só do lado interno.
- Não há devolução pelo link: quando algo não fecha, o inspetor liga para o líder (regra da empresa) e ajusta a quantidade/tamanho com motivo registrado.

---

## 5. Telas no CORH e permissões

### 5.1 Telas (módulo Materiais, `src/pages/materiais/`, shell próprio com `ModuleTabs`, grupo Operacional no menu)

| Rota | Tela | Quem usa |
|---|---|---|
| `/materiais/pedidos` | Lista do mês: contrato, rota efetiva (selo "rota do dia" quando há override; a mesa troca a rota do pedido ali, com motivo), status das duas filas, valor, exceções, "preenchido pelo escritório"; filtros com `FiltrosAtivosBadge`; botão "Pedido extra" | todos do módulo |
| `/materiais/sem-pedido` | "Contratos que ainda não pediram" (seção 6): último responsável informado pelo líder, rota, dias para o prazo, botão "Preencher pelo kit" | inspetoria, gestor, mesa (só leitura) |
| `/materiais/pedidos/:id` | Detalhe: linhas pedido/kit/validado/aprovado, justificativas, comentários com histórico, ações conforme perfil | todos |
| `/materiais/validacao` | Fila do inspetor: só pedidos `em_validacao` (por rota) | inspetoria |
| `/materiais/painel` | Painel do gestor: por contrato, valor pedido × limite (kit × preço) × média dos últimos 6 meses fechados (histórico das planilhas + pedidos aprovados no CORH; média de 12 meses como referência); destaque de quem passou do limite; "Aprovar selecionados" e ajuste item a item | gestor |
| `/materiais/catalogo` | Itens, variações, unidade, validade, fornecedor, preço vigente + histórico ("Novo preço a partir de…"), nomes antigos ligados ao item | gestor (+ admin) |
| `/materiais/fornecedores` | Cadastro único (substitui `/ceu/fornecedores`) | gestor (+ admin) |
| `/materiais/contratos` | Por contrato: rota padrão, recebe limpeza, Kit Mensal editável, limite em R$, média 6/12 meses, link e QR code (gerar, ver/reimprimir, regenerar — invalida o anterior; envios do mês por IP), alterações de kit pendentes | gestor (tudo), mesa (só rota padrão) |
| `/materiais/alteracoes-kit` | Solicitar (mesa/inspetoria) e decidir (gestor) | mesa, inspetoria, gestor |
| `/ceu/pedidos` (aba nova no `CeuShell`) | Fila da Beth: por contrato; 1º passo **identificar o nome digitado** (sugestão fuzzy + confirmação, seção 4.3); depois, por colaborador, linhas com tamanho pedido × cadastro (vermelho se diverge), "entregue em dd/mm" se recente, **saldo `itens.estoque` ao lado** (só referência, nunca bloqueia), conferência do inspetor (aprovar/ajustar/devolver), atendimento (marcar atendido), "Abrir crachás na aba Crachás" (`navigate('/ceu/crachas', { state: { colaboradorIds } })`), "Lançar entrega" (abre o Lançamento Rápido; o lançamento automático é Fase 3) | inspetoria (conferir), dp2 (atender) |

**Por que a fila da Beth entra já na Fase 1 (recebimento, conferência e atendimento, sem compra nem lançamento automático):** o objetivo da Fase 1 é desligar os Google Forms, e os formulários trazem uniforme, EPI e crachá junto com os produtos — 28 dos 65 formulários são *só* disso. Sem a fila, esses pedidos ficariam sem destino. O custo é baixo: tudo o que ela precisa ler já existe (`itens`, `ceu_tamanhos`, `entregas`, aba Crachás). Ficam para depois só a compra ao fornecedor (Fase 2) e o lançamento automático no CEU (Fase 3).

Pedido operacional (ferista/faltista sem posto, urgência): botão "Pedido extra" cria `mat_pedidos` com `tipo = 'extra'`, `origem = 'operacional'`, no contrato escolhido. **Ferista**: pedido no contrato onde está trabalhando (normalmente feito pelo líder do posto, como "fora da equipe"). **Faltista sem posto**: pedido no departamento **ADM PLENA** (recibo "PLENA ADM") — sem contrato técnico novo.

### 5.2 Permissões

`PERMISSOES_PADRAO` (e as mesmas linhas na `PermissoesPage` — regra do §12):

```ts
materiais: {
  editar_catalogo:          ['gestor'],                  // itens, variações, preços, fornecedores, nomes antigos
  editar_kit:               ['gestor'],                  // edição direta do Kit Mensal
  editar_rota:              ['gestor', 'mesa'],          // rota padrão do contrato
  alterar_rota_pedido:      ['gestor', 'mesa'],          // rota do dia de um pedido (override)
  solicitar_alteracao_kit:  ['mesa', 'inspetoria'],
  decidir_alteracao_kit:    ['gestor'],
  gerenciar_links:          ['gestor'],
  ver_sem_pedido:           ['gestor', 'inspetoria', 'mesa'],
  preencher_pelo_kit:       ['gestor', 'inspetoria'],
  validar:                  ['gestor', 'inspetoria'],
  aprovar:                  ['gestor'],
  pedido_extra:             ['mesa', 'inspetoria'],
  reabrir_pedido:           ['gestor', 'mesa'],
},
ceu: {
  // ... existentes, MENOS gerenciar_fornecedores
  conferir_pedido: ['gestor', 'inspetoria'],
  atender_pedido:  ['gestor', 'dp2'],
},
```

`permissoes_perfil` (migration 123): `menu.materiais` / `rota.materiais` = true para gestor, mesa, inspetoria; false para rh, dp1, dp2, financeiro, visualizador, dp3 (dp2 entra pela aba do CEU). As ações acima também semeadas (mesmo padrão da 115/117) e `reset_permissoes_perfil` recriada idêntica à da 117 + essas linhas, para "Restaurar padrão" não revogar o acesso. Rotas com `<ProtectedRoute permissao={{ recurso: 'rota', acao: 'materiais' }}>`; `/ceu/pedidos` usa a rota do CEU + a ação.

Alinhamento banco × tela: as funções `pode_*` têm listas fixas (seção 3.1) que espelham este mapa. Se a tela Permissões conceder uma ação a outro perfil, a RLS/RPC continuará bloqueando — limitação conhecida do projeto (ver migration 087); concessões novas exigem migration.

---

## 6. Contratos que ainda não pediram (sem geração automática)

**Decisão da gestão: nada é gerado automaticamente** — nem produtos, nem uniforme/EPI. A regra da empresa é insistir que o líder peça; se não pedir, o inspetor liga e cobra. Não há pg_cron nem migration de agendamento neste módulo.

- Tela `/materiais/sem-pedido` (e card no topo de `/materiais/pedidos`): lista os contratos ativos com `recebe_limpeza = true` ou com equipe, **sem pedido mensal enviado** na competência (RPC `mat_contratos_sem_pedido`), com rota, se o link foi aberto no mês sem envio (evento `carregar` no `mat_acesso_log`) e dias até o prazo.
- **Aviso a partir do dia configurável** `materiais_config.dia_aviso` (padrão 10, por `hojeBrasil()`): a lista ganha destaque âmbar e um alerta no topo das telas do módulo para inspetoria e gestor; depois do dia 15, vermelho. Sem e-mail/notificação externa na Fase 1.
- **"Preencher pelo kit"** (gestor/admin e inspetoria, RPC `preencher_pedido_pelo_kit`): usado só quando necessário, depois da cobrança; cria o pedido com as linhas do Kit Mensal (respeitando `periodicidade_meses`), `origem = 'escritorio'`, `preenchido_pelo_escritorio = true`, `status_produtos = 'validado'` (dentro do kit) e sem linhas de uniforme/EPI. Quem preencheu fica registrado (`criado_por`) e o selo "preenchido pelo escritório" aparece na lista, no painel e (Fase 3) no recibo.

---

## 7. Ordem de implementação

Cada passo deixa o sistema funcionando. Migrations aplicadas manualmente (Management API), nunca `db push`. **Deploy no Netlify só nos marcos D1, D2 e D3** (15 créditos cada).

| # | Entrega | Como testar | Banco / deploy |
|---|---|---|---|
| 1 | Migration 121 (cadastro, histórico, funções `pode_*`, fornecedores ampliado) + tipos em `src/types/materiais.ts` e `database.ts` | `npm test` (incl. validador RLS se houver Python); consultas de conferência por perfil | Migration 121 |
| 2 | Lógica pura `src/lib/materiais/`: preço vigente, limite em R$, exceções (acima do kit, validade, fora do kit), janela 1–15, dia de aviso, competência, média 6/12 meses (meses zerados contam), normalização de nomes para aliases | Testes Vitest (casos reais: balde 6 meses, Abaeté limite × pedido) | — |
| 3 | Telas Catálogo, Fornecedores, Contratos (rota, kit, limite, média) + remoção da aba Fornecedores do CEU e da ação `ceu.gerenciar_fornecedores` | Smoke test das páginas; lint; cadastro manual de 2 contratos de teste | — |
| 4 | **Carga inicial** (seção 8, parte A): catálogo, nomes antigos, preços, kit, contratos/rotas — planilha de conferência → usuária revisa → script aplica | Contagens e totais por contrato batem com a planilha revisada | Dados (com backup) |
| 4b | **Carga do histórico** (seção 8, parte B): consumo item × contrato × mês desde 12/2022 | Totais por contrato/mês batem com as tabelas dinâmicas da planilha; média 6 meses de 3 contratos conferida à mão | Dados (com backup) |
| 5 | Migration 122 (pedidos, filas, comentários, RPCs) + 123 (permissões) | Testes das RPCs por perfil (SQL), `permissoes.test.ts` | Migrations 122/123 |
| **D1** | Deploy: cadastro e histórico prontos, Elisangela começa a revisar kits/preços/médias | hash do bundle em produção = `dist/` | Netlify (1) |
| 6 | Edge Function `pedido-materiais` (carregar/enviar + gerar_link/ver_link) | Testes de lógica pura extraída; chamadas com `curl` (link regenerado = antigo recusado, payload adulterado, item fora do catálogo, fora da janela, 2º envio mesclado antes da aprovação e pedido extra depois; aviso de repetição (produtos; uniforme só com mesmo nome+peça+tamanho; crachá mesma pessoa) sem travar a validação; dois envios simultâneos = um pedido sóo, rate limit por IP); conferir que a resposta não contém nome/tamanho de colaborador | Deploy da function + secrets |
| 7 | Tela pública `/pedido/:token` | Celular real em contrato de teste; Lighthouse mobile; teste sem login e com outro usuário logado | — |
| 8 | Lista/detalhe de pedidos (com rota do dia), fila de validação, painel do gestor | Fluxo completo com pedido de teste: dentro do kit (passa direto), acima do kit (vai ao inspetor), corte com motivo, mesa troca a rota de um pedido (padrão do contrato inalterado) | — |
| 9 | Aba CEU → Pedidos (conferência + atendimento + saldo + crachás) | Nome digitado com grafia diferente → sugestão correta; pedido com tamanho divergente e peça entregue há 30 dias → destaques aparecem após a identificação; atalho para Crachás; pedido de faltista em ADM PLENA | — |
| 10 | Tela "Contratos que ainda não pediram" + "Preencher pelo kit" | Simular dia 9/10/16 (data injetável na lógica pura); preencher contrato sem envio; tentar preencher contrato que já enviou (recusa) | — |
| **D2** | Deploy: piloto com 2–3 contratos (links entregues aos líderes), Google Forms continuam em paralelo | Acompanhar um ciclo de 1 a 15 | Netlify (2) |
| 11 | Ajustes do piloto; geração dos links e QR codes de todos os contratos (impressão para os quadros); documentação (AGENTS.md §8/§11, `docs/REGRAS_NEGOCIO.md`, manual) | — | — |
| **D3** | Deploy: todos os contratos; Google Forms desligados | — | Netlify (3) |

---

## 8. Dados iniciais

Fontes (não ler inteiras — arquivos grandes; processar por script):
- `docs/Pedido de material/pedido_materiais_todas_abas.md` — seção "1. Kit Mensal e Link por cliente" (contrato × item, cabeçalho com unidade e validade, ex.: "BALDE 8 LITROS - (Unidade) - VAL: 06 MESES"); seção "2. FORM P/ USO DA ÁREA OPER" (pedidos de alteração de kit).
- `docs/Pedido de material/Planilha completa de material eu mexendo.xlsx` — linhas MODELO ("Média de Consumo" e preço, para conferência do limite), os nomes padronizados definidos no início do projeto e **o histórico de pedidos item × contrato × mês desde 12/2022** (~162 mil linhas, maioria com quantidade zero).

Roteiro — parte A (cadastro):
1. Script (`scripts/materiais/preparar-carga.ts`, roda com `tsx`) extrai: catálogo (nome padronizado, unidade, validade dos cabeçalhos), aliases (grafias antigas → nome padronizado), kit por contrato, preço mais recente, e casa o nome do contrato com `departamentos.nome_curto` usando `encontrarDepartamentoFuzzy`/`departamentosSelecionaveis` (nunca ILIKE).
2. Gera `dados-locais/conferencia_materiais_<data>.xlsx` com abas Catálogo, Variações, Preços, Kit por contrato (inclusive o limite em R$ calculado), Contratos (nome da planilha → departamento casado, rota, recebe limpeza) e **Pendências**: células de texto livre no kit ("Pede 2 latas a cada 02 meses", "02 / 350mm"), contratos sem match, itens sem preço, divergência kit × "Média de Consumo".
3. **A usuária revisa e devolve a planilha.** Rotas e "recebe limpeza" são preenchidos/confirmados por ela.
4. Script de aplicação lê a planilha revisada, faz backup das tabelas-alvo e grava (dry-run por padrão, `--aplicar` para valer — mesmo padrão de `scripts/lancar-epis-mensal.mjs`).

Roteiro — parte B (histórico, "vale ouro"; depois da parte A, porque depende do catálogo e dos nomes antigos):
1. `scripts/materiais/preparar-historico.ts` lê o histórico, descarta linhas com quantidade zero/vazia e erros (`#REF!`, `#N/A`), converte grafias pelo `mat_aliases` (com `fator` de unidade) e casa o contrato como na parte A.
2. Gera `dados-locais/conferencia_historico_materiais_<data>.xlsx`: **resumo por contrato × mês** (quantidade de linhas e valor) para bater com as tabelas dinâmicas atuais; aba **Nomes sem correspondência** (nome antigo, nº de ocorrências, sugestão de item) — a usuária liga cada um a um item do catálogo ou marca "ignorar"; aba de contratos sem match (contratos encerrados podem ser ignorados).
3. **A usuária revisa e devolve.** Os nomes ligados por ela entram em `mat_aliases`; o script reprocessa até não sobrar pendência relevante.
4. Aplicação em `mat_historico_consumo` (`fonte = 'planilha_completa'`), em lotes, com dry-run e backup; recarga é idempotente (apaga e regrava só a fonte `planilha_completa`).

---

## 9. Riscos e pontos de atenção

- **LGPD — risco reduzido por desenho**: o link é público (QR no quadro), por isso a tela e a resposta da function **não contêm dado pessoal** — sem lista da equipe, sem tamanhos cadastrados, sem CPF/matrícula, sem autocomplete de nomes, sem preços, sem rascunho no servidor; ao reabrir o link, só a lista de produtos do mês e a contagem de uniformes/EPI/crachá. O que o líder digita (nomes, tamanhos, "Seu nome") só é lido dentro do CORH, por perfis autenticados. Incluir o fluxo no registro de tratamento de dados (finalidade: pedido de material).
- **Risco residual — pedido falso ou spam**: qualquer pessoa com o QR pode enviar. Mitigação: nada vira compra ou entrega sem a conferência do inspetor (e a aprovação do gestor); envios repetidos são mesclados com rastreio de quem enviou e repetições destacadas para o inspetor; rate limit por IP e alerta de volume por contrato; log de IP/data-hora/user agent e "Seu nome" em cada envio; abuso → regenerar o link e reimprimir o QR.
- **Token na URL**: pode ficar em histórico do navegador e em prints; por isso `no-referrer` e regeneração simples.
- **Fusos**: janela 1–15 e competência sempre pela hora de Brasília (`hojeBrasil()` no front, `America/Sao_Paulo` no Deno/SQL); a function decide, nunca o relógio do celular. Colunas `date` com `parseDataLocal()`.
- **Departamentos duplicados**: contrato aponta para a linha Ativa com nome_curto; equipe por `idsColaboradoresDoDepartamento` (expande irmãs); seletores com `departamentosSelecionaveis`; exibição com `nomeCurtoDepartamentoFuzzy`. Se um contrato não aparecer, é dado (nome_curto), não código — ver auditoria de 09/10/2026.
- **Falso sucesso**: todo UPDATE/DELETE com `.select('id')`; transições por RPC que devolvem erro explícito.
- **Saldo do CEU impreciso**: `itens.estoque` é manual e não baixa com as entregas — aparece com o rótulo "referência" e nunca bloqueia (decisão da gestão).
- **Concorrência**: dois celulares no mesmo link — lock no pedido do mês dentro de `mat_registrar_envio`; o segundo envio é mesclado (ou vira extra), nunca um segundo pedido mensal.
- **Exposição dos produtos já pedidos**: a lista de produtos do mês fica visível a quem abrir o link — não é dado pessoal (aceito pela gestão); uniformes/EPI/crachá aparecem só como contagem.
- **RLS × tela Permissões**: listas fixas nas `pode_*`; documentar no AGENTS.md para a próxima alteração.
- **PWA**: a rota pública passa pelo mesmo service worker; testar que o líder recebe build novo (ciclo `skipWaiting` já existente).
- **Média histórica**: a qualidade depende do mapeamento dos nomes antigos (141 grafias só em 2026, unidades diferentes como "Cloro 1L" × "bombona 5L"). Nome não mapeado some da média — por isso a aba "Nomes sem correspondência" e a conferência dos totais por contrato × mês antes de gravar.
- **Contrato que não pede**: sem geração automática, um contrato esquecido fica sem material — o aviso a partir do dia 10 e a lista "ainda não pediram" são a rede de segurança; o inspetor precisa olhar a lista.
- **Rota do dia**: Fases 2/3 devem sempre usar a rota efetiva do pedido (`coalesce(rota_override, rota)`), nunca só a do contrato.

---

## 10. Fases 2 e 3 (fora deste plano)

**Fase 2 — compra e estoque**
- Estoque de materiais: `mat_estoque_movimentos` (entrada de compra/sobra/devolução, saída, ajuste de contagem) e saldo por item/variação; contagem mensal com registro da diferença.
- Compra: soma do aprovado − saldo = a comprar; marcação por item "fornecedor entrega" × "sai do estoque (inspetor entrega)"; Excel por fornecedor e mês no formato da aba "Pedido ao Fornecedor por Cliente" (itens nas linhas, contratos nas colunas, total) e resumo "Compra ao Fornecedor"; separação por rota; registro do que chegou (mesa).
- Fila da Beth: pedido ao fornecedor do que faltar no estoque do CEU, no mesmo formato.
- Status `em_compra` / `entregue` / `entregue_parcial` e `qtd_entregue` com motivo.

**Fase 3 — entrega e histórico**
- Relatório de entrega único por contrato (produtos + uniformes/EPI/crachás + lembrete da guia do exame periódico, texto de `materiais_config.aviso_recibo`), agrupado por rota, assinado pelo líder (como o link é público, a assinatura pelo link precisa ser reavaliada na Fase 3 — papel ou assinatura na entrega presencial).
- Na confirmação: entregas de uniforme/EPI lançadas automaticamente no CEU (com o recibo existente, regras do CEU sobre data e situação) e baixa das saídas do estoque de materiais.
- (A importação do histórico foi antecipada para a Fase 1 — decisão da gestão.)

---

## 11. Decisões confirmadas pela gestão (09/10/2026)

1. **Catálogo, preços, fornecedores e links**: Elisangela (perfil gestor) e a administração (admin/adm). A mesa **não** gerencia catálogo nem links.
2. **Kit Mensal**: só o gestor edita direto; mesa e inspetoria pedem alteração, que vale após aprovação do gestor.
3. **Rota**: gestor e mesa alteram a rota padrão do contrato; a mesa também troca a rota de **um pedido** (necessidade do dia, `rota_override`) sem mudar o padrão.
4. **Histórico**: carregado já na Fase 1 (planilha completa, desde 12/2022), com nomes antigos ligados ao catálogo; painel usa a **média dos últimos 6 meses fechados** e mostra a de 12 meses como referência.
5. **Ferista**: pedido e recibo no contrato onde está trabalhando (o líder o inclui como "fora da equipe"). **Faltista sem posto**: pedido da mesa/inspetoria no departamento existente **ADM PLENA** (recibo "PLENA ADM"); nenhum contrato técnico novo.
6. **Nada de pedido automático** após o dia 15: painel "Contratos que ainda não pediram" com aviso a partir do dia 10 (configurável); o inspetor cobra o líder; se necessário, "Preencher pelo kit", marcado "preenchido pelo escritório". A migration/pg_cron de geração automática foi retirada do plano (as migrations ficam 121, 122 e 123).
7. **Uniforme/EPI nunca automático** — e, com o item 6, nada no módulo é automático.
8. **Link sem PIN** (09/10/2026): o link fica em QR code no quadro de cada contrato e é enviado aos líderes; qualquer um que leia pode preencher — aceito. Mitigação obrigatória: tela pública sem dado pessoal; nomes e tamanhos digitados e resolvidos só internamente; "Seu nome" obrigatório; rate limit por IP; token revogável; log de cada envio.
9. **Envios repetidos** (comuns e aceitos): um pedido por contrato e mês; antes da aprovação (produtos) / conferência (Beth) o novo envio é mesclado, com origem "complemento", data/hora e "Seu nome"; depois, vira pedido extra. O link reaberto mostra os produtos já pedidos e só a contagem de uniformes/EPI/crachá. Item repetido entre envios é **só aviso** (não trava): o inspetor soma, descarta ou ignora; em uniformes/EPI o aviso só vale para mesmo nome + peça + tamanho, e em crachá para a mesma pessoa no mês.
10. Detalhes técnicos mantidos (a gestão não comentou): link reexibível (guardado cifrado, para reimprimir o QR); preço próprio opcional por variação.

