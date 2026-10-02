-- Migração 117: emissão de crachás (CEU → Crachás) + perfil dp3
--
-- PENDENTE DE APLICAÇÃO (escrita em 02/10/2026, ajustada com cargo_cracha; aplicar manualmente após backup).
--
-- Decisões da gestão:
--  1) Foto do colaborador passa a ficar no cadastro: coluna
--     colaboradores.foto_path + bucket PRIVADO `colaborador-fotos`
--     (jpeg/png/webp, 2 MB). Leitura só por URL assinada.
--     (O `foto_url` do tipo TS era fantasma — a coluna nunca existiu.)
--  2) Nome e função do crachá guardados à parte: colaboradores.nome_cracha e
--     colaboradores.cargo_cracha (nullable; NULL = usar o do cadastro).
--     nome_completo e cargo NUNCA são alterados pela tela de crachás.
--  3) Novo perfil `dp3` (estagiária que SÓ emite crachás). NÃO é "editor":
--     is_editor() continua sem incluí-lo, então ele não escreve em nenhuma
--     tabela. O que ele precisa:
--       - ler colaboradores/empresas/departamentos (pode_ver_* + dp3);
--       - ler/gravar fotos no bucket (pode_emitir_cracha());
--       - gravar nome_cracha/cargo_cracha/foto_path SOMENTE via RPC salvar_dados_cracha.
--     O logo por empresa fica em configuracoes.cracha_config (SELECT de
--     configuracoes é para qualquer autenticado; INSERT/UPDATE só is_editor():
--     admin/dp2/mesa trocam o logo, dp3 só usa).
--  4) Quem emite: admin/adm/dp2/mesa/dp3 — função pode_emitir_cracha().
--
-- Itens:
--  A) Nível dp3 em perfis.nivel_acesso (CHECK ou enum, o que existir)
--  B) Colunas foto_path, nome_cracha e cargo_cracha
--  C) pode_emitir_cracha() e RPC salvar_dados_cracha()
--  D) pode_ver_colaboradores/empresas/departamentos + dp3
--  E) Bucket colaborador-fotos + policies
--  F) Sementes em permissoes_perfil e reset_permissoes_perfil recriada
-- Não cria tabela — sem GRANT de tabela necessário.

-- ============================================================
-- A) Nível dp3 em perfis.nivel_acesso
-- (a tabela perfis nasceu fora das migrations; trata CHECK ou enum)
-- ============================================================
DO $$
DECLARE
  r record;
  v_udt text;
  v_enum boolean;
BEGIN
  SELECT c.udt_name INTO v_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'perfis' AND c.column_name = 'nivel_acesso';

  IF v_udt IS NULL THEN
    RAISE NOTICE 'perfis.nivel_acesso não encontrada — nada a fazer';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = v_udt AND n.nspname = 'public'
  ) INTO v_enum;

  IF v_enum THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', v_udt, 'dp3');
  ELSE
    FOR r IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.perfis'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%nivel_acesso%'
    LOOP
      EXECUTE format('ALTER TABLE public.perfis DROP CONSTRAINT %I', r.conname);
    END LOOP;

    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_nivel_acesso_check
      CHECK (nivel_acesso IN (
        'admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'dp3',
        'mesa', 'inspetoria', 'financeiro', 'visualizador'
      ));
  END IF;
END
$$;

-- ============================================================
-- B) Colunas no cadastro de colaboradores
-- ============================================================
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS foto_path text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS nome_cracha text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cargo_cracha text;

COMMENT ON COLUMN public.colaboradores.foto_path IS 'Caminho da foto 3x4 no bucket privado colaborador-fotos (leitura por URL assinada)';
COMMENT ON COLUMN public.colaboradores.nome_cracha IS 'Nome impresso no crachá (nome social/abreviado). NULL = usa nome_completo. Nunca substitui nome_completo.';
COMMENT ON COLUMN public.colaboradores.cargo_cracha IS 'Função impressa no crachá. NULL = usa cargo. Nunca substitui cargo.';

