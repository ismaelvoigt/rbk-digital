begin;
create table public.rbk_crm_clientes (
 id uuid primary key default gen_random_uuid(), razao_social text not null check(length(trim(razao_social)) between 2 and 200),
 cnpj text unique check(cnpj ~ '^[0-9]{14}$'), farm_id uuid unique references public.farms(id),
 contato text not null default '', whatsapp text not null default '', email text not null default '', cidade text not null default '', uf text not null default '' check(uf='' or uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 origem text not null default '', interesses text[] not null default '{}' check(interesses <@ array['Credenciamento','Auditoria','Renovação','RBK Digital','ANVISA','Compra/Venda de CNPJ','Notícias/Comunicados PFPB']::text[]),
 ultimo_contato date, proxima_acao text not null default '', proxima_acao_data date,
 responsavel_id uuid not null references public.users(id), observacoes text not null default '',
 status text not null default 'Novo lead' check(status in ('Novo lead','Em contato','Interessado','Aguardando oportunidade','Proposta enviada','Cliente','Sem interesse')),
 aguardando_credenciamento boolean not null default false, oportunidade_referencia text not null default '',
 created_by uuid not null references public.users(id), updated_by uuid not null references public.users(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index rbk_crm_filtros on public.rbk_crm_clientes(responsavel_id,status,uf);
create index rbk_crm_interesses on public.rbk_crm_clientes using gin(interesses);
create table public.rbk_contratos (
 id uuid primary key default gen_random_uuid(), cliente_id uuid not null references public.rbk_crm_clientes(id),
 servico text not null check(servico in ('Auditoria','Credenciamento','Renovação','ANVISA','RBK Digital','Outros serviços avulsos')),
 valor numeric(14,2) not null check(valor>0), forma_pagamento text not null check(forma_pagamento in ('Pix','Pix Automático','Boleto/Pix','Cartão recorrente','Transferência','Dinheiro','Outro')),
 data_contratacao date not null, vencimento date not null, observacoes text not null default '', plano text not null default '', data_inicio date not null,
 dia_vencimento integer check(dia_vencimento between 1 and 31), status text not null default 'ativo' check(status in ('ativo','suspenso','cancelado')),
 pausa_inicio date, pausas jsonb not null default '[]', gateway text, gateway_reference text, created_by uuid not null references public.users(id),updated_by uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(vencimento >= data_inicio), check(servico <> 'RBK Digital' or (length(trim(plano))>0 and dia_vencimento is not null))
);
create index rbk_contratos_cliente on public.rbk_contratos(cliente_id);
create table public.rbk_cobrancas (
 id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.rbk_contratos(id), competencia date not null, vencimento date not null, valor numeric(14,2) not null check(valor>0),
 cancelada boolean not null default false, gateway_reference text, created_by uuid not null references public.users(id), updated_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(contrato_id,competencia)
);
create index rbk_cobrancas_vencimento on public.rbk_cobrancas(vencimento);
create table public.rbk_pagamentos (
 id uuid primary key default gen_random_uuid(), cobranca_id uuid not null references public.rbk_cobrancas(id),valor numeric(14,2) not null check(valor>0),data_pagamento date not null,
 forma_pagamento text not null,observacoes text not null default '',idempotency_key uuid not null unique,origem text not null default 'manual' check(origem='manual'),
 created_by uuid not null references public.users(id), created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index rbk_pagamentos_cobranca on public.rbk_pagamentos(cobranca_id);
create index rbk_pagamentos_data on public.rbk_pagamentos(data_pagamento);
create table public.rbk_comunicados (
 id uuid primary key default gen_random_uuid(),titulo text not null check(length(trim(titulo)) between 1 and 200),texto text not null check(length(trim(texto)) between 1 and 10000),
 canal text not null check(canal in ('E-mail','WhatsApp')),segmento jsonb not null default '{}',status text not null default 'rascunho' check(status='rascunho'),created_by uuid not null references public.users(id),updated_by uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table public.rbk_gestao_eventos (
 id uuid primary key default gen_random_uuid(),entidade text not null,entidade_id uuid not null,acao text not null,antes jsonb,depois jsonb,created_by uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp()
);
create index rbk_gestao_eventos_entidade on public.rbk_gestao_eventos(entidade_id,created_at desc);
-- No direct Data API access. Only the authenticated, scoped dispatcher may mutate or read.
alter table public.rbk_crm_clientes enable row level security;
alter table public.rbk_contratos enable row level security;
alter table public.rbk_cobrancas enable row level security;
alter table public.rbk_pagamentos enable row level security;
alter table public.rbk_comunicados enable row level security;
alter table public.rbk_gestao_eventos enable row level security;
revoke all on public.rbk_crm_clientes,public.rbk_contratos,public.rbk_cobrancas,public.rbk_pagamentos,public.rbk_comunicados,public.rbk_gestao_eventos from public,anon,authenticated;
grant all on public.rbk_crm_clientes,public.rbk_contratos,public.rbk_cobrancas,public.rbk_pagamentos,public.rbk_comunicados,public.rbk_gestao_eventos to service_role;

create function rbk_private.gestao_acesso(p_cliente uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.rbk_crm_clientes c where c.id=p_cliente and (
 rbk_private.actor_role()='superadmin_rbk' or (rbk_private.actor_role()='gestor_rbk' and (
 (c.farm_id is null and c.responsavel_id=auth.uid()) or exists(select 1 from public.rbk_manager_farms m where m.farm_id=c.farm_id and m.manager_user_id=auth.uid())))))
$$;
create function rbk_private.gestao_vencimento(p_mes date,p_dia integer) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',p_mes)::date + (least(p_dia,extract(day from date_trunc('month',p_mes)+interval '1 month - 1 day')::integer)-1))::date
$$;
create function rbk_private.gestao_gerar(p_contrato uuid) returns void language plpgsql security definer set search_path='' as $$
declare k public.rbk_contratos; d date; v date; limite date := date_trunc('month',timezone('America/Sao_Paulo',now()))::date;
begin
 select * into k from public.rbk_contratos where id=p_contrato for update;
 if not found or not rbk_private.gestao_acesso(k.cliente_id) then raise exception 'Acesso negado';end if;
 if k.status<>'ativo' then return;end if;
 if k.servico='RBK Digital' then
   d:=date_trunc('month',k.vencimento)::date;
   -- Generate first invoice even for future starts. Catch up through current month, never overwrite history.
   limite:=greatest(limite,d);
   while d<=limite loop
    v:=rbk_private.gestao_vencimento(d,k.dia_vencimento);
    if v>=k.vencimento and not exists(select 1 from jsonb_array_elements(k.pausas) p where d>=(p->>'inicio')::date and d<(p->>'fim')::date) then
     insert into public.rbk_cobrancas(contrato_id,competencia,vencimento,valor,created_by,updated_by)values(k.id,d,v,k.valor,auth.uid(),auth.uid()) on conflict(contrato_id,competencia)do nothing;
    end if;
    d:=(d+interval '1 month')::date;
   end loop;
 else
   insert into public.rbk_cobrancas(contrato_id,competencia,vencimento,valor,created_by,updated_by)values(k.id,date_trunc('month',k.vencimento)::date,k.vencimento,k.valor,auth.uid(),auth.uid())on conflict(contrato_id,competencia)do nothing;
 end if;
end$$;
create function rbk_private.gestao_cobrancas(p_contrato uuid default null) returns table(id uuid,contrato_id uuid,competencia date,vencimento date,valor numeric,pago numeric,saldo numeric,status text) language sql stable security definer set search_path='' as $$
 select b.id,b.contrato_id,b.competencia,b.vencimento,b.valor,coalesce(p.total,0),case when b.cancelada then 0 else b.valor-coalesce(p.total,0) end,
 case when b.cancelada then 'cancelado' when coalesce(p.total,0)>=b.valor then 'pago' when b.vencimento<timezone('America/Sao_Paulo',now())::date then 'atrasado' else 'pendente' end
 from public.rbk_cobrancas b join public.rbk_contratos k on k.id=b.contrato_id left join lateral(select sum(valor) total from public.rbk_pagamentos p where p.cobranca_id=b.id)p on true
 where (p_contrato is null or k.id=p_contrato) and rbk_private.gestao_acesso(k.cliente_id)
$$;

create function rbk_private.gestao_dispatch(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); role_name text:=rbk_private.actor_role(); hoje date:=timezone('America/Sao_Paulo',now())::date;
 c public.rbk_crm_clientes; old_c public.rbk_crm_clientes; k public.rbk_contratos; old_k public.rbk_contratos; b public.rbk_cobrancas; payment public.rbk_pagamentos; draft public.rbk_comunicados;
 cid uuid:=nullif(p_data->>'id','')::uuid; fid uuid; rid uuid; cnpj_value text; result jsonb; before_value jsonb; after_value jsonb; entity text; entity_id uuid; total_pago numeric; amount numeric; key_value uuid; n integer; ids uuid[];
begin
 if actor is null or role_name is null or role_name not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso restrito à gestão RBK' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>40000 then raise exception 'Dados inválidos';end if;
 if p_action='contexto' then
   return jsonb_build_object('actor_id',actor,'responsaveis',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nome',u.nome)),'[]')from public.users u where u.status='active' and (u.id=actor or role_name='superadmin_rbk') and (u.perfil='gestor_rbk' or exists(select 1 from public.rbk_admins a where a.user_id=u.id and a.ativo))));
 elsif p_action='clientes' then
   with filtrados as(select * from public.rbk_crm_clientes x where rbk_private.gestao_acesso(x.id)
    and (coalesce(p_data->>'busca','')='' or x.razao_social ilike '%'||(p_data->>'busca')||'%' or x.cnpj like '%'||regexp_replace(p_data->>'busca','[^0-9]','','g')||'%' and regexp_replace(p_data->>'busca','[^0-9]','','g')<>'')
    and (coalesce(p_data->>'status','')='' or x.status=p_data->>'status')
    and (coalesce(p_data->>'interesse','')='' or (p_data->>'interesse')=any(x.interesses))
    and (coalesce(p_data->>'uf','')='' or x.uf=p_data->>'uf')
    and (coalesce(p_data->>'cidade','')='' or x.cidade ilike '%'||(p_data->>'cidade')||'%')
    and (coalesce(p_data->>'responsavel_id','')='' or x.responsavel_id=(p_data->>'responsavel_id')::uuid)
    and (not coalesce((p_data->>'aguardando')::boolean,false) or x.aguardando_credenciamento))
   select jsonb_build_object('total',(select count(*)from filtrados),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]')from(select * from filtrados order by updated_at desc,id limit 100 offset greatest(0,coalesce((p_data->>'offset')::integer,0)))t))into result;
   return result;
 elsif p_action='cliente' then
   select * into c from public.rbk_crm_clientes where id=cid and rbk_private.gestao_acesso(id);if not found then raise exception 'Cadastro indisponível';end if;return to_jsonb(c);
 elsif p_action='cliente_salvar' then
   if cid is not null then
    select * into old_c from public.rbk_crm_clientes where id=cid and rbk_private.gestao_acesso(id) for update;
    if not found then raise exception 'Cadastro indisponível';end if;
    if nullif(p_data->>'updated_at','')::timestamptz is distinct from old_c.updated_at then raise exception 'Cadastro alterado por outro usuário. Atualize a lista.';end if;
   end if;
   cnpj_value:=nullif(regexp_replace(coalesce(p_data->>'cnpj',''),'[^0-9]','','g'),'');
   if cnpj_value is not null and length(cnpj_value)<>14 then raise exception 'CNPJ deve ter 14 dígitos';end if;
   if old_c.id is not null and (old_c.farm_id is not null or exists(select 1 from public.rbk_contratos where cliente_id=cid)) and cnpj_value is distinct from old_c.cnpj then raise exception 'Não é possível trocar o CNPJ de um cadastro vinculado';end if;
   if exists(select 1 from public.rbk_crm_clientes where cnpj=cnpj_value and id is distinct from cid)then raise exception 'CNPJ já cadastrado. Localize o cadastro existente ou solicite acesso à carteira.' using errcode='23505';end if;
   select count(*), (array_agg(id))[1] into n,fid from public.farms where regexp_replace(cnpj,'[^0-9]','','g')=cnpj_value;
   if n>1 then raise exception 'CNPJ possui mais de uma farmácia. Revise o cadastro existente.';end if;
   if old_c.farm_id is not null and fid is distinct from old_c.farm_id then raise exception 'O vínculo da farmácia mudou. Revise o cadastro antes de continuar.';end if;
   if nullif(p_data->>'farm_id','')is not null and (p_data->>'farm_id')::uuid is distinct from fid then raise exception 'Farmácia não corresponde ao CNPJ';end if;
   if fid is not null and role_name<>'superadmin_rbk' and not exists(select 1 from public.rbk_manager_farms where farm_id=fid and manager_user_id=actor)then raise exception 'Farmácia fora da sua carteira';end if;
   rid:=coalesce(nullif(p_data->>'responsavel_id','')::uuid,actor);
   if role_name<>'superadmin_rbk' and rid<>actor then raise exception 'Responsável inválido';end if;
   if not exists(select 1 from public.users u where u.id=rid and u.status='active' and (u.perfil='gestor_rbk' or exists(select 1 from public.rbk_admins a where a.user_id=u.id and a.ativo)))then raise exception 'Responsável inválido';end if;
   if coalesce(p_data->>'email','')<>'' and not (p_data->>'email' ~ '^[^ @]+@[^ @]+\.[^ @]+$')then raise exception 'E-mail inválido';end if;
   if old_c.id is null then
    insert into public.rbk_crm_clientes(razao_social,cnpj,farm_id,responsavel_id,created_by,updated_by)values(trim(p_data->>'razao_social'),cnpj_value,fid,rid,actor,actor)returning * into c;
   else c:=old_c;end if;
   update public.rbk_crm_clientes set razao_social=trim(p_data->>'razao_social'),cnpj=cnpj_value,farm_id=fid,
    contato=coalesce(p_data->>'contato',''),whatsapp=coalesce(p_data->>'whatsapp',''),email=coalesce(p_data->>'email',''),cidade=coalesce(p_data->>'cidade',''),uf=upper(coalesce(p_data->>'uf','')),
    origem=coalesce(p_data->>'origem',''),interesses=array(select jsonb_array_elements_text(coalesce(p_data->'interesses','[]'))),ultimo_contato=nullif(p_data->>'ultimo_contato','')::date,
    proxima_acao=coalesce(p_data->>'proxima_acao',''),proxima_acao_data=nullif(p_data->>'proxima_acao_data','')::date,responsavel_id=rid,observacoes=coalesce(p_data->>'observacoes',''),status=coalesce(p_data->>'status','Novo lead'),
    aguardando_credenciamento=coalesce((p_data->>'aguardando_credenciamento')::boolean,false),oportunidade_referencia=coalesce(p_data->>'oportunidade_referencia',''),updated_at=clock_timestamp(),updated_by=actor where id=c.id returning * into c;
   result:=to_jsonb(c);entity:='cliente';entity_id:=c.id;before_value:=case when old_c.id is not null then to_jsonb(old_c)end;
 elsif p_action='contrato_salvar' then
   if cid is not null then
    select * into old_k from public.rbk_contratos where id=cid and rbk_private.gestao_acesso(cliente_id) for update;
    if not found then raise exception 'Contrato indisponível';end if;
    if nullif(p_data->>'updated_at','')::timestamptz is distinct from old_k.updated_at then raise exception 'Contrato alterado por outro usuário. Atualize a lista.';end if;
   end if;
   select * into c from public.rbk_crm_clientes where id=(p_data->>'cliente_id')::uuid and rbk_private.gestao_acesso(id) for update;
   if not found then raise exception 'Cliente indisponível';end if;
   if c.cnpj is null then raise exception 'Informe o CNPJ no CRM antes de contratar';end if;
   if old_k.id is not null and (old_k.cliente_id<>c.id or old_k.servico is distinct from p_data->>'servico' or old_k.vencimento is distinct from (p_data->>'vencimento')::date or old_k.data_inicio is distinct from (p_data->>'data_inicio')::date or old_k.dia_vencimento is distinct from nullif(p_data->>'dia_vencimento','')::integer) then raise exception 'Cliente, serviço e calendário são fixos. Crie outro contrato para alterar esses dados.';end if;
   if old_k.status='cancelado' and p_data->>'status'<>'cancelado' then raise exception 'Contrato cancelado não pode ser reativado';end if;
   if (p_data->>'data_inicio')::date<'2000-01-01'::date then raise exception 'Data de início inválida';end if;
   if p_data->>'servico'='RBK Digital' and (p_data->>'vencimento')::date is distinct from rbk_private.gestao_vencimento((p_data->>'vencimento')::date,(p_data->>'dia_vencimento')::integer)then raise exception 'Primeiro vencimento não corresponde ao dia mensal';end if;
   if old_k.id is null then
    insert into public.rbk_contratos(cliente_id,servico,valor,forma_pagamento,data_contratacao,vencimento,plano,data_inicio,dia_vencimento,status,observacoes,created_by,updated_by)
    values(c.id,p_data->>'servico',(p_data->>'valor')::numeric,p_data->>'forma_pagamento',(p_data->>'data_contratacao')::date,(p_data->>'vencimento')::date,coalesce(p_data->>'plano',''),(p_data->>'data_inicio')::date,nullif(p_data->>'dia_vencimento','')::integer,coalesce(p_data->>'status','ativo'),coalesce(p_data->>'observacoes',''),actor,actor)returning * into k;
   else
    -- Materialize old obligations at the old amount before changing terms.
    perform rbk_private.gestao_gerar(old_k.id);
    update public.rbk_contratos set valor=(p_data->>'valor')::numeric,forma_pagamento=p_data->>'forma_pagamento',data_contratacao=(p_data->>'data_contratacao')::date,plano=coalesce(p_data->>'plano',''),status=p_data->>'status',
     pausa_inicio=case when p_data->>'status'='suspenso' and old_k.status<>'suspenso' then date_trunc('month',hoje+interval '1 month')::date when p_data->>'status'='ativo' then null else old_k.pausa_inicio end,
     pausas=case when old_k.status='suspenso' and p_data->>'status'='ativo' and old_k.pausa_inicio is not null then old_k.pausas||jsonb_build_array(jsonb_build_object('inicio',old_k.pausa_inicio,'fim',date_trunc('month',hoje)::date)) else old_k.pausas end,
     observacoes=coalesce(p_data->>'observacoes',''),updated_by=actor,updated_at=clock_timestamp()where id=old_k.id returning * into k;
   end if;
   if k.status='cancelado' then
    update public.rbk_cobrancas b set cancelada=true,updated_by=actor,updated_at=clock_timestamp()where b.contrato_id=k.id and b.vencimento>=hoje and not exists(select 1 from public.rbk_pagamentos p where p.cobranca_id=b.id);
   else perform rbk_private.gestao_gerar(k.id);end if;
   if old_k.id is null and k.status='suspenso' then update public.rbk_contratos set pausa_inicio=date_trunc('month',k.vencimento)::date where id=k.id returning * into k;end if;
   result:=to_jsonb(k);entity:='contrato';entity_id:=k.id;before_value:=case when old_k.id is not null then to_jsonb(old_k)end;
 elsif p_action='sincronizar' then
   for k in select * from public.rbk_contratos where status='ativo' and rbk_private.gestao_acesso(cliente_id)order by id loop perform rbk_private.gestao_gerar(k.id);end loop;
   return jsonb_build_object('ok',true);
 elsif p_action='financeiro' then
   with contratos as(select k.*,c.razao_social,c.cnpj from public.rbk_contratos k join public.rbk_crm_clientes c on c.id=k.cliente_id where rbk_private.gestao_acesso(c.id)),
   faturas as(select * from rbk_private.gestao_cobrancas()),
   rows as(select k.*,coalesce((select min(vencimento) from faturas b where b.contrato_id=k.id and b.saldo>0),case when k.servico='RBK Digital' and k.status='ativo' then rbk_private.gestao_vencimento(coalesce((select max(competencia)+interval '1 month' from faturas b where b.contrato_id=k.id),k.vencimento)::date,k.dia_vencimento)end)proxima_cobranca,
     case when exists(select 1 from faturas b where b.contrato_id=k.id and b.status='atrasado')then 'atrasado' when exists(select 1 from faturas b where b.contrato_id=k.id and b.saldo>0)then 'pendente' when k.status='cancelado' then 'cancelado' else 'pago' end as pagamento_status
     from contratos k),
   filtrados as(select * from rows x where (coalesce(p_data->>'busca','')='' or x.razao_social ilike '%'||(p_data->>'busca')||'%' or x.cnpj like '%'||regexp_replace(p_data->>'busca','[^0-9]','','g')||'%' and regexp_replace(p_data->>'busca','[^0-9]','','g')<>'')and (coalesce(p_data->>'status','')='' or x.pagamento_status=p_data->>'status')and (coalesce(p_data->>'servico','')='' or x.servico=p_data->>'servico'))
   select jsonb_build_object('total',(select count(*)from filtrados),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]')from(select * from filtrados order by created_at desc,id limit 100 offset greatest(0,coalesce((p_data->>'offset')::integer,0)))t),
    'indicadores',jsonb_build_object('mrr',(select coalesce(sum(valor),0)from contratos where servico='RBK Digital' and status='ativo' and data_inicio<=hoje),
    'assinaturas_ativas',(select count(*)from contratos where servico='RBK Digital' and status='ativo' and data_inicio<=hoje),
    'recebido_mes',(select coalesce(sum(p.valor),0)from public.rbk_pagamentos p join faturas b on b.id=p.cobranca_id where p.data_pagamento>=date_trunc('month',hoje)::date and p.data_pagamento<=hoje),
    'a_receber',(select coalesce(sum(saldo),0)from faturas),'atrasados',(select coalesce(sum(saldo),0)from faturas where status='atrasado'),'quantidade_atrasados',(select count(*)from faturas where status='atrasado')))into result;return result;
 elsif p_action='contrato' then
   select * into k from public.rbk_contratos where id=cid and rbk_private.gestao_acesso(cliente_id);if not found then raise exception 'Contrato indisponível';end if;
   return jsonb_build_object('contrato',to_jsonb(k),'cobrancas',(select coalesce(jsonb_agg(to_jsonb(t)order by t.vencimento),'[]')from rbk_private.gestao_cobrancas(cid)t),
   'pagamentos',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]')from public.rbk_pagamentos p join public.rbk_cobrancas b on b.id=p.cobranca_id where b.contrato_id=cid));
 elsif p_action='pagamento' then
   select * into b from public.rbk_cobrancas where id=(p_data->>'cobranca_id')::uuid for update;
   if not found or not exists(select 1 from public.rbk_contratos k where k.id=b.contrato_id and rbk_private.gestao_acesso(k.cliente_id))then raise exception 'Cobrança indisponível';end if;
   key_value:=(p_data->>'idempotency_key')::uuid;amount:=(p_data->>'valor')::numeric;
   if key_value is null or amount is null or amount<=0 or amount<>round(amount,2)then raise exception 'Pagamento inválido';end if;
   select * into payment from public.rbk_pagamentos where idempotency_key=key_value;
   if found then
    if payment.cobranca_id<>b.id or payment.valor<>amount or payment.data_pagamento is distinct from (p_data->>'data_pagamento')::date or payment.forma_pagamento is distinct from p_data->>'forma_pagamento' then raise exception 'Identificador de pagamento já utilizado';end if;
    return to_jsonb(payment);
   end if;
   select coalesce(sum(valor),0)into total_pago from public.rbk_pagamentos where cobranca_id=b.id;
   if b.cancelada or amount>b.valor-total_pago then raise exception 'Valor superior ao saldo ou cobrança cancelada';end if;
   if nullif(p_data->>'data_pagamento','')is null or (p_data->>'data_pagamento')::date>hoje then raise exception 'Data de pagamento inválida';end if;
   if coalesce(p_data->>'forma_pagamento','')not in ('Pix','Pix Automático','Boleto/Pix','Cartão recorrente','Transferência','Dinheiro','Outro')then raise exception 'Forma de pagamento inválida';end if;
   insert into public.rbk_pagamentos(cobranca_id,valor,data_pagamento,forma_pagamento,observacoes,idempotency_key,created_by)values(b.id,amount,(p_data->>'data_pagamento')::date,p_data->>'forma_pagamento',coalesce(p_data->>'observacoes',''),key_value,actor)returning * into payment;
   update public.rbk_cobrancas set updated_at=clock_timestamp(),updated_by=actor where id=b.id;
   result:=to_jsonb(payment);entity:='pagamento';entity_id:=payment.id;
 elsif p_action='comunicados' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]')into result from(select * from public.rbk_comunicados where created_by=actor or role_name='superadmin_rbk' order by updated_at desc limit 100)t;return result;
 elsif p_action='comunicado_salvar' then
   if cid is not null then
    select * into draft from public.rbk_comunicados where id=cid and (created_by=actor or role_name='superadmin_rbk')for update;
    if not found then raise exception 'Rascunho indisponível';end if;
    if nullif(p_data->>'updated_at','')::timestamptz is distinct from draft.updated_at then raise exception 'Rascunho alterado. Atualize a lista.';end if;before_value:=to_jsonb(draft);
    update public.rbk_comunicados set titulo=p_data->>'titulo',texto=p_data->>'texto',canal=p_data->>'canal',segmento=coalesce(p_data->'segmento','{}'),updated_by=actor,updated_at=clock_timestamp()where id=cid returning * into draft;
   else
    insert into public.rbk_comunicados(titulo,texto,canal,segmento,created_by,updated_by)values(p_data->>'titulo',p_data->>'texto',p_data->>'canal',coalesce(p_data->'segmento','{}'),actor,actor)returning * into draft;
   end if;
   result:=to_jsonb(draft);entity:='comunicado';entity_id:=draft.id;
 else raise exception 'Operação inválida';end if;
 insert into public.rbk_gestao_eventos(entidade,entidade_id,acao,antes,depois,created_by)values(entity,entity_id,p_action,before_value,result,actor);
 return result;
end$$;
revoke all on function rbk_private.gestao_acesso(uuid),rbk_private.gestao_vencimento(date,integer),rbk_private.gestao_gerar(uuid),rbk_private.gestao_cobrancas(uuid),rbk_private.gestao_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function rbk_private.gestao_dispatch(text,jsonb) to authenticated;
create function public.gestao_rbk(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select rbk_private.gestao_dispatch(p_action,p_data)$$;
revoke all on function public.gestao_rbk(text,jsonb) from public,anon;
grant execute on function public.gestao_rbk(text,jsonb) to authenticated;
commit;
