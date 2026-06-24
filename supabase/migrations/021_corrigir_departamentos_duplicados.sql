-- Migração 021: Corrige departamentos com nomes curtos duplicados

-- ============================================================
-- 1. Consolida CHÁCARA ITAGUAI (Rosas e Dalias são o mesmo prédio)
-- ============================================================

DO $$
DECLARE
  principal_id uuid;
  duplicado_id uuid;
BEGIN
  -- Seleciona o registro mais antigo como principal
  SELECT id INTO principal_id
  FROM public.departamentos
  WHERE nome_curto = 'CHÁCARA ITAGUAI'
  ORDER BY created_at ASC
  LIMIT 1;

  IF principal_id IS NOT NULL THEN
    -- Atualiza referências nas tabelas filhas
    UPDATE public.colaboradores
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    UPDATE public.contratos_adicionais
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    UPDATE public.extras
    SET departamento_id = principal_id
    WHERE departamento_id IN (
      SELECT id FROM public.departamentos
      WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id
    );

    -- Remove os duplicados
    DELETE FROM public.departamentos
    WHERE nome_curto = 'CHÁCARA ITAGUAI' AND id <> principal_id;
  END IF;
END $$;

-- ============================================================
-- 2. Diferencia as agências DUOCONNECT no nome_curto
-- ============================================================

UPDATE public.departamentos
SET nome_curto = 'DUOCONNECT ' || UPPER(REPLACE(nome, 'CENTRO AUDITIVO TELEX ', ''))
WHERE nome_curto = 'DUOCONNECT';
