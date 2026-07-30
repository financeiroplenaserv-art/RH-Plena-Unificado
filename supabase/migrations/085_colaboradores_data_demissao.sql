-- ============================================================================
-- Migration 085: Versionar a coluna colaboradores.data_demissao.
--
-- Contexto: a coluna existe em produção (tipo date), mas foi criada fora das
-- migrations — drift entre o banco e o versionamento. O app já depende dela
-- de ponta a ponta: formulário de colaborador (salvar com demissão força
-- status Inativo), página de detalhes, importação Excel genérica
-- ("Data Demissão"/"Demissão") e integração e-Contador (a Edge Function busca
-- o atributo "demissao" da Alterdata e o hook grava data_demissao).
-- Esta migration apenas registra a coluna de forma idempotente (no-op em
-- produção) para que ambientes novos a tenham.
-- ============================================================================

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS data_demissao date;

COMMENT ON COLUMN public.colaboradores.data_demissao IS
  'Data de demissão do colaborador. Preenchida manualmente, por importação Excel ou pela integração e-Contador (atributo "demissao"). Quando preenchida, o colaborador é tratado como Inativo.';
