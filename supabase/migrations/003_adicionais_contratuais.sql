create table if not exists public.contratos_adicionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  departamento_id uuid references public.departamentos(id) on delete set null,
  adicionais jsonb not null default '{}'::jsonb,
  dias_intrajornada integer[] not null default '{}'::integer[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.vinculos_adicionais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos_adicionais(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.calendario_adicionais (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculos_adicionais(id) on delete cascade,
  data date not null,
  status text not null default 'trabalhou',
  intrajornada boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (vinculo_id, data)
);

alter table public.contratos_adicionais enable row level security;
alter table public.vinculos_adicionais enable row level security;
alter table public.calendario_adicionais enable row level security;

-- Policies não suportam IF NOT EXISTS; usamos DROP IF EXISTS antes de criar.
drop policy if exists "Usuários autenticados podem ler contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem inserir contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem atualizar contratos" on public.contratos_adicionais;
drop policy if exists "Usuários autenticados podem deletar contratos" on public.contratos_adicionais;

create policy "Usuários autenticados podem ler contratos"
  on public.contratos_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir contratos"
  on public.contratos_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar contratos"
  on public.contratos_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar contratos"
  on public.contratos_adicionais for delete to authenticated using (true);

drop policy if exists "Usuários autenticados podem ler vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem inserir vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem atualizar vínculos" on public.vinculos_adicionais;
drop policy if exists "Usuários autenticados podem deletar vínculos" on public.vinculos_adicionais;

create policy "Usuários autenticados podem ler vínculos"
  on public.vinculos_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir vínculos"
  on public.vinculos_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar vínculos"
  on public.vinculos_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar vínculos"
  on public.vinculos_adicionais for delete to authenticated using (true);

drop policy if exists "Usuários autenticados podem ler calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem inserir calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem atualizar calendário" on public.calendario_adicionais;
drop policy if exists "Usuários autenticados podem deletar calendário" on public.calendario_adicionais;

create policy "Usuários autenticados podem ler calendário"
  on public.calendario_adicionais for select to authenticated using (true);
create policy "Usuários autenticados podem inserir calendário"
  on public.calendario_adicionais for insert to authenticated with check (true);
create policy "Usuários autenticados podem atualizar calendário"
  on public.calendario_adicionais for update to authenticated using (true);
create policy "Usuários autenticados podem deletar calendário"
  on public.calendario_adicionais for delete to authenticated using (true);
