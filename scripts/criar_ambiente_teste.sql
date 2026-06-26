-- Adiciona campos necessários ao dashboard e alertas do módulo CEU

ALTER TABLE itens
  ADD COLUMN IF NOT EXISTS estoque integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_uso_dias integer;

COMMENT ON COLUMN itens.estoque IS 'Quantidade atual em estoque';
COMMENT ON COLUMN itens.estoque_minimo IS 'Quantidade mínima para alerta de estoque baixo';
COMMENT ON COLUMN itens.prazo_uso_dias IS 'Prazo máximo de uso do item em dias (para alerta de prazo de uso)';

-- Adiciona campos de tamanho de uniforme para integração CEU

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS tamanho_camisa text,
  ADD COLUMN IF NOT EXISTS tamanho_calca text,
  ADD COLUMN IF NOT EXISTS tamanho_calcado text;

COMMENT ON COLUMN colaboradores.tamanho_camisa IS 'Tamanho da camisa/uniforme superior (módulo CEU)';
COMMENT ON COLUMN colaboradores.tamanho_calca IS 'Tamanho da calça/uniforme inferior (módulo CEU)';
COMMENT ON COLUMN colaboradores.tamanho_calcado IS 'Tamanho do calçado (módulo CEU)';
create table if not exists public.historico_importacoes_econtador (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete set null,
  empresa_id text,
  empresa_nome text,
  quantidade integer not null default 0,
  importados integer not null default 0,
  atualizados integer not null default 0,
  erros integer not null default 0,
  created_at timestamp with time zone default now()
);

alter table public.historico_importacoes_econtador enable row level security;

-- Policies não suportam IF NOT EXISTS; usamos DROP IF EXISTS antes de criar.
drop policy if exists "Usuários autenticados podem inserir próprio histórico" on public.historico_importacoes_econtador;
drop policy if exists "Usuários autenticados podem ler próprio histórico" on public.historico_importacoes_econtador;

create policy "Usuários autenticados podem inserir próprio histórico"
  on public.historico_importacoes_econtador
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy "Usuários autenticados podem ler próprio histórico"
  on public.historico_importacoes_econtador
  for select
  to authenticated
  using (auth.uid() = usuario_id);
