-- Migração 114: pedido de férias do próprio colaborador (ferias_solicitacoes.pedido_colaborador)
--
-- Decisão da gestão em 25/09/2026: o colaborador PODE dizer quando quer
-- tirar férias — o RH registra o pedido (flag pedido_colaborador) e ele tem
-- destaque/prioridade na aprovação. Quem não pede nada entra no plano
-- automático (planejamentoAutomatico.ts), que agenda por ordem do que é
-- melhor para a empresa: limite concessivo mais antigo primeiro, encadeado
-- por contrato+função (respeitando o teto RN-01).
--
-- Aplicada via Management API em 25/09/2026.

ALTER TABLE public.ferias_solicitacoes
  ADD COLUMN IF NOT EXISTS pedido_colaborador BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ferias_solicitacoes.pedido_colaborador IS 'true = período pedido pelo próprio colaborador (registrado pelo RH); tem prioridade na aprovação e não é mexido pelo plano automático.';