-- ============================================================
-- C) Autorização e RPC de gravação restrita
-- (comparações com ::text: se nivel_acesso for enum, o valor 'dp3' recém
--  adicionado ainda não pode ser usado como literal enum nesta transação)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_emitir_cracha()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso::text IN ('admin', 'adm', 'dp2', 'mesa', 'dp3')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_emitir_cracha() TO authenticated;

-- Grava SOMENTE nome_cracha, cargo_cracha e/ou foto_path. Flags indicam qual coluna tocar
-- (assim salvar o nome não zera a foto e vice-versa). Devolve false se o
-- colaborador não existe.
CREATE OR REPLACE FUNCTION public.salvar_dados_cracha(
  p_colaborador_id uuid,
  p_nome_cracha text DEFAULT NULL,
  p_foto_path text DEFAULT NULL,
  p_atualizar_nome boolean DEFAULT false,
  p_atualizar_foto boolean DEFAULT false,
  p_cargo_cracha text DEFAULT NULL,
  p_atualizar_cargo boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_cargo text;
  v_foto text;
  v_linhas integer;
BEGIN
  IF NOT public.pode_emitir_cracha() THEN
    RAISE EXCEPTION 'Sem permissão para emitir crachás';
  END IF;

  v_nome := NULLIF(btrim(COALESCE(p_nome_cracha, '')), '');
  v_cargo := NULLIF(btrim(COALESCE(p_cargo_cracha, '')), '');
  v_foto := NULLIF(btrim(COALESCE(p_foto_path, '')), '');

  IF v_nome IS NOT NULL AND char_length(v_nome) > 120 THEN
    RAISE EXCEPTION 'Nome do crachá longo demais (máximo 120 caracteres)';
  END IF;

  IF v_cargo IS NOT NULL AND char_length(v_cargo) > 120 THEN
    RAISE EXCEPTION 'Função do crachá longa demais (máximo 120 caracteres)';
  END IF;

  -- A foto só pode apontar para um arquivo do próprio colaborador (<id>.jpg)
  IF v_foto IS NOT NULL AND left(v_foto, char_length(p_colaborador_id::text) + 1) <> p_colaborador_id::text || '.' THEN
    RAISE EXCEPTION 'Caminho de foto inválido para este colaborador';
  END IF;

  IF NOT p_atualizar_nome AND NOT p_atualizar_foto AND NOT p_atualizar_cargo THEN
    RETURN false;
  END IF;

  UPDATE public.colaboradores
  SET nome_cracha = CASE WHEN p_atualizar_nome THEN v_nome ELSE nome_cracha END,
      cargo_cracha = CASE WHEN p_atualizar_cargo THEN v_cargo ELSE cargo_cracha END,
      foto_path = CASE WHEN p_atualizar_foto THEN v_foto ELSE foto_path END
  WHERE id = p_colaborador_id;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas > 0;
END;
$$;

-- Assinatura antiga (5 args, se a 117 chegou a ser aplicada antes do ajuste) sai do caminho
DROP FUNCTION IF EXISTS public.salvar_dados_cracha(uuid, text, text, boolean, boolean);

GRANT EXECUTE ON FUNCTION public.salvar_dados_cracha(uuid, text, text, boolean, boolean, text, boolean) TO authenticated;

-- ============================================================
-- D) Leitura para o dp3 (só linhas; escrita continua só is_editor())
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_ver_colaboradores()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso::text IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'dp3', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_empresas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso::text IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'dp3', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_departamentos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso::text IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'dp3', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_colaboradores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_empresas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_departamentos() TO authenticated;

-- ============================================================
-- E) Bucket privado de fotos + policies (mesmo desenho da 094)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'colaborador-fotos',
  'colaborador-fotos',
  false,
  2097152, -- 2 MB (o app já reduz para ~600 px antes de enviar)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Emissores podem ler colaborador-fotos" ON storage.objects;
CREATE POLICY "Emissores podem ler colaborador-fotos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'colaborador-fotos' AND public.pode_emitir_cracha());

DROP POLICY IF EXISTS "Emissores podem inserir colaborador-fotos" ON storage.objects;
CREATE POLICY "Emissores podem inserir colaborador-fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'colaborador-fotos' AND public.pode_emitir_cracha());

