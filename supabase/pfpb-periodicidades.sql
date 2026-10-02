-- Tabelas globais publicadas por migração revisada. Nenhuma escrita por farmácia.
begin;
create table public.pfpb_periodicidades (
 id uuid primary key default gen_random_uuid(), chave text not null, versao integer not null check(versao>0),
 principio_ativo text not null, concentracao text not null, apresentacao text not null,
 indicacao text not null, periodicidade_dias integer not null check(periodicidade_dias between 1 and 3650),
 tipo_item text not null check(tipo_item in ('medicamento','fralda','absorvente')),
 fonte text not null check(fonte like 'https://%'), data_vigencia date not null, data_fim date,
 ativo boolean not null default false, verificado_em date not null, observacao text not null default '',
 unique(chave,versao), check(data_fim is null or data_fim>data_vigencia)
);
create table public.pfpb_produtos_periodicidade (
 id uuid primary key default gen_random_uuid(), ean text not null check(ean ~ '^([0-9]{8}|[0-9]{12,14})$'),
 produto text not null, principio_ativo text not null, concentracao text not null, apresentacao text not null,
 indicacao text not null, tipo_item text not null check(tipo_item in ('medicamento','fralda','absorvente')),
 regra_chave text, fonte text not null check(fonte like 'https://%'), pagina_fonte integer not null,
 data_vigencia date not null, data_fim date, versao text not null,
 ativo boolean not null default false, observacao text not null default '',
 unique(ean,versao), check(data_fim is null or data_fim>data_vigencia)
);
create index pfpb_produtos_periodicidade_ean_idx on public.pfpb_produtos_periodicidade(ean,data_vigencia);
create index pfpb_periodicidades_chave_idx on public.pfpb_periodicidades(chave,data_vigencia);
alter table public.pfpb_periodicidades enable row level security;
alter table public.pfpb_produtos_periodicidade enable row level security;
revoke all on public.pfpb_periodicidades,public.pfpb_produtos_periodicidade from public,anon,authenticated;
grant select,insert,update on public.pfpb_periodicidades,public.pfpb_produtos_periodicidade to service_role;

create function rbk_private.pfpb_versao_imutavel() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-array['ativo','data_fim']) is distinct from (to_jsonb(old)-array['ativo','data_fim']) then
  raise exception 'Versão imutável. Publique uma nova versão com vigência própria.';
 end if;
 return new;
end $$;
create trigger pfpb_regra_imutavel before update or delete on public.pfpb_periodicidades for each row execute function rbk_private.pfpb_versao_imutavel();
create trigger pfpb_produto_imutavel before update or delete on public.pfpb_produtos_periodicidade for each row execute function rbk_private.pfpb_versao_imutavel();
create function rbk_private.pfpb_vigencia_unica() returns trigger
language plpgsql set search_path='' as $$
begin
 if not new.ativo then return new;end if;
 if tg_table_name='pfpb_periodicidades' then
  perform pg_advisory_xact_lock(hashtext('regra:'||new.chave));
  if exists(select 1 from public.pfpb_periodicidades r where r.chave=new.chave and r.ativo and r.id<>new.id and daterange(r.data_vigencia,r.data_fim,'[)') && daterange(new.data_vigencia,new.data_fim,'[)')) then raise exception 'Vigências sobrepostas para a regra.';end if;
 else
  perform pg_advisory_xact_lock(hashtext('ean:'||new.ean));
  if exists(select 1 from public.pfpb_produtos_periodicidade r where r.ean=new.ean and r.ativo and r.id<>new.id and daterange(r.data_vigencia,r.data_fim,'[)') && daterange(new.data_vigencia,new.data_fim,'[)')) then raise exception 'Vigências sobrepostas para o EAN.';end if;
 end if;
 return new;
end $$;
create trigger pfpb_regra_vigencia before insert or update on public.pfpb_periodicidades for each row execute function rbk_private.pfpb_vigencia_unica();
create trigger pfpb_produto_vigencia before insert or update on public.pfpb_produtos_periodicidade for each row execute function rbk_private.pfpb_vigencia_unica();

alter table public.dispensacao_itens add column concentracao text, add column apresentacao text,
 add column tipo_item text check(tipo_item in ('medicamento','fralda','absorvente'));
