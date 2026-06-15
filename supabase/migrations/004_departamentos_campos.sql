alter table public.departamentos
add column if not exists endereco text,
add column if not exists nome_contato text,
add column if not exists telefone_contato text,
add column if not exists email_contato text,
add column if not exists status text not null default 'Ativo';
