-- Migração 168: VT — rascunho da carga no banco + auditoria das tabelas vt_*
--
-- Decisão da gestora em 02/11/2026, após o incidente de 25/10/2026: a mesa
-- calculou a carga de novembro/2026 e NADA foi gravado (vt_cargas ficou vazia)
-- porque o cálculo só existia na tela até o "Gravar carga" — e o botão estava
-- bloqueado pelo portão de pendências. Duas mudanças de desenho aprovadas:
--
-- (A) RASCUNHO NO BANCO: logo após o cálculo, a carga é salva em vt_cargas
--     com status 'rascunho' — o trabalho não depende mais de a aba ficar
--     aberta nem do aparelho. "Gravar carga" passa a CONFIRMAR (status
--     'gravada' + confirmada_em/por) somente quem está pronto
--     (`prontaParaGravar`), sem o portão tudo-ou-nada (B): quem tem pendência
--     fica como rascunho até ser resolvido e confirmado depois.
--     O rascunho NUNCA rebaixa nem sobrescreve uma linha já 'gravada'.
--     O fechamento (Fase 2b) lê SÓ linhas 'gravada'.
--
-- (C) AUDITORIA: nenhuma tabela vt_* gravava em log_auditoria (o único
--     trigger do módulo era o de updated_at em vt_trajetos) — o incidente de
--     25/10 ficou sem rastro por isso. Trilha auditar_operacao (migrations
--     029/061/066) aplicada às 5 tabelas do módulo.
--
-- Sem tabela nova — sem GRANT de tabela. vt_cargas está vazia na data (a
-- carga de novembro nunca foi gravada), então o DEFAULT não precisa de
-- backfill.

ALTER TABLE public.vt_cargas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho';
ALTER TABLE public.vt_cargas ADD COLUMN IF NOT EXISTS confirmada_em timestamptz;
ALTER TABLE public.vt_cargas ADD COLUMN IF NOT EXISTS confirmada_por uuid;
ALTER TABLE public.vt_cargas DROP CONSTRAINT IF EXISTS vt_cargas_status_ck;
ALTER TABLE public.vt_cargas ADD CONSTRAINT vt_cargas_status_ck CHECK (status IN ('rascunho', 'gravada'));

COMMENT ON COLUMN public.vt_cargas.status IS 'rascunho = calculado e salvo automaticamente; gravada = confirmada pelo operador (vale para o fechamento)';

DROP TRIGGER IF EXISTS trg_auditoria_vt_cargas ON public.vt_cargas;
CREATE TRIGGER trg_auditoria_vt_cargas
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_cargas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_vt_coberturas ON public.vt_coberturas;
CREATE TRIGGER trg_auditoria_vt_coberturas
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_coberturas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_vt_fechamentos ON public.vt_fechamentos;
CREATE TRIGGER trg_auditoria_vt_fechamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_vt_trajetos ON public.vt_trajetos;
CREATE TRIGGER trg_auditoria_vt_trajetos
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_trajetos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_vt_bilhetes ON public.vt_bilhetes;
CREATE TRIGGER trg_auditoria_vt_bilhetes
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_bilhetes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
