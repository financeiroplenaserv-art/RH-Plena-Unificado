-- 167_vt_bu_ativado_riocard.sql
-- Decisão da gestora em 28/10/2026: antes de classificar o cartão (BUN/BUI/JAE/
-- sem), gravar o FATO oficial vindo do site da Riocard: quem tem o Bilhete
-- Único ATIVADO. O BUI só vale com o cartão validado — trajeto de R$ 18,80
-- para quem está com o BU suspenso não cobre o trajeto na rua (o cruzamento de
-- 28/10 achou 11 casos). O tipo de cartão (vt_tipo_cartao) continua sendo a
-- classificação operacional; o fato Riocard é a âncora que a valida.
--
--  A) colaboradores.vt_bu_ativado (boolean; NULL = ainda não consultado na
--     Riocard) + vt_bu_situacao (texto cru do site: Ativado / Suspenso Setrans
--     / Não possui BU / Desativado / Ativação Solicitada) +
--     vt_bu_consultado_em (data do arquivo) + vt_riocard_numero_cartao (o "Nº
--     do Cartão" do site — número de série do cartão, útil na Fase 4 Riocard).
--
-- **Preparada, NÃO aplicada** — aplicar via Management API (script de ARQUIVO,
-- nunca inline — regra da migration 131). A importação da lista fica em
-- scripts/vt/importar-riocard-bu.ts (dry-run por padrão).
--
-- Sem tabela nova — sem GRANT. Idempotente (IF NOT EXISTS / DROP IF EXISTS).

begin;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_bu_ativado boolean;
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_bu_situacao text;
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_bu_consultado_em date;
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_riocard_numero_cartao text;

commit;
