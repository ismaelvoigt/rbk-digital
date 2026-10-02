-- Aplicar após vendas-schema.sql. Não publica o aplicativo nem agenda o worker.
begin;
-- Amplia a invalidação para alterações do status do documento.
drop trigger invalidar_itens_cupom on public.documentos;
create trigger invalidar_itens_cupom after update of caminho_arquivo,categoria,autorizacao_id,status on public.documentos
 for each row when (old.caminho_arquivo is distinct from new.caminho_arquivo or old.categoria is distinct from new.categoria or old.autorizacao_id is distinct from new.autorizacao_id or old.status is distinct from new.status)
 execute function rbk_private.invalidar_itens_cupom();
create table public.cupom_extracoes (
 documento_id uuid primary key references public.documentos(id) on delete cascade,
 autorizacao_id uuid not null references public.autorizacoes(id) on delete cascade,
 caminho_arquivo text not null,
 versao uuid not null default gen_random_uuid(),
 estado text not null default 'fila' check(estado in ('fila','processando','revisao','erro','confirmado','substituido')),
 tentativas integer not null default 0,
 disponivel_em timestamptz not null default now(),
 lease_token uuid, lease_ate timestamptz,
 resultado jsonb not null default '{}' check(jsonb_typeof(resultado)='object'),
 arquivo_sha256 text,
 erro text,
 revisado_por uuid, revisado_em timestamptz,
 updated_at timestamptz not null default now()
);
create index cupom_extracoes_fila on public.cupom_extracoes(estado,disponivel_em);
create index cupom_extracoes_autorizacao on public.cupom_extracoes(autorizacao_id);
alter table public.cupom_extracoes enable row level security;
revoke all on public.cupom_extracoes from public,anon,authenticated;
grant select on public.cupom_extracoes to authenticated;
grant all on public.cupom_extracoes to service_role;
create policy cupom_extracoes_leitura on public.cupom_extracoes for select to authenticated using(exists(select 1 from public.autorizacoes a where a.id=autorizacao_id));

create function rbk_private.enfileirar_cupom() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.categoria in ('cupom_fiscal','cupom_vinculado') and new.caminho_arquivo is not null and new.status='recebido' then
  insert into public.cupom_extracoes(documento_id,autorizacao_id,caminho_arquivo) values(new.id,new.autorizacao_id,new.caminho_arquivo)
  on conflict(documento_id) do update set autorizacao_id=excluded.autorizacao_id,caminho_arquivo=excluded.caminho_arquivo,
   versao=gen_random_uuid(),estado='fila',tentativas=0,disponivel_em=now(),lease_token=null,lease_ate=null,resultado='{}',erro=null,arquivo_sha256=null,revisado_por=null,revisado_em=null,updated_at=now();
 else
  delete from public.cupom_extracoes where documento_id=new.id;
 end if;
 return new;
end $$;
revoke all on function rbk_private.enfileirar_cupom() from public,anon,authenticated;
create trigger cupom_novo after insert on public.documentos for each row execute function rbk_private.enfileirar_cupom();
create trigger cupom_alterado after update of caminho_arquivo,categoria,autorizacao_id,status on public.documentos for each row
 when(old.caminho_arquivo is distinct from new.caminho_arquivo or old.categoria is distinct from new.categoria or old.autorizacao_id is distinct from new.autorizacao_id or old.status is distinct from new.status)
 execute function rbk_private.enfileirar_cupom();

