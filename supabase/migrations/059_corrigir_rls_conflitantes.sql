-- Migração 059: Corrige policies RLS conflitantes e abertas
--
-- Contexto: análise das migrations com scripts/validar_rls.py detectou que
-- várias tabelas sensíveis ainda possuem policies SELECT abertas (USING (true))
-- ou múltiplas policies permissivas conflitantes. Como o PostgreSQL avalia
-- policies permissivas com OR, isso anula a proteção do RLS.
--
-- Esta migration:
--   1. Remove TODAS as policies antigas das tabelas sensíveis afetadas.
--   2. Recria policies alinhadas com o modelo de permissão atual.
--   3. Garante que apenas uma policy por operação (SELECT/INSERT/UPDATE/DELETE)
--      exista em cada tabela.

-- ============================================================
-- 1. Configuracoes
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Configuracoes select geral" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

CREATE POLICY "Permitir select geral em configuracoes"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave <> 'econtador_token' OR (chave = 'econtador_token' AND public.is_rh_ou_admin()));

CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir insert token eContador apenas admin dp"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir update token eContador apenas admin dp"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir delete de configuracoes"
  ON public.configuracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 2. Perfis
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.perfis;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.perfis;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.perfis;
DROP POLICY IF EXISTS "Perfis select próprio" ON public.perfis;
DROP POLICY IF EXISTS "Perfis select proprio ou editor" ON public.perfis;
DROP POLICY IF EXISTS "Perfis update próprio consentimento" ON public.perfis;
DROP POLICY IF EXISTS "Perfis update proprio consentimento" ON public.perfis;
DROP POLICY IF EXISTS "Permitir select de perfis" ON public.perfis;
DROP POLICY IF EXISTS "Permitir insert de perfis" ON public.perfis;
DROP POLICY IF EXISTS "Permitir update de perfis" ON public.perfis;
DROP POLICY IF EXISTS "Permitir delete de perfis" ON public.perfis;

CREATE POLICY "Permitir select de perfis"
  ON public.perfis
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Permitir insert de perfis"
  ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir update de perfis"
  ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Permitir delete de perfis"
  ON public.perfis
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. Colaboradores
-- ============================================================

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir select de colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir insert de colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir update de colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir delete de colaboradores" ON public.colaboradores;

CREATE POLICY "Permitir select de colaboradores"
  ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.pode_ver_colaboradores());

CREATE POLICY "Permitir insert de colaboradores"
  ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_rh_ou_admin() OR public.is_editor());

CREATE POLICY "Permitir update de colaboradores"
  ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.is_rh_ou_admin() OR public.is_editor())
  WITH CHECK (public.is_rh_ou_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de colaboradores"
  ON public.colaboradores
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. Ocorrências e tabelas relacionadas
-- ============================================================

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_testemunhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_defesas ENABLE ROW LEVEL SECURITY;

-- Limpa policies antigas de ocorrencias
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir select de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir insert de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir update de ocorrencias" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir delete de ocorrencias" ON public.ocorrencias;

-- Limpa policies antigas de ocorrencia_anexos
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir select de ocorrencia_anexos" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_anexos" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir update de ocorrencia_anexos" ON public.ocorrencia_anexos;
DROP POLICY IF EXISTS "Permitir delete de ocorrencia_anexos" ON public.ocorrencia_anexos;

-- Limpa policies antigas de ocorrencia_testemunhas
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir select de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir update de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;
DROP POLICY IF EXISTS "Permitir delete de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;

-- Limpa policies antigas de ocorrencia_aprovacoes
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir select de ocorrencia_aprovacoes" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_aprovacoes" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir update de ocorrencia_aprovacoes" ON public.ocorrencia_aprovacoes;
DROP POLICY IF EXISTS "Permitir delete de ocorrencia_aprovacoes" ON public.ocorrencia_aprovacoes;

-- Limpa policies antigas de ocorrencia_defesas
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir select de ocorrencia_defesas" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_defesas" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir update de ocorrencia_defesas" ON public.ocorrencia_defesas;
DROP POLICY IF EXISTS "Permitir delete de ocorrencia_defesas" ON public.ocorrencia_defesas;

CREATE POLICY "Permitir select de ocorrencias"
  ON public.ocorrencias
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencias"
  ON public.ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencias"
  ON public.ocorrencias
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencias"
  ON public.ocorrencias
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de ocorrencia_anexos"
  ON public.ocorrencia_anexos
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencia_anexos"
  ON public.ocorrencia_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencia_anexos"
  ON public.ocorrencia_anexos
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencia_anexos"
  ON public.ocorrencia_anexos
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de ocorrencia_aprovacoes"
  ON public.ocorrencia_aprovacoes
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencia_aprovacoes"
  ON public.ocorrencia_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencia_aprovacoes"
  ON public.ocorrencia_aprovacoes
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencia_aprovacoes"
  ON public.ocorrencia_aprovacoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de ocorrencia_defesas"
  ON public.ocorrencia_defesas
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencia_defesas"
  ON public.ocorrencia_defesas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencia_defesas"
  ON public.ocorrencia_defesas
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencia_defesas"
  ON public.ocorrencia_defesas
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. Auditoria e log de auditoria
-- ============================================================

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.auditoria;
DROP POLICY IF EXISTS "Auditoria select restrito" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir select de auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir insert de auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir update de auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir delete de auditoria" ON public.auditoria;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir select de log_auditoria" ON public.log_auditoria;
DROP POLICY IF EXISTS "Log auditoria select restrito" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir insert de log_auditoria" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir update de log_auditoria" ON public.log_auditoria;
DROP POLICY IF EXISTS "Permitir delete de log_auditoria" ON public.log_auditoria;

CREATE POLICY "Permitir select de auditoria"
  ON public.auditoria
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir insert de auditoria"
  ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir update de auditoria"
  ON public.auditoria
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir delete de auditoria"
  ON public.auditoria
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de log_auditoria"
  ON public.log_auditoria
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir insert de log_auditoria"
  ON public.log_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir update de log_auditoria"
  ON public.log_auditoria
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir delete de log_auditoria"
  ON public.log_auditoria
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. Projetos VR e resultados VR
-- ============================================================

ALTER TABLE public.projetos_vr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_vr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir select de projetos_vr" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert de projetos_vr" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update de projetos_vr" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir delete de projetos_vr" ON public.projetos_vr;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir select de resultados_vr" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert de resultados_vr" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update de resultados_vr" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir delete de resultados_vr" ON public.resultados_vr;

CREATE POLICY "Permitir select de projetos_vr"
  ON public.projetos_vr
  FOR SELECT TO authenticated
  USING (public.pode_ver_vr());

CREATE POLICY "Permitir insert de projetos_vr"
  ON public.projetos_vr
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir update de projetos_vr"
  ON public.projetos_vr
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.pode_ver_vr())
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir delete de projetos_vr"
  ON public.projetos_vr
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de resultados_vr"
  ON public.resultados_vr
  FOR SELECT TO authenticated
  USING (public.pode_ver_vr());

