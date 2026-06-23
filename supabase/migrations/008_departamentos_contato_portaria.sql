alter table public.departamentos
add column if not exists contato_portaria text,
add column if not exists nome_contato_2 text,
add column if not exists telefone_contato_2 text,
add column if not exists email_contato_2 text;