create table if not exists public.contratos_adicionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  departamento_id uuid references public.departamentos(id) on delete set null,
  adicionais jsonb not null default '{}'::jsonb,
  dias_intrajornada integer[] not null default '{}'::integer[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.vinculos_adicionais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos_adicionais(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.calendario_adicionais (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculos_adicionais(id) on delete cascade,
  data date not null,
  status text not null default 'trabalhou',
  intrajornada boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (vinculo_id, data)
);

alter table public.contratos_adicionais enable row level security;
alter table public.vinculos_adicionais enable row level security;
alter table public.calendario_adicionais enable row level security;

-- Policies não suportam IF NOT EXISTS; usamos DROP IF EXISTS antes de criar.
drop policy if exists "Usuários autenticados podem ler contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem inserir contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem atualizar contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem deletar contratos" on public.contratos_adicionais;

create policy "Usuários autenticados podem ler contratos"
  on public.contratos_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir contratos"
  on public.contratos_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar contratos"
  on public.contratos_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar contratos"
  on public.contratos_adicionais for delete to authenticated using (true);

drop policy if exists "Usuários autenticados podem ler vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem inserir vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem atualizar vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem deletar vínculos" on public.vinculos_adicionais;

create policy "Usuários autenticados podem ler vínculos"
  on public.vinculos_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir vínculos"
  on public.vinculos_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar vínculos"
  on public.vinculos_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar vínculos"
  on public.vinculos_adicionais for delete to authenticated using (true);

drop policy if exists "Usuários autenticados podem ler calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem inserir calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem atualizar calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem deletar calendário" on public.calendario_adicionais;

create policy "Usuários autenticados podem ler calendário"
  on public.calendario_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir calendário"
  on public.calendario_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar calendário"
  on public.calendario_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar calendário"
  on public.calendario_adicionais for delete to authenticated using (true);
alter table public.departamentos
add column if not exists endereco text,
add column if not exists nome_contato text,
add column if not exists telefone_contato text,
add column if not exists email_contato text,
add column if not exists status text not null default 'Ativo';
-- Garante que a tabela de departamentos existe com todos os campos esperados
-- e habilita RLS para que usuários autenticados possam gerenciar registros.

create table if not exists public.departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa_id uuid,
  endereco text,
  nome_contato text,
  telefone_contato text,
  email_contato text,
  status text not null default 'Ativo',
  created_at timestamp with time zone default now()
);

-- Adiciona as colunas caso a tabela já exista sem elas
alter table public.departamentos
add column if not exists endereco text,
add column if not exists nome_contato text,
add column if not exists telefone_contato text,
add column if not exists email_contato text,
add column if not exists status text not null default 'Ativo';

alter table public.departamentos enable row level security;

-- Policies não suportam IF NOT EXISTS; usamos DROP IF EXISTS antes de criar.
drop policy if exists "Usuários autenticados podem ler departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem inserir departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem atualizar departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem deletar departamentos" on public.departamentos;

create policy "Usuários autenticados podem ler departamentos"
  on public.departamentos
  for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem inserir departamentos"
  on public.departamentos
  for insert
  to authenticated
  with check (true);

create policy "Usuários autenticados podem atualizar departamentos"
  on public.departamentos
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados podem deletar departamentos"
  on public.departamentos
  for delete
  to authenticated
  using (true);
alter table public.departamentos
add column if not exists nome_curto text;
alter table public.calendario_adicionais
  add column if not exists substituto_colaborador_id uuid references public.colaboradores(id) on delete set null,
  add column if not exists substituto_colaborador_nome text;
alter table public.departamentos
add column if not exists contato_portaria text,
add column if not exists nome_contato_2 text,
add column if not exists telefone_contato_2 text,
add column if not exists email_contato_2 text;
alter table public.departamentos
add column if not exists bairro text,
add column if not exists cidade text,
add column if not exists estado text,
add column if not exists cep text;
-- Migração 010: Row Level Security (RLS) para tabelas de negócio
-- Contexto: uma única equipe gerencia todas as empresas do grupo.
-- Objetivo: permitir leitura/escrita livre para usuários autenticados,
-- mas restringir DELETE apenas a administradores.
--
-- Esta migração verifica se cada tabela existe antes de aplicar as policies,
-- evitando erros quando o schema ainda não possui determinadas tabelas.

-- Função auxiliar: verifica se o usuário logado é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- A função aplicar_rls_admin é um utilitário interno da migration.
-- Ela NÃO deve ser executada por usuários autenticados, por isso
-- não recebe GRANT EXECUTE para authenticated.
-- A migration 013 a remove do banco após a execução bem-sucedida.

-- Função auxiliar: aplica RLS e policies de forma segura em uma tabela
CREATE OR REPLACE FUNCTION public.aplicar_rls_admin(p_tabela TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tabela TEXT := p_tabela;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_tabela
  ) THEN
    -- Habilita RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    -- Remove policies antigas caso existam
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

    -- Cria policies
    EXECUTE format(
      'CREATE POLICY "Permitir select para autenticados" ON public.%I FOR SELECT TO authenticated USING (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir insert para autenticados" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir update para autenticados" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir delete apenas para admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
      v_tabela
    );
  END IF;
END;
$$;

-- NOTA: a função aplicar_rls_admin não deve ser executada por usuários autenticados,
-- pois possui SECURITY DEFINER e permite alterar policies/RLS. Ela é removida
-- pela migration 013 após a execução bem-sucedida desta migration.
-- ============================================================
-- Aplica RLS nas tabelas de negócio (apenas se existirem)
-- ============================================================

SELECT public.aplicar_rls_admin('empresas');
SELECT public.aplicar_rls_admin('colaboradores');
SELECT public.aplicar_rls_admin('departamentos');
SELECT public.aplicar_rls_admin('perfis');
SELECT public.aplicar_rls_admin('configuracoes');
SELECT public.aplicar_rls_admin('ocorrencias');
SELECT public.aplicar_rls_admin('ocorrencia_anexos');
SELECT public.aplicar_rls_admin('ocorrencia_testemunhas');
SELECT public.aplicar_rls_admin('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_admin('ocorrencia_defesas');
SELECT public.aplicar_rls_admin('alertas');
SELECT public.aplicar_rls_admin('modelos_ocorrencia');
SELECT public.aplicar_rls_admin('auditoria');
SELECT public.aplicar_rls_admin('projetos_vr');
SELECT public.aplicar_rls_admin('resultados_vr');
SELECT public.aplicar_rls_admin('fornecedores');
SELECT public.aplicar_rls_admin('itens');
SELECT public.aplicar_rls_admin('entregas');
SELECT public.aplicar_rls_admin('contratos_adicionais');
SELECT public.aplicar_rls_admin('vinculos_adicionais');
SELECT public.aplicar_rls_admin('calendario_adicionais');
SELECT public.aplicar_rls_admin('log_auditoria');

-- ============================================================
-- Tabela com regra específica: histórico de importações
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'historico_importacoes_econtador'
  ) THEN
    ALTER TABLE public.historico_importacoes_econtador ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Usuários veem próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Usuários inserem próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Usuários atualizam próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Apenas admins deletam histórico" ON public.historico_importacoes_econtador;

    CREATE POLICY "Usuários veem próprio histórico" ON public.historico_importacoes_econtador
      FOR SELECT TO authenticated USING (usuario_id = auth.uid());

    CREATE POLICY "Usuários inserem próprio histórico" ON public.historico_importacoes_econtador
      FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

    CREATE POLICY "Usuários atualizam próprio histórico" ON public.historico_importacoes_econtador
      FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

    CREATE POLICY "Apenas admins deletam histórico" ON public.historico_importacoes_econtador
      FOR DELETE TO authenticated USING (usuario_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- Limpa as funções auxiliares se desejar (descomente abaixo após execução bem-sucedida)
-- DROP FUNCTION IF EXISTS public.aplicar_rls_admin(TEXT);
-- Migração 011: Row Level Security (RLS) nos storage buckets
--
-- Protege os buckets de arquivos contra acesso, upload e remoção indevidos.
-- Como a mesma equipe gerencia todas as empresas, autenticados podem ler/upload.
-- DELETE restrito a administradores.
--
-- Pré-requisito: migração 010 (função public.is_admin() deve existir).

-- ============================================================
-- Bucket: ocorrencia-anexos
-- ============================================================

-- Torna o bucket privado (caso exista)
UPDATE storage.buckets
SET public = false
WHERE id = 'ocorrencia-anexos';

-- Cria policies apenas se o bucket existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Autenticados podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos" ON storage.objects;

    CREATE POLICY "Autenticados podem ler anexos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Autenticados podem inserir anexos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Autenticados podem atualizar anexos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'ocorrencia-anexos')
    WITH CHECK (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Apenas admins podem deletar anexos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_admin()
    );
  END IF;
END $$;

-- ============================================================
-- Bucket: vr-arquivos
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'vr-arquivos';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    DROP POLICY IF EXISTS "Autenticados podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos" ON storage.objects;

    CREATE POLICY "Autenticados podem ler vr-arquivos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'vr-arquivos');

    CREATE POLICY "Autenticados podem inserir vr-arquivos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vr-arquivos');

    CREATE POLICY "Autenticados podem atualizar vr-arquivos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'vr-arquivos')
    WITH CHECK (bucket_id = 'vr-arquivos');

    CREATE POLICY "Apenas admins podem deletar vr-arquivos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_admin()
    );
  END IF;
END $$;
-- Migração 012: Remove policies antigas de storage que concedem permissão total (ALL)
-- e conflitam com as regras da migration 011.
--
-- As policies removidas abaixo davam permissão ALL para qualquer usuário autenticado,
-- anulando a restrição de DELETE apenas para administradores.

DROP POLICY IF EXISTS "Permitir admin e rh vr" ON storage.objects;
DROP POLICY IF EXISTS "Permitir admin e rh ocorrencias" ON storage.objects;
-- Migração 013: Remove a função auxiliar aplicar_rls_admin
--
-- Contexto: a função public.aplicar_rls_admin(TEXT) foi criada na migration 010
-- com SECURITY DEFINER e GRANT EXECUTE para authenticated. Isso permitia que
-- qualquer usuário logado alterasse policies, habilitasse/desabilitasse RLS e
-- manipulasse permissões de tabelas.
--
-- Esta migration revoga o privilégio e remove a função completamente.

-- Revoga o privilégio caso ainda exista (bancos onde a migration 010 original foi aplicada).
REVOKE ALL ON FUNCTION public.aplicar_rls_admin(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.aplicar_rls_admin(TEXT) FROM public;

-- Remove a função auxiliar do banco.
DROP FUNCTION IF EXISTS public.aplicar_rls_admin(TEXT);
-- Migração 014: Restringe RLS por nível de acesso
--
-- Contexto: todos os usuários autenticados devem ter acesso a todas as empresas.
-- Regra de permissão:
--   - visualizador: apenas SELECT
--   - gestor / rh: SELECT, INSERT, UPDATE
--   - admin: SELECT, INSERT, UPDATE, DELETE
--
-- Esta migration substitui as policies criadas na migration 010.

-- Função auxiliar: verifica se o usuário é editor (admin, rh ou gestor)
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'rh', 'gestor')
  );
$$;

-- Função auxiliar interna: aplica policies restritas em uma tabela
CREATE OR REPLACE FUNCTION public.aplicar_rls_restrito(p_tabela TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tabela TEXT := p_tabela;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_tabela
  ) THEN
    -- Habilita RLS (caso ainda não esteja)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    -- Remove policies antigas da migration 010
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

    -- Cria novas policies por nível de acesso
    EXECUTE format(
      'CREATE POLICY "Permitir select para autenticados" ON public.%I FOR SELECT TO authenticated USING (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir insert para editores" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir update para editores" ON public.%I FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir delete apenas para admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
      v_tabela
    );
  END IF;
END;
$$;

