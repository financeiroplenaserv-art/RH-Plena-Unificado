-- Migração 121: Módulo Materiais (Fase 1) — cadastro, kit, links e histórico
--
-- Decisão da gestão (09/10/2026, docs/PLANO_MATERIAIS_FASE1.md): fim dos
-- Google Forms de pedido de material. O líder de cada contrato faz o pedido
-- do mês por um link/QR público (sem login e sem PIN) servido por Edge
-- Function; o pedido se divide em produtos (módulo Materiais) e
-- uniformes/EPI/crachás (CEU → Pedidos).
--
-- Esta migration cria só o CADASTRO (a 122 cria os pedidos e a 123 as
-- permissões):
--  A) Funções de permissão pode_*() (listas fixas, SECURITY DEFINER);
--  B) fornecedores (existente) ampliado: contato, observacao, ativo — vira o
--     cadastro único de fornecedores (policies recriadas);
--  C) mat_itens, mat_item_variacoes, mat_precos (+ view), mat_aliases;
--  D) mat_contratos (contrato de pedido ≠ departamento), mat_contrato_acesso
--     (segredos do link — só service_role), mat_acesso_log;
--  E) mat_kit_itens (Kit Mensal = limite), mat_kit_alteracoes,
--     mat_historico_consumo (base da média 6/12 meses);
--  F) RPCs: definir_rota_contrato, decidir_alteracao_kit, mat_status_links,
--     mat_preco_vigente.
--
-- Regras: RLS em toda tabela; nenhuma policy aberta; GRANT explícito (nunca
-- para anon — o líder só fala com a Edge Function, que usa service_role).
-- Escrita de estado por RPC que reconfere perfil (padrão da 115).
-- Idempotente. NÃO aplicar sem backup das policies de fornecedores.

-- ============================================================
-- A) Funções de permissão
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_ver_materiais()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa', 'inspetoria', 'dp2')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_editar_cadastro_materiais()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor')
  );
$$;

-- Fornecedores (cadastro único): decisão da gestão em 09/10/2026 — quem
-- cadastra é a mesa (Maciel), dp2 e financeiro, além de gestor/admin.
-- Separado de pode_editar_cadastro_materiais (catálogo/preços/kit seguem só
-- gestor/admin). dp1 não.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_fornecedores()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa', 'dp2', 'financeiro')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_aprovar_materiais()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_alterar_rota_materiais()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_validar_materiais()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_atender_pedido_ceu()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_materiais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_cadastro_materiais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_fornecedores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_aprovar_materiais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_alterar_rota_materiais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_validar_materiais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_atender_pedido_ceu() TO authenticated;

-- ============================================================
-- B) fornecedores: cadastro único (existente, ampliado)
-- ============================================================
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS contato text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Remove TODAS as policies atuais (os nomes variam entre as migrations
-- 010/014/037/065) e recria o conjunto final. Backup das policies antes.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'fornecedores'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fornecedores', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (public.pode_ver_ceu() OR public.pode_ver_materiais() OR public.pode_gerenciar_fornecedores());
CREATE POLICY "fornecedores_insert" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_fornecedores());
CREATE POLICY "fornecedores_update" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_fornecedores())
  WITH CHECK (public.pode_gerenciar_fornecedores());
CREATE POLICY "fornecedores_delete" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- C) Catálogo de produtos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'limpeza' CHECK (categoria IN ('limpeza', 'portaria', 'outros')),
  unidade_pedido text NOT NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  validade_meses integer CHECK (validade_meses IS NULL OR validade_meses > 0),
  tem_variacao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_itens_nome_uq ON public.mat_itens (lower(nome));

CREATE TABLE IF NOT EXISTS public.mat_item_variacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.mat_itens(id) ON DELETE CASCADE,
  rotulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, rotulo)
);

-- Histórico de preços: nunca UPDATE do valor; nova linha a cada mudança.
CREATE TABLE IF NOT EXISTS public.mat_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.mat_itens(id) ON DELETE CASCADE,
  variacao_id uuid REFERENCES public.mat_item_variacoes(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  preco numeric(12,2) NOT NULL CHECK (preco >= 0),
  vigente_desde date NOT NULL,
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mat_precos_vigencia_idx
  ON public.mat_precos (item_id, variacao_id, vigente_desde DESC);

-- Nomes antigos (planilhas) → item do catálogo; fator converte a unidade
-- (ex.: "Cloro 1L" → bombona 5L = 0,2). nome_legado já vem normalizado.
CREATE TABLE IF NOT EXISTS public.mat_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_legado text NOT NULL UNIQUE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id) ON DELETE CASCADE,
  variacao_id uuid REFERENCES public.mat_item_variacoes(id) ON DELETE SET NULL,
  fator numeric NOT NULL DEFAULT 1 CHECK (fator > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- D) Contratos de pedido, link e log
