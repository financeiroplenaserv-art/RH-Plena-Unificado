-- Migração 031: Adiciona detalhes dos erros ao histórico de importações do e-Contador

alter table public.historico_importacoes_econtador
add column if not exists detalhes_erros jsonb default '[]'::jsonb;
