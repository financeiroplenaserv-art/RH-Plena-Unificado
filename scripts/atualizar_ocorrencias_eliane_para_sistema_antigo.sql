-- Atualiza ocorrências importadas para referenciar o sistema antigo ao invés da planilha Eliane
-- Execute no SQL Editor do Supabase ou via psql

DO $$
BEGIN
  UPDATE public.ocorrencias
  SET descricao = REPLACE(descricao, 'planilha Eliane', 'sistema antigo')
  WHERE descricao ILIKE '%planilha Eliane%';

  UPDATE public.ocorrencias
  SET descricao = REPLACE(descricao, 'na planilha', 'no sistema antigo')
  WHERE descricao ILIKE '%na planilha%';

  UPDATE public.ocorrencias
  SET base_legal = REPLACE(base_legal, 'planilha Eliane', 'sistema antigo')
  WHERE base_legal ILIKE '%planilha Eliane%';

  UPDATE public.ocorrencias
  SET defesa_funcionario = REPLACE(defesa_funcionario, 'planilha Eliane', 'sistema antigo')
  WHERE defesa_funcionario ILIKE '%planilha Eliane%';

  UPDATE public.ocorrencias
  SET medida_corretiva = REPLACE(medida_corretiva, 'planilha Eliane', 'sistema antigo')
  WHERE medida_corretiva ILIKE '%planilha Eliane%';

  -- Caso exista alguma referência direta a "Eliane" (sem "planilha") em campos de texto
  UPDATE public.ocorrencias
  SET descricao = REPLACE(descricao, 'Eliane', 'sistema antigo')
  WHERE descricao ILIKE '%Eliane%';

  UPDATE public.ocorrencias
  SET base_legal = REPLACE(base_legal, 'Eliane', 'sistema antigo')
  WHERE base_legal ILIKE '%Eliane%';

  UPDATE public.ocorrencias
  SET defesa_funcionario = REPLACE(defesa_funcionario, 'Eliane', 'sistema antigo')
  WHERE defesa_funcionario ILIKE '%Eliane%';

  UPDATE public.ocorrencias
  SET medida_corretiva = REPLACE(medida_corretiva, 'Eliane', 'sistema antigo')
  WHERE medida_corretiva ILIKE '%Eliane%';
END $$;