-- ============================================================
-- Contrato de pedido ≠ departamento: em geral 1:1, mas um departamento pode
-- ter vários (CENTRO AUDITIVO TELEX: 4). Sem unicidade em departamento_id.
CREATE TABLE IF NOT EXISTS public.mat_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  nome text NOT NULL,
  rota smallint CHECK (rota IN (1, 2, 3)),
  recebe_limpeza boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_contratos_nome_uq ON public.mat_contratos (lower(nome));
CREATE INDEX IF NOT EXISTS mat_contratos_departamento_idx ON public.mat_contratos (departamento_id);

-- Segredos do link: tabela separada, SEM policy e SEM grant para
-- authenticated — só a Edge Function (service_role) lê/escreve.
CREATE TABLE IF NOT EXISTS public.mat_contrato_acesso (
  contrato_id uuid PRIMARY KEY REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_cifrado text,
  versao integer NOT NULL DEFAULT 1,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.mat_acesso_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  evento text NOT NULL CHECK (evento IN ('carregar', 'envio', 'envio_recusado', 'limite_ip', 'link_gerado')),
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mat_acesso_log_contrato_idx ON public.mat_acesso_log (contrato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mat_acesso_log_ip_idx ON public.mat_acesso_log (ip, created_at DESC);

-- ============================================================
-- E) Kit Mensal, alterações de kit e histórico de consumo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  quantidade numeric(10,2) NOT NULL CHECK (quantidade >= 0),
  periodicidade_meses smallint NOT NULL DEFAULT 1 CHECK (periodicidade_meses >= 1),
  observacao text,
  atualizado_por uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_kit_itens_uq
  ON public.mat_kit_itens (contrato_id, item_id, (COALESCE(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE OR REPLACE FUNCTION public.mat_kit_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.atualizado_por := COALESCE(auth.uid(), NEW.atualizado_por);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mat_kit_touch ON public.mat_kit_itens;
CREATE TRIGGER trg_mat_kit_touch BEFORE UPDATE ON public.mat_kit_itens
  FOR EACH ROW EXECUTE FUNCTION public.mat_kit_touch();

CREATE TABLE IF NOT EXISTS public.mat_kit_alteracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  quantidade_nova numeric(10,2) NOT NULL CHECK (quantidade_nova >= 0),
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  solicitado_por uuid DEFAULT auth.uid(),
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  decidido_por uuid,
  decidido_em timestamptz,
  comentario_decisao text
);
CREATE INDEX IF NOT EXISTS mat_kit_alteracoes_status_idx ON public.mat_kit_alteracoes (status, contrato_id);

CREATE TABLE IF NOT EXISTS public.mat_historico_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  competencia date NOT NULL,
  quantidade numeric NOT NULL,
  valor numeric(12,2),
  nome_legado text,
  fonte text NOT NULL DEFAULT 'planilha_completa'
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_historico_consumo_uq
  ON public.mat_historico_consumo (contrato_id, item_id, (COALESCE(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)), competencia, fonte);
CREATE INDEX IF NOT EXISTS mat_historico_consumo_comp_idx
  ON public.mat_historico_consumo (contrato_id, competencia DESC);

-- ============================================================
-- RLS + GRANTs
-- ============================================================
ALTER TABLE public.mat_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_item_variacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_contrato_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_acesso_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_kit_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_kit_alteracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_historico_consumo ENABLE ROW LEVEL SECURITY;

-- Catálogo, variações, aliases e histórico: SELECT materiais; escrita
-- cadastro (gestor/admin); DELETE admin.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mat_itens', 'mat_item_variacoes', 'mat_aliases', 'mat_historico_consumo']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.pode_ver_materiais())', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pode_editar_cadastro_materiais())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.pode_editar_cadastro_materiais()) WITH CHECK (public.pode_editar_cadastro_materiais())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t || '_delete', t);
  END LOOP;
END $$;

-- Preços: histórico imutável (sem UPDATE).
DROP POLICY IF EXISTS "mat_precos_select" ON public.mat_precos;
DROP POLICY IF EXISTS "mat_precos_insert" ON public.mat_precos;
DROP POLICY IF EXISTS "mat_precos_delete" ON public.mat_precos;
CREATE POLICY "mat_precos_select" ON public.mat_precos FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_precos_insert" ON public.mat_precos FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_cadastro_materiais());
CREATE POLICY "mat_precos_delete" ON public.mat_precos FOR DELETE TO authenticated
  USING (public.is_admin());