-- Aplica as policies restritas nas tabelas de negócio
SELECT public.aplicar_rls_restrito('empresas');
SELECT public.aplicar_rls_restrito('colaboradores');
SELECT public.aplicar_rls_restrito('departamentos');
SELECT public.aplicar_rls_restrito('perfis');
SELECT public.aplicar_rls_restrito('configuracoes');
SELECT public.aplicar_rls_restrito('ocorrencias');
SELECT public.aplicar_rls_restrito('ocorrencia_anexos');
SELECT public.aplicar_rls_restrito('ocorrencia_testemunhas');
SELECT public.aplicar_rls_restrito('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_restrito('ocorrencia_defesas');
SELECT public.aplicar_rls_restrito('alertas');
SELECT public.aplicar_rls_restrito('modelos_ocorrencia');
SELECT public.aplicar_rls_restrito('auditoria');
SELECT public.aplicar_rls_restrito('projetos_vr');
SELECT public.aplicar_rls_restrito('resultados_vr');
SELECT public.aplicar_rls_restrito('fornecedores');
SELECT public.aplicar_rls_restrito('itens');
SELECT public.aplicar_rls_restrito('entregas');
SELECT public.aplicar_rls_restrito('contratos_adicionais');
SELECT public.aplicar_rls_restrito('vinculos_adicionais');
SELECT public.aplicar_rls_restrito('calendario_adicionais');
SELECT public.aplicar_rls_restrito('log_auditoria');

-- Remove a função auxiliar interna (não deve ficar exposta)
DROP FUNCTION IF EXISTS public.aplicar_rls_restrito(TEXT);

-- Garante que is_admin continue disponível para as policies
-- (já foi criada na migration 010 e mantida)
-- Migração 015: Protege token do eContador e alinha RLS de departamentos
--
-- Contexto:
--   1. O token da API Alterdata estava acessível a qualquer usuário autenticado
--      porque a tabela public.configuracoes permitia SELECT irrestrito.
--   2. A migration 005 criou policies permissivas para departamentos,
--      permitindo qualquer operação a qualquer usuário logado.
--
-- Esta migration:
--   - Restringe leitura/escrita da chave 'econtador_token' a admin e rh.
--   - Substitui as policies permissivas de departamentos pelas regras de nível
--     de acesso usadas nas demais tabelas (visualizador lê, gestor/rh editam,
--     admin deleta).

-- ============================================================
-- Função auxiliar: verifica se o usuário é admin ou rh
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_rh_ou_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'rh')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_rh_ou_admin() TO authenticated;

-- ============================================================
-- Protege a tabela configuracoes
-- ============================================================

-- Remove policies anteriores (migration 010 / 014)
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- Leitura geral exceto token eContador
CREATE POLICY "Permitir select geral em configuracoes"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave <> 'econtador_token');

-- Leitura do token eContador apenas para admin/rh
CREATE POLICY "Permitir select token eContador apenas admin rh"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin());

-- Escrita geral para editores exceto token
CREATE POLICY "Permitir insert em configuracoes"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update em configuracoes"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- Escrita do token apenas para admin/rh
CREATE POLICY "Permitir insert token eContador apenas admin rh"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

CREATE POLICY "Permitir update token eContador apenas admin rh"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin())
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

-- Delete apenas para admin
CREATE POLICY "Permitir delete apenas para admins"
  ON public.configuracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- Alinha RLS de departamentos com as demais tabelas
-- ============================================================

-- Remove policies permissivas da migration 005
DROP POLICY IF EXISTS "Usuários autenticados podem ler departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar departamentos" ON public.departamentos;

-- Aplica policies restritas por nível de acesso
CREATE POLICY "Permitir select em departamentos"
  ON public.departamentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Permitir insert em departamentos"
  ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update em departamentos"
  ON public.departamentos
  FOR UPDATE TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete em departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (public.is_admin());
-- Migração 016: Adiciona coluna quantidade_colaboradores em contratos_adicionais
-- O formulário de contratos já envia esse campo, mas ele não existia no schema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos_adicionais'
      AND column_name = 'quantidade_colaboradores'
  ) THEN
    ALTER TABLE public.contratos_adicionais
      ADD COLUMN quantidade_colaboradores integer NOT NULL DEFAULT 0;
  END IF;
END $$;
-- Migração 017: Adiciona regime de trabalho nos contratos de adicionais
-- Permite definir o padrão de dias trabalhados/folga para o calendário.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos_adicionais'
      AND column_name = 'regime_trabalho'
  ) THEN
    ALTER TABLE public.contratos_adicionais
      ADD COLUMN regime_trabalho text NOT NULL DEFAULT '12x36';
  END IF;
END $$;
-- Migração 018: Cria módulo Extras (controle de faltas, coberturas e pagamentos em cash)

-- Tabela de categorias de valor para extras
CREATE TABLE IF NOT EXISTS public.categorias_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_padrao numeric(10, 2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categorias_extras IS 'Categorias de valores padrão para pagamento de extras/faltas';

-- Seed inicial de categorias
INSERT INTO public.categorias_extras (nome, valor_padrao, ativo)
VALUES
  ('ASG 7:20 hs', 0, true),
  ('ASG 12×36', 0, true),
  ('Porteiro 12×36', 0, true),
  ('ASG Rio', 0, true),
  ('Valor acordado', 0, true)
ON CONFLICT (id) DO NOTHING;

-- Tabela principal de extras/ocorrências
CREATE TABLE IF NOT EXISTS public.extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ocorrencia date NOT NULL,
  turno text NOT NULL,
  categoria text NOT NULL,
  posto text NOT NULL,
  colaborador_ausente_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  colaborador_ausente_nome text,
  substituto_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  substituto_nome text,
  motivo text NOT NULL,
  extra_faturado boolean NOT NULL DEFAULT false,
  valor numeric(10, 2) NOT NULL DEFAULT 0,
  categoria_valor_id uuid REFERENCES public.categorias_extras(id) ON DELETE SET NULL,
  categoria_valor_nome text,
  comunicacao_tipo text,
  comunicacao_data date,
  comunicacao_hora time,
  comunicacao_detalhes text,
  observacoes text,
  status text NOT NULL DEFAULT 'Pendente',
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.extras IS 'Registro de faltas, coberturas e pagamentos extras em cash';

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_extras_data_ocorrencia ON public.extras(data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_extras_colaborador_ausente_id ON public.extras(colaborador_ausente_id);
CREATE INDEX IF NOT EXISTS idx_extras_substituto_id ON public.extras(substituto_id);
CREATE INDEX IF NOT EXISTS idx_extras_status ON public.extras(status);
CREATE INDEX IF NOT EXISTS idx_extras_empresa_id ON public.extras(empresa_id);

-- RLS
ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias_extras: todos os usuários autenticados podem ler; apenas admin/rh podem gerenciar
CREATE POLICY "Permitir leitura de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de categorias_extras"
  ON public.categorias_extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para extras
CREATE POLICY "Permitir leitura de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de extras"
  ON public.extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
-- Migração 019: Adiciona departamento_id à tabela extras

ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS departamento_nome text;

CREATE INDEX IF NOT EXISTS idx_extras_departamento_id ON public.extras(departamento_id);
-- Migração 020: Atualiza valores padrão das categorias de extras

UPDATE public.categorias_extras
SET valor_padrao = 110.00
WHERE nome = 'ASG 7:20 hs';

UPDATE public.categorias_extras
SET valor_padrao = 130.00
WHERE nome = 'ASG 12×36';

UPDATE public.categorias_extras
SET valor_padrao = 145.00
WHERE nome = 'Porteiro 12×36';

UPDATE public.categorias_extras
SET valor_padrao = 140.00
WHERE nome = 'ASG Rio';
-- Migração 021: Corrige departamentos com nomes curtos duplicados

-- ============================================================
-- 1. Consolida CHÁCARA ITAGUAI (Rosas e Dalias são o mesmo prédio)
-- ============================================================

DO $$
DECLARE
  principal_id uuid;
  duplicado_id uuid;
BEGIN
  -- Seleciona o registro mais antigo como principal
  SELECT id INTO principal_id
  FROM public.departamentos
  WHERE nome_curto = 'CHÁCARA ITAGUAI'
  ORDER BY created_at ASC
  LIMIT 1;

  IF principal_id IS NOT NULL THEN
    -- Atualiza referências nas tabelas filhas
    UPDATE public.colaboradores
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    UPDATE public.contratos_adicionais
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    UPDATE public.extras
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    -- Remove os duplicados
    DELETE FROM public.departamentos
    WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id;
  END IF;
END $$;

-- ============================================================
-- 2. Diferencia as agências DUOCONNECT no nome_curto
-- ============================================================

UPDATE public.departamentos
SET nome_curto = 'DUOCONNECT ' || UPPER(REPLACE(nome, 'CENTRO AUDITIVO TELEX ', ''))
WHERE nome_curto = 'DUOCONNECT';
-- Migração 022: Remove departamentos sem nome_curto que têm um correspondente válido

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Para cada departamento inválido (sem nome_curto), procura um válido com mesmo nome
  FOR r IN
    SELECT i.id as invalido_id, v.id as valido_id
    FROM public.departamentos i
    JOIN public.departamentos v
      ON LOWER(TRIM(i.nome)) = LOWER(TRIM(v.nome))
     AND (v.nome_curto IS NOT NULL AND v.nome_curto <> '')
    WHERE (i.nome_curto IS NULL OR i.nome_curto = '')
  LOOP
    -- Atualiza referências nas tabelas filhas
    UPDATE public.colaboradores
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.contratos_adicionais
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.extras
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    -- Remove o departamento inválido
    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;
-- Migração 023: Gera nome_curto para departamentos que não têm correspondente válido

UPDATE public.departamentos
SET nome_curto = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        UPPER(nome),
        '^CONDOMINIO DO EDIFICIO[[:space:]]+', '', 'i'
      ),
      '^CONDOMINIO DO EDIFCIO[[:space:]]+', '', 'i'
    ),
    '^CONDOMINIO[[:space:]]+', '', 'i'
  )
)
WHERE (nome_curto IS NULL OR nome_curto = '')
  AND status = 'Ativo';