alter table public.proximas_previsoes drop constraint proximas_previsoes_origem_check;
alter table public.proximas_previsoes add constraint proximas_previsoes_origem_check check(origem in ('nao_calculado','fonte_confirmada','intervalo_fonte','manual','intervalo_confirmado','regra_pfpb'));
alter table public.proximas_previsoes add column regra_id uuid references public.pfpb_periodicidades(id),
 add column regra_snapshot jsonb, add column alerta_data date generated always as (proxima_data-2) stored;
alter table public.proximas_previsoes add constraint proximas_regra_evidencia check(origem<>'regra_pfpb' or (regra_id is not null and regra_snapshot is not null));
create index proximas_alerta_idx on public.proximas_previsoes(farmacia_id,alerta_data) where ativa and status='a_avisar';

create function rbk_private.pfpb_normalizar(p text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(translate(upper(coalesce(p,'')),'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ','AAAAEEEIIIOOOOUUUC'),'\s+','','g')
$$;
create function rbk_private.pfpb_resolver(i public.dispensacao_itens) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare produto public.pfpb_produtos_periodicidade; regra public.pfpb_periodicidades; n integer; resultado jsonb;
begin
 if i.status<>'confirmado' or i.data_dispensacao is null then return null;end if;
 if nullif(btrim(i.ean),'') is not null then
  select count(*) into n from public.pfpb_produtos_periodicidade p where p.ean=i.ean and p.ativo and i.data_dispensacao>=p.data_vigencia and (p.data_fim is null or i.data_dispensacao<p.data_fim);
  if n<>1 then return null;end if;
  select * into produto from public.pfpb_produtos_periodicidade p where p.ean=i.ean and p.ativo and i.data_dispensacao>=p.data_vigencia and (p.data_fim is null or i.data_dispensacao<p.data_fim);
  -- Um EAN conhecido não sobrepõe metadados contraditórios confirmados no cupom.
  if rbk_private.pfpb_normalizar(i.produto)<>rbk_private.pfpb_normalizar(produto.produto)
   or (nullif(i.principio_ativo,'') is not null and rbk_private.pfpb_normalizar(i.principio_ativo)<>rbk_private.pfpb_normalizar(produto.principio_ativo))
   or (nullif(i.concentracao,'') is not null and rbk_private.pfpb_normalizar(i.concentracao)<>rbk_private.pfpb_normalizar(produto.concentracao))
   or (nullif(i.apresentacao,'') is not null and rbk_private.pfpb_normalizar(i.apresentacao)<>rbk_private.pfpb_normalizar(produto.apresentacao))
   or (nullif(i.indicacao,'') is not null and rbk_private.pfpb_normalizar(i.indicacao)<>rbk_private.pfpb_normalizar(produto.indicacao))
   or (i.tipo_item is not null and i.tipo_item<>produto.tipo_item) then return null;end if;
  select count(*) into n from public.pfpb_periodicidades r where r.chave=produto.regra_chave and r.ativo and i.data_dispensacao>=r.data_vigencia and (r.data_fim is null or i.data_dispensacao<r.data_fim);
  if n<>1 then return null;end if;
  select * into regra from public.pfpb_periodicidades r where r.chave=produto.regra_chave and r.ativo and i.data_dispensacao>=r.data_vigencia and (r.data_fim is null or i.data_dispensacao<r.data_fim);
  resultado=to_jsonb(regra)||jsonb_build_object('metodo','ean','produto_catalogo',to_jsonb(produto));
 else
  if nullif(btrim(i.principio_ativo),'') is null or nullif(btrim(i.concentracao),'') is null or nullif(btrim(i.apresentacao),'') is null or nullif(btrim(i.indicacao),'') is null or i.tipo_item is null then return null;end if;
  select count(*),jsonb_agg(to_jsonb(r))->0 into n,resultado from public.pfpb_periodicidades r
  where r.ativo and i.data_dispensacao>=r.data_vigencia and (r.data_fim is null or i.data_dispensacao<r.data_fim)
   and rbk_private.pfpb_normalizar(r.principio_ativo)=rbk_private.pfpb_normalizar(i.principio_ativo)
   and rbk_private.pfpb_normalizar(r.concentracao)=rbk_private.pfpb_normalizar(i.concentracao)
   and rbk_private.pfpb_normalizar(r.apresentacao)=rbk_private.pfpb_normalizar(i.apresentacao)
   and rbk_private.pfpb_normalizar(r.indicacao)=rbk_private.pfpb_normalizar(i.indicacao) and r.tipo_item=i.tipo_item;
  if n<>1 then return null;end if;
  resultado=resultado||jsonb_build_object('metodo','identidade_estruturada');
 end if;
 return resultado;
end $$;
create function rbk_private.pfpb_validar_identidade() returns trigger language plpgsql set search_path='' as $$
declare campo text;
begin
 foreach campo in array array['concentracao','apresentacao','tipo_item'] loop
  if to_jsonb(new)->campo <> 'null'::jsonb and nullif(btrim(new.origens->>campo),'') is null then raise exception 'Informe a origem do campo %.',campo;end if;
 end loop;
 return new;
end $$;
create trigger pfpb_validar_identidade before insert or update on public.dispensacao_itens for each row execute function rbk_private.pfpb_validar_identidade();
revoke all on function rbk_private.pfpb_validar_identidade() from public,anon,authenticated;
revoke all on function rbk_private.pfpb_resolver(public.dispensacao_itens),rbk_private.pfpb_normalizar(text),rbk_private.pfpb_versao_imutavel(),rbk_private.pfpb_vigencia_unica() from public,anon,authenticated;

create or replace function rbk_private.proximas_sincronizar(p_item uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.dispensacao_itens; a public.autorizacoes; p public.proximas_previsoes; c uuid; snapshot jsonb; d date; o text; motivo_calculo text; antes jsonb; ref_calculo text; intervalo_calculo integer; material boolean; regra jsonb; regra_ref uuid;
begin
 select * into i from public.dispensacao_itens where id=p_item;
 select * into a from public.autorizacoes where id=i.autorizacao_id;
 select * into p from public.proximas_previsoes where item_id=p_item for update;
 -- Snapshots legados não tinham estas chaves; ausência e null são equivalentes.
 if p.id is not null then p.fonte=jsonb_build_object('principio_ativo',null,'concentracao',null,'apresentacao',null,'indicacao',null,'tipo_item',null)||p.fonte;end if;
 antes=jsonb_build_object('data',p.proxima_data,'origem',p.origem,'referencia',p.referencia,'intervalo',p.intervalo_dias,'fonte',p.fonte-'cpf','regra',p.regra_snapshot);
 if i.id is null or a.id is null or i.status<>'confirmado' or i.produto is null then
  if p.id is not null and p.ativa then
   update public.proximas_previsoes set ativa=false,motivo='Fonte removida ou aguardando confirmação.',versao=versao+1,updated_at=now() where id=p.id returning * into p;
   perform rbk_private.proximas_evento(p,'fonte_invalidada',jsonb_build_object('antes',antes));
  end if;return;
 end if;
 -- Vínculo explícito da autorização; nunca depender do vínculo atual de seu criador.
 snapshot=jsonb_build_object('farmacia_id',a.farm_id,'cpf',a.cpf_cliente,'produto',i.produto,'ean',i.ean,'unidade',i.unidade,'quantidade',i.quantidade,'data',i.data_dispensacao,'retirada',i.retirada_prevista_fonte,'intervalo',i.intervalo_retirada_dias,'referencia',i.retirada_referencia,'principio_ativo',i.principio_ativo,'concentracao',i.concentracao,'apresentacao',i.apresentacao,'indicacao',i.indicacao,'tipo_item',i.tipo_item);
 if p.id is not null and p.fonte=snapshot and p.ativa then return;end if;
 insert into public.proximas_contatos(farmacia_id,cpf) values(a.farm_id,coalesce(a.cpf_cliente,'')) on conflict(farmacia_id,cpf) do nothing;
 select id into c from public.proximas_contatos where farmacia_id=a.farm_id and cpf=coalesce(a.cpf_cliente,'');
 d=null;o='nao_calculado';ref_calculo=i.retirada_referencia;intervalo_calculo=null;motivo_calculo='Sem intervalo ou data de retorno confirmados.';
 if i.data_dispensacao is null then motivo_calculo='Data da última dispensação não confirmada.';
 elsif nullif(btrim(i.retirada_referencia),'') is not null then
  if i.retirada_prevista_fonte>i.data_dispensacao then d=i.retirada_prevista_fonte;o='fonte_confirmada';
  elsif i.retirada_prevista_fonte is not null then motivo_calculo='Data de retorno da fonte inconsistente; revisar.';
  elsif i.intervalo_retirada_dias is not null and nullif(btrim(i.unidade),'') is not null then d=i.data_dispensacao+i.intervalo_retirada_dias;o='intervalo_fonte';intervalo_calculo=i.intervalo_retirada_dias;
  elsif i.intervalo_retirada_dias is not null then motivo_calculo='Unidade da dispensação não confirmada; revisar intervalo.';end if;
 end if;
 if d is null and i.data_dispensacao is not null and i.retirada_prevista_fonte is null and i.intervalo_retirada_dias is null then
  regra=rbk_private.pfpb_resolver(i);
  if regra is not null then
   regra_ref=(regra->>'id')::uuid;intervalo_calculo=(regra->>'periodicidade_dias')::integer;d=i.data_dispensacao+intervalo_calculo;o='regra_pfpb';ref_calculo=regra->>'fonte';
  else motivo_calculo='Sem correspondência segura de item, apresentação e regra vigente. Revise ou defina manualmente.';end if;
 end if;
 if d is not null then motivo_calculo=case when o='regra_pfpb' then 'Periodicidade oficial do item: '||intervalo_calculo||' dias · versão '||(regra->>'versao') else 'Previsão baseada em informação confirmada da fonte.' end;end if;
 material=p.id is not null and (p.fonte-array['retirada','intervalo','referencia']) is distinct from (snapshot-array['retirada','intervalo','referencia']);
 if material then
  d=null;o='nao_calculado';intervalo_calculo=null;regra=null;regra_ref=null;motivo_calculo='Dados da dispensação alterados. Confirme novamente a regra e a previsão.';
 elsif p.id is not null and p.ativa and (p.origem in ('manual','intervalo_confirmado') or (p.origem='nao_calculado' and p.referencia is not null)) then
  d=p.proxima_data;o=p.origem;intervalo_calculo=p.intervalo_dias;ref_calculo=p.referencia;motivo_calculo=p.motivo;regra=p.regra_snapshot;regra_ref=p.regra_id;
 end if;
 if p.id is null then
  insert into public.proximas_previsoes(farmacia_id,contato_id,item_id,autorizacao_id,produto,ean,unidade,ultima_data,proxima_data,origem,intervalo_dias,referencia,motivo,fonte,regra_id,regra_snapshot)
  values(a.farm_id,c,i.id,a.id,i.produto,i.ean,i.unidade,i.data_dispensacao,d,o,intervalo_calculo,ref_calculo,motivo_calculo,snapshot,regra_ref,regra) returning * into p;
  perform rbk_private.proximas_evento(p,'criada',jsonb_build_object('depois',jsonb_build_object('data',p.proxima_data,'origem',p.origem,'referencia',p.referencia,'intervalo',p.intervalo_dias,'fonte',p.fonte-'cpf','regra',p.regra_snapshot)));
 else
  -- Datas manuais só se conservam com a mesma evidência; alterações materiais pedem revisão.
  update public.proximas_previsoes set contato_id=c,produto=i.produto,ean=i.ean,unidade=i.unidade,ultima_data=i.data_dispensacao,
   proxima_data=d,origem=o,intervalo_dias=intervalo_calculo,referencia=ref_calculo,regra_id=regra_ref,regra_snapshot=regra,
   motivo=motivo_calculo||' Fonte atualizada; confira a previsão.',fonte=snapshot,ativa=true,status=case when proxima_data is distinct from d or material then 'a_avisar' else status end,avisado_em=case when proxima_data is distinct from d or material then null else avisado_em end,avisado_por=case when proxima_data is distinct from d or material then null else avisado_por end,versao=versao+1,updated_at=now()
   where id=p.id returning * into p;
  perform rbk_private.proximas_evento(p,'fonte_atualizada',jsonb_build_object('antes',antes,'depois',jsonb_build_object('data',p.proxima_data,'origem',p.origem,'referencia',p.referencia,'intervalo',p.intervalo_dias,'fonte',p.fonte-'cpf','regra',p.regra_snapshot)));
 end if;
end $$;
create or replace function rbk_private.proximas_listar(p_farm uuid,p_inicio date,p_fim date,p_filtro text,p_pagina integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare hoje date=(now() at time zone 'America/Sao_Paulo')::date; resumo jsonb; linhas jsonb; total integer;
begin
 perform rbk_private.proximas_validar(p_farm);
 if p_filtro is null or p_filtro not in ('periodo','nao_calculado','atrasados','historico','alertas') or p_pagina is null or p_pagina<0 or p_pagina>100000 then raise exception 'Filtro inválido.';end if;
 if p_filtro='periodo' and (p_inicio is null or p_fim is null or p_fim<p_inicio) then raise exception 'Período inválido.';end if;
 select jsonb_build_object('alertas',count(*) filter(where status='a_avisar' and alerta_data<=hoje and proxima_data>=hoje),'hoje',count(*) filter(where proxima_data=hoje),'dias2',count(*) filter(where proxima_data>hoje and proxima_data<=hoje+2),'dias7',count(*) filter(where proxima_data>hoje and proxima_data<=hoje+7),'dias30',count(*) filter(where proxima_data>hoje and proxima_data<=hoje+30),'nao_calculado',count(*) filter(where proxima_data is null),'atrasados',count(*) filter(where proxima_data<hoje)) into resumo
 from public.proximas_previsoes where farmacia_id=p_farm and ativa and status in ('a_avisar','avisado');
 with filtradas as (
 select p.*,c.nome,c.telefone,c.versao as contato_versao,case when c.cpf ~ '^[0-9]{11}$' then '***.'||substring(c.cpf from 4 for 3)||'.'||substring(c.cpf from 7 for 3)||'-**' else 'Não informado' end as cpf_mascarado
 from public.proximas_previsoes p join public.proximas_contatos c on c.id=p.contato_id and c.farmacia_id=p.farmacia_id
 where p.farmacia_id=p_farm and (p_filtro='historico' or (p.ativa and (
 (p_filtro='alertas' and p.status='a_avisar' and p.alerta_data<=hoje and p.proxima_data>=hoje) or
 (p_filtro='periodo' and p.status in ('a_avisar','avisado') and p.proxima_data between p_inicio and p_fim) or
 (p_filtro='nao_calculado' and p.proxima_data is null and p.status in ('a_avisar','avisado')) or
 (p_filtro='atrasados' and p.proxima_data<hoje and p.status in ('a_avisar','avisado'))))))
 select (select count(*) from filtradas),coalesce((select jsonb_agg(to_jsonb(x)) from (
 select id,produto,ean,unidade,ultima_data,proxima_data,alerta_data,regra_id,regra_snapshot,origem,intervalo_dias,referencia,motivo,status,ativa,versao,avisado_em,
 (select u.nome from public.users u where u.id=filtradas.avisado_por) as avisado_por_nome,nome,telefone,contato_versao,cpf_mascarado
 from filtradas order by proxima_data nulls last,id limit 50 offset p_pagina*50) x),'[]') into total,linhas;
 return jsonb_build_object('linhas',linhas,'total',total,'pagina',p_pagina,'resumo',resumo,'hoje',hoje);
end $$;
create or replace function rbk_private.proximas_salvar(p_farm uuid,p_id uuid,p_versao integer,p_dados jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p public.proximas_previsoes; c public.proximas_contatos; antes jsonb; acao text; modo text; data_prevista date; dias integer; ref text; tel text; nome_cliente text; novo_status text;
begin
 perform rbk_private.proximas_validar(p_farm,true);
 if p_dados is null or jsonb_typeof(p_dados)<>'object' or exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('acao','modo','data','intervalo_dias','referencia','nome','telefone','contato_versao','status')) then raise exception 'Dados inválidos.';end if;
 select * into p from public.proximas_previsoes where id=p_id and farmacia_id=p_farm for update;
 if not found or not p.ativa then raise exception 'Previsão indisponível.';end if;
 if p_versao is null or p.versao<>p_versao then raise exception 'Registro alterado por outro usuário. Atualize a tela.';end if;
 select * into c from public.proximas_contatos where id=p.contato_id and farmacia_id=p_farm for update;
 antes=jsonb_build_object('data',p.proxima_data,'status',p.status,'origem',p.origem,'referencia',p.referencia,'regra',p.regra_snapshot);
 acao=p_dados->>'acao';
 if acao='previsao' then
  if (p_dados->>'contato_versao')::integer is distinct from c.versao then raise exception 'Contato alterado por outro usuário. Atualize a tela.';end if;
  nome_cliente=nullif(btrim(p_dados->>'nome'),'');tel=nullif(regexp_replace(coalesce(p_dados->>'telefone',''),'[ ()-]','','g'),'');
  if nome_cliente is not null and length(nome_cliente) not between 2 and 150 then raise exception 'Informe um nome entre 2 e 150 caracteres.';end if;
  if tel is not null and tel !~ '^[1-9][0-9][0-9]{8,9}$' then raise exception 'Informe telefone nacional com DDD, 10 ou 11 dígitos.';end if;
  modo=p_dados->>'modo';ref=nullif(btrim(p_dados->>'referencia'),'');
  if modo is null or modo not in ('data','intervalo','nao_calculado','manter') then raise exception 'Modo inválido.';end if;
  if modo<>'manter' and (ref is null or length(ref) not between 3 and 1000) then raise exception 'Informe a referência ou justificativa da previsão.';end if;
  if modo='manter' then
   update public.proximas_contatos set nome=nome_cliente,telefone=tel,versao=versao+1,updated_at=now() where id=c.id;
   update public.proximas_previsoes set versao=versao+1,updated_at=now() where id=p.id returning * into p;
   perform rbk_private.proximas_evento(p,'contato_editado',jsonb_build_object('regra_preservada',p.regra_id,'contato_alterado',c.nome is distinct from nome_cliente or c.telefone is distinct from tel));
   return;
  end if;
  if modo='data' then data_prevista=(p_dados->>'data')::date;
  elsif modo='intervalo' then
   dias=(p_dados->>'intervalo_dias')::integer;
   if dias is null or dias not between 1 and 3650 then raise exception 'Intervalo inválido.';end if;
   data_prevista=p.ultima_data+dias;
  end if;
  if modo<>'nao_calculado' and (p.ultima_data is null or data_prevista is null or data_prevista<=p.ultima_data or data_prevista>p.ultima_data+3650) then raise exception 'Confirme a última dispensação na fonte e uma data posterior, até 10 anos.';end if;
  update public.proximas_contatos set nome=nome_cliente,telefone=tel,versao=versao+1,updated_at=now() where id=c.id;
  update public.proximas_previsoes set proxima_data=data_prevista,intervalo_dias=dias,regra_id=null,regra_snapshot=null,
   origem=case modo when 'data' then 'manual' when 'intervalo' then 'intervalo_confirmado' else 'nao_calculado' end,
   referencia=ref,motivo=case modo when 'nao_calculado' then 'Aguardando definição segura da próxima retirada.' else 'Previsão conferida pelo funcionário; não substitui autorização do PFPB.' end,
   status=case when proxima_data is distinct from data_prevista then 'a_avisar' else status end,
   avisado_em=case when proxima_data is distinct from data_prevista then null else avisado_em end,
   avisado_por=case when proxima_data is distinct from data_prevista then null else avisado_por end,
   versao=versao+1,updated_at=now() where id=p.id returning * into p;
  perform rbk_private.proximas_evento(p,'previsao_editada',jsonb_build_object('antes',antes,'data',p.proxima_data,'origem',p.origem,'referencia',ref,'contato_alterado',c.nome is distinct from nome_cliente or c.telefone is distinct from tel));
 elsif acao='status' then
  novo_status=p_dados->>'status';
  if novo_status is null or novo_status not in ('a_avisar','avisado','retirado','nao_retirado') then raise exception 'Status inválido.';end if;
  if novo_status='avisado' and (p.proxima_data is null or c.nome is null or c.telefone is null) then raise exception 'Complete nome, telefone e previsão antes de registrar o aviso.';end if;
  if novo_status='avisado' and (p_dados->>'contato_versao')::integer is distinct from c.versao then raise exception 'Contato alterado por outro usuário. Atualize a tela.';end if;
  if novo_status=p.status and novo_status<>'avisado' then return;end if;
  update public.proximas_previsoes set status=novo_status,avisado_em=case when novo_status='avisado' then clock_timestamp() else avisado_em end,
   avisado_por=case when novo_status='avisado' then auth.uid() else avisado_por end,versao=versao+1,updated_at=now() where id=p.id returning * into p;
  perform rbk_private.proximas_evento(p,novo_status,jsonb_build_object('antes',antes,'confirmado_pelo_usuario',true));
 else raise exception 'Ação inválida.';end if;
end $$;
commit;
