-- Migração 055: Ajuste de permissões conforme regras de negócio validadas
--
-- - RH não deve ter acesso ao e-Contador.
-- - Inspetoria deve ter acesso ao menu e rota de Extras.

-- ============================================================
-- 1. Remove acesso do RH ao e-Contador
-- ============================================================

DELETE FROM public.permissoes_perfil
WHERE perfil = 'rh'
  AND recurso = 'econtador'
  AND acao = 'gerenciar';

DELETE FROM public.permissoes_perfil
WHERE perfil = 'rh'
  AND recurso = 'menu'
  AND acao = 'econtador';

DELETE FROM public.permissoes_perfil
WHERE perfil = 'rh'
  AND recurso = 'rota'
  AND acao = 'importar_econtador';

-- ============================================================
-- 2. Libera menu e rota de Extras para Inspetoria
-- ============================================================

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  ('inspetoria', 'menu', 'extras', true),
  ('inspetoria', 'rota', 'extras', true)
ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();
