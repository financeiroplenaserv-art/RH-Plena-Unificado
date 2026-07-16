-- Restore a partir do backup manual do plano Free do Supabase
-- ATENÇÃO: este script TRUNCA as tabelas atuais e restaura os dados do backup.
-- Recomendado executar apenas em caso de emergência.
-- Execute no SQL Editor do Supabase.

DO $$
DECLARE
  v_sufixo TEXT := '_backup_2026_07_16';
  v_tabela TEXT;
  v_tabelas TEXT[] := ARRAY[
    'colaboradores',
    'ocorrencias',
    'ocorrencia_anexos',
    'ocorrencia_testemunhas',
    'ocorrencia_aprovacoes',
    'ocorrencia_defesas',
    'empresas',
    'departamentos',
    'extras',
    'categorias_extras',
    'recibos_extras',
    'contratos_adicionais',
    'vinculos_adicionais',
    'calendario_adicionais',
    'projetos_vr',
    'resultados_vr',
    'fornecedores',
    'itens',
    'entregas',
    'perfis',
    'permissoes_perfil',
    'configuracoes',
    'auditoria',
    'log_auditoria',
    'historico_importacoes_econtador',
    'modelos_ocorrencia',
    'alertas',
    'consentimento_lgpd'
  ];
BEGIN
  FOREACH v_tabela IN ARRAY v_tabelas
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_tabela
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_tabela || v_sufixo
    ) THEN
      EXECUTE format('TRUNCATE public.%I RESTART IDENTITY; INSERT INTO public.%I SELECT * FROM public.%I%s;', v_tabela, v_tabela, v_tabela, v_sufixo);
    END IF;
  END LOOP;
END $$;

SELECT 'Restore concluído em ' || now() AS status;
