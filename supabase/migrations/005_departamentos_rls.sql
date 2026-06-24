-- Garante que a tabela de departamentos existe com todos os campos esperados
-- e habilita RLS para que usuários autenticados possam gerenciar registros.

create table if not exists public.departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa_id uuid,
  endereco text,
  nome_contato text,
  telefone_contato text,
  email_contato text,
  status text not null default 'Ativo',
  created_at timestamp with time zone default now()
);

-- Adiciona as colunas caso a tabela já exista sem elas
alter table public.departamentos
add column if not exists endereco text,
add column if not exists nome_contato text,
add column if not exists telefone_contato text,
add column if not exists email_contato text,
add column if not exists status text not null default 'Ativo';

alter table public.departamentos enable row level security;

-- Policies não suportam IF NOT EXISTS; usamos DROP IF EXISTS antes de criar.
drop policy if exists "Usuários autenticados podem ler departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem inserir departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem atualizar departamentos" on public.departamentos;
drop policy if exists "Usuários autenticados podem deletar departamentos" on public.departamentos;

create policy "Usuários autenticados podem ler departamentos"
  on public.departamentos
  for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem inserir departamentos"
  on public.departamentos
  for insert
  to authenticated
  with check (true);

create policy "Usuários autenticados podem atualizar departamentos"
  on public.departamentos
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados podem deletar departamentos"
  on public.departamentos
  for delete
  to authenticated
  using (true);
