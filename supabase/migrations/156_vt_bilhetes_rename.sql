-- 156_vt_bilhetes_rename.sql
-- Decisão da gestora em 21/10/2026: "combinação" vira "bilhete" (termo da
-- operação) em TODO o módulo VT — UI, código, tipos e banco. A migration 155
-- já está aplicada em produção (vt_combinacoes com as 9 seeds; vt_trajetos
-- vazia), então o rename é feito aqui, sem tocar na 155.
--
--  A) vt_combinacoes → vt_bilhetes (tabela). Policies, RLS, grants e defaults
--     acompanham o rename automaticamente; renomeamos os NOMES das policies,
--     do índice da PK e da constraint de CHECK (auto-nomeados pela 155) para
--     manter a coerência.
--  B) vt_trajetos: colunas combinacao_id → bilhete_id e combinacao_2_id →
--     bilhete_2_id. A expressão do CHECK o PostgreSQL atualiza sozinho;
--     renomeamos a constraint nomeada e as FKs auto-nomeadas.
--
-- GRANTs: o rename de tabela/coluna PRESERVA os grants — nada a re-conceder.
-- Idempotente: todos os renomes são guardados por IF EXISTS (via catálogos),
-- então rodar 2× seguidas é no-op. Sem dado alterado.

begin;

-- ============================================================
-- A) Tabela vt_combinacoes → vt_bilhetes
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'vt_combinacoes'
  ) THEN
    ALTER TABLE public.vt_combinacoes RENAME TO vt_bilhetes;
  END IF;
END $$;

-- Policies (acompanham a tabela no rename; aqui só trocam de nome).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT pol.polname AS nome
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relname = 'vt_bilhetes'
       AND pol.polname LIKE 'vt_combinacoes_%'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.vt_bilhetes RENAME TO %I',
      p.nome,
      replace(p.nome, 'vt_combinacoes', 'vt_bilhetes')
    );
  END LOOP;
END $$;

-- Índice da PK (nome auto-gerado pela 155: vt_combinacoes_pkey).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relname = 'vt_combinacoes_pkey'
       AND c.relkind = 'i'
  ) THEN
    ALTER INDEX public.vt_combinacoes_pkey RENAME TO vt_bilhetes_pkey;
  END IF;
END $$;

-- Constraint de CHECK auto-nomeada (vt_combinacoes_valor_diario_centavos_check).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relname = 'vt_bilhetes'
       AND con.conname = 'vt_combinacoes_valor_diario_centavos_check'
  ) THEN
    ALTER TABLE public.vt_bilhetes
      RENAME CONSTRAINT vt_combinacoes_valor_diario_centavos_check
      TO vt_bilhetes_valor_diario_centavos_check;
  END IF;
END $$;

-- ============================================================
-- B) Colunas de vt_trajetos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vt_trajetos'
       AND column_name = 'combinacao_id'
  ) THEN
    ALTER TABLE public.vt_trajetos RENAME COLUMN combinacao_id TO bilhete_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vt_trajetos'
       AND column_name = 'combinacao_2_id'
  ) THEN
    ALTER TABLE public.vt_trajetos RENAME COLUMN combinacao_2_id TO bilhete_2_id;
  END IF;
END $$;

-- Constraint nomeada da 155 (a expressão já aponta para as colunas novas).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relname = 'vt_trajetos'
       AND con.conname = 'vt_trajetos_combinacoes_distintas_ck'
  ) THEN
    ALTER TABLE public.vt_trajetos
      RENAME CONSTRAINT vt_trajetos_combinacoes_distintas_ck
      TO vt_trajetos_bilhetes_distintos_ck;
  END IF;
END $$;

-- FKs auto-nomeadas (vt_trajetos_combinacao_id_fkey / _combinacao_2_id_fkey).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relname = 'vt_trajetos'
       AND con.conname = 'vt_trajetos_combinacao_id_fkey'
  ) THEN
    ALTER TABLE public.vt_trajetos
      RENAME CONSTRAINT vt_trajetos_combinacao_id_fkey
      TO vt_trajetos_bilhete_id_fkey;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relname = 'vt_trajetos'
       AND con.conname = 'vt_trajetos_combinacao_2_id_fkey'
  ) THEN
    ALTER TABLE public.vt_trajetos
      RENAME CONSTRAINT vt_trajetos_combinacao_2_id_fkey
      TO vt_trajetos_bilhete_2_id_fkey;
  END IF;
END $$;

commit;