-- Migração 024: Consolida departamentos do e-contador com departamentos manuais
-- Associa pelo nome_curto do manual contido no nome completo do e-contador (correspondência de palavra inteira)

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT v.id as valido_id, i.id as invalido_id, v.nome_curto, i.nome
    FROM public.departamentos v
    JOIN public.departamentos i
      ON i.id <> v.id
     AND i.nome ~* ('\y' || v.nome_curto || '\y')
    WHERE v.status = 'Ativo'
      AND v.nome_curto IS NOT NULL
      AND v.nome_curto <> ''
      AND LENGTH(v.nome_curto) >= 4
      AND i.status = 'Ativo'
    ORDER BY v.nome_curto
  LOOP
    -- Atualiza referências nas tabelas filhas
    UPDATE public.colaboradores
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.contratos_adicionais
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.extras
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    -- Remove o departamento do e-contador
    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;
-- Migração 025: Corrige vínculos de colaboradores com departamentos
-- Causa: migration 024 falhou para nomes acentuados e deixou departamento_id nulos

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalizar_match(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(unaccent(coalesce(texto, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- 1. Consolida departamentos do e-contador restantes usando comparação normalizada
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (i.id)
      v.id AS valido_id,
      i.id AS invalido_id
    FROM public.departamentos v
    JOIN public.departamentos i
      ON i.id <> v.id
      AND i.status = 'Ativo'
      AND v.status = 'Ativo'
      AND v.nome_curto IS NOT NULL
      AND v.nome_curto <> ''
      AND public.normalizar_match(i.nome) ~ ('\m' || public.normalizar_match(v.nome_curto) || '\M')
    ORDER BY i.id, length(v.nome_curto) DESC
  LOOP
    UPDATE public.colaboradores
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.contratos_adicionais
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.extras
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;

-- 2. Preenche colaboradores com departamento_id nulo mas campo departamento preenchido
UPDATE public.colaboradores c
SET departamento_id = d.id
FROM public.departamentos d
WHERE c.departamento_id IS NULL
  AND c.departamento IS NOT NULL
  AND c.departamento <> ''
  AND d.status = 'Ativo'
  AND d.nome_curto IS NOT NULL
  AND d.nome_curto <> ''
  AND public.normalizar_match(c.departamento) ~ ('\m' || public.normalizar_match(d.nome_curto) || '\M');
-- Migração 026: Cria tabela de recibos de extras com assinatura digital

CREATE TABLE IF NOT EXISTS public.recibos_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  colaborador_nome text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_total numeric(10, 2) NOT NULL DEFAULT 0,
  quantidade_extras integer NOT NULL DEFAULT 0,
  assinatura_colaborador text, -- imagem PNG em base64
  extras_ids uuid[] NOT NULL DEFAULT '{}',
  marcar_pago boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'emitido',
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recibos_extras IS 'Recibos de pagamento de extras com assinatura digital do colaborador';

CREATE INDEX IF NOT EXISTS idx_recibos_extras_colaborador_id ON public.recibos_extras(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_recibos_extras_data_inicio ON public.recibos_extras(data_inicio);
CREATE INDEX IF NOT EXISTS idx_recibos_extras_data_fim ON public.recibos_extras(data_fim);

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de recibos_extras"
  ON public.recibos_extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
-- Migração 027: Adiciona fluxo de assinatura posterior nos recibos de extras

-- Adiciona data de assinatura para controle
ALTER TABLE public.recibos_extras
ADD COLUMN IF NOT EXISTS data_assinatura timestamptz;

-- Atualiza comentário da tabela
COMMENT ON TABLE public.recibos_extras IS 'Recibos de pagamento de extras. Podem ser criados pendentes de assinatura e assinados posteriormente pelo colaborador.';

-- Atualiza comentário da coluna status
COMMENT ON COLUMN public.recibos_extras.status IS 'Status do recibo: pendente_assinatura, assinado ou cancelado';

-- Garante que recibos pendentes podem existir sem assinatura
COMMENT ON COLUMN public.recibos_extras.assinatura_colaborador IS 'Imagem PNG da assinatura em base64. Pode ser nula enquanto o recibo estiver pendente de assinatura.';
-- Migração 028: Cria tabelas do módulo VR (projetos_vr e resultados_vr)
--
-- Contexto: as migrations anteriores (ex: 014) já aplicam RLS nessas tabelas,
-- mas seus CREATE TABLE não estavam versionados no repositório. Esta migration
-- cria as tabelas e garante as policies corretas.

-- ============================================================
-- projetos_vr
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projetos_vr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_corte date NOT NULL,
  data_efetivacao date NOT NULL,
  configuracao_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projetos_vr IS 'Projetos de cálculo de Vale Refeição (VR)';

CREATE INDEX IF NOT EXISTS idx_projetos_vr_data_corte ON public.projetos_vr(data_corte);
CREATE INDEX IF NOT EXISTS idx_projetos_vr_created_at ON public.projetos_vr(created_at);

-- ============================================================
-- resultados_vr
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resultados_vr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos_vr(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome text,
  cpf text,
  matricula text,
  dias_elegiveis integer NOT NULL DEFAULT 0,
  dias_pdf integer NOT NULL DEFAULT 0,
  dias_escala integer NOT NULL DEFAULT 0,
  dias_abatimento integer NOT NULL DEFAULT 0,
  valor_bruto numeric(10, 2) NOT NULL DEFAULT 0,
  extra numeric(10, 2) NOT NULL DEFAULT 0,
  detalhes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.resultados_vr IS 'Resultados de cálculo de VR por colaborador';

CREATE INDEX IF NOT EXISTS idx_resultados_vr_projeto_id ON public.resultados_vr(projeto_id);
CREATE INDEX IF NOT EXISTS idx_resultados_vr_colaborador_id ON public.resultados_vr(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_resultados_vr_cpf ON public.resultados_vr(cpf);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.projetos_vr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_vr ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas caso existam
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.projetos_vr;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.resultados_vr;

-- Projetos VR
CREATE POLICY "Permitir select para autenticados" ON public.projetos_vr
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insert para editores" ON public.projetos_vr
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update para editores" ON public.projetos_vr
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete apenas para admins" ON public.projetos_vr
  FOR DELETE TO authenticated USING (public.is_admin());

-- Resultados VR
CREATE POLICY "Permitir select para autenticados" ON public.resultados_vr
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insert para editores" ON public.resultados_vr
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update para editores" ON public.resultados_vr
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete apenas para admins" ON public.resultados_vr
  FOR DELETE TO authenticated USING (public.is_admin());
-- Migração 029: Auditoria automática via triggers
--
-- Cria tabela de log de auditoria (se não existir) e triggers nas tabelas críticas
-- para registrar INSERT, UPDATE e DELETE automaticamente.

-- ============================================================
-- Tabela de log de auditoria
-- ============================================================

CREATE TABLE IF NOT EXISTS public.log_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'CANCEL')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.log_auditoria IS 'Registro automático de alterações em dados sensíveis do sistema';

CREATE INDEX IF NOT EXISTS idx_log_auditoria_tabela ON public.log_auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_registro_id ON public.log_auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_created_at ON public.log_auditoria(created_at);

-- ============================================================
-- Função genérica de auditoria
-- ============================================================

CREATE OR REPLACE FUNCTION public.auditar_operacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, 'sem-id'), 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text, 'sem-id'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(OLD.id::text, 'sem-id'), 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- Aplica triggers nas tabelas críticas
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auditoria_ocorrencias ON public.ocorrencias;
CREATE TRIGGER trigger_auditoria_ocorrencias
  AFTER INSERT OR UPDATE OR DELETE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_colaboradores ON public.colaboradores;
CREATE TRIGGER trigger_auditoria_colaboradores
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_extras ON public.extras;
CREATE TRIGGER trigger_auditoria_extras
  AFTER INSERT OR UPDATE OR DELETE ON public.extras
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_recibos_extras ON public.recibos_extras;
CREATE TRIGGER trigger_auditoria_recibos_extras
  AFTER INSERT OR UPDATE OR DELETE ON public.recibos_extras
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_projetos_vr ON public.projetos_vr;
CREATE TRIGGER trigger_auditoria_projetos_vr
  AFTER INSERT OR UPDATE OR DELETE ON public.projetos_vr
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_resultados_vr ON public.resultados_vr;
CREATE TRIGGER trigger_auditoria_resultados_vr
  AFTER INSERT OR UPDATE OR DELETE ON public.resultados_vr
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- ============================================================
-- RLS na tabela de log (apenas leitura para autenticados; insert via trigger)
-- ============================================================

ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de log_auditoria" ON public.log_auditoria;
CREATE POLICY "Permitir select de log_auditoria"
  ON public.log_auditoria
  FOR SELECT
  TO authenticated
  USING (true);
-- Migração 030: Criptografia do token e-Contador no banco
--
-- Contexto: o token JWT do e-Contador estava armazenado em texto plano na tabela
-- configuracoes. Esta migration prepara a tabela para armazenar o token cifrado.
-- A criptografia/descriptografia propriamente dita é feita na Edge Function
-- /functions/v1/econtador, que é a única que possui a chave ENCRYPTION_KEY.

-- ============================================================
-- Colunas para armazenamento cifrado do token
-- ============================================================

ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS valor_cifrado text,
ADD COLUMN IF NOT EXISTS iv text,
ADD COLUMN IF NOT EXISTS tag text;

COMMENT ON COLUMN public.configuracoes.valor_cifrado IS 'Token e-Contador criptografado (ciphertext em base64)';
COMMENT ON COLUMN public.configuracoes.iv IS 'Vetor de inicialização usado na criptografia AES-GCM (base64)';
COMMENT ON COLUMN public.configuracoes.tag IS 'Tag de autenticação AES-GCM (base64)';

-- ============================================================
-- Atualiza RLS para reforçar que o token nunca seja lido pelo frontend
-- ============================================================

-- Remove policies antigas da tabela configuracoes para evitar conflito
DROP POLICY IF EXISTS "Permitir select de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update de configuracoes" ON public.configuracoes;

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Permitir select geral de configuracoes"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE: editores podem inserir/atualizar, mas o frontend NUNCA deve
-- ler o token de volta. A Edge Function gerencia o token de forma segura.
CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

-- DELETE: apenas admin
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
CREATE POLICY "Permitir delete de configuracoes"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
-- Migração 031: Adiciona detalhes dos erros ao histórico de importações do e-Contador

alter table public.historico_importacoes_econtador
add column if not exists detalhes_erros jsonb default '[]'::jsonb;
-- Migração 032: Restringe RLS das tabelas extras, categorias_extras e recibos_extras
--
-- Contexto: as migrations 018 e 026 criaram policies abertas (USING (true))
-- para todas as operações, permitindo que qualquer usuário autenticado lesse,
-- alterasse ou removesse dados financeiros. Esta migration corrige isso.
--
-- Regra de permissão:
--   - visualizador: apenas SELECT
--   - gestor / rh: SELECT, INSERT, UPDATE
--   - admin: SELECT, INSERT, UPDATE, DELETE

-- ============================================================
-- categorias_extras
-- ============================================================

ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de categorias_extras" ON public.categorias_extras;

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de categorias_extras"
  ON public.categorias_extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de categorias_extras"
  ON public.categorias_extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de categorias_extras"
  ON public.categorias_extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- extras
-- ============================================================

ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de extras" ON public.extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de extras"
  ON public.extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de extras"
  ON public.extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de extras"
  ON public.extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- recibos_extras
-- ============================================================

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
-- Migração 033: Torna a matrícula única por empresa, não global
--
-- Contexto: com duas empresas no e-Contador (Plena Tech e Plena EA),
-- funcionários diferentes podem ter a mesma matrícula em empresas diferentes.
-- A constraint global "colaboradores_matricula_key" impedia a importação.

-- 1. Remove a constraint única global de matrícula, se existir
alter table public.colaboradores
  drop constraint if exists colaboradores_matricula_key;

-- 2. Remove índice único global de matrícula, se existir
drop index if exists colaboradores_matricula_key;

-- 3. Cria índice não-único para manter performance nas buscas por matrícula
create index if not exists idx_colaboradores_matricula
  on public.colaboradores (matricula);

-- 4. Tenta criar unicidade por empresa. Se houver duplicatas dentro da mesma empresa,
--    apenas cria um índice normal por empresa e registra o problema.
DO $$
DECLARE
  duplicatas integer;
BEGIN
  SELECT count(*) INTO duplicatas
  FROM (
    SELECT matricula, empresa_id, count(*) as total
    FROM public.colaboradores
    WHERE matricula IS NOT NULL
      AND matricula <> ''
    GROUP BY matricula, empresa_id
    HAVING count(*) > 1
  ) d;

  IF duplicatas = 0 THEN
    -- Seguro criar constraint única por empresa
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT colaboradores_matricula_empresa_key
      UNIQUE (empresa_id, matricula);
  ELSE
    -- Há duplicatas dentro da mesma empresa; não podemos forçar unicidade agora.
    -- Cria índice normal por empresa para performance.
    CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula_empresa
      ON public.colaboradores (empresa_id, matricula);
    RAISE NOTICE 'Existem % matrículas duplicadas dentro da mesma empresa. Unicidade por empresa não foi aplicada.', duplicatas;
  END IF;
END $$;
-- Migração 034: Restringe SELECT irrestrito em dados sensíveis
--
-- Contexto: a migration 014 criou SELECT liberado para qualquer usuário autenticado
-- em todas as tabelas de negócio. Esta migration remove o acesso de visualizadores
-- a tabelas administrativas/sensíveis.
--
-- Perfis do sistema: admin/adm, rh, gestor, dp1, dp2, mesa, inspetoria, financeiro, visualizador

-- Atualiza is_admin para reconhecer 'admin' e 'adm'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm')
  );
$$;

-- Atualiza is_editor para incluir os novos perfis operacionais
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'rh', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

-- Função auxiliar: verifica se o usuário é apenas visualizador
CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'visualizador'
  );
$$;

-- Aplica SELECT restrito em tabelas sensíveis: apenas editores/admin podem ler
CREATE OR REPLACE FUNCTION public.aplicar_select_restrito(p_tabela TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tabela TEXT := p_tabela;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_tabela
  ) THEN
    -- Habilita RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    -- Remove policy de SELECT antiga (se existir)
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select restrito" ON public.%I;', v_tabela);

    -- Cria policy que nega visualizadores e permite editores/admins
    EXECUTE format(
      'CREATE POLICY "Permitir select restrito" ON public.%I FOR SELECT TO authenticated USING (NOT public.is_visualizador());',
      v_tabela
    );
  END IF;
END;
$$;

-- Aplica restrição nas tabelas administrativas/sensíveis
SELECT public.aplicar_select_restrito('perfis');
SELECT public.aplicar_select_restrito('configuracoes');
SELECT public.aplicar_select_restrito('log_auditoria');
SELECT public.aplicar_select_restrito('auditoria');

-- Remove a função auxiliar (não deve ficar exposta)
DROP FUNCTION IF EXISTS public.aplicar_select_restrito(TEXT);
-- Migração 035: Isola storage buckets por contexto/perfil
--
-- Contexto: a migration 011 permitiu que qualquer usuário autenticado lesse,
-- inserisse e atualizasse arquivos nos buckets. Esta migration restringe as
-- operações por perfil de acesso.
--
-- Regras aplicadas:
--   - visualizador: sem acesso ao storage
--   - editor (admin, rh, gestor, dp1, dp2, mesa, inspetoria, financeiro): pode ler/inserir/atualizar
--   - admin: pode deletar

-- ============================================================
-- Bucket: ocorrencia-anexos
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'ocorrencia-anexos';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    -- Limpa policies antigas
    DROP POLICY IF EXISTS "Autenticados podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos restrito" ON storage.objects;

    CREATE POLICY "Editores podem ler anexos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem inserir anexos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem atualizar anexos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    )
    WITH CHECK (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Apenas admins podem deletar anexos restrito"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_admin()
    );
  END IF;
END $$;

-- ============================================================
-- Bucket: vr-arquivos
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'vr-arquivos';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    -- Limpa policies antigas
    DROP POLICY IF EXISTS "Autenticados podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos restrito" ON storage.objects;

    CREATE POLICY "Editores podem ler vr-arquivos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem inserir vr-arquivos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem atualizar vr-arquivos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    )
    WITH CHECK (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Apenas admins podem deletar vr-arquivos restrito"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_admin()
    );
  END IF;
END $$;
-- Migração 036: Consentimento LGPD
--
-- Objetivo: registrar consentimento informado dos usuários do sistema
-- e versionar os termos de privacidade.

-- ============================================================
-- 1. Tabela de termos/versionamento LGPD
-- ============================================================
CREATE TABLE IF NOT EXISTS public.termos_lgpd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  finalidades TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.termos_lgpd IS 'Versionamento dos termos de consentimento LGPD';

-- ============================================================
-- 2. Campos de consentimento na tabela perfis
-- ============================================================
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS consentimento_lgpd BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_data TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_versao TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_finalidades TEXT[] DEFAULT '{}';

-- ============================================================
-- 3. RLS para termos_lgpd
-- ============================================================
ALTER TABLE public.termos_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Termos LGPD select ativo" ON public.termos_lgpd;
DROP POLICY IF EXISTS "Termos LGPD admin gerencia" ON public.termos_lgpd;

-- Qualquer usuário autenticado pode ler o termo ativo
CREATE POLICY "Termos LGPD select ativo"
  ON public.termos_lgpd
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Apenas admin pode inserir/editar/desativar termos
CREATE POLICY "Termos LGPD admin gerencia"
  ON public.termos_lgpd
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Ajuste de RLS em perfis para consentimento próprio
-- ============================================================
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Garante que o usuário possa ler/alterar seu próprio perfil,
-- independentemente do nível de acesso (inclusive visualizador).
DROP POLICY IF EXISTS "Perfis select próprio" ON public.perfis;
DROP POLICY IF EXISTS "Perfis update próprio consentimento" ON public.perfis;

CREATE POLICY "Perfis select próprio"
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_editor());

CREATE POLICY "Perfis update próprio consentimento"
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 5. Seed do termo inicial
-- ============================================================
INSERT INTO public.termos_lgpd (versao, titulo, conteudo, finalidades, ativo)
VALUES (
  '1.0',
  'Termo de Consentimento para Tratamento de Dados Pessoais',
  E'Lei Geral de Proteção de Dados Pessoais (LGPD), Lei nº 13.709/2018.\n\n'
  || E'1. Controlador: RH Plena Unificado, responsável pelo tratamento dos dados pessoais inseridos neste sistema.\n\n'
  || E'2. Dados tratados: nome, e-mail, CPF, RG, dados bancários, endereço, telefone, dados profissionais, registros de ponto, ocorrências disciplinares, registros de entrega de EPI/uniforme, informações de vale-refeição e outros dados necessários à gestão de recursos humanos.\n\n'
  || E'3. Finalidades: gestão de colaboradores, controle de ponto e adicionais, gestão de ocorrências disciplinares, entrega de EPI/uniforme, cálculo de benefícios, integração com sistemas contábeis (e-Contador/Alterdata) e cumprimento de obrigações legais/trabalhistas.\n\n'
  || E'4. Base legal: execução de contrato, cumprimento de obrigação legal/regulatória, legítimo interesse e consentimento, conforme aplicável.\n\n'
  || E'5. Direitos do titular: você pode acessar, retificar, excluir, portar seus dados e revogar o consentimento a qualquer momento, nos termos do art. 18 da LGPD. Para exercer seus direitos, entre em contato com o administrador do sistema ou com o encarregado de dados (DPO).\n\n'
  || E'6. Segurança: adotamos medidas técnicas e administrativas para proteger seus dados, incluindo criptografia, controle de acesso baseado em perfil e logs de auditoria.\n\n'
  || E'7. Compartilhamento: os dados poderão ser compartilhados com prestadores de serviço autorizados (ex: contabilidade) e órgãos reguladores, quando exigido por lei.\n\n'
  || E'8. Prazo de retenção: os dados serão mantidos pelo período necessário ao cumprimento das finalidades e obrigações legais.\n\n'
  || E'9. Ao clicar em "Aceito", declaro que li e concordo com este termo e autorizo o tratamento dos meus dados pessoais para as finalidades descritas.',
  ARRAY['gestao_rh', 'controle_ponto', 'ocorrencias', 'epi_uniforme', 'beneficios', 'integracao_contabil', 'obrigacoes_legais'],
  true
)
ON CONFLICT (versao) DO NOTHING;
-- Migração 037: RBAC granular com 8 perfis
--
-- Perfis do sistema: adm, gestor, rh, dp1, dp2, mesa, inspetoria, financeiro
-- Perfis legados mantidos para compatibilidade: admin (equivalente a adm), visualizador

-- ============================================================
-- 1. Funções auxiliares de permissão
-- ============================================================

-- Administrador: admin (legado) ou adm
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm')
  );
$$;

-- Editor: perfis com permissão de escrita em dados de negócio
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

-- Visualizador: apenas leitura (perfil legado)
CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'visualizador'
  );
