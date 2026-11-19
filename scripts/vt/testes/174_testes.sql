-- Testes da migration 174 (rodar SEMPRE dentro de transacao desfeita:
-- scripts/vt/testar-174-transacao.ps1). ASCII puro.
DO $$
DECLARE
  v_id uuid;
  v_padrao boolean;
BEGIN
  SELECT id INTO v_id FROM public.colaboradores LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: nenhum colaborador para o teste';
  END IF;

  -- 1) default false para linhas existentes
  SELECT vt_tarifa_cheia INTO v_padrao FROM public.colaboradores WHERE id = v_id;
  IF v_padrao IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FALHOU: default de vt_tarifa_cheia nao e false';
  END IF;
  IF EXISTS (SELECT 1 FROM public.colaboradores WHERE vt_tarifa_cheia) THEN
    RAISE EXCEPTION 'FALHOU: alguma linha nasceu com vt_tarifa_cheia = true';
  END IF;

  -- 2) marcar sem motivo e recusado
  BEGIN
    UPDATE public.colaboradores SET vt_tarifa_cheia = true, vt_tarifa_cheia_motivo = NULL WHERE id = v_id;
    RAISE EXCEPTION 'FALHOU: excecao sem motivo foi aceita';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 3) motivo so com espacos e recusado
  BEGIN
    UPDATE public.colaboradores SET vt_tarifa_cheia = true, vt_tarifa_cheia_motivo = '   ' WHERE id = v_id;
    RAISE EXCEPTION 'FALHOU: excecao com motivo vazio foi aceita';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- 4) marcar com motivo, autor e data e aceito
  UPDATE public.colaboradores
  SET vt_tarifa_cheia = true,
      vt_tarifa_cheia_motivo = 'teste da migration 174',
      vt_tarifa_cheia_por = gen_random_uuid(),
      vt_tarifa_cheia_em = now()
  WHERE id = v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALHOU: nao foi possivel marcar a excecao com motivo';
  END IF;

  -- 5) desmarcar (motivo pode ficar como historico ou ser limpo)
  UPDATE public.colaboradores SET vt_tarifa_cheia = false, vt_tarifa_cheia_motivo = NULL WHERE id = v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALHOU: nao foi possivel desmarcar a excecao';
  END IF;

  -- 6) reaplicar a migration e idempotente (as colunas continuam 4, CHECK 1)
  IF (SELECT count(*) FROM pg_constraint WHERE conname = 'colaboradores_vt_tarifa_cheia_motivo_ck') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: CHECK duplicado ou ausente';
  END IF;

  RAISE NOTICE 'TUDO OK - default false, motivo obrigatorio, marcar/desmarcar funcionam';
END $$;

SELECT 'TUDO OK 174' AS resultado,
       (SELECT count(*) FROM public.colaboradores WHERE vt_tarifa_cheia) AS com_excecao;