CREATE POLICY "Permitir insert de resultados_vr"
  ON public.resultados_vr
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir update de resultados_vr"
  ON public.resultados_vr
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.pode_ver_vr())
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir delete de resultados_vr"
  ON public.resultados_vr
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 7. Recibos de extras
-- ============================================================

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir select de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir insert de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir update de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir delete de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 8. Contratos e vínculos adicionais
-- ============================================================

ALTER TABLE public.contratos_adicionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos_adicionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ler contratos" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir contratos" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar contratos" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar contratos" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir select de contratos_adicionais" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir insert de contratos_adicionais" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir update de contratos_adicionais" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir delete de contratos_adicionais" ON public.contratos_adicionais;

DROP POLICY IF EXISTS "Usuários autenticados podem ler vínculos" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir vínculos" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar vínculos" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar vínculos" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir select de vinculos_adicionais" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir insert de vinculos_adicionais" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir update de vinculos_adicionais" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir delete de vinculos_adicionais" ON public.vinculos_adicionais;

CREATE POLICY "Permitir select de contratos_adicionais"
  ON public.contratos_adicionais
  FOR SELECT TO authenticated
  USING (public.pode_ver_adicionais());

CREATE POLICY "Permitir insert de contratos_adicionais"
  ON public.contratos_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de contratos_adicionais"
  ON public.contratos_adicionais
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de contratos_adicionais"
  ON public.contratos_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR SELECT TO authenticated
  USING (public.pode_ver_adicionais());

CREATE POLICY "Permitir insert de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 9. Histórico de importações do e-Contador
-- ============================================================

ALTER TABLE public.historico_importacoes_econtador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem inserir próprio histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Usuários autenticados podem ler próprio histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Usuários veem próprio histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Usuários inserem próprio histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Usuários atualizam próprio histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Apenas admins deletam histórico" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Permitir select de historico_importacoes_econtador" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Permitir insert de historico_importacoes_econtador" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Permitir update de historico_importacoes_econtador" ON public.historico_importacoes_econtador;
DROP POLICY IF EXISTS "Permitir delete de historico_importacoes_econtador" ON public.historico_importacoes_econtador;

CREATE POLICY "Permitir select de historico_importacoes_econtador"
  ON public.historico_importacoes_econtador
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id OR public.is_admin());

CREATE POLICY "Permitir insert de historico_importacoes_econtador"
  ON public.historico_importacoes_econtador
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Permitir update de historico_importacoes_econtador"
  ON public.historico_importacoes_econtador
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir delete de historico_importacoes_econtador"
  ON public.historico_importacoes_econtador
  FOR DELETE TO authenticated
  USING (public.is_admin());