$$;

-- DP: dp1 ou dp2
CREATE OR REPLACE FUNCTION public.is_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('dp1', 'dp2')
  );
$$;

-- Mesa
CREATE OR REPLACE FUNCTION public.is_mesa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'mesa'
  );
$$;

-- Inspetoria
CREATE OR REPLACE FUNCTION public.is_inspetoria()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'inspetoria'
  );
$$;

-- Financeiro
CREATE OR REPLACE FUNCTION public.is_financeiro()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'financeiro'
  );
$$;

-- Gestor
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'gestor'
  );
$$;

-- RH
CREATE OR REPLACE FUNCTION public.is_rh()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'rh'
  );
$$;

-- Garante que usuários autenticados possam executar as funções de permissão
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mesa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inspetoria() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rh() TO authenticated;

-- ============================================================
-- 2. Reaplica policies RLS para garantir consistência
-- ============================================================

-- Reaplica RLS nas tabelas de negócio com as funções atualizadas
CREATE OR REPLACE FUNCTION public.aplicar_rls_padrao(p_tabela TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tabela TEXT := p_tabela;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_tabela
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para editores" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para editores" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

    EXECUTE format(
      'CREATE POLICY "Permitir select para autenticados" ON public.%I FOR SELECT TO authenticated USING (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir insert para editores" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir update para editores" ON public.%I FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir delete apenas para admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
      v_tabela
    );
  END IF;
END;
$$;

SELECT public.aplicar_rls_padrao('empresas');
SELECT public.aplicar_rls_padrao('colaboradores');
SELECT public.aplicar_rls_padrao('departamentos');
SELECT public.aplicar_rls_padrao('perfis');
SELECT public.aplicar_rls_padrao('configuracoes');
SELECT public.aplicar_rls_padrao('ocorrencias');
SELECT public.aplicar_rls_padrao('ocorrencia_anexos');
SELECT public.aplicar_rls_padrao('ocorrencia_testemunhas');
SELECT public.aplicar_rls_padrao('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_padrao('ocorrencia_defesas');
SELECT public.aplicar_rls_padrao('alertas');
SELECT public.aplicar_rls_padrao('modelos_ocorrencia');
SELECT public.aplicar_rls_padrao('auditoria');
SELECT public.aplicar_rls_padrao('projetos_vr');
SELECT public.aplicar_rls_padrao('resultados_vr');
SELECT public.aplicar_rls_padrao('fornecedores');
SELECT public.aplicar_rls_padrao('itens');
SELECT public.aplicar_rls_padrao('entregas');
SELECT public.aplicar_rls_padrao('contratos_adicionais');
SELECT public.aplicar_rls_padrao('vinculos_adicionais');
SELECT public.aplicar_rls_padrao('calendario_adicionais');
SELECT public.aplicar_rls_padrao('log_auditoria');

DROP FUNCTION IF EXISTS public.aplicar_rls_padrao(TEXT);

-- ============================================================
-- 3. Policies específicas já existentes mantidas
-- ============================================================

-- A migration 032 já criou policies específicas para extras, categorias_extras e recibos_extras.
-- A migration 034 já criou SELECT restrito para perfis, configuracoes, log_auditoria e auditoria.
-- A migration 035 já criou policies para storage buckets.
-- A migration 036 já criou policies para termos_lgpd e perfis.

-- Nenhuma alteração adicional necessária nessas tabelas; as funções is_admin/is_editor atualizadas
-- garantem que os novos perfis sejam reconhecidos pelas policies existentes.
-- Migração 038: Marca como Inativo os departamentos sem nome_curto
--
-- Regra de negócio: o sistema deve exibir apenas departamentos que possuem
-- nome_curto preenchido. Departamentos sem nome_curto são legados ou
-- importados de forma incompleta e devem ficar ocultos da listagem.
--
-- Atenção: não excluímos os registros para preservar o histórico e
-- possíveis vínculos em outras tabelas.

UPDATE public.departamentos
SET status = 'Inativo'
WHERE nome_curto IS NULL
   OR TRIM(nome_curto) = '';
-- Migração 038: Ajusta RLS de extras, recibos_extras, categorias_extras e ocorrências
--
-- Regras de negócio validadas em 2026-06-26:
--   - Extras: visualização apenas para adm, mesa, financeiro e dp1.
--   - Ocorrências: visualização para adm, gestor, dp1, dp2, mesa e inspetoria.
--   - Administrador legado ('admin') equivale a 'adm'.

-- ============================================================
-- 1. Funções auxiliares de visualização
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_extras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'mesa', 'financeiro', 'dp1')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_ocorrencias()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_extras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_ocorrencias() TO authenticated;

-- ============================================================
-- 2. categorias_extras
-- ============================================================

ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de categorias_extras" ON public.categorias_extras;

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 3. extras
-- ============================================================

ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de extras" ON public.extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 4. recibos_extras
-- ============================================================

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 5. ocorrências
-- ============================================================

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencias;

CREATE POLICY "Permitir select de ocorrencias"
  ON public.ocorrencias
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_ocorrencias());

