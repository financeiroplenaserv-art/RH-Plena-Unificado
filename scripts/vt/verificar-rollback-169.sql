SELECT json_build_object(
  'tabelas_novas', COALESCE((
    SELECT json_agg(tablename ORDER BY tablename)
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename IN (
         'vt_pacotes',
         'vt_pacote_componentes',
         'vt_pacote_precos',
         'vt_pacote_requisitos',
         'vt_trajeto_decisoes',
         'vt_trajeto_decisao_componentes',
         'vt_beneficio_ajustes',
         'vt_carga_lotes',
         'vt_lote_aprovacoes'
       )
  ), '[]'::json),
  'vt_bilhetes', (SELECT count(*) FROM public.vt_bilhetes),
  'vt_trajetos', (SELECT count(*) FROM public.vt_trajetos),
  'vt_cargas', (SELECT count(*) FROM public.vt_cargas),
  'vt_fechamentos', (SELECT count(*) FROM public.vt_fechamentos),
  'vt_coberturas', (SELECT count(*) FROM public.vt_coberturas),
  'vt_geocode_cache', (SELECT count(*) FROM public.vt_geocode_cache)
) AS verificacao;
