-- Migração 066: Auditoria automática nas tabelas operacionais restantes
--
-- A migration 061 cobriu ocorrencias, colaboradores, extras, recibos_extras,
-- projetos_vr, resultados_vr e permissoes_perfil. Esta estende a trilha para
-- as demais tabelas com escrita disponível na UI, fechando o achado M11 da
-- auditoria: toda alteração/exclusão fica registrada em log_auditoria.

DROP TRIGGER IF EXISTS trg_auditoria_departamentos ON public.departamentos;
CREATE TRIGGER trg_auditoria_departamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_empresas ON public.empresas;
CREATE TRIGGER trg_auditoria_empresas
  AFTER INSERT OR UPDATE OR DELETE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_itens ON public.itens;
CREATE TRIGGER trg_auditoria_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_fornecedores ON public.fornecedores;
CREATE TRIGGER trg_auditoria_fornecedores
  AFTER INSERT OR UPDATE OR DELETE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_entregas ON public.entregas;
CREATE TRIGGER trg_auditoria_entregas
  AFTER INSERT OR UPDATE OR DELETE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_contratos_adicionais ON public.contratos_adicionais;
CREATE TRIGGER trg_auditoria_contratos_adicionais
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_vinculos_adicionais ON public.vinculos_adicionais;
CREATE TRIGGER trg_auditoria_vinculos_adicionais
  AFTER INSERT OR UPDATE OR DELETE ON public.vinculos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_calendario_adicionais ON public.calendario_adicionais;
CREATE TRIGGER trg_auditoria_calendario_adicionais
  AFTER INSERT OR UPDATE OR DELETE ON public.calendario_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
