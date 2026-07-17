-- Script: criar_perfis_teste.sql
--
-- Objetivo: criar/atualizar perfis de teste para cada nível de acesso.
--
-- IMPORTANTE: o cadastro público foi desabilitado. Para usar este script,
-- você deve primeiro criar os usuários no painel do Supabase Auth
-- (Authentication → Users → Add user) para cada email abaixo.
-- Depois de criar todos os usuários, execute este script no SQL Editor do
-- Supabase para definir o nome e o nível de acesso de cada um na tabela
-- public.perfis.
--
-- Emails e perfis de teste:
--   teste.adm@plena.local        -> adm
--   teste.gestor@plena.local     -> gestor
--   teste.rh@plena.local         -> rh
--   teste.dp1@plena.local        -> dp1
--   teste.dp2@plena.local        -> dp2
--   teste.mesa@plena.local       -> mesa
--   teste.inspetoria@plena.local -> inspetoria
--   teste.financeiro@plena.local -> financeiro
--   teste.visualizador@plena.local -> visualizador

DO $$
DECLARE
  v_reg RECORD;
BEGIN
  FOR v_reg IN
    SELECT * FROM (VALUES
      ('teste.adm@plena.local',        'Administrador Teste',       'adm'),
      ('teste.gestor@plena.local',     'Gestor Teste',              'gestor'),
      ('teste.rh@plena.local',         'RH Teste',                  'rh'),
      ('teste.dp1@plena.local',        'DP1 Teste',                 'dp1'),
      ('teste.dp2@plena.local',        'DP2 Teste',                 'dp2'),
      ('teste.mesa@plena.local',       'Mesa Teste',                'mesa'),
      ('teste.inspetoria@plena.local', 'Inspetoria Teste',          'inspetoria'),
      ('teste.financeiro@plena.local', 'Financeiro Teste',          'financeiro'),
      ('teste.visualizador@plena.local','Visualizador Teste',       'visualizador')
    ) AS t(email, nome, nivel)
  LOOP
    IF EXISTS (
      SELECT 1 FROM auth.users WHERE email = v_reg.email
    ) THEN
      INSERT INTO public.perfis (id, nome, nivel_acesso)
      SELECT id, v_reg.nome, v_reg.nivel
      FROM auth.users
      WHERE email = v_reg.email
      ON CONFLICT (id) DO UPDATE
      SET nome = EXCLUDED.nome,
          nivel_acesso = v_reg.nivel;
    ELSE
      RAISE NOTICE 'Usuário não encontrado: %', v_reg.email;
    END IF;
  END LOOP;
END
$$;