-- Contratos de pedido: a mesa altera só a rota, pela RPC definir_rota_contrato.
DROP POLICY IF EXISTS "mat_contratos_select" ON public.mat_contratos;
DROP POLICY IF EXISTS "mat_contratos_insert" ON public.mat_contratos;
DROP POLICY IF EXISTS "mat_contratos_update" ON public.mat_contratos;
DROP POLICY IF EXISTS "mat_contratos_delete" ON public.mat_contratos;
CREATE POLICY "mat_contratos_select" ON public.mat_contratos FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_contratos_insert" ON public.mat_contratos FOR INSERT TO authenticated
  WITH CHECK (public.pode_aprovar_materiais());
CREATE POLICY "mat_contratos_update" ON public.mat_contratos FOR UPDATE TO authenticated
  USING (public.pode_aprovar_materiais()) WITH CHECK (public.pode_aprovar_materiais());
CREATE POLICY "mat_contratos_delete" ON public.mat_contratos FOR DELETE TO authenticated
  USING (public.is_admin());

-- mat_contrato_acesso: RLS ligado e NENHUMA policy (nega tudo a authenticated).

-- Log de acesso: leitura admin/aprovador; escrita só service_role.
DROP POLICY IF EXISTS "mat_acesso_log_select" ON public.mat_acesso_log;
CREATE POLICY "mat_acesso_log_select" ON public.mat_acesso_log FOR SELECT TO authenticated
  USING (public.is_admin() OR public.pode_aprovar_materiais());

-- Kit: edição direta só do gestor (aprovador).
DROP POLICY IF EXISTS "mat_kit_itens_select" ON public.mat_kit_itens;
DROP POLICY IF EXISTS "mat_kit_itens_insert" ON public.mat_kit_itens;
DROP POLICY IF EXISTS "mat_kit_itens_update" ON public.mat_kit_itens;
DROP POLICY IF EXISTS "mat_kit_itens_delete" ON public.mat_kit_itens;
CREATE POLICY "mat_kit_itens_select" ON public.mat_kit_itens FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_kit_itens_insert" ON public.mat_kit_itens FOR INSERT TO authenticated
  WITH CHECK (public.pode_aprovar_materiais());
CREATE POLICY "mat_kit_itens_update" ON public.mat_kit_itens FOR UPDATE TO authenticated
  USING (public.pode_aprovar_materiais()) WITH CHECK (public.pode_aprovar_materiais());
CREATE POLICY "mat_kit_itens_delete" ON public.mat_kit_itens FOR DELETE TO authenticated
  USING (public.pode_aprovar_materiais());

-- Alterações de kit: solicitar (inspetoria, mesa, gestor) sempre 'pendente';
-- a decisão é a RPC decidir_alteracao_kit (sem UPDATE direto). O plano cita
-- validar/editar_cadastro; a mesa tem a ação solicitar_alteracao_kit no mapa
-- padrão, então entra por pode_alterar_rota_materiais().
DROP POLICY IF EXISTS "mat_kit_alteracoes_select" ON public.mat_kit_alteracoes;
DROP POLICY IF EXISTS "mat_kit_alteracoes_insert" ON public.mat_kit_alteracoes;
DROP POLICY IF EXISTS "mat_kit_alteracoes_delete" ON public.mat_kit_alteracoes;
CREATE POLICY "mat_kit_alteracoes_select" ON public.mat_kit_alteracoes FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_kit_alteracoes_insert" ON public.mat_kit_alteracoes FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pendente'
    AND (public.pode_validar_materiais() OR public.pode_editar_cadastro_materiais() OR public.pode_alterar_rota_materiais())
  );
CREATE POLICY "mat_kit_alteracoes_delete" ON public.mat_kit_alteracoes FOR DELETE TO authenticated
  USING (public.is_admin());

-- GRANTs explícitos (AGENTS.md §8). Nunca para anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_item_variacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_item_variacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_precos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_precos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_aliases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_contratos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_kit_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_kit_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_kit_alteracoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_kit_alteracoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_historico_consumo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_historico_consumo TO service_role;
-- Só service_role lê/escreve o segredo do link.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_contrato_acesso TO service_role;
-- Log: authenticated só lê (a policy restringe); escrita só service_role.
GRANT SELECT ON public.mat_acesso_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_acesso_log TO service_role;