-- INSERT/UPDATE/DELETE mantidos conforme migration 037 (editor/admin)
-- Migração 039: Refina RLS dos buckets de storage
--
-- Regras de negócio validadas em 2026-06-26:
--   - Anexos de ocorrências: adm, gestor, rh, dp1, dp2, mesa, inspetoria.
--   - Anexos de VR/projetos: adm e dp2.
--   - Exclusão: apenas adm em ambos.

-- ============================================================
-- 1. Funções auxiliares de permissão para storage
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_anexos_ocorrencia()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_vr_arquivos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_anexos_ocorrencia() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_vr_arquivos() TO authenticated;

-- ============================================================
-- 2. Bucket: ocorrencia-anexos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Editores podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos restrito" ON storage.objects;

    CREATE POLICY "Permitir select de anexos de ocorrencias"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
      );

    CREATE POLICY "Permitir insert de anexos de ocorrencias"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
      );

    CREATE POLICY "Permitir update de anexos de ocorrencias"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
      )
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
      );

    CREATE POLICY "Permitir delete de anexos de ocorrencias"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.is_admin()
      );
  END IF;
END $$;

-- ============================================================
-- 3. Bucket: vr-arquivos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    DROP POLICY IF EXISTS "Editores podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos restrito" ON storage.objects;

    CREATE POLICY "Permitir select de vr-arquivos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
      );

    CREATE POLICY "Permitir insert de vr-arquivos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
      );

    CREATE POLICY "Permitir update de vr-arquivos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
      )
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
      );

    CREATE POLICY "Permitir delete de vr-arquivos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.is_admin()
      );
  END IF;
