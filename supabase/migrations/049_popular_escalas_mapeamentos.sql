-- Migração 049: Popular Locais de Trabalho e Mapeamentos do Flit
--
-- Regras aplicadas:
-- - Tudo em maiúsculo
-- - Dispositivos/departamentos que contêm DÁLIAS, DALIAS ou ROSAS vão para CHÁCARA ITAGUAÍ
-- - Nomes dos locais seguem o padrão de nomes curtos dos departamentos

-- ============================================================
-- 0. Garantir extensão unaccent
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 1. Função auxiliar para normalizar texto
-- ============================================================

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

  -- Remove acentos
  v_texto := unaccent(p_texto);
  -- Converte para maiúsculo
  v_texto := upper(v_texto);
  -- Remove espaços extras
  v_texto := trim(regexp_replace(v_texto, '\\s+', ' ', 'g'));

  RETURN v_texto;
END;
$$;

-- ============================================================
-- 2. Inserir Locais de Trabalho
-- ============================================================

INSERT INTO public.locais_trabalho (nome, nome_curto, status, observacao) VALUES
('ABAETÉ', 'ABAETÉ', 'Ativo', 'Importado automaticamente do Flit'),
('BACK ART', 'BACK ART', 'Ativo', 'Importado automaticamente do Flit'),
('BLUE TERMINAIS', 'BLUE TERMINAIS', 'Ativo', 'Importado automaticamente do Flit'),
('BUSINESS CENTER', 'BUSINESS CENTER', 'Ativo', 'Importado automaticamente do Flit'),
('CALLE MAGGIORE', 'CALLE MAGGIORE', 'Ativo', 'Importado automaticamente do Flit'),
('CARMO CAMPANELLA', 'CARMO CAMPANELLA', 'Ativo', 'Importado automaticamente do Flit'),
('CARVALHO NETO', 'CARVALHO NETO', 'Ativo', 'Importado automaticamente do Flit'),
('CASCAIS', 'CASCAIS', 'Ativo', 'Importado automaticamente do Flit'),
('CBO MACAÉ', 'CBO MACAÉ', 'Ativo', 'Importado automaticamente do Flit'),
('CBO NITERÓI', 'CBO NITERÓI', 'Ativo', 'Importado automaticamente do Flit'),
('CENTRAL PORTARIA REMOTA', 'CENTRAL PORTARIA REMOTA', 'Ativo', 'Importado automaticamente do Flit'),
('CENTRO AUDITIVO TELEX', 'CENTRO AUDITIVO TELEX', 'Ativo', 'Importado automaticamente do Flit'),
('CHÁCARA DO ABAETÉ', 'CHÁCARA DO ABAETÉ', 'Ativo', 'Importado automaticamente do Flit'),
('CHÁCARA ITAGUAÍ', 'CHÁCARA ITAGUAÍ', 'Ativo', 'Importado automaticamente do Flit'),
('CNOOC PETROLEUM', 'CNOOC PETROLEUM', 'Ativo', 'Importado automaticamente do Flit'),
('DUOCONNECT SOLUÇÕES', 'DUOCONNECT SOLUÇÕES', 'Ativo', 'Importado automaticamente do Flit'),
('DUOCONNECT TELEX', 'DUOCONNECT TELEX', 'Ativo', 'Importado automaticamente do Flit'),
('ENSEADA PARK', 'ENSEADA PARK', 'Ativo', 'Importado automaticamente do Flit'),
('EXCLUSIVE', 'EXCLUSIVE', 'Ativo', 'Importado automaticamente do Flit'),
('FLAMBOYANT', 'FLAMBOYANT', 'Ativo', 'Importado automaticamente do Flit'),
('FONSECA', 'FONSECA', 'Ativo', 'Importado automaticamente do Flit'),
('FOREVER', 'FOREVER', 'Ativo', 'Importado automaticamente do Flit'),
('GERANIUM', 'GERANIUM', 'Ativo', 'Importado automaticamente do Flit'),
('GRAND VALLEY', 'GRAND VALLEY', 'Ativo', 'Importado automaticamente do Flit'),
('GREAT PLACE', 'GREAT PLACE', 'Ativo', 'Importado automaticamente do Flit'),
('IDA SCARSELLI', 'IDA SCARSELLI', 'Ativo', 'Importado automaticamente do Flit'),
('IGREJA METODISTA', 'IGREJA METODISTA', 'Ativo', 'Importado automaticamente do Flit'),
('JARDIM FONSECA', 'JARDIM FONSECA', 'Ativo', 'Importado automaticamente do Flit'),
('JARDINS ICARAÍ', 'JARDINS ICARAÍ', 'Ativo', 'Importado automaticamente do Flit'),
('LA RESERVE', 'LA RESERVE', 'Ativo', 'Importado automaticamente do Flit'),
('LA ROCHELLE', 'LA ROCHELLE', 'Ativo', 'Importado automaticamente do Flit'),
('LAGOA MAR', 'LAGOA MAR', 'Ativo', 'Importado automaticamente do Flit'),
('MARINO RESIDENCIAL', 'MARINO RESIDENCIAL', 'Ativo', 'Importado automaticamente do Flit'),
('MATIZES ICARAÍ', 'MATIZES ICARAÍ', 'Ativo', 'Importado automaticamente do Flit'),
('MB LOFTS', 'MB LOFTS', 'Ativo', 'Importado automaticamente do Flit'),
('MÉRITO BARRETO', 'MÉRITO BARRETO', 'Ativo', 'Importado automaticamente do Flit'),
('MIRAFLORES', 'MIRAFLORES', 'Ativo', 'Importado automaticamente do Flit'),
('NOVAS CORES', 'NOVAS CORES', 'Ativo', 'Importado automaticamente do Flit'),
('NUTRINDO IDEAIS', 'NUTRINDO IDEAIS', 'Ativo', 'Importado automaticamente do Flit'),
('OCEAN PLACE', 'OCEAN PLACE', 'Ativo', 'Importado automaticamente do Flit'),
('OITICICA', 'OITICICA', 'Ativo', 'Importado automaticamente do Flit'),
('OLIMPIO BARGIELA', 'OLIMPIO BARGIELA', 'Ativo', 'Importado automaticamente do Flit'),
('OSCAR PEREIRA', 'OSCAR PEREIRA', 'Ativo', 'Importado automaticamente do Flit'),
('PALAZZO', 'PALAZZO', 'Ativo', 'Importado automaticamente do Flit'),
('PALAZZO ITAÚBA', 'PALAZZO ITAÚBA', 'Ativo', 'Importado automaticamente do Flit'),
('PARQUE DOS PRÍNCIPES', 'PARQUE DOS PRÍNCIPES', 'Ativo', 'Importado automaticamente do Flit'),
('PRIDE', 'PRIDE', 'Ativo', 'Importado automaticamente do Flit'),
('PRIDE STYLE', 'PRIDE STYLE', 'Ativo', 'Importado automaticamente do Flit'),
('PROFESSOR OITICICA', 'PROFESSOR OITICICA', 'Ativo', 'Importado automaticamente do Flit'),
('QUATRE', 'QUATRE', 'Ativo', 'Importado automaticamente do Flit'),
('QUINCAS', 'QUINCAS', 'Ativo', 'Importado automaticamente do Flit'),
('QUINCAS PATRIMONIAL', 'QUINCAS PATRIMONIAL', 'Ativo', 'Importado automaticamente do Flit'),
('QUINTAS DE ICARAÍ', 'QUINTAS DE ICARAÍ', 'Ativo', 'Importado automaticamente do Flit'),
('QUINTESSENZA', 'QUINTESSENZA', 'Ativo', 'Importado automaticamente do Flit'),
('ROSAS', 'ROSAS', 'Ativo', 'Importado automaticamente do Flit'),
('SAN FRANCISCO HILLS', 'SAN FRANCISCO HILLS', 'Ativo', 'Importado automaticamente do Flit'),
('SOLAR DAS OLIVEIRAS', 'SOLAR DAS OLIVEIRAS', 'Ativo', 'Importado automaticamente do Flit'),
('SOLAR DO AMAPA', 'SOLAR DO AMAPA', 'Ativo', 'Importado automaticamente do Flit'),
('SPLENDIDO', 'SPLENDIDO', 'Ativo', 'Importado automaticamente do Flit'),
('SPLENDIDO RESIDENCIAL', 'SPLENDIDO RESIDENCIAL', 'Ativo', 'Importado automaticamente do Flit'),
('SUMMER BAY', 'SUMMER BAY', 'Ativo', 'Importado automaticamente do Flit'),
('TATHIANA', 'TATHIANA', 'Ativo', 'Importado automaticamente do Flit'),
('TELEX NITERÓI E ICARAÍ', 'TELEX NITERÓI E ICARAÍ', 'Ativo', 'Importado automaticamente do Flit'),
('VILA DE CASCAIS', 'VILA DE CASCAIS', 'Ativo', 'Importado automaticamente do Flit'),
('WINBLEDON', 'WINBLEDON', 'Ativo', 'Importado automaticamente do Flit')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Inserir Mapeamentos por Dispositivo (Flit Multi)
-- ============================================================

