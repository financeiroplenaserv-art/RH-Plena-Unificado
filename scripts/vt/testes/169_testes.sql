-- Testes da migration 169, executados na MESMA transação da migration.
-- Não contém BEGIN/COMMIT/ROLLBACK: scripts/vt/testar-169-transacao.ps1 monta
-- migration + estes testes + ROLLBACK. Nunca executar isoladamente em produção.

DO $$
DECLARE
  v_decisao record;
  v_nova_decisao uuid;
  ok boolean;
BEGIN
  -- 1) Backfill: conteúdo e referências, não apenas contagens.
  IF NOT EXISTS (SELECT 1 FROM public.vt_pacotes) THEN
    RAISE EXCEPTION 'FALHOU: nenhum pacote foi criado';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.vt_bilhetes b
      LEFT JOIN public.vt_pacote_precos pp ON pp.bilhete_legado_id = b.id
      LEFT JOIN public.vt_pacotes p ON p.id = pp.pacote_id
     WHERE pp.id IS NULL
        OR p.id IS NULL
        OR pp.valor_diario_centavos <> b.valor_diario_centavos
        OR pp.vigente_desde <> b.vigente_desde
        OR p.legado_nome IS DISTINCT FROM b.nome
  ) THEN
    RAISE EXCEPTION 'FALHOU: preço ou pacote diverge do bilhete legado';
  END IF;

  WITH esperado AS (
    SELECT b.id,
           lead(b.vigente_desde) OVER (
             PARTITION BY b.nome ORDER BY b.vigente_desde, b.created_at, b.id
           ) - 1 AS vigente_ate
      FROM public.vt_bilhetes b
  )
  SELECT 1 INTO ok
   WHERE EXISTS (
     SELECT 1
       FROM esperado e
       JOIN public.vt_pacote_precos pp ON pp.bilhete_legado_id = e.id
      WHERE pp.vigente_ate IS DISTINCT FROM e.vigente_ate
   );
  IF ok THEN
    RAISE EXCEPTION 'FALHOU: fechamento das vigências diverge do legado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vt_trajeto_decisoes
     WHERE origem = 'legado'
       AND vigente_desde <> (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) THEN
    RAISE EXCEPTION 'FALHOU: composição legada recebeu vigência anterior à data de corte';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.vt_trajetos t
      LEFT JOIN public.vt_beneficio_ajustes a
        ON a.decisao_trajeto_id IN (
          SELECT d.id FROM public.vt_trajeto_decisoes d WHERE d.trajeto_legado_id = t.id
        )
       AND a.origem = 'legado'
     WHERE COALESCE(t.valor_extra_centavos, 0) <> 0
       AND (a.id IS NULL OR a.valor_diario_centavos <> t.valor_extra_centavos)
  ) THEN
    RAISE EXCEPTION 'FALHOU: valor extra não foi preservado';
  END IF;

  SELECT d.* INTO v_decisao
    FROM public.vt_trajeto_decisoes d
    JOIN public.vt_trajeto_decisao_componentes dc ON dc.decisao_trajeto_id = d.id
   WHERE d.status = 'confirmada'
   ORDER BY d.id
   LIMIT 1;
  IF v_decisao.id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: não há decisão confirmada para testar as travas';
  END IF;

  -- 2) Decisão confirmada: conteúdo não muda, mas vigente_ate pode fechar.
  ok := false;
  BEGIN
    UPDATE public.vt_trajeto_decisoes SET cotacao_id = 'adulterado'
     WHERE id = v_decisao.id;
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%nova revisão%';
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FALHOU: alteração de decisão confirmada foi aceita';
  END IF;
  IF (SELECT cotacao_id FROM public.vt_trajeto_decisoes WHERE id = v_decisao.id)
     IS DISTINCT FROM v_decisao.cotacao_id THEN
    RAISE EXCEPTION 'FALHOU: decisão confirmada foi alterada apesar da trava';
  END IF;

  UPDATE public.vt_trajeto_decisoes SET vigente_ate = '2099-12-31'
   WHERE id = v_decisao.id;
  IF (SELECT vigente_ate FROM public.vt_trajeto_decisoes WHERE id = v_decisao.id) <> '2099-12-31' THEN
    RAISE EXCEPTION 'FALHOU: fechamento de vigência foi bloqueado indevidamente';
  END IF;

  -- 3) Componentes e ajustes de decisão confirmada são imutáveis.
  ok := false;
  BEGIN
    INSERT INTO public.vt_trajeto_decisao_componentes (decisao_trajeto_id, pacote_id, ordem)
    SELECT v_decisao.id, dc.pacote_id, max(dc.ordem) + 1
      FROM public.vt_trajeto_decisao_componentes dc
     WHERE dc.decisao_trajeto_id = v_decisao.id
     GROUP BY dc.pacote_id
     LIMIT 1;
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%nova revisão%';
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FALHOU: componente foi incluído em decisão confirmada';
  END IF;

  ok := false;
  BEGIN
    INSERT INTO public.vt_beneficio_ajustes (
      decisao_trajeto_id, valor_diario_centavos, motivo, autor_id,
      vigente_desde, vigente_ate, origem
    ) VALUES (
      v_decisao.id, 1, 'teste de trava', NULL, NULL, NULL, 'legado'
    );
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%nova revisão%';
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FALHOU: ajuste foi incluído em decisão confirmada';
  END IF;

  ok := false;
  BEGIN
    DELETE FROM public.vt_trajeto_decisoes WHERE id = v_decisao.id;
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%nova revisão%';
  END;
  IF NOT ok OR NOT EXISTS (SELECT 1 FROM public.vt_trajeto_decisoes WHERE id = v_decisao.id) THEN
    RAISE EXCEPTION 'FALHOU: exclusão de decisão confirmada foi aceita';
  END IF;

  -- 4) A correção permitida é uma NOVA REVISÃO, com componentes próprios e auditoria.
  INSERT INTO public.vt_trajeto_decisoes (
    trajeto_legado_id, colaborador_id, departamento_id, revisao,
    cotacao_id, status, confirmado_por, confirmado_em,
    vigente_desde, vigente_ate, origem, referencias_legadas_nao_resolvidas
  )
  SELECT trajeto_legado_id, colaborador_id, departamento_id, revisao + 1,
         cotacao_id, 'sugerida', NULL, NULL,
         (now() AT TIME ZONE 'America/Sao_Paulo')::date, NULL, 'manual', '{}'::uuid[]
    FROM public.vt_trajeto_decisoes
   WHERE id = v_decisao.id
  RETURNING id INTO v_nova_decisao;

  INSERT INTO public.vt_trajeto_decisao_componentes (decisao_trajeto_id, pacote_id, ordem)
  SELECT v_nova_decisao, pacote_id, ordem
    FROM public.vt_trajeto_decisao_componentes
   WHERE decisao_trajeto_id = v_decisao.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.vt_trajeto_decisao_componentes WHERE decisao_trajeto_id = v_nova_decisao
  ) THEN
    RAISE EXCEPTION 'FALHOU: nova revisão não aceitou seus componentes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.log_auditoria
     WHERE tabela = 'vt_trajeto_decisoes' AND registro_id = v_nova_decisao::text
  ) THEN
    RAISE EXCEPTION 'FALHOU: inserção da nova revisão não gerou auditoria';
  END IF;

  RAISE NOTICE 'TUDO OK — backfill, imutabilidade, nova revisão e auditoria';
END $$;

-- 5) Grants reais: authenticated e service_role têm acesso; anon não tem.
DO $$
DECLARE
  v_grants text;
BEGIN
  IF NOT has_table_privilege('service_role', 'public.vt_pacotes', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: service_role sem SELECT em vt_pacotes';
  END IF;
  SELECT string_agg(grantee || ':' || privilege_type || ' por ' || grantor, ', ')
    INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'vt_pacotes' AND grantee = 'anon';
  IF v_grants IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: grants de anon em vt_pacotes: %', v_grants;
  END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'vt_pacotes'
       AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem GRANT SELECT em vt_pacotes';
  END IF;
  RAISE NOTICE 'TUDO OK — grants e acesso autenticado';
END $$;
RESET ROLE;
