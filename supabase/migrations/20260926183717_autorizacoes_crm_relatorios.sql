-- Metadados opcionais da receita. Autorizações antigas permanecem sem CRM.
-- Não altera políticas RLS, permissões ou arquivos existentes.
begin;
alter table public.autorizacoes add column if not exists crm text;
alter table public.autorizacoes add column if not exists crm_uf text;
alter table public.autorizacoes add constraint autorizacoes_crm_valido check (
  (crm is null and crm_uf is null) or
  (crm is not null and crm_uf is not null and crm ~ '^[1-9][0-9]{0,9}$' and
   crm_uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);
create index if not exists autorizacoes_crm_uf_data_idx on public.autorizacoes(crm, crm_uf, data_autorizacao) where crm is not null;
comment on column public.autorizacoes.crm is 'CRM informado a partir da receita; número sem formatação ou zeros iniciais.';
comment on column public.autorizacoes.crm_uf is 'UF do registro do CRM; obrigatória quando há CRM.';
commit;
