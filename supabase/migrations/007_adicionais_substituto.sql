alter table public.calendario_adicionais
  add column if not exists substituto_colaborador_id uuid references public.colaboradores(id) on delete set null,
  add column if not exists substituto_colaborador_nome text;
