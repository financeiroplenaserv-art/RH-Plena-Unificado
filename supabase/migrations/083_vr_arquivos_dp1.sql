-- ============================================================================
-- Migration 083: Permitir que dp1 anexe arquivos no bucket vr-arquivos.
--
-- Contexto: a tela Permissões concedeu vr.gerenciar ao perfil dp1 (ajuste
-- dinâmico em permissoes_perfil — o PERMISSOES_PADRAO só lista dp2). Com
-- isso, o dp1 importa o ponto e calcula o VR normalmente, mas o upload do
-- arquivo de origem para o bucket vr-arquivos era bloqueado pela policy de
-- INSERT (pode_ver_vr_arquivos: admin, adm, dp2). O erro aparecia em toast
-- DEPOIS do processamento — os dados já estavam em memória, então o cálculo
-- funcionava mesmo com a mensagem de erro na tela.
--
-- A função passa a incluir dp1. Como pode_acessar_arquivo_vr (SELECT) usa
-- essa mesma função, o dp1 também passa a ler os arquivos que anexou.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pode_ver_vr_arquivos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_vr_arquivos() TO authenticated;
