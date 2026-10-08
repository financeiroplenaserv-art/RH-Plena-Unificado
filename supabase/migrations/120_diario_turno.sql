-- Migração 120: preservar o turno da escala Flit em locais_trabalho_diario
--
-- Decisão da gestão (08/10/2026): o turno do Excel de escala do Flit traz o
-- HORÁRIO do colaborador embutido no texto (ex.: "19 às 7h CBO MACAÉ VIGIA N.
-- PAR", "8h às 17h CASCAIS"). Até aqui o turno era lido só para inferir o
-- local de trabalho (inferirLocalTrabalho) e DESCARTADO no upsert — era a
-- única fonte de horário do colaborador no sistema. O Quadro de
-- Colaboradores (CEU → Quadro, migration 119) usa o turno mais recente como
-- horário padrão do cartaz.
--
-- Coluna nova (nullable, sem backfill — as importações antigas não têm como
-- recuperar o turno; reimportar a escala do período preenche). O upsert da
-- importação (useEscalasDiario) passa a gravar `turno`.
-- Não cria tabela — sem GRANT de tabela necessário.

ALTER TABLE public.locais_trabalho_diario
  ADD COLUMN IF NOT EXISTS turno text;

COMMENT ON COLUMN public.locais_trabalho_diario.turno IS
  'Turno/horário do dia conforme a escala do Flit (ex.: "7h às 19h CBO"); usado como horário padrão no Quadro de Colaboradores.';