-- RPCs abaixo são chamadas exclusivamente pelo servidor com service_role.
create function public.cupom_solicitar(p_documento uuid,p_retry boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare d public.documentos;
begin
 select * into d from public.documentos where id=p_documento for update;
 if d.id is null or d.categoria not in ('cupom_fiscal','cupom_vinculado') or d.caminho_arquivo is null or d.status<>'recebido' then raise exception 'Cupom indisponível.';end if;
 insert into public.cupom_extracoes(documento_id,autorizacao_id,caminho_arquivo) values(d.id,d.autorizacao_id,d.caminho_arquivo) on conflict do nothing;
 if p_retry then
  update public.cupom_extracoes set estado='fila',tentativas=0,disponivel_em=now(),erro=null,versao=gen_random_uuid(),lease_token=null,lease_ate=null,resultado='{}',updated_at=now()
  where documento_id=d.id and (estado='erro' or (estado='processando' and lease_ate<now()));
 end if;
end $$;

create function public.cupom_claim(p_documento uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.cupom_extracoes;
begin
 update public.cupom_extracoes set estado='erro',erro='Leitura interrompida. Solicite nova tentativa.',lease_token=null,lease_ate=null,updated_at=now() where estado='processando' and lease_ate<now() and tentativas>=3;
 select * into j from public.cupom_extracoes where (p_documento is null or documento_id=p_documento) and tentativas<3
 and ((estado in ('fila','erro') and disponivel_em<=now()) or (estado='processando' and lease_ate<now()))
 order by disponivel_em,documento_id for update skip locked limit 1;
 if j.documento_id is null then return null;end if;
 update public.cupom_extracoes set estado='processando',tentativas=tentativas+1,lease_token=gen_random_uuid(),lease_ate=now()+interval '3 minutes',updated_at=now()
 where documento_id=j.documento_id returning * into j;
 return to_jsonb(j);
end $$;
create function public.cupom_concluir(p_documento uuid,p_versao uuid,p_token uuid,p_estado text,p_resultado jsonb,p_sha text,p_erro text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_estado not in ('revisao','erro') or length(p_resultado::text)>500000 or (p_sha is not null and p_sha!~'^[a-f0-9]{64}$') then raise exception 'Resultado inválido.';end if;
 update public.cupom_extracoes set estado=p_estado,resultado=p_resultado,arquivo_sha256=p_sha,erro=left(p_erro,250),lease_token=null,lease_ate=null,disponivel_em=now()+interval '1 minute',updated_at=now()
 where documento_id=p_documento and versao=p_versao and lease_token=p_token and estado='processando' and lease_ate>now();
 get diagnostics n=row_count;return n=1;
end $$;

create function public.cupom_confirmar(p_documento uuid,p_versao uuid,p_actor uuid,p_itens jsonb,p_substituir boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare j public.cupom_extracoes;d public.documentos;a public.autorizacoes;r jsonb;k text;origem jsonb;pos integer=0;referencia text;
begin
 -- Serializa confirmações de cupons distintos da mesma autorização.
 select a0.* into a from public.autorizacoes a0 join public.documentos d0 on d0.autorizacao_id=a0.id where d0.id=p_documento for update of a0;
 if a.id is null or not exists(select 1 from public.users u join public.users owner on owner.id=a.user_id join public.farms f on f.id=u.farm_id where u.id=p_actor and u.status='active' and f.status='active' and u.farm_id=owner.farm_id and u.perfil in ('farmacia','administrador_farmacia','gerente_farmacia','operador') and not exists(select 1 from public.rbk_admins r where r.user_id=p_actor and r.ativo)) then raise exception 'Sem permissão para confirmar os itens desta autorização.';end if;
 select * into d from public.documentos where id=p_documento for update;
 select * into j from public.cupom_extracoes where documento_id=p_documento for update;
 if j.documento_id is null or j.versao<>p_versao or j.estado<>'revisao' or j.autorizacao_id<>a.id or j.caminho_arquivo<>d.caminho_arquivo or d.status<>'recebido' then raise exception 'Extração alterada ou indisponível. Atualize a página.';end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>500 then raise exception 'Itens inválidos.';end if;
 if exists(select 1 from public.dispensacao_itens where autorizacao_id=a.id) and not p_substituir then raise exception 'Confirme a substituição da base de itens da autorização.';end if;
 -- Os itens são uma única base canônica. Não soma cupons fiscal/vinculado.
 delete from public.dispensacao_itens where autorizacao_id=a.id;
 for r in select value from jsonb_array_elements(p_itens) loop
  pos=pos+1;
  if jsonb_typeof(r->'produto') is distinct from 'string' or length(btrim(r->>'produto')) not between 1 and 300 or jsonb_typeof(r->'fonte') is distinct from 'string' or length(btrim(r->>'fonte')) not between 1 and 1000 then raise exception 'Produto e fonte obrigatórios.';end if;
  origem='{}';referencia='Conferido no documento '||d.id||' • '||(r->>'fonte');
  foreach k in array array['produto','ean','unidade','quantidade','valor_unitario','valor_total','valor_pfpb','principio_ativo','indicacao','data_dispensacao'] loop
   if r->k is not null and r->k<>'null'::jsonb then origem=origem||jsonb_build_object(k,referencia);end if;
  end loop;
  insert into public.dispensacao_itens(autorizacao_id,documento_id,posicao,produto,ean,unidade,quantidade,valor_unitario,valor_total,valor_pfpb,principio_ativo,indicacao,data_dispensacao,status,origens)
  values(a.id,d.id,pos,btrim(r->>'produto'),r->>'ean',r->>'unidade',(r->>'quantidade')::numeric,(r->>'valor_unitario')::numeric,(r->>'valor_total')::numeric,(r->>'valor_pfpb')::numeric,r->>'principio_ativo',r->>'indicacao',(r->>'data_dispensacao')::date,'confirmado',origem);
 end loop;
 update public.cupom_extracoes set estado='substituido',updated_at=now() where autorizacao_id=a.id and documento_id<>d.id and estado='confirmado';
 update public.cupom_extracoes set estado='confirmado',revisado_por=p_actor,revisado_em=now(),updated_at=now() where documento_id=d.id;
end $$;
revoke all on function public.cupom_solicitar(uuid,boolean),public.cupom_claim(uuid),public.cupom_concluir(uuid,uuid,uuid,text,jsonb,text,text),public.cupom_confirmar(uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.cupom_solicitar(uuid,boolean),public.cupom_claim(uuid),public.cupom_concluir(uuid,uuid,uuid,text,jsonb,text,text),public.cupom_confirmar(uuid,uuid,uuid,jsonb,boolean) to service_role;
comment on table public.cupom_extracoes is 'Fila durável por documento e versão. OCR/PDF gera candidatos; revisão humana confirma uma única base por autorização. Tentativas/lease recuperam interrupções; trigger não chama serviços externos.';
commit;
