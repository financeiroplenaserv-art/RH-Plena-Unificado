-- Aplicar este SQL no SQL Editor do painel do Supabase antes de importar os departamentos

alter table public.departamentos
add column if not exists nome_curto text,
add column if not exists endereco text,
add column if not exists bairro text,
add column if not exists cidade text,
add column if not exists estado text,
add column if not exists cep text,
add column if not exists nome_contato text,
add column if not exists telefone_contato text,
add column if not exists email_contato text,
add column if not exists contato_portaria text,
add column if not exists nome_contato_2 text,
add column if not exists telefone_contato_2 text,
add column if not exists email_contato_2 text,
add column if not exists status text not null default 'Ativo';

-- Garantir que a coluna status tenha valor padrão para registros existentes
update public.departamentos set status = 'Ativo' where status is null;