END $$;
-- Migração 040: Corrige policies SELECT abertas deixadas pela migration 037
--
-- Contexto: a migration 037 aplicou RLS padrão em várias tabelas, recriando a
-- policy "Permitir select para autenticados" com USING (true). Como a migration
-- 034 já havia criado policies restritas ("Permitir select restrito") nas
-- tabelas administrativas/sensíveis, as duas policies coexistiram e o PostgreSQL
-- avaliou com OR, anulando a proteção.
--
-- Esta migration remove a policy aberta e garante a policy restrita nas tabelas:
--   - perfis
--   - configuracoes
--   - auditoria
--   - log_auditoria

-- ============================================================
-- 1. Garante que a função is_visualizador existe e está atualizada
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'visualizador'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;

-- ============================================================
-- 2. Remove policy SELECT aberta e recria policy restrita
-- ============================================================

DO $$
DECLARE
  v_tabela TEXT;
  v_tabelas TEXT[] := ARRAY['perfis', 'configuracoes', 'auditoria', 'log_auditoria'];
BEGIN
  FOREACH v_tabela IN ARRAY v_tabelas
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_tabela
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

      -- Remove a policy aberta criada pela migration 037
      EXECUTE format(
        'DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;',
        v_tabela
      );

      -- Remove e recria a policy restrita para garantir consistência
      EXECUTE format(
        'DROP POLICY IF EXISTS "Permitir select restrito" ON public.%I;',
        v_tabela
      );

      EXECUTE format(
        'CREATE POLICY "Permitir select restrito" ON public.%I FOR SELECT TO authenticated USING (NOT public.is_visualizador());',
        v_tabela
      );
    END IF;
  END LOOP;
