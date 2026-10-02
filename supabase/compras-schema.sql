-- Estoque informado pela farmácia: posição integral, sem inferir movimentos.
begin;
create table public.compras_estoque (
 farm_id uuid primary key references public.farms(id),
 versao uuid not null default gen_random_uuid(),
 data_posicao date not null,
 arquivo text not null check(length(arquivo) between 1 and 250),
 itens jsonb not null check(jsonb_typeof(itens)='array' and jsonb_array_length(itens) between 1 and 20000),
 atualizado_em timestamptz not null default now(),
 atualizado_por uuid not null
);
alter table public.compras_estoque enable row level security;
revoke all on public.compras_estoque from public,anon,authenticated;
grant select on public.compras_estoque to authenticated;
create policy compras_leitura on public.compras_estoque for select to authenticated using (rbk_private.can_access_farm(farm_id));
create function public.compras_obter(p_farm uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem acesso à farmácia';end if;
 return (select to_jsonb(e)-'atualizado_por' from public.compras_estoque e where farm_id=p_farm);
end $$;
create function public.compras_importar(p_farm uuid,p_data date,p_arquivo text,p_itens jsonb,p_versao uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual uuid; nova uuid; item jsonb; q numeric;
begin
 if auth.uid() is null or not coalesce(rbk_private.can_access_farm(p_farm),false) or not (coalesce(rbk_private.can_write_farm(p_farm),false) or coalesce(rbk_private.actor_role() in ('gestor_rbk','superadmin_rbk'),false)) then raise exception 'Sem permissão para importar';end if;
 if p_data is null or p_data>(now() at time zone 'America/Sao_Paulo')::date or p_data<'2000-01-01' or p_arquivo is null or length(p_arquivo) not between 1 and 250 then raise exception 'Data ou arquivo inválido';end if;
 if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens) not between 1 and 20000 or octet_length(p_itens::text)>10000000 then raise exception 'Lote inválido';end if;
 for item in select value from jsonb_array_elements(p_itens) loop
 if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>4 or not (item ?& array['ean','produto','unidade','quantidade']) then raise exception 'Campos inválidos';end if;
 if (item->'ean'<>'null'::jsonb and (jsonb_typeof(item->'ean')<>'string' or item->>'ean' !~ '^\d{14}$')) or jsonb_typeof(item->'produto')<>'string' or length(btrim(item->>'produto')) not between 1 and 250 or jsonb_typeof(item->'unidade')<>'string' or length(btrim(item->>'unidade')) not between 1 and 30 or item->>'unidade'<>upper(btrim(item->>'unidade')) or jsonb_typeof(item->'quantidade')<>'number' then raise exception 'Produto inválido';end if;
 q=(item->>'quantidade')::numeric;if q<0 or q>1000000000 or q<>round(q,3) then raise exception 'Quantidade inválida';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_itens) i where i->>'ean' is not null group by i->>'ean',i->>'unidade' having count(*)>1) then raise exception 'EAN e unidade duplicados';end if;
 -- Serializa inclusive a primeira importação; evita perder alterações concorrentes.
 perform pg_advisory_xact_lock(hashtextextended(p_farm::text,726));
 select versao into atual from public.compras_estoque where farm_id=p_farm;
 if atual is distinct from p_versao then raise exception 'Estoque alterado por outra importação. Atualize a tela e confira novamente.';end if;
 nova=gen_random_uuid();
 insert into public.compras_estoque(farm_id,versao,data_posicao,arquivo,itens,atualizado_por) values(p_farm,nova,p_data,p_arquivo,p_itens,auth.uid())
 on conflict(farm_id) do update set versao=nova,data_posicao=p_data,arquivo=p_arquivo,itens=p_itens,atualizado_por=auth.uid(),atualizado_em=now();
 return public.compras_obter(p_farm);
end $$;
revoke all on function public.compras_obter(uuid) from public,anon;
revoke all on function public.compras_importar(uuid,date,text,jsonb,uuid) from public,anon;
grant execute on function public.compras_obter(uuid) to authenticated;
grant execute on function public.compras_importar(uuid,date,text,jsonb,uuid) to authenticated;
commit;
