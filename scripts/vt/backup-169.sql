SELECT json_build_object(
  'criado_em', now(),
  'vt_bilhetes', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.id) FROM public.vt_bilhetes x), '[]'::json),
  'vt_trajetos', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.id) FROM public.vt_trajetos x), '[]'::json),
  'vt_cargas', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.id) FROM public.vt_cargas x), '[]'::json),
  'vt_fechamentos', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.id) FROM public.vt_fechamentos x), '[]'::json),
  'vt_coberturas', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.id) FROM public.vt_coberturas x), '[]'::json),
  'vt_geocode_cache', COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.chave) FROM public.vt_geocode_cache x), '[]'::json)
) AS backup;
