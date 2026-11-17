-- Testes da migration 170, executados depois da 169 na MESMA transação.
-- scripts/vt/testar-170-transacao.ps1 monta 169 + 170 + estes testes + ROLLBACK.

CREATE TEMP TABLE t170(k text PRIMARY KEY, v text);
GRANT ALL ON t170 TO authenticated;
INSERT INTO t170
SELECT 'pessoa', id::text FROM public.colaboradores ORDER BY id LIMIT 1;

CREATE OR REPLACE FUNCTION pg_temp.t170_lote(
  p_id uuid,
  p_valor integer,
  p_versao integer,
  p_parent uuid,
  p_status text
) RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'id', p_id,
    'competencia', '2026-11',
    'status', 'rascunho',
    'versaoConteudo', p_versao,
    'conteudoHash', md5(p_id::text) || md5(p_id::text),
    'versaoCalculo', '3.0.0',
    'versaoRegras', jsonb_build_object('tarifas', '2026-11-01'),
    'fonte', jsonb_build_object(
      'tipo', 'gestao_escalas_flit',
      'nomeArquivo', 'teste.xlsx',
      'conteudoHash', 'fonte-teste',
      'importadoEm', '2026-11-15T10:00:00Z'
    ),
    'linhas', '[]'::jsonb,
    'totaisPorColaborador', jsonb_build_array(jsonb_build_object(
      'colaboradorId', (SELECT v FROM t170 WHERE k = 'pessoa'),
      'status', p_status,
      'necessidadeCentavos', COALESCE(p_valor, 0),
      'ajusteCentavos', 0,
      'valorCentavos', p_valor,
      'excedenteTruncadoCentavos', 0,
      'lancamentoAjusteIds', '[]'::jsonb,
      'pendenciaIds', '[]'::jsonb
    )),
    'pendencias', '[]'::jsonb,
    'necessidadeCentavos', COALESCE(p_valor, 0),
    'ajusteCentavos', 0,
    'valorCentavos', p_valor,
    'confirmacao', NULL,
    'loteSubstituidoId', p_parent
  );
$$;

-- Vetor calculado pela função TypeScript: hashDivergenciaColaborador.
DO $$
DECLARE
  v_total jsonb := jsonb_build_object(
    'colaboradorId', '10000000-0000-4000-8000-000000000001',
    'status', 'completo', 'necessidadeCentavos', 1000,
    'ajusteCentavos', 0, 'valorCentavos', 1000,
    'excedenteTruncadoCentavos', 0,
    'lancamentoAjusteIds', '[]'::jsonb, 'pendenciaIds', '[]'::jsonb
  );
BEGIN
  IF public.vt_divergencia_hash(v_total, v_total) <>
     '5009cb5fe9244a5ce322427d938525887b529600c266c2232c6b663cc3be9d4b' THEN
    RAISE EXCEPTION 'FALHOU: hash SQL=%; canonical=%',
      public.vt_divergencia_hash(v_total, v_total),
      public.vt_total_canonico(v_total);
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

-- 1) Confirmação simples e preparação do substituto.
SELECT public.vt_salvar_rascunho_lote(
  pg_temp.t170_lote('10000000-0000-4000-8000-000000000100', 1000, 1, NULL, 'completo'), 0
);
SELECT public.vt_confirmar_lote('10000000-0000-4000-8000-000000000100', 1);
DO $$
BEGIN
  IF (SELECT status FROM public.vt_carga_lotes WHERE id = '10000000-0000-4000-8000-000000000100') <> 'confirmado' THEN
    RAISE EXCEPTION 'FALHOU: lote não foi confirmado';
  END IF;
  IF (SELECT confirmacao->>'confirmadaPor' FROM public.vt_carga_lotes
      WHERE id = '10000000-0000-4000-8000-000000000100') <>
     '6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4' THEN
    RAISE EXCEPTION 'FALHOU: confirmação sem autor correto';
  END IF;
END $$;

-- 1b) Duas cargas independentes não podem ficar confirmadas na mesma competência.
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM public.vt_salvar_rascunho_lote(
    pg_temp.t170_lote('10000000-0000-4000-8000-000000000103', 900, 1, NULL, 'completo'), 0
  );
  BEGIN
    PERFORM public.vt_confirmar_lote('10000000-0000-4000-8000-000000000103', 1);
  EXCEPTION WHEN unique_violation THEN
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: segunda carga independente foi confirmada na mesma competência'; END IF;
END $$;

SELECT public.vt_salvar_rascunho_lote(
  pg_temp.t170_lote(
    '10000000-0000-4000-8000-000000000101', 1200, 1,
    '10000000-0000-4000-8000-000000000100', 'completo'
  ), 0
);

