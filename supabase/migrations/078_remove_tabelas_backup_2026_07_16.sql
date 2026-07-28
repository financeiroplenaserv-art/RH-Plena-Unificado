-- 078_remove_tabelas_backup_2026_07_16.sql
-- Remove 27 tabelas de backup criadas manualmente no SQL Editor em 16/07/2026.
-- Elas estavam sem RLS e expostas publicamente via PostgREST (alerta CRÍTICO
-- "rls_disabled_in_public" do Supabase Security Advisor, reportado por e-mail
-- em 26/07/2026). Dados pessoais (colaboradores, ocorrências, perfis,
-- configurações) ficavam acessíveis a qualquer pessoa com a URL do projeto.
-- Decisão da usuária em 28/07/2026: apagar os backups (não são mais necessários).
-- Aplicada via `supabase db query --linked` em 28/07/2026 (o histórico de
-- migrations não é versionado no banco — aplicações são feitas manualmente).

drop table if exists
  public.alertas_backup_2026_07_16,
  public.auditoria_backup_2026_07_16,
  public.calendario_adicionais_backup_2026_07_16,
  public.categorias_extras_backup_2026_07_16,
  public.colaboradores_backup_2026_07_16,
  public.configuracoes_backup_2026_07_16,
  public.contratos_adicionais_backup_2026_07_16,
  public.departamentos_backup_2026_07_16,
  public.empresas_backup_2026_07_16,
  public.entregas_backup_2026_07_16,
  public.extras_backup_2026_07_16,
  public.fornecedores_backup_2026_07_16,
  public.historico_importacoes_econtador_backup_2026_07_16,
  public.itens_backup_2026_07_16,
  public.log_auditoria_backup_2026_07_16,
  public.modelos_ocorrencia_backup_2026_07_16,
  public.ocorrencia_anexos_backup_2026_07_16,
  public.ocorrencia_aprovacoes_backup_2026_07_16,
  public.ocorrencia_defesas_backup_2026_07_16,
  public.ocorrencia_testemunhas_backup_2026_07_16,
  public.ocorrencias_backup_2026_07_16,
  public.perfis_backup_2026_07_16,
  public.permissoes_perfil_backup_2026_07_16,
  public.projetos_vr_backup_2026_07_16,
  public.recibos_extras_backup_2026_07_16,
  public.resultados_vr_backup_2026_07_16,
  public.vinculos_adicionais_backup_2026_07_16
cascade;
