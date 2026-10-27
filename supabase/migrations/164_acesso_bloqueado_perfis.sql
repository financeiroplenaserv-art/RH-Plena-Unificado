-- 164_acesso_bloqueado_perfis.sql
-- Decisao da gestao: suspender o acesso de uma PESSOA (ex.: saiu da empresa)
-- sem apagar o perfil nem mexer nas permissoes do nivel — outra pessoa pode
-- assumir o mesmo e-mail depois e o acesso e reativado com um clique.
--
-- (A) Coluna perfis.acesso_bloqueado (padrao false). O useAuth desloga na hora
--     quem esta bloqueado (login e restauracao de sessao).
-- (B) Trigger de protecao: a policy de UPDATE de perfis (058) permite ao
--     usuario alterar a PROPRIA linha — sem esta trava, um usuario bloqueado
--     com sessao ainda valida poderia se desbloquear pela API. Somente
--     admin/adm (is_admin()) pode mudar a coluna; service_role e scripts
--     (auth.uid() nulo) passam livre.
-- Sem tabela nova — sem GRANT de tabela.

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS acesso_bloqueado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.perfis_proteger_acesso_bloqueado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acesso_bloqueado IS DISTINCT FROM OLD.acesso_bloqueado
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem bloquear ou desbloquear o acesso.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfis_acesso_bloqueado ON public.perfis;
CREATE TRIGGER trg_perfis_acesso_bloqueado
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.perfis_proteger_acesso_bloqueado();