DROP POLICY IF EXISTS "Emissores podem atualizar colaborador-fotos" ON storage.objects;
CREATE POLICY "Emissores podem atualizar colaborador-fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'colaborador-fotos' AND public.pode_emitir_cracha())
WITH CHECK (bucket_id = 'colaborador-fotos' AND public.pode_emitir_cracha());

DROP POLICY IF EXISTS "Apenas admins podem deletar colaborador-fotos" ON storage.objects;
CREATE POLICY "Apenas admins podem deletar colaborador-fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'colaborador-fotos' AND public.is_admin());

-- ============================================================
-- F) Sementes em permissoes_perfil (espelham PERMISSOES_PADRAO:
--    ceu.emitir_cracha = dp2/mesa/dp3; admin/adm passam sempre).
--    O guard da rota /ceu/crachas lê ceu.emitir_cracha (dinâmico). O item
--    "Crachás" do menu lateral lê menu.crachas e só aparece para quem NÃO
--    tem acesso ao CEU (dp3); dp2/mesa usam a aba Crachás dentro do CEU.
-- ============================================================
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  ('dp2', 'ceu', 'emitir_cracha', true),
  ('mesa', 'ceu', 'emitir_cracha', true),
  ('dp3', 'ceu', 'emitir_cracha', true),
  ('dp3', 'menu', 'crachas', true),
  ('dp3', 'menu', 'dashboard', false)
ON CONFLICT (perfil, recurso, acao) DO UPDATE SET permitido = EXCLUDED.permitido;

