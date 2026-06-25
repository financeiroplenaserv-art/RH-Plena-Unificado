-- Migração 036: Consentimento LGPD
--
-- Objetivo: registrar consentimento informado dos usuários do sistema
-- e versionar os termos de privacidade.

-- ============================================================
-- 1. Tabela de termos/versionamento LGPD
-- ============================================================
CREATE TABLE IF NOT EXISTS public.termos_lgpd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  finalidades TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.termos_lgpd IS 'Versionamento dos termos de consentimento LGPD';

-- ============================================================
-- 2. Campos de consentimento na tabela perfis
-- ============================================================
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS consentimento_lgpd BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_data TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_versao TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_finalidades TEXT[] DEFAULT '{}';

-- ============================================================
-- 3. RLS para termos_lgpd
-- ============================================================
ALTER TABLE public.termos_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Termos LGPD select ativo" ON public.termos_lgpd;
DROP POLICY IF EXISTS "Termos LGPD admin gerencia" ON public.termos_lgpd;

-- Qualquer usuário autenticado pode ler o termo ativo
CREATE POLICY "Termos LGPD select ativo"
  ON public.termos_lgpd
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Apenas admin pode inserir/editar/desativar termos
CREATE POLICY "Termos LGPD admin gerencia"
  ON public.termos_lgpd
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Ajuste de RLS em perfis para consentimento próprio
-- ============================================================
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Garante que o usuário possa ler/alterar seu próprio perfil,
-- independentemente do nível de acesso (inclusive visualizador).
DROP POLICY IF EXISTS "Perfis select próprio" ON public.perfis;
DROP POLICY IF EXISTS "Perfis update próprio consentimento" ON public.perfis;

CREATE POLICY "Perfis select próprio"
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_editor());

CREATE POLICY "Perfis update próprio consentimento"
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 5. Seed do termo inicial
-- ============================================================
INSERT INTO public.termos_lgpd (versao, titulo, conteudo, finalidades, ativo)
VALUES (
  '1.0',
  'Termo de Consentimento para Tratamento de Dados Pessoais',
  E'Lei Geral de Proteção de Dados Pessoais (LGPD), Lei nº 13.709/2018.\n\n'
  || E'1. Controlador: RH Plena Unificado, responsável pelo tratamento dos dados pessoais inseridos neste sistema.\n\n'
  || E'2. Dados tratados: nome, e-mail, CPF, RG, dados bancários, endereço, telefone, dados profissionais, registros de ponto, ocorrências disciplinares, registros de entrega de EPI/uniforme, informações de vale-refeição e outros dados necessários à gestão de recursos humanos.\n\n'
  || E'3. Finalidades: gestão de colaboradores, controle de ponto e adicionais, gestão de ocorrências disciplinares, entrega de EPI/uniforme, cálculo de benefícios, integração com sistemas contábeis (e-Contador/Alterdata) e cumprimento de obrigações legais/trabalhistas.\n\n'
  || E'4. Base legal: execução de contrato, cumprimento de obrigação legal/regulatória, legítimo interesse e consentimento, conforme aplicável.\n\n'
  || E'5. Direitos do titular: você pode acessar, retificar, excluir, portar seus dados e revogar o consentimento a qualquer momento, nos termos do art. 18 da LGPD. Para exercer seus direitos, entre em contato com o administrador do sistema ou com o encarregado de dados (DPO).\n\n'
  || E'6. Segurança: adotamos medidas técnicas e administrativas para proteger seus dados, incluindo criptografia, controle de acesso baseado em perfil e logs de auditoria.\n\n'
  || E'7. Compartilhamento: os dados poderão ser compartilhados com prestadores de serviço autorizados (ex: contabilidade) e órgãos reguladores, quando exigido por lei.\n\n'
  || E'8. Prazo de retenção: os dados serão mantidos pelo período necessário ao cumprimento das finalidades e obrigações legais.\n\n'
  || E'9. Ao clicar em "Aceito", declaro que li e concordo com este termo e autorizo o tratamento dos meus dados pessoais para as finalidades descritas.',
  ARRAY['gestao_rh', 'controle_ponto', 'ocorrencias', 'epi_uniforme', 'beneficios', 'integracao_contabil', 'obrigacoes_legais'],
  true
)
ON CONFLICT (versao) DO NOTHING;
