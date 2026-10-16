-- Migração 133: integridade de anexos de ocorrências — nunca mais "anexo que não permaneceu"
--
-- Contexto (16/10/2026): dois incidentes reais mostraram que o toast "Anexo enviado"
-- não garantia anexo de verdade: (1) upload no bucket + INSERT na tabela bloqueado
-- por RLS gerou 29 objetos órfãos (sem linha na tabela — o anexo "sumia"); (2) um
-- atestado subiu com 0 bytes e ficou listado mas ilegível (página em branco).
-- O frontend passou a conferir o objeto gravado e a desfazer o upload quando o
-- registro falha (useAnexos), mas a garantia precisa valer no BANCO, para qualquer
-- caminho de escrita. Esta migration:
--
--   1. Trigger BEFORE INSERT/UPDATE em ocorrencia_anexos: o caminho_storage tem
--      que existir no bucket 'ocorrencia-anexos' com tamanho > 0 — impossível
--      registrar anexo sem arquivo real. Ignorada quando não há JWT
--      (auth.uid() IS NULL: restores, scripts e Management API), para não
--      quebrar restore de ambiente de teste sem os arquivos do bucket.
--   2. RPC anexos_verificar_integridade() (só admin): lista registro-sem-objeto,
--      objeto-sem-registro (órfão) e objeto vazio — auditoria sob demanda.
--   3. Policy de DELETE no bucket para objetos ÓRFÃOS: o rollback do frontend
--      (apagar o objeto recém-enviado quando o INSERT falha) também funciona
--      para perfis não-admin — a policy antiga de DELETE é só is_admin().
--      Só vale para objeto SEM linha na tabela, então não permite apagar anexo
--      de ninguém.
--
-- Não cria tabela — sem GRANT de tabela.
-- PREPARADA em 16/10/2026; APLICAR na mesma sessão da limpeza dos 29 objetos
-- órfãos (o passo 2 é o relatório que embasa a limpeza).

-- ============================================================
-- 1) Trigger de integridade
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_anexo_ocorrencia_integro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem JWT (restore de backup, script, Management API): não verifica —
  -- o ambiente de teste restaura as linhas sem os arquivos do bucket.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.caminho_storage IS NULL OR btrim(NEW.caminho_storage) = '' THEN
    RAISE EXCEPTION 'Anexo sem caminho de arquivo (caminho_storage vazio)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'ocorrencia-anexos'
      AND o.name = NEW.caminho_storage
      AND COALESCE((o.metadata->>'size')::bigint, 0) > 0
  ) THEN
    RAISE EXCEPTION 'O arquivo do anexo não existe no armazenamento ou está vazio: %', NEW.caminho_storage;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ocorrencia_anexos_integro ON public.ocorrencia_anexos;
CREATE TRIGGER trg_ocorrencia_anexos_integro
  BEFORE INSERT OR UPDATE OF caminho_storage ON public.ocorrencia_anexos
  FOR EACH ROW
  EXECUTE FUNCTION public.verificar_anexo_ocorrencia_integro();

-- ============================================================
-- 2) RPC de auditoria sob demanda (só admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.anexos_verificar_integridade()
RETURNS TABLE(tipo text, anexo_id uuid, caminho text, detalhe text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas admin/adm podem verificar a integridade dos anexos';
  END IF;

  -- Registro na tabela sem objeto no bucket (link quebrado)
  RETURN QUERY
    SELECT 'registro_sem_objeto'::text, a.id, a.caminho_storage,
           ('anexo "' || a.nome_arquivo || '" sem arquivo no bucket')::text
    FROM public.ocorrencia_anexos a
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'ocorrencia-anexos' AND o.name = a.caminho_storage
    );

  -- Objeto no bucket sem registro na tabela (órfão — candidato a limpeza)
  RETURN QUERY
    SELECT 'objeto_sem_registro'::text, NULL::uuid, o.name,
           ('objeto de ' || COALESCE(o.metadata->>'size', '?') || ' bytes sem linha em ocorrencia_anexos')::text
    FROM storage.objects o
    WHERE o.bucket_id = 'ocorrencia-anexos'
      AND NOT EXISTS (
        SELECT 1 FROM public.ocorrencia_anexos a
        WHERE a.caminho_storage = o.name
      );

  -- Objeto vazio (0 bytes) — ilegível mesmo com registro
  RETURN QUERY
    SELECT 'objeto_vazio'::text, a.id, o.name,
           ('objeto com 0 bytes' || CASE WHEN a.id IS NULL THEN ' (também órfão)' ELSE '' END)::text
    FROM storage.objects o
    LEFT JOIN public.ocorrencia_anexos a ON a.caminho_storage = o.name
    WHERE o.bucket_id = 'ocorrencia-anexos'
      AND COALESCE((o.metadata->>'size')::bigint, 0) = 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.anexos_verificar_integridade() TO authenticated;

-- ============================================================
-- 3) DELETE de objetos órfãos no bucket (rollback do frontend p/ não-admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.anexo_ocorrencia_sem_registro(path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.ocorrencia_anexos a
    WHERE a.caminho_storage = path
  );
$$;

GRANT EXECUTE ON FUNCTION public.anexo_ocorrencia_sem_registro(text) TO authenticated;

DROP POLICY IF EXISTS "Autenticados removem anexos orfaos de ocorrencia" ON storage.objects;
CREATE POLICY "Autenticados removem anexos orfaos de ocorrencia"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ocorrencia-anexos'
    AND public.pode_ver_anexos_ocorrencia()
    AND public.anexo_ocorrencia_sem_registro(name)
  );