END
$$;
-- Migração 041: Reforça RLS da tabela configuracoes para a chave econtador_token
--
-- Contexto: a migration 030 permitiu que qualquer "editor" (rh, gestor, mesa,
-- inspetoria, financeiro, dp1, dp2) inserisse/alterasse qualquer chave de
-- configuracoes, incluindo o token cifrado do e-Contador. Além disso, o
-- DROP POLICY usou nome diferente da policy criada na migration 015, deixando
-- a policy antiga de SELECT ativa.
--
-- Esta migration:
--   - Remove a policy antiga de SELECT do token (nome correto da migration 015).
--   - Restringe INSERT/UPDATE da chave 'econtador_token' a admin/adm/dp1/dp2.
--   - Mantém INSERT/UPDATE de outras chaves para editores.
--   - Mantém SELECT geral exceto o token e DELETE apenas para admin.

-- ============================================================
-- 1. Função auxiliar: admin/adm/dp1/dp2 podem gerenciar o token
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_ou_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_ou_dp() TO authenticated;

-- ============================================================
-- 2. Limpa policies antigas/conflitantes de configuracoes
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- ============================================================
-- 3. Recria policies de configuracoes de forma segura
-- ============================================================

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Permitir select geral de configuracoes"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE de chaves comuns: editores podem inserir/atualizar
CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- INSERT/UPDATE do token e-Contador: apenas admin/adm/dp1/dp2
CREATE POLICY "Permitir insert token eContador apenas admin dp"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir update token eContador apenas admin dp"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

-- DELETE: apenas admin
CREATE POLICY "Permitir delete apenas para admins"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
-- Migração 042: Limpa policies legadas/abertas em tabelas sensíveis
--
-- Contexto: após as migrations 040 e 041, ainda restaram policies antigas
-- com nomes diferentes (ex.: select_autenticado, perfil_proprio, write_admin_rh)
-- que mantinham SELECT aberto (USING (true)) em tabelas sensíveis.
--
-- Esta migration remove TODAS as policies de:
--   - public.perfis
--   - public.configuracoes
--   - public.auditoria
--   - public.log_auditoria
--
-- E recria apenas as policies necessárias, alinhadas com o modelo de permissão
-- atual do sistema.

-- ============================================================
-- 1. Garante funções auxiliares
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND nivel_acesso IN ('admin', 'adm')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND nivel_acesso = 'visualizador'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_ou_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_ou_dp() TO authenticated;

-- ============================================================
-- 2. Limpa e recria policies de PERFIS
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as policies antigas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfis'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfis;', r.policyname);
  END LOOP;
END
$$;

-- SELECT: usuário vê seu próprio perfil; editores veem todos
CREATE POLICY "Perfis select proprio ou editor"
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_editor());

-- INSERT: usuário pode inserir apenas seu próprio perfil (sign-up)
CREATE POLICY "Perfis insert proprio"
  ON public.perfis
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: usuário pode alterar apenas seu próprio perfil
CREATE POLICY "Perfis update proprio"
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: apenas admin
CREATE POLICY "Perfis delete admin"
  ON public.perfis
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. Limpa e recria policies de CONFIGURACOES
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuracoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.configuracoes;', r.policyname);
  END LOOP;
END
$$;

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Configuracoes select geral"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE de chaves comuns: editores
CREATE POLICY "Configuracoes insert comum"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Configuracoes update comum"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- INSERT/UPDATE do token e-Contador: apenas admin/adm/dp1/dp2
CREATE POLICY "Configuracoes insert token admin dp"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Configuracoes update token admin dp"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

-- DELETE: apenas admin
CREATE POLICY "Configuracoes delete admin"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. Limpa e recria policies de AUDITORIA
-- ============================================================

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auditoria;', r.policyname);
  END LOOP;
END
$$;

-- Apenas SELECT restrito. INSERT/UPDATE/DELETE são feitos por triggers SECURITY DEFINER.
CREATE POLICY "Auditoria select restrito"
  ON public.auditoria
  FOR SELECT
  TO authenticated
  USING (NOT public.is_visualizador());

-- ============================================================
-- 5. Limpa e recria policies de LOG_AUDITORIA
-- ============================================================

ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'log_auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.log_auditoria;', r.policyname);
  END LOOP;
END
$$;

-- Apenas SELECT restrito. INSERT/UPDATE/DELETE são feitos por triggers SECURITY DEFINER.
CREATE POLICY "Log auditoria select restrito"
  ON public.log_auditoria
  FOR SELECT
  TO authenticated
  USING (NOT public.is_visualizador());
