-- 175_vt_trajeto_bilhete_opcional.sql
-- Fila "Rotas a confirmar" (21/11/2026): o RH cria o trajeto de quem está "Sem
-- rota cadastrada" direto pela fila. O preço vem do motor novo na confirmação
-- (vt_trajeto_decisoes.custo_diario_centavos, migration 173), então o bilhete da
-- planilha antiga NÃO deve ser inventado: vt_trajetos.bilhete_id passa a aceitar
-- NULL (= trajeto criado pela fila, ainda sem bilhete legado).
-- Proteção: trajeto 'confirmado' no caminho legado continua exigindo bilhete
-- (o portão legado só paga trajeto confirmado com bilhete resolvido).
-- Sem tabela nova — sem GRANT. APLICADA via Management API em 21/11/2026 (backup
-- em dados-locais/backup_vt_175_2026-11-21/; teste: scripts/vt/testar-175-transacao.ps1).

ALTER TABLE public.vt_trajetos
  ALTER COLUMN bilhete_id DROP NOT NULL;

ALTER TABLE public.vt_trajetos
  DROP CONSTRAINT IF EXISTS vt_trajetos_confirmado_exige_bilhete_ck;
ALTER TABLE public.vt_trajetos
  ADD CONSTRAINT vt_trajetos_confirmado_exige_bilhete_ck
  CHECK (status <> 'confirmado' OR bilhete_id IS NOT NULL);

COMMENT ON COLUMN public.vt_trajetos.bilhete_id IS
  'Bilhete legado da planilha. NULL = trajeto criado pela fila Rotas a confirmar (preço pela decisão revisada).';