-- View de preços vigentes (security_invoker: respeita a RLS de quem consulta).
-- Vigente = linha mais recente com vigente_desde <= hoje (Brasília) por
-- (item, variação). A variação, se tiver preço próprio, prevalece sobre o do
-- item (regra aplicada por mat_preco_vigente e pela lib do front).
CREATE OR REPLACE VIEW public.mat_precos_vigentes
WITH (security_invoker = true) AS
SELECT DISTINCT ON (item_id, variacao_id)
  id, item_id, variacao_id, fornecedor_id, preco, vigente_desde
FROM public.mat_precos
WHERE vigente_desde <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY item_id, variacao_id, vigente_desde DESC, created_at DESC;
GRANT SELECT ON public.mat_precos_vigentes TO authenticated;
GRANT SELECT ON public.mat_precos_vigentes TO service_role;

-- ============================================================
-- F) RPCs e funções
-- ============================================================

-- Preço vigente numa data: o da variação (se existir) prevalece sobre o do item.
CREATE OR REPLACE FUNCTION public.mat_preco_vigente(p_item uuid, p_variacao uuid, p_data date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT preco FROM (
    SELECT preco, 1 AS prioridade, vigente_desde, created_at
      FROM public.mat_precos
     WHERE item_id = p_item AND p_variacao IS NOT NULL AND variacao_id = p_variacao
       AND vigente_desde <= p_data
    UNION ALL
    SELECT preco, 2, vigente_desde, created_at
      FROM public.mat_precos
     WHERE item_id = p_item AND variacao_id IS NULL AND vigente_desde <= p_data
  ) x
  WHERE auth.uid() IS NULL OR public.pode_ver_materiais()  -- service_role (sem uid) ou quem vê o módulo
  ORDER BY prioridade, vigente_desde DESC, created_at DESC
  LIMIT 1;
$$;

-- Rota padrão do contrato (mesa e gestor).
CREATE OR REPLACE FUNCTION public.definir_rota_contrato(p_contrato uuid, p_rota smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_alterar_rota_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a rota do contrato';
  END IF;
  IF p_rota IS NOT NULL AND p_rota NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Rota inválida: %', p_rota;
  END IF;
  UPDATE public.mat_contratos SET rota = p_rota WHERE id = p_contrato;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
END $$;

-- Decisão de alteração de kit (gestor): aplica o upsert/remoção no kit na
-- mesma transação. quantidade_nova = 0 retira o item do kit.
CREATE OR REPLACE FUNCTION public.decidir_alteracao_kit(p_id uuid, p_aprovar boolean, p_comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a public.mat_kit_alteracoes%ROWTYPE;
BEGIN
  IF NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para decidir alterações de kit';
  END IF;
  SELECT * INTO a FROM public.mat_kit_alteracoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF a.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já decidida (%)', a.status;
  END IF;

  IF p_aprovar THEN
    IF a.quantidade_nova = 0 THEN
      DELETE FROM public.mat_kit_itens
       WHERE contrato_id = a.contrato_id AND item_id = a.item_id
         AND COALESCE(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(a.variacao_id, '00000000-0000-0000-0000-000000000000'::uuid);
    ELSE
      INSERT INTO public.mat_kit_itens (contrato_id, item_id, variacao_id, quantidade)
      VALUES (a.contrato_id, a.item_id, a.variacao_id, a.quantidade_nova)
      ON CONFLICT (contrato_id, item_id, (COALESCE(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      DO UPDATE SET quantidade = EXCLUDED.quantidade;
    END IF;
  END IF;

  UPDATE public.mat_kit_alteracoes
     SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
         decidido_por = auth.uid(), decidido_em = now(),
         comentario_decisao = p_comentario
   WHERE id = p_id;
END $$;

-- Situação dos links por contrato SEM expor token nem hash.
CREATE OR REPLACE FUNCTION public.mat_status_links()
RETURNS TABLE (contrato_id uuid, gerado_em timestamptz, gerado_por uuid, versao integer, ativo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_ver_materiais() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
    SELECT a.contrato_id, a.gerado_em, a.gerado_por, a.versao, a.ativo
      FROM public.mat_contrato_acesso a;
END $$;

REVOKE ALL ON FUNCTION public.mat_preco_vigente(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_rota_contrato(uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decidir_alteracao_kit(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mat_status_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_preco_vigente(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_rota_contrato(uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_alteracao_kit(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mat_status_links() TO authenticated;
