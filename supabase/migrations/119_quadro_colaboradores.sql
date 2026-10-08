-- Migração 119: Quadro de Colaboradores (cartaz A4 por posto — CEU → Quadro)
--
-- Decisão da gestão (08/10/2026): cartaz para elevadores dos contratos com
-- foto, nome, função e horário/escala de cada colaborador do posto,
-- agrupado por função, com o ferista/faltista em folha separada
-- (reimprime só essa folha quando o ferista troca).
--
-- Colunas novas em colaboradores (todas nullable/default — sem backfill):
--  - horario_quadro: texto livre do horário/escala exibido no cartaz
--    (NULL = padrão: regime do contrato do vínculo ativo, ou "conforme
--    escala"). O horário não existe em nenhuma tabela — é dado novo.
--  - foto_foco: enquadramento da foto no cartaz (jsonb {zoom, px, py} —
--    frações/escala aplicadas via CSS object-position/transform;
--    NULL = padrão zoom 1, 50%/20%). Só o quadro usa nesta etapa.
--  - ferista_faltista: flag global do colaborador — marcado por toggle no
--    quadro; quem tem o flag sai do cartaz principal e vai para folha
--    separada. (ferias_feristas não resolve: é carteira de férias e o
--    faltista/ferista de posto, ex. Lohan, não consta lá.)
--
-- Escrita: UPDATE direto pela tela — a policy de UPDATE de colaboradores
-- (058) já aceita is_rh_ou_admin() OR is_editor(); a tela do quadro usa a
-- mesma permissão dos crachás (ceu.emitir_cracha: admin/adm/dp2/mesa) e o
-- dp3 NÃO acessa o quadro (rota dentro do guarda rota.ceu).
-- Não cria tabela — sem GRANT de tabela necessário.

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS horario_quadro text,
  ADD COLUMN IF NOT EXISTS foto_foco jsonb,
  ADD COLUMN IF NOT EXISTS ferista_faltista boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.colaboradores.horario_quadro IS
  'Horário/escala exibido no Quadro de Colaboradores (CEU → Quadro); NULL = regime do contrato do vínculo ativo ou "conforme escala".';
COMMENT ON COLUMN public.colaboradores.foto_foco IS
  'Enquadramento da foto no quadro (jsonb {zoom, px, py}, aplicado via CSS); NULL = padrão (zoom 1, 50%/20%).';
COMMENT ON COLUMN public.colaboradores.ferista_faltista IS
  'Colaborador ferista/faltista — sai do cartaz principal do quadro e vai para folha separada.';
