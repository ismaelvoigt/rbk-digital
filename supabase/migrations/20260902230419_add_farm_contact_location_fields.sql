alter table public.farms
  add column if not exists telefone text,
  add column if not exists cidade text,
  add column if not exists estado text;

comment on column public.farms.telefone is
  'Telefone de contato da farmacia';

comment on column public.farms.cidade is
  'Cidade da farmacia';

comment on column public.farms.estado is
  'UF do estado da farmacia';
