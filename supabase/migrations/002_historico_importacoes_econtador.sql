create table if not exists public.historico_importacoes_econtador (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete set null,
  empresa_id text,
  empresa_nome text,
  quantidade integer not null default 0,
  importados integer not null default 0,
  atualizados integer not null default 0,
  erros integer not null default 0,
  created_at timestamp with time zone default now()
);

alter table public.historico_importacoes_econtador enable row level security;

create policy if not exists "Usuários autenticados podem inserir próprio histórico"
  on public.historico_importacoes_econtador
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

create policy if not exists "Usuários autenticados podem ler próprio histórico"
  on public.historico_importacoes_econtador
  for select
  to authenticated
  using (auth.uid() = usuario_id);
