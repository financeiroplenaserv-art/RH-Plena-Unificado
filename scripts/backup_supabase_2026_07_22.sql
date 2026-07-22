-- Snapshot manual pré-piloto — CORH
-- Cria cópias das tabelas de negócio com sufixo _backup_2026_07_22.
-- Execute no SQL Editor do Supabase.
--
-- Observações:
-- - Isto é um SNAPSHOT DE DADOS (CREATE TABLE AS): não copia índices,
--   constraints, triggers nem RLS. Serve para recuperar dados em caso de
--   erro operacional durante o piloto. O backup completo/gerenciado é o
--   backup diário automático do plano Pro (Database → Backups).
-- - Tabelas inexistentes são ignoradas automaticamente (IF EXISTS).

DO $$
DECLARE
  v_sufixo TEXT := '_backup_2026_07_22';
  v_tabelas TEXT[] := ARRAY[
    'colaboradores',
    'ocorrencias',
    'ocorrencia_anexos',
    'ocorrencia_testemunhas',
    'ocorrencia_aprovacoes',
    'ocorrencia_defesas',
    'modelos_ocorrencia',
    'alertas',
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
    'consentimento_lgpd',
    'consentimentos_lgpd',
    'termos_lgpd',
    'locais_trabalho',
    'mapeamento_flit_local_trabalho',
    'locais_trabalho_diario',
    'historico_local_trabalho_diario'
  ];
  v_tabela TEXT;
  v_tabela_backup TEXT;
  v_copiadas INTEGER := 0;
BEGIN
  FOREACH v_tabela IN ARRAY v_tabelas LOOP
    v_tabela_backup := v_tabela || v_sufixo;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
        EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
      END IF;
      EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
      v_copiadas := v_copiadas + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Snapshot concluído: % tabelas copiadas com sufixo %.', v_copiadas, v_sufixo;
END $$;