-- 2) Substituição exige aprovação e a confirmação comum não contorna.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.vt_confirmar_substituto(
      '10000000-0000-4000-8000-000000000100', 1,
      '10000000-0000-4000-8000-000000000101', 1
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%sem aprovação%' THEN
      RAISE EXCEPTION 'FALHOU: erro inesperado na substituição: %', SQLERRM;
    END IF;
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: substituição sem aprovação foi aceita'; END IF;

  ok := false;
  BEGIN
    PERFORM public.vt_confirmar_lote('10000000-0000-4000-8000-000000000101', 1);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%Substituição exige aprovações%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: confirmação comum contornou a substituição'; END IF;
END $$;

SELECT public.vt_aprovar_divergencia(
  '10000000-0000-4000-8000-000000000100',
  '10000000-0000-4000-8000-000000000101',
  (SELECT v::uuid FROM t170 WHERE k = 'pessoa')
);

-- 3) Editar depois da aprovação exige nova aprovação.
SELECT public.vt_salvar_rascunho_lote(
  pg_temp.t170_lote(
    '10000000-0000-4000-8000-000000000101', 1300, 2,
    '10000000-0000-4000-8000-000000000100', 'completo'
  ), 1
);
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.vt_confirmar_substituto(
      '10000000-0000-4000-8000-000000000100', 1,
      '10000000-0000-4000-8000-000000000101', 2
    );
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%sem aprovação%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: aprovação antiga liberou conteúdo alterado'; END IF;
END $$;

SELECT public.vt_aprovar_divergencia(
  '10000000-0000-4000-8000-000000000100',
  '10000000-0000-4000-8000-000000000101',
  (SELECT v::uuid FROM t170 WHERE k = 'pessoa')
);
SELECT public.vt_confirmar_substituto(
  '10000000-0000-4000-8000-000000000100', 1,
  '10000000-0000-4000-8000-000000000101', 2
);
DO $$
BEGIN
  IF (SELECT status FROM public.vt_carga_lotes WHERE id = '10000000-0000-4000-8000-000000000100') <> 'substituido' THEN
    RAISE EXCEPTION 'FALHOU: anterior não ficou substituído';
  END IF;
  IF (SELECT status FROM public.vt_carga_lotes WHERE id = '10000000-0000-4000-8000-000000000101') <> 'confirmado' THEN
    RAISE EXCEPTION 'FALHOU: novo não ficou confirmado';
  END IF;
  IF (SELECT lote_substituido_id FROM public.vt_carga_lotes WHERE id = '10000000-0000-4000-8000-000000000101') <>
     '10000000-0000-4000-8000-000000000100' THEN
    RAISE EXCEPTION 'FALHOU: vínculo do substituto incorreto';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.log_auditoria
     WHERE tabela = 'vt_carga_lotes' AND registro_id = '10000000-0000-4000-8000-000000000101'
  ) THEN
    RAISE EXCEPTION 'FALHOU: confirmação/substituição sem auditoria';
  END IF;
END $$;

-- 4) Segunda substituição, versão antiga e lote parcial são recusados.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.vt_confirmar_substituto(
      '10000000-0000-4000-8000-000000000100', 1,
      '10000000-0000-4000-8000-000000000101', 2
    );
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%substituído%' OR SQLERRM LIKE '%confirmado%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: segunda substituição foi aceita'; END IF;
END $$;

SELECT public.vt_salvar_rascunho_lote(
  pg_temp.t170_lote('10000000-0000-4000-8000-000000000102', NULL, 1, NULL, 'parcial'), 0
);
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.vt_confirmar_lote('10000000-0000-4000-8000-000000000102', 1);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%pendências%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: lote parcial foi confirmado'; END IF;

  ok := false;
  BEGIN
    PERFORM public.vt_confirmar_lote('10000000-0000-4000-8000-000000000102', 0);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%versão%' OR SQLERRM LIKE '%pendências%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: versão antiga não foi recusada'; END IF;
END $$;

-- 5) Escrita direta é bloqueada; só as RPCs escrevem.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.vt_carga_lotes (
      competencia, versao_conteudo, conteudo_hash, versao_calculo,
      versao_regras, fonte, necessidade_centavos, ajuste_centavos
    ) VALUES ('2026-11', 1, md5('x') || md5('x'), '3', '{}', '{}', 0, 0);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%row-level security%' THEN
      RAISE EXCEPTION 'FALHOU: erro inesperado no INSERT direto: %', SQLERRM;
    END IF;
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: INSERT direto como authenticated foi aceito'; END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('vt_carga_lotes', 'vt_lote_aprovacoes')
       AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'FALHOU: anon recebeu GRANT nas tabelas da 170';
  END IF;
  RAISE NOTICE 'TUDO OK — persistência, confirmação, substituição, aprovações e grants';
END $$;

RESET ROLE;
