-- 179 — VT: retira TRUNCATE/REFERENCES/TRIGGER de authenticated nas tabelas vt_*
-- (28/11/2026, pedido da gestora após a aplicação da 178).
--
-- O default de privilégios do projeto concede a authenticated, em toda tabela
-- nova, também TRUNCATE, REFERENCES e TRIGGER. TRUNCATE IGNORA o RLS: qualquer
-- usuário logado poderia esvaziar uma tabela inteira pela API. O app nunca usa
-- esses privilégios (só SELECT/INSERT/UPDATE/DELETE, que continuam como estão,
-- sujeitos às policies). service_role não muda.
--
-- Idempotente: roda sobre todas as tabelas public.vt_* existentes.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'vt\_%'
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

-- Conferência: nenhuma tabela vt_* pode ter TRUNCATE para authenticated/anon.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name LIKE 'vt\_%'
    AND grantee IN ('authenticated', 'anon')
    AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER');
  IF n > 0 THEN
    RAISE EXCEPTION '179: ainda há % privilégio(s) TRUNCATE/REFERENCES/TRIGGER em tabelas vt_*', n;
  END IF;
END $$;
