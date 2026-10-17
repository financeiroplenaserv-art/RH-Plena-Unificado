-- ============================================================
-- 144 — Materiais: status e dados de mat_pedidos só mudam pelas RPCs
-- ============================================================
-- Pré-publicação (17/10/2026): a policy mat_pedidos_update (122) deixava gestor/admin
-- (pode_aprovar_materiais) e o criador do rascunho fazerem UPDATE direto em qualquer
-- coluna — inclusive status_produtos/status_ceu — pulando a máquina de estados
-- (validar → aprovar etc.) e a auditoria das RPCs.
--
-- Conferência do frontend: nenhuma tela faz UPDATE em mat_pedidos (só select, insert do
-- rascunho do pedido extra e delete do rascunho). Toda mudança passa por RPC
-- SECURITY DEFINER (validar_pedido_materiais, aprovar_pedido_materiais,
-- ajustar_linha_kit_materiais, incluir_linha_pedido_materiais,
-- ligar_linha_catalogo_materiais, enviar_pedido_interno, reabrir/definir_rota,
-- atender_linhas_pedido_ceu, mat_registrar_envio etc.), que rodam como dono e não
-- dependem de policy nem de grant do papel authenticated.
--
-- Aqui: remove a policy de UPDATE e revoga o privilégio UPDATE de authenticated em
-- mat_pedidos — tentativa de UPDATE direto passa a dar "permission denied" (erro claro,
-- sem falso sucesso). SELECT/INSERT/DELETE ficam como estavam. Sem tabela nova.
-- Backup das policies: dados-locais/backup_materiais_143_144_2026-10-17/policies_antes.json
-- ============================================================

DROP POLICY IF EXISTS "mat_pedidos_update" ON public.mat_pedidos;
REVOKE UPDATE ON public.mat_pedidos FROM authenticated;
