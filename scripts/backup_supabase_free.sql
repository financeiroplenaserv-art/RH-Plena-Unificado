-- Backup manual para plano Free do Supabase
-- Cria cópias das tabelas principais com sufixo _backup_2026_07_16
-- Execute no SQL Editor do Supabase.

DO $$
DECLARE
  v_sufixo TEXT := '_backup_2026_07_16';
  v_tabela TEXT;
  v_tabela_backup TEXT;
BEGIN
  -- colaboradores
  v_tabela := 'colaboradores';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- ocorrencias
  v_tabela := 'ocorrencias';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- ocorrencia_anexos
  v_tabela := 'ocorrencia_anexos';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- ocorrencia_testemunhas
  v_tabela := 'ocorrencia_testemunhas';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- ocorrencia_aprovacoes
  v_tabela := 'ocorrencia_aprovacoes';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- ocorrencia_defesas
  v_tabela := 'ocorrencia_defesas';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- empresas
  v_tabela := 'empresas';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- departamentos
  v_tabela := 'departamentos';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- extras
  v_tabela := 'extras';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- categorias_extras
  v_tabela := 'categorias_extras';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- recibos_extras
  v_tabela := 'recibos_extras';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- contratos_adicionais
  v_tabela := 'contratos_adicionais';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- vinculos_adicionais
  v_tabela := 'vinculos_adicionais';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- calendario_adicionais
  v_tabela := 'calendario_adicionais';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- projetos_vr
  v_tabela := 'projetos_vr';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- resultados_vr
  v_tabela := 'resultados_vr';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- fornecedores
  v_tabela := 'fornecedores';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- itens
  v_tabela := 'itens';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- entregas
  v_tabela := 'entregas';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- perfis
  v_tabela := 'perfis';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- permissoes_perfil
  v_tabela := 'permissoes_perfil';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- configuracoes
  v_tabela := 'configuracoes';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- auditoria
  v_tabela := 'auditoria';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- log_auditoria
  v_tabela := 'log_auditoria';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- historico_importacoes_econtador
  v_tabela := 'historico_importacoes_econtador';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- modelos_ocorrencia
  v_tabela := 'modelos_ocorrencia';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- alertas
  v_tabela := 'alertas';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;

  -- consentimento_lgpd
  v_tabela := 'consentimento_lgpd';
  v_tabela_backup := v_tabela || v_sufixo;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tabela_backup) THEN
      EXECUTE format('DROP TABLE public.%I;', v_tabela_backup);
    END IF;
    EXECUTE format('CREATE TABLE public.%I AS TABLE public.%I;', v_tabela_backup, v_tabela);
  END IF;
END $$;

SELECT 'Backup concluído em ' || now() AS status;