-- reset_permissoes_perfil recriada: idêntica à 115 + linha emitir_cracha
-- em dp2/mesa + bloco novo do dp3 (senão "Restaurar padrão" revogaria).
CREATE OR REPLACE FUNCTION public.reset_permissoes_perfil(p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas administradores podem executar esta função
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar permissões';
  END IF;

  IF p_perfil IS NULL OR p_perfil = '' THEN
    RAISE EXCEPTION 'Perfil não informado';
  END IF;

  -- Remove as permissões atuais do perfil
  DELETE FROM public.permissoes_perfil
  WHERE perfil = p_perfil;

  -- ============================================================
  -- ADM / ADMIN: acesso total
  -- ============================================================
  IF p_perfil IN ('adm', 'admin') THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('adm', 'todos', 'todos', true),
      ('admin', 'todos', 'todos', true),
      ('adm', 'menu', 'todos', true),
      ('admin', 'menu', 'todos', true),
      ('adm', 'rota', 'todos', true),
      ('admin', 'rota', 'todos', true);
    RETURN;
  END IF;

  -- ============================================================
  -- VISUALIZADOR
  -- ============================================================
  IF p_perfil = 'visualizador' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('visualizador', 'dashboard', 'ver', true),
      ('visualizador', 'colaboradores', 'ver', true),
      ('visualizador', 'empresas', 'ver', true),
      ('visualizador', 'departamentos', 'ver', true),
      ('visualizador', 'extras', 'ver_balanco', true),
      ('visualizador', 'menu', 'dashboard', true),
      ('visualizador', 'menu', 'colaboradores', true),
      ('visualizador', 'menu', 'empresas', true),
      ('visualizador', 'menu', 'departamentos', true),
      ('visualizador', 'menu', 'relatorios', true),
      ('visualizador', 'menu', 'ferias', true),
      ('visualizador', 'rota', 'empresas', true),
      ('visualizador', 'rota', 'departamentos', true),
      ('visualizador', 'rota', 'colaboradores', true),
      ('visualizador', 'rota', 'relatorios', true),
      ('visualizador', 'rota', 'ferias', true),
      ('visualizador', 'rota', 'mobile_falta', true),
      ('visualizador', 'menu', 'escalas', true),
      ('visualizador', 'rota', 'escalas', true),
      ('visualizador', 'escala', 'visualizar', true),
      ('visualizador', 'menu', 'bi', false),
      ('visualizador', 'rota', 'bi', false),
      ('visualizador', 'ocorrencia', 'validar', false);
    RETURN;
  END IF;

  -- ============================================================
  -- GESTOR
  -- ============================================================
  IF p_perfil = 'gestor' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('gestor', 'empresa', 'editar', true),
      ('gestor', 'departamento', 'editar', true),
      ('gestor', 'departamento', 'excluir', true),
      ('gestor', 'departamento', 'importar', true),
      ('gestor', 'colaborador', 'editar_basico', true),
      ('gestor', 'colaborador', 'editar_completo', true),
      ('gestor', 'colaborador', 'exportar', true),
      ('gestor', 'ocorrencia', 'criar', true),
      ('gestor', 'ocorrencia', 'editar', true),
      ('gestor', 'ocorrencia', 'cancelar', true),
      ('gestor', 'ocorrencia', 'ver_detalhes', true),
      ('gestor', 'ocorrencia', 'aprovar', true),
      ('gestor', 'ocorrencia', 'anexar', true),
      ('gestor', 'ocorrencia', 'adicionar_testemunha', true),
      ('gestor', 'ocorrencia', 'gerar_pdf', true),
      ('gestor', 'adicionais', 'editar_contrato', true),
      ('gestor', 'adicionais', 'ver_relatorio', false),
      ('gestor', 'auditoria', 'ver', true),
      ('gestor', 'configuracoes', 'ver', true),
      ('gestor', 'menu', 'dashboard', true),
      ('gestor', 'menu', 'colaboradores', true),
      ('gestor', 'menu', 'empresas', true),
      ('gestor', 'menu', 'departamentos', true),
      ('gestor', 'menu', 'rh', true),
      ('gestor', 'menu', 'ceu', true),
      ('gestor', 'menu', 'adicionais', true),
      ('gestor', 'menu', 'configuracoes', true),
      ('gestor', 'menu', 'auditoria', true),
      ('gestor', 'menu', 'relatorios', true),
      ('gestor', 'menu', 'ferias', true),
      ('gestor', 'rota', 'empresas', true),
      ('gestor', 'rota', 'departamentos', true),
      ('gestor', 'rota', 'colaboradores', true),
      ('gestor', 'rota', 'ocorrencias', true),
      ('gestor', 'rota', 'ceu', true),
      ('gestor', 'rota', 'adicionais', true),
      ('gestor', 'rota', 'configuracoes', true),
      ('gestor', 'rota', 'auditoria', true),
      ('gestor', 'rota', 'relatorios', true),
      ('gestor', 'rota', 'ferias', true),
      ('gestor', 'rota', 'mobile_falta', true),
      ('gestor', 'menu', 'escalas', true),
      ('gestor', 'rota', 'escalas', true),
      ('gestor', 'escala', 'visualizar', true),
      ('gestor', 'escala', 'editar_local', true),
      ('gestor', 'escala', 'mapear_flit', true),
      ('gestor', 'escala', 'importar', true),
      ('gestor', 'escala', 'confirmar_manual', true),
      ('gestor', 'escala', 'editar_dia', true),
      ('gestor', 'menu', 'bi', true),
      ('gestor', 'rota', 'bi', true),
      ('gestor', 'ocorrencia', 'validar', false);
    RETURN;
  END IF;

  -- ============================================================
  -- RH
  -- ============================================================
  IF p_perfil = 'rh' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('rh', 'colaborador', 'editar_basico', true),
      ('rh', 'colaborador', 'editar_completo', true),
      ('rh', 'colaborador', 'cadastrar', true),
      ('rh', 'colaborador', 'exportar', true),
      ('rh', 'departamento', 'importar', true),
      ('rh', 'ocorrencia', 'criar', true),
      ('rh', 'ocorrencia', 'editar', true),
      ('rh', 'ocorrencia', 'cancelar', true),
      ('rh', 'ocorrencia', 'ver_detalhes', true),
      ('rh', 'ocorrencia', 'aprovar', true),
      ('rh', 'ocorrencia', 'anexar', true),
      ('rh', 'ocorrencia', 'adicionar_testemunha', true),
      ('rh', 'ocorrencia', 'gerar_pdf', true),
      ('rh', 'ocorrencia', 'gerenciar_modelos', true),
      ('rh', 'menu', 'dashboard', true),
      ('rh', 'menu', 'colaboradores', true),
      ('rh', 'menu', 'empresas', true),
      ('rh', 'menu', 'departamentos', true),
      ('rh', 'menu', 'rh', true),
      ('rh', 'menu', 'relatorios', true),
      ('rh', 'menu', 'ferias', true),
      ('rh', 'rota', 'empresas', true),
      ('rh', 'rota', 'departamentos', true),
      ('rh', 'rota', 'colaboradores', true),
      ('rh', 'rota', 'ocorrencias', true),
      ('rh', 'rota', 'relatorios', true),
      ('rh', 'rota', 'ferias', true),
      ('rh', 'rota', 'mobile_falta', true),
      ('rh', 'menu', 'escalas', true),
      ('rh', 'rota', 'escalas', true),
      ('rh', 'escala', 'visualizar', true),
      ('rh', 'escala', 'editar_local', true),
      ('rh', 'escala', 'mapear_flit', true),
      ('rh', 'escala', 'importar', true),
      ('rh', 'escala', 'confirmar_manual', true),
      ('rh', 'escala', 'editar_dia', true),
      ('rh', 'menu', 'bi', false),
      ('rh', 'rota', 'bi', false),
      ('rh', 'ocorrencia', 'validar', false);
    RETURN;
  END IF;

  -- ============================================================
  -- DP1
  -- ============================================================
  IF p_perfil = 'dp1' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp1', 'empresa', 'editar', true),
      ('dp1', 'departamento', 'editar', true),
      ('dp1', 'colaborador', 'editar_basico', true),
      ('dp1', 'colaborador', 'editar_completo', true),
      ('dp1', 'colaborador', 'cadastrar', true),
      ('dp1', 'colaborador', 'excluir', true),
      ('dp1', 'colaborador', 'importar', true),
      ('dp1', 'colaborador', 'exportar', true),
      ('dp1', 'departamento', 'importar', true),
      ('dp1', 'econtador', 'gerenciar', true),
      ('dp1', 'ocorrencia', 'criar', true),
      ('dp1', 'ocorrencia', 'editar', true),
      ('dp1', 'ocorrencia', 'cancelar', true),
      ('dp1', 'ocorrencia', 'ver_detalhes', true),
      ('dp1', 'ocorrencia', 'aprovar', true),
      ('dp1', 'ocorrencia', 'anexar', true),
      ('dp1', 'ocorrencia', 'adicionar_testemunha', true),
      ('dp1', 'ocorrencia', 'gerar_pdf', true),
      ('dp1', 'ocorrencia', 'gerenciar_modelos', true),
      ('dp1', 'alertas', 'gerenciar', true),
      ('dp1', 'vr', 'visualizar', true),
      ('dp1', 'extras', 'gerenciar_recibo', true),
      ('dp1', 'adicionais', 'ver_relatorio', true),
      ('dp1', 'menu', 'dashboard', true),
      ('dp1', 'menu', 'colaboradores', true),
      ('dp1', 'menu', 'empresas', true),
      ('dp1', 'menu', 'departamentos', true),
      ('dp1', 'menu', 'rh', true),
      ('dp1', 'menu', 'extras', true),
      ('dp1', 'menu', 'vr', true),
      ('dp1', 'menu', 'ceu', true),
      ('dp1', 'menu', 'adicionais', true),
      ('dp1', 'menu', 'alertas', true),
      ('dp1', 'menu', 'relatorios', true),
      ('dp1', 'menu', 'ferias', true),
      ('dp1', 'rota', 'empresas', true),
      ('dp1', 'rota', 'departamentos', true),
      ('dp1', 'rota', 'colaboradores', true),
      ('dp1', 'rota', 'ocorrencias', true),
      ('dp1', 'rota', 'extras', true),
      ('dp1', 'rota', 'vr', true),
      ('dp1', 'rota', 'ceu', true),
      ('dp1', 'rota', 'adicionais', true),
      ('dp1', 'rota', 'importar_econtador', true),
      ('dp1', 'rota', 'alertas', true),
      ('dp1', 'rota', 'relatorios', true),
      ('dp1', 'rota', 'ferias', true),
      ('dp1', 'rota', 'mobile_falta', true),
      ('dp1', 'menu', 'escalas', true),
      ('dp1', 'rota', 'escalas', true),
      ('dp1', 'escala', 'visualizar', true),
      ('dp1', 'escala', 'editar_local', true),
      ('dp1', 'escala', 'mapear_flit', true),
      ('dp1', 'escala', 'importar', true),
      ('dp1', 'escala', 'confirmar_manual', true),
      ('dp1', 'escala', 'editar_dia', true),
      ('dp1', 'menu', 'bi', false),
      ('dp1', 'rota', 'bi', false),
      ('dp1', 'ocorrencia', 'validar', true);
    RETURN;
  END IF;

  -- ============================================================
  -- DP2
  -- ============================================================
  IF p_perfil = 'dp2' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp2', 'empresa', 'editar', true),
      ('dp2', 'departamento', 'editar', true),
      ('dp2', 'colaborador', 'editar_basico', true),
      ('dp2', 'colaborador', 'editar_completo', true),
      ('dp2', 'colaborador', 'cadastrar', true),
      ('dp2', 'colaborador', 'excluir', true),
      ('dp2', 'colaborador', 'importar', true),
      ('dp2', 'colaborador', 'exportar', true),
      ('dp2', 'departamento', 'importar', true),
      ('dp2', 'econtador', 'gerenciar', true),
      ('dp2', 'configuracoes', 'configurar_token', true),
      ('dp2', 'ocorrencia', 'criar', true),
      ('dp2', 'ocorrencia', 'editar', true),
      ('dp2', 'ocorrencia', 'ver_detalhes', true),
      ('dp2', 'ocorrencia', 'aprovar', true),
      ('dp2', 'ocorrencia', 'anexar', true),
      ('dp2', 'ocorrencia', 'adicionar_testemunha', true),
      ('dp2', 'ocorrencia', 'gerar_pdf', true),
      ('dp2', 'ocorrencia', 'gerenciar_modelos', true),
      ('dp2', 'vr', 'visualizar', true),
      ('dp2', 'vr', 'gerenciar', true),
      ('dp2', 'adicionais', 'editar_contrato', true),
      ('dp2', 'adicionais', 'editar_vinculo', true),
      ('dp2', 'adicionais', 'editar_calendario', true),
      ('dp2', 'adicionais', 'ver_relatorio', true),
      ('dp2', 'extras', 'gerenciar_recibo', true),
      ('dp2', 'menu', 'dashboard', true),
      ('dp2', 'menu', 'colaboradores', true),
      ('dp2', 'menu', 'empresas', true),
      ('dp2', 'menu', 'departamentos', true),
      ('dp2', 'menu', 'rh', true),
      ('dp2', 'menu', 'extras', true),
      ('dp2', 'menu', 'vr', true),
      ('dp2', 'menu', 'ceu', true),
      ('dp2', 'menu', 'adicionais', true),
      ('dp2', 'menu', 'configuracoes', true),
      ('dp2', 'menu', 'relatorios', true),
      ('dp2', 'menu', 'ferias', true),
      ('dp2', 'rota', 'empresas', true),
      ('dp2', 'rota', 'departamentos', true),
      ('dp2', 'rota', 'colaboradores', true),
      ('dp2', 'rota', 'ocorrencias', true),
      ('dp2', 'rota', 'extras', true),
      ('dp2', 'rota', 'vr', true),
      ('dp2', 'rota', 'ceu', true),
      ('dp2', 'rota', 'adicionais', true),
      ('dp2', 'rota', 'importar_econtador', true),
      ('dp2', 'rota', 'configuracoes', true),
      ('dp2', 'rota', 'relatorios', true),
      ('dp2', 'rota', 'ferias', true),
      ('dp2', 'rota', 'mobile_falta', true),
      ('dp2', 'menu', 'escalas', true),
      ('dp2', 'rota', 'escalas', true),
      ('dp2', 'escala', 'visualizar', true),
      ('dp2', 'escala', 'editar_local', true),
      ('dp2', 'escala', 'mapear_flit', true),
      ('dp2', 'escala', 'importar', true),
      ('dp2', 'escala', 'confirmar_manual', true),
      ('dp2', 'escala', 'editar_dia', true),
      ('dp2', 'menu', 'bi', false),
      ('dp2', 'rota', 'bi', false),
      ('dp2', 'ocorrencia', 'validar', true),
      ('dp2', 'ceu', 'emitir_cracha', true);
    RETURN;
  END IF;

  -- ============================================================
  -- MESA
  -- ============================================================
  IF p_perfil = 'mesa' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('mesa', 'colaborador', 'editar_basico', true),
      ('mesa', 'colaborador', 'exportar', true),
      ('mesa', 'departamento', 'editar', true),
      ('mesa', 'departamento', 'importar', true),
      ('mesa', 'ocorrencia', 'criar', true),
      ('mesa', 'ocorrencia', 'editar', true),
      ('mesa', 'ocorrencia', 'cancelar', true),
      ('mesa', 'ocorrencia', 'ver_detalhes', true),
      ('mesa', 'ocorrencia', 'anexar', true),
      ('mesa', 'ocorrencia', 'adicionar_testemunha', true),
      ('mesa', 'ocorrencia', 'gerar_pdf', true),
      ('mesa', 'extras', 'editar', true),
      ('mesa', 'extras', 'editar_categoria', true),
      ('mesa', 'extras', 'excluir_categoria', true),
      ('mesa', 'extras', 'gerenciar_recibo', true),
      ('mesa', 'extras', 'ver_relatorio', true),
      ('mesa', 'adicionais', 'editar_contrato', true),
      ('mesa', 'adicionais', 'editar_vinculo', true),
      ('mesa', 'adicionais', 'editar_calendario', true),
      ('mesa', 'extras', 'enviar_comunicacao', true),
      ('mesa', 'extras', 'ver_balanco', true),
      ('mesa', 'menu', 'dashboard', true),
      ('mesa', 'menu', 'colaboradores', true),
      ('mesa', 'menu', 'empresas', true),
      ('mesa', 'menu', 'departamentos', true),
      ('mesa', 'menu', 'rh', true),
      ('mesa', 'menu', 'extras', true),
      ('mesa', 'menu', 'ceu', true),
      ('mesa', 'menu', 'adicionais', true),
      ('mesa', 'menu', 'relatorios', true),
      ('mesa', 'menu', 'ferias', true),
      ('mesa', 'rota', 'empresas', true),
      ('mesa', 'rota', 'departamentos', true),
      ('mesa', 'rota', 'colaboradores', true),
      ('mesa', 'rota', 'ocorrencias', true),
      ('mesa', 'rota', 'extras', true),
      ('mesa', 'rota', 'ceu', true),
      ('mesa', 'rota', 'adicionais', true),
      ('mesa', 'rota', 'relatorios', true),
      ('mesa', 'rota', 'ferias', true),
      ('mesa', 'rota', 'mobile_falta', true),
      ('mesa', 'menu', 'escalas', true),
      ('mesa', 'rota', 'escalas', true),
      ('mesa', 'escala', 'visualizar', true),
      ('mesa', 'escala', 'confirmar_manual', true),
      ('mesa', 'escala', 'editar_dia', true),
      ('mesa', 'menu', 'bi', true),
      ('mesa', 'rota', 'bi', true),
      ('mesa', 'ocorrencia', 'validar', false),
      ('mesa', 'ceu', 'emitir_cracha', true);
    RETURN;
  END IF;

  -- ============================================================
  -- INSPETORIA
  -- ============================================================
  IF p_perfil = 'inspetoria' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('inspetoria', 'ocorrencia', 'ver_detalhes', true),
      ('inspetoria', 'ocorrencia', 'anexar', true),
      ('inspetoria', 'ocorrencia', 'adicionar_testemunha', true),
      ('inspetoria', 'ocorrencia', 'gerar_pdf', true),
      ('inspetoria', 'extras', 'editar', true),
      ('inspetoria', 'extras', 'editar_categoria', true),
      ('inspetoria', 'extras', 'enviar_comunicacao', true),
      ('inspetoria', 'extras', 'ver_balanco', true),
      ('inspetoria', 'menu', 'dashboard', true),
      ('inspetoria', 'menu', 'colaboradores', true),
      ('inspetoria', 'menu', 'departamentos', true),
      ('inspetoria', 'menu', 'rh', true),
      ('inspetoria', 'menu', 'extras', true),
      ('inspetoria', 'menu', 'ceu', true),
      ('inspetoria', 'menu', 'relatorios', true),
      ('inspetoria', 'menu', 'ferias', true),
      ('inspetoria', 'rota', 'departamentos', true),
      ('inspetoria', 'rota', 'colaboradores', true),
      ('inspetoria', 'rota', 'ocorrencias', true),
      ('inspetoria', 'rota', 'extras', true),
      ('inspetoria', 'rota', 'ceu', true),
      ('inspetoria', 'rota', 'relatorios', true),
      ('inspetoria', 'rota', 'ferias', true),
      ('inspetoria', 'rota', 'mobile_falta', true),
      ('inspetoria', 'menu', 'escalas', true),
      ('inspetoria', 'rota', 'escalas', true),
      ('inspetoria', 'escala', 'visualizar', true),
      ('inspetoria', 'menu', 'bi', true),
      ('inspetoria', 'rota', 'bi', true),
      ('inspetoria', 'ocorrencia', 'validar', false);
    RETURN;
  END IF;

  -- ============================================================
  -- FINANCEIRO
  -- ============================================================
  IF p_perfil = 'financeiro' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('financeiro', 'empresa', 'editar', true),
      ('financeiro', 'departamento', 'editar', true),
      ('financeiro', 'departamento', 'excluir', true),
      ('financeiro', 'colaborador', 'exportar', true),
      ('financeiro', 'adicionais', 'editar_contrato', true),
      ('financeiro', 'adicionais', 'ver_relatorio', true),
      ('financeiro', 'extras', 'editar_categoria', true),
      ('financeiro', 'extras', 'excluir_categoria', true),
      ('financeiro', 'extras', 'gerenciar_recibo', true),
      ('financeiro', 'extras', 'marcar_pago', true),
      ('financeiro', 'extras', 'cancelar_recibo', true),
      ('financeiro', 'extras', 'ver_relatorio', true),
      ('financeiro', 'extras', 'ver_balanco', true),
      ('financeiro', 'menu', 'dashboard', true),
      ('financeiro', 'menu', 'colaboradores', true),
      ('financeiro', 'menu', 'empresas', true),
      ('financeiro', 'menu', 'departamentos', true),
      ('financeiro', 'menu', 'extras', true),
      ('financeiro', 'menu', 'adicionais', true),
      ('financeiro', 'menu', 'relatorios', true),
      ('financeiro', 'menu', 'ferias', true),
      ('financeiro', 'rota', 'empresas', true),
      ('financeiro', 'rota', 'departamentos', true),
      ('financeiro', 'rota', 'colaboradores', true),
      ('financeiro', 'rota', 'extras', true),
      ('financeiro', 'rota', 'adicionais', true),
      ('financeiro', 'rota', 'relatorios', true),
      ('financeiro', 'rota', 'ferias', true),
      ('financeiro', 'rota', 'mobile_falta', true),
      ('financeiro', 'menu', 'escalas', true),
      ('financeiro', 'rota', 'escalas', true),
      ('financeiro', 'escala', 'visualizar', true),
      ('financeiro', 'menu', 'bi', false),
      ('financeiro', 'rota', 'bi', false),
      ('financeiro', 'ocorrencia', 'validar', false);
    RETURN;
  END IF;

  -- ============================================================
  -- DP3 (estagiária — SÓ emite crachás; ver migration 117)
  -- ============================================================
  IF p_perfil = 'dp3' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp3', 'ceu', 'emitir_cracha', true),
      ('dp3', 'menu', 'crachas', true),
      ('dp3', 'menu', 'dashboard', false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Perfil desconhecido: %', p_perfil;
END;
$$;

-- Permite que usuários autenticados chamem a função (a função interna valida se é admin)
GRANT EXECUTE ON FUNCTION public.reset_permissoes_perfil(text) TO authenticated;
