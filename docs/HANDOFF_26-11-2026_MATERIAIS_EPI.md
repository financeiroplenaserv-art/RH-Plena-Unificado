# Handoff 26/11/2026 — Materiais/CEU: primeiros EPIs pelo módulo

## O que foi feito hoje (tudo em produção, no banco)

1. **Carga dos EPIs de dezembro/2026** a partir de `dados-locais/EPIs Dezembro.26.xlsx`
   (pedidos já aprovados e comprados pelos líderes). Script `scripts/materiais/importar-epis-dezembro.ts`
   (dry-run padrão, `--aplicar` grava) + parser `src/lib/materiais/pedidoEpiTexto.ts` — commit `e6481e0`.
   - 42 pedidos (competência 2026-12-01), 171 linhas, 240 EPIs, 112 pessoas, marca
     `p_user_agent = 'importado-planilha-epis-2026-12'`.
   - Decisões da gestora: **posto = o do CORH** (vale sobre a aba da planilha); avental = AVENTAL cód. 686;
     luva térmica (qualquer tamanho) = LUVA TÉRMICA Tam. 11 (cód. 713); manguito = MANGUITO (700);
     luva pigmentada = LUVA DE MALHA PIGMENTADA (642); linha 232 PRIDE = Paulo Henrique Lima de Souza;
     linha 309 = Marcos Vinicius Stellet Monteiro (aparece 2x na planilha, os dois pedidos foram para
     GRAND VALLEY, itens diferentes); Telex: Eliana → TELEX BAR, TIJ E IPA; Fabiana e Michelle →
     TELEX ICA, CENTRO NIT E CENTRO RJ; Ricardo dos Santos Gonçalves (ferista) → ESCRITÓRIO PLENA.
   - A parte de materiais desses 42 pedidos ficou "sem necessidade" (autorizado).
   - Revisão e backup: `dados-locais/importacao_epis_dezembro_2026-11-26/` (revisao2.xlsx).
2. **Tudo de outubro/2026 APAGADO** (decisão da gestora: o módulo não tinha sido usado; blazer e cia
   eram lixo da importação de 17/10): 58 pedidos, 556 linhas de materiais, 135 linhas CEU, 110 envios,
   1 compra cancelada. Backup completo em `dados-locais/backup_pedidos_outubro_apagados_2026-11-26/`
   (+ o cancelamento anterior em `backup_ceu_pedidos_outubro_2026-11-26/`). Estoque (29 movimentos de
   contagem) intocado. Hoje o módulo tem SÓ os 42 pedidos de dezembro.
3. **Abaeté**: as 10 linhas tinham sido canceladas por engano na conferência ("erro") — reabertas como
   conferidas (backup `dados-locais/backup_ceu_abaete_reabrir_2026-11-26.json`).
4. A gestora conferiu todas as linhas: **171 conferidas, prontas para a Beth atender** (fila CEU → Pedidos,
   Etapa "Atender (CEU)").

## A FAZER amanhã — "Atender" já lança a entrega no CEU

Hoje a Beth registra duas vezes ("Atender selecionadas" na fila + Lançamento rápido). Proposta APROVADA:
o "Atender selecionadas" abre uma janela de confirmação e, ao confirmar, cria as entregas no CEU e marca
as linhas como atendidas, numa transação só.

Decisões da gestora (26/11/2026):
1. **Data da entrega sugerida = dia 1º do mês do pedido** (ex.: 01/12/2026); Beth pode trocar na janela.
2. **Recibo como hoje** — a confirmação NÃO emite recibo; emissão segue pelo caminho atual do CEU.
3. **Entregou menos → lança só o que entregou** (linha atendida parcial com motivo, como já existe).
4. Situação padrão "Troca" (regra do CEU).

Plano técnico (a confirmar no código):
- Migration nova: `ceu_pedido_itens.entrega_id` (FK `entregas`) — rastreio e anti-duplicidade.
- RPC transacional (SECURITY DEFINER, `atender_pedido` = gestor/dp2/admin) que cria as entregas
  (snapshot_item do item NA DATA, como o lançamento normal — CA vem do snapshot) e marca as linhas.
  Recriar `atender_linhas_pedido_ceu` a partir do `pg_get_functiondef` real (migration 124).
- Janela de confirmação na `src/pages/ceu/CeuPedidosPage.tsx`; GRANT/backup/teste em transação desfeita.
- Lançamento rápido continua para entregas fora de pedido.

## Dúvidas da gestora a tratar amanhã (incluir no desenho)

- **Colaborador de outro contrato percebido na separação**: a entrega e o recibo do CEU são por PESSOA
  (não por contrato), então lançar não fica errado. Mas o pedido é do contrato (separação por posto,
  orçamento de uniforme/EPI). Hoje a fila NÃO tem "mover linha para outro contrato". Proposta: ação
  "Trocar contrato" na linha (motivo obrigatório; move a linha para o pedido do mês do contrato certo,
  criando o pedido se não existir) — confirmar com a gestora. Lembrar a regra: o posto vale pelo CORH;
  se o CORH estiver errado, corrigir o cadastro.
- **CA depois da compra**: o recibo usa o CA do **snapshot da entrega** (foto do item na data do
  lançamento — regra permanente do CEU). Então o CA certo precisa estar no cadastro do item (CEU → Itens)
  ANTES de atender/lançar. Proposta: a janela de confirmação mostra o CA de cada item e AVISA quando o
  item está sem CA (ex.: LUVA TÉRMICA 713 está com CA vazio) ou quando a gestora quiser conferir o CA do
  lote comprado; opção de corrigir o CA antes de confirmar (atualiza o cadastro, vale dali em diante).
  Confirmar com a gestora se basta o aviso ou se o CA deve ser informado por compra/lote.
