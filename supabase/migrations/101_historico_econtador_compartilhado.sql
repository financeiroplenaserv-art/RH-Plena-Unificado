-- 101: histórico de importações e-Contador compartilhado entre os perfis que importam
-- Decisão da gestão (12/08/2026): a operação usa várias contas (adm/dp1/dp2) para
-- importar e cada usuário via apenas o próprio histórico (RLS por usuario_id),
-- o que gerava confusão ("cadê a importação que fiz de manhã?"). O SELECT passa a
-- valer para todos os perfis com permissão de importação — os mesmos da Edge
-- Function econtador (admin, adm, dp1, dp2). INSERT/UPDATE/DELETE inalterados.

CREATE OR REPLACE FUNCTION public.pode_importar_econtador()
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

DROP POLICY IF EXISTS "Permitir select de historico_importacoes_econtador" ON public.historico_importacoes_econtador;

CREATE POLICY "Permitir select de historico_importacoes_econtador"
ON public.historico_importacoes_econtador
FOR SELECT
TO authenticated
USING (public.pode_importar_econtador());
