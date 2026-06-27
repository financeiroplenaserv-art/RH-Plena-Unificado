-- Migração 050: Adicionar mapeamentos de Perímetro do Flit
--
-- Baseado no arquivo "Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx"
-- A coluna M (Perímetro) contém os locais onde o colaborador bateu pelo celular.

-- Garantir extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função auxiliar
CREATE OR REPLACE FUNCTION public.normalizar_para_local(p_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_texto TEXT;
BEGIN
  IF p_texto IS NULL THEN
    RETURN NULL;
  END IF;

  v_texto := unaccent(p_texto);
  v_texto := upper(v_texto);
  v_texto := trim(regexp_replace(v_texto, '\\s+', ' ', 'g'));

  RETURN v_texto;
END;
$$;

-- Inserir locais que ainda não existem
INSERT INTO public.locais_trabalho (nome, nome_curto, status, observacao) VALUES
('ADMINISTRATIVO PLENA', 'ADMINISTRATIVO PLENA', 'Ativo', 'Importado do perímetro do Flit'),
('CENTRAL DE MONITORAMENTO', 'CENTRAL DE MONITORAMENTO', 'Ativo', 'Importado do perímetro do Flit'),
('GRAND VALLEY', 'GRAND VALLEY', 'Ativo', 'Importado do perímetro do Flit'),
('IGREJA METODISTA', 'IGREJA METODISTA', 'Ativo', 'Importado do perímetro do Flit'),
('LA RESERVE', 'LA RESERVE', 'Ativo', 'Importado do perímetro do Flit'),
('MB LOFTS', 'MB LOFTS', 'Ativo', 'Importado do perímetro do Flit'),
('NISE', 'NISE', 'Ativo', 'Importado do perímetro do Flit'),
('PRIDE', 'PRIDE', 'Ativo', 'Importado do perímetro do Flit')
ON CONFLICT DO NOTHING;

-- Mapeamentos de perímetro
WITH periodos AS (
  SELECT unnest(ARRAY[
    'Administrativo Plena',
    'Central de Monitoramento',
    'GRAND VALLEY',
    'IGREJA METODISTA',
    'LA RESERVE',
    'MB LOFTS',
    'NISE',
    'PRIDE',
    'ROSAS (ITAGUAÍ)'
  ]) AS nome_perimetro
),
mapeamentos_perimetro AS (
  SELECT
    p.nome_perimetro,
    CASE
      WHEN public.normalizar_para_local(p.nome_perimetro) ~ 'DALIAS|ROSAS' THEN 'CHÁCARA ITAGUAÍ'
      WHEN p.nome_perimetro = 'Administrativo Plena' THEN 'ADMINISTRATIVO PLENA'
      WHEN p.nome_perimetro = 'Central de Monitoramento' THEN 'CENTRAL DE MONITORAMENTO'
      ELSE p.nome_perimetro
    END AS nome_local
  FROM periodos p
)
INSERT INTO public.mapeamento_flit_local_trabalho (local_trabalho_id, tipo_match, valor_flit, prioridade, ativo)
SELECT
  lt.id,
  'perimetro',
  mp.nome_perimetro,
  90, -- prioridade maior que dispositivo e turno (mais confiável para celular)
  true
FROM mapeamentos_perimetro mp
JOIN public.locais_trabalho lt ON lt.nome = mp.nome_local
ON CONFLICT DO NOTHING;

-- Limpar função auxiliar
DROP FUNCTION IF EXISTS public.normalizar_para_local(TEXT);