WITH dispositivos AS (
  SELECT unnest(ARRAY[
    'ABAETÉ',
    'BACK ART',
    'CALLE MAGGIORE',
    'CARMO CAMPANELLA',
    'CARVALHO NETO',
    'CASCAIS',
    'CBO MACAÉ',
    'CBO NITERÓI',
    'CENTRAL PORTARIA REMOTA',
    'CNOOC',
    'ENSEADA PARK MULT',
    'EXCLUSIVE',
    'FONSECA',
    'FOREVER',
    'GERANIUM',
    'GRAND VALLEY',
    'GREAT PLACE',
    'IGREJA METODISTA',
    'JARDINS ICARAÍ',
    'LA ROCHELLE',
    'LAGOA MAR',
    'MARINO',
    'MATIZES MULT',
    'MÉRITO BARRTO',
    'MIRAFLORES',
    'NOVAS CORES',
    'OSCAR PEREIRA',
    'PALAZZO',
    'PARQUE PRÍNCIPES MULT',
    'QUATRE',
    'QUINCAS PATRIMONIAL',
    'QUINTAS',
    'QUINTESSENZA',
    'ROSAS (ITAGUAÍ)',
    'SAN FRANCISCO HILLS',
    'SPLENDIDO',
    'TATHIANA',
    'TELEX NITERÓI E ICARAÍ',
    'WINBLEDON'
  ]) AS nome_dispositivo
),
mapeamentos_dispositivo AS (
  SELECT
    d.nome_dispositivo,
    CASE
      WHEN public.normalizar_para_local(d.nome_dispositivo) ~ 'DALIAS|ROSAS' THEN 'CHÁCARA ITAGUAÍ'
      WHEN d.nome_dispositivo = 'ENSEADA PARK MULT' THEN 'ENSEADA PARK'
      WHEN d.nome_dispositivo = 'MATIZES MULT' THEN 'MATIZES ICARAÍ'
      WHEN d.nome_dispositivo = 'PARQUE PRÍNCIPES MULT' THEN 'PARQUE DOS PRÍNCIPES'
      WHEN d.nome_dispositivo = 'MÉRITO BARRTO' THEN 'MÉRITO BARRETO'
      WHEN d.nome_dispositivo = 'ROSAS (ITAGUAÍ)' THEN 'CHÁCARA ITAGUAÍ'
      ELSE d.nome_dispositivo
    END AS nome_local
  FROM dispositivos d
)
INSERT INTO public.mapeamento_flit_local_trabalho (local_trabalho_id, tipo_match, valor_flit, prioridade, ativo)
SELECT
  lt.id,
  'dispositivo',
  md.nome_dispositivo,
  100,
  true
