-- Migração 023: Gera nome_curto para departamentos que não têm correspondente válido

UPDATE public.departamentos
SET nome_curto = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        UPPER(nome),
        '^CONDOMINIO DO EDIFICIO[[:space:]]+', '', 'i'
      ),
      '^CONDOMINIO DO EDIFCIO[[:space:]]+', '', 'i'
    ),
    '^CONDOMINIO[[:space:]]+', '', 'i'
  )
)
WHERE (nome_curto IS NULL OR nome_curto = '')
  AND status = 'Ativo';
