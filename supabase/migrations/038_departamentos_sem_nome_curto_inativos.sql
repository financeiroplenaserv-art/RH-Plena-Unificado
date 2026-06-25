-- Migração 038: Marca como Inativo os departamentos sem nome_curto
--
-- Regra de negócio: o sistema deve exibir apenas departamentos que possuem
-- nome_curto preenchido. Departamentos sem nome_curto são legados ou
-- importados de forma incompleta e devem ficar ocultos da listagem.
--
-- Atenção: não excluímos os registros para preservar o histórico e
-- possíveis vínculos em outras tabelas.

UPDATE public.departamentos
SET status = 'Inativo'
WHERE nome_curto IS NULL
   OR TRIM(nome_curto) = '';