FROM mapeamentos_dispositivo md
JOIN public.locais_trabalho lt ON lt.nome = md.nome_local
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Inserir Mapeamentos por Turno contendo Departamento
-- ============================================================

WITH deptos AS (
  SELECT unnest(ARRAY[
    'ABAETÉ',
    'BACK ART',
    'BLUE TERMINAIS',
    'BUSINESS CENTER',
    'CALLE MAGGIORE',
    'CARMO CAMPANELLA',
    'CARVALHO NETO',
    'CBO MACAÉ',
    'CBO NITERÓI',
    'CENTRAL PORTARIA REMOTA',
    'CENTRO AUDITIVO TELEX',
    'CHÁCARA DO ABAETÉ',
    'CHÁCARA ITAGUAÍ',
    'CNOOC PETROLEUM',
    'DUOCONNECT SOLUÇÕES',
    'DUOCONNECT TELEX',
    'ENSEADA LIMP COM INSA',
    'ENSEADA LIMPEZA',
    'ENSEADA PARK',
    'EXCLUSIVE CHARITAS',
    'FLAMBOYANT',
    'FONSECA',
    'FOREVER',
    'FOREVER LIMPEZA COM INSALUBRIDADE',
    'GERANIUM',
    'GERANIUM ZELADOR',
    'GRAND VALLEY',
    'GREAT PLACE',
    'GREAT PLACE LIMP C INSAL',
    'GREAT PLACE PORTARIA',
    'IDA SCARSELLI',
    'IGREJA METODISTA ICARAÍ',
    'JARDIM FONSECA',
    'JARDINS ICARAÍ',
    'LA RESERVE',
    'LA ROCHELLE',
    'LAGOA MAR',
    'MARINO LIMPEZA & ENCARREGADO',
    'MARINO RESIDENCIAL',
    'MATIZES ICARAÍ',
    'MB LOFTS',
    'MÉRITO BARRETO',
    'MIRAFLORES',
    'NOVAS CORES',
    'NUTRINDO IDEAIS',
    'OCEAN PLACE',
    'OITICICA',
    'OLIMPIO BARGIELA',
    'OSCAR PEREIRA',
    'PALAZZO',
    'PALAZZO ITAÚBA',
    'PARQUE DOS PRÍNCIPES',
    'PARQUE PRINCIPES',
    'PLENA EA ADMINISTRATIVO',
    'PLENA TECH ADMINISTRATIVO',
    'PRAIA DOFIR',
    'PRIDE',
    'PRIDE STYLE',
    'PROFESSOR OITICICA',
    'QUATRE',
    'QUINCAS',
    'QUINCAS PATRIMONIAL LTDA',
    'QUINTAS DE ICARAÍ',
    'QUINTAS PORTARIA',
    'QUINTESSENZA',
    'RESIDENCIAL QUATRE',
    'SAN FRANCISCO HILLS',
    'SOLAR DAS OLIVEIRAS',
    'SOLAR DO AMAPA',
    'SPLENDIDO',
    'SPLENDIDO RESIDENCIAL',
    'SUMMER BAY',
    'SUMMER BAY RES.',
    'THATIANA',
    'VILA DE CASCAIS',
    'VILA DE CASCAIS RESIDENCIAL',
    'WINBLEDON'
  ]) AS nome_departamento
),
mapeamentos_turno AS (
  SELECT
    d.nome_departamento,
    CASE
      WHEN public.normalizar_para_local(d.nome_departamento) ~ 'DALIAS|ROSAS' THEN 'CHÁCARA ITAGUAÍ'
      WHEN d.nome_departamento IN ('CHÁCARA DO ABAETÉ') THEN 'ABAETÉ'
      WHEN d.nome_departamento IN ('ENSEADA LIMP COM INSA', 'ENSEADA LIMPEZA') THEN 'ENSEADA PARK'
      WHEN d.nome_departamento IN ('EXCLUSIVE CHARITAS') THEN 'EXCLUSIVE'
      WHEN d.nome_departamento IN ('FOREVER LIMPEZA COM INSALUBRIDADE') THEN 'FOREVER'
      WHEN d.nome_departamento IN ('GERANIUM ZELADOR') THEN 'GERANIUM'
      WHEN d.nome_departamento IN ('GREAT PLACE LIMP C INSAL', 'GREAT PLACE PORTARIA') THEN 'GREAT PLACE'
      WHEN d.nome_departamento IN ('IGREJA METODISTA ICARAÍ') THEN 'IGREJA METODISTA'
      WHEN d.nome_departamento IN ('JARDIM FONSECA') THEN 'FONSECA'
      WHEN d.nome_departamento IN ('MARINO LIMPEZA & ENCARREGADO', 'MARINO RESIDENCIAL') THEN 'MARINO RESIDENCIAL'
      WHEN d.nome_departamento IN ('PALAZZO ITAÚBA') THEN 'PALAZZO'
      WHEN d.nome_departamento IN ('PARQUE PRINCIPES') THEN 'PARQUE DOS PRÍNCIPES'
      WHEN d.nome_departamento IN ('PLENA EA ADMINISTRATIVO', 'PLENA TECH ADMINISTRATIVO') THEN NULL -- Administrativo, sem local fixo
      WHEN d.nome_departamento IN ('PRIDE STYLE') THEN 'PRIDE'
      WHEN d.nome_departamento IN ('PROFESSOR OITICICA') THEN 'OITICICA'
      WHEN d.nome_departamento IN ('QUINCAS PATRIMONIAL LTDA') THEN 'QUINCAS PATRIMONIAL'
      WHEN d.nome_departamento IN ('QUINTAS PORTARIA') THEN 'QUINTAS DE ICARAÍ'
      WHEN d.nome_departamento IN ('RESIDENCIAL QUATRE') THEN 'QUATRE'
      WHEN d.nome_departamento IN ('SOLAR DAS OLIVEIRAS') THEN 'SOLAR DAS OLIVEIRAS'
      WHEN d.nome_departamento IN ('SOLAR DO AMAPA') THEN 'SOLAR DO AMAPA'
      WHEN d.nome_departamento IN ('SPLENDIDO RESIDENCIAL') THEN 'SPLENDIDO'
      WHEN d.nome_departamento IN ('SUMMER BAY RES.') THEN 'SUMMER BAY'
      WHEN d.nome_departamento IN ('THATIANA') THEN 'TATHIANA'
      WHEN d.nome_departamento IN ('VILA DE CASCAIS RESIDENCIAL') THEN 'VILA DE CASCAIS'
      ELSE d.nome_departamento
    END AS nome_local
  FROM deptos d
)
INSERT INTO public.mapeamento_flit_local_trabalho (local_trabalho_id, tipo_match, valor_flit, prioridade, ativo)
SELECT
  lt.id,
  'turno_departamento',
  mt.nome_departamento,
  100,
  true
FROM mapeamentos_turno mt
JOIN public.locais_trabalho lt ON lt.nome = mt.nome_local
WHERE mt.nome_local IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Limpar função auxiliar
-- ============================================================

-- ============================================================
-- 6. Garantir unique constraint para evitar duplicatas futuras
-- ============================================================

ALTER TABLE public.locais_trabalho
DROP CONSTRAINT IF EXISTS unique_local_trabalho_nome;

ALTER TABLE public.locais_trabalho
ADD CONSTRAINT unique_local_trabalho_nome
UNIQUE (nome);

ALTER TABLE public.mapeamento_flit_local_trabalho
DROP CONSTRAINT IF EXISTS unique_mapeamento_flit_local;

ALTER TABLE public.mapeamento_flit_local_trabalho
ADD CONSTRAINT unique_mapeamento_flit_local
UNIQUE (local_trabalho_id, tipo_match, valor_flit);

DROP FUNCTION IF EXISTS public.normalizar_para_local(TEXT);
