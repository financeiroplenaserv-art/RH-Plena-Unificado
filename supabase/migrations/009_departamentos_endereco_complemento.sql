alter table public.departamentos
add column if not exists bairro text,
add column if not exists cidade text,
add column if not exists estado text,
add column if not exists cep text;
