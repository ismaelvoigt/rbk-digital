-- Baseline estrutural: produção lida em 2026-10-29. Sem dados de clientes, usuários ou arquivos.
BEGIN;
SET LOCAL check_function_bodies = off;
CREATE SCHEMA IF NOT EXISTS rbk_private;
CREATE SCHEMA IF NOT EXISTS aud_private;
REVOKE ALL ON SCHEMA rbk_private, aud_private FROM PUBLIC, anon;
CREATE TABLE "public"."clients" (
  "id" uuid NOT NULL,
  "farm_id" uuid NOT NULL,
  "nome" text NOT NULL,
  "cpf" text,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."documents" (
  "id" uuid NOT NULL,
  "authorization_id" uuid NOT NULL,
  "categoria" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."document_versions" (
  "id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "storage_path" text NOT NULL,
  "original_filename" text,
  "mime_type" text,
  "file_size" bigint,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."authorizations" (
  "id" uuid NOT NULL,
  "farm_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "numero" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "data_dispensacao" date
);
CREATE TABLE "public"."documentos" (
  "id" uuid NOT NULL,
  "autorizacao_id" uuid NOT NULL,
  "categoria" text NOT NULL,
  "nome_arquivo" text,
  "caminho_arquivo" text,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."farms" (
  "id" uuid NOT NULL,
  "razao_social" text NOT NULL,
  "nome_fantasia" text,
  "cnpj" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "telefone" text,
  "cidade" text,
  "estado" text
);
CREATE TABLE "public"."rbk_admins" (
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "ativo" boolean NOT NULL
);
CREATE TABLE "public"."rbk_manager_farms" (
  "manager_user_id" uuid NOT NULL,
  "farm_id" uuid NOT NULL,
  "granted_by" uuid,
  "granted_at" timestamp with time zone NOT NULL
);
CREATE TABLE "aud_private"."links" (
  "id" uuid NOT NULL,
  "audit_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "aud_private"."rates" (
  "key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "hits" integer NOT NULL
);
CREATE TABLE "public"."aud_batches" (
  "id" uuid NOT NULL,
  "audit_id" uuid NOT NULL,
  "number" integer NOT NULL,
  "client_key" uuid NOT NULL,
  "manifest" jsonb NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "protocol" text
);
CREATE TABLE "public"."aud_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "audit_id" uuid NOT NULL,
  "event" text NOT NULL,
  "actor_id" uuid,
  "entity_id" uuid,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."aud_jobs" (
  "id" uuid NOT NULL,
  "audit_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."aud_files" (
  "id" uuid NOT NULL,
  "audit_id" uuid NOT NULL,
  "batch_id" uuid,
  "source" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "filename" text NOT NULL,
  "size" bigint NOT NULL,
  "mime" text NOT NULL,
  "fingerprint" text NOT NULL,
  "storage_path" text NOT NULL,
  "received_at" timestamp with time zone,
  "scan" text NOT NULL,
  "verified_sha256" text,
  "scanned_at" timestamp with time zone,
  "scan_attempts" integer NOT NULL,
  "next_scan_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."aud_audits" (
  "id" uuid NOT NULL,
  "farm_id" uuid NOT NULL,
  "pharmacy" text NOT NULL,
  "cnpj" text NOT NULL,
  "reference" text NOT NULL,
  "requested" integer,
  "deadline" date,
  "notes" text NOT NULL,
  "collection" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "next_batch" integer NOT NULL,
  "max_bytes" bigint NOT NULL,
  "retention_days" integer,
  "contact_email" text NOT NULL,
  "contact_phone" text NOT NULL,
  "confirmed_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid
);
CREATE TABLE "public"."cre_processes" (
  "id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "ficha" jsonb NOT NULL,
  "filial" boolean NOT NULL,
  "partners" integer NOT NULL,
  "revision" integer NOT NULL,
  "token_hash" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "rate_minute" timestamp with time zone,
  "rate_count" integer NOT NULL,
  "farm_id" uuid
);
CREATE TABLE "public"."cre_files" (
  "id" uuid NOT NULL,
  "process_id" uuid NOT NULL,
  "kind" integer NOT NULL,
  "filename" text NOT NULL,
  "mime" text NOT NULL,
  "size" bigint NOT NULL,
  "fingerprint" text NOT NULL,
  "storage_path" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone,
  "scan" text NOT NULL,
  "scan_attempts" integer NOT NULL,
  "scanned_at" timestamp with time zone,
  "next_scan_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."compras_estoque" (
  "farm_id" uuid NOT NULL,
  "versao" uuid NOT NULL,
  "data_posicao" date NOT NULL,
  "arquivo" text NOT NULL,
  "itens" jsonb NOT NULL,
  "atualizado_em" timestamp with time zone NOT NULL,
  "atualizado_por" uuid NOT NULL
);
CREATE TABLE "public"."invitation_deliveries" (
  "attempt_id" uuid NOT NULL,
  "audit_id" uuid,
  "credential_id" uuid,
  "link_hash" text NOT NULL,
  "channel" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "rbk_private"."farm_deletions" (
  "farm_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "cnpj" text NOT NULL,
  "summary" jsonb NOT NULL,
  "entity_ids" uuid[] NOT NULL,
  "user_ids" uuid[] NOT NULL,
  "audit_ids" uuid[] NOT NULL,
  "credential_ids" uuid[] NOT NULL,
  "objects" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone
);
CREATE TABLE "public"."cre_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "process_id" uuid,
  "action" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "entity_id" uuid,
  "result" text
);
CREATE TABLE "public"."autorizacoes" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "numero_autorizacao" text NOT NULL,
  "data_autorizacao" date NOT NULL,
  "farmacia" text,
  "observacao" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "cpf_cliente" text,
  "crm" text,
  "crm_uf" text,
  "farm_id" uuid NOT NULL,
  "analysis_status" text NOT NULL
);
CREATE TABLE "public"."audit_logs" (
  "id" uuid NOT NULL,
  "farm_id" uuid,
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."users" (
  "id" uuid NOT NULL,
  "farm_id" uuid,
  "nome" text NOT NULL,
  "email" text NOT NULL,
  "perfil" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "last_access_at" timestamp with time zone,
  "tipo_convite" text,
  "convidado_por" uuid,
  "convite_enviado_em" timestamp with time zone
);
CREATE TABLE "public"."proximas_contatos" (
  "id" uuid NOT NULL,
  "farmacia_id" uuid NOT NULL,
  "cpf" text NOT NULL,
  "nome" text,
  "telefone" text,
  "versao" integer NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."proximas_eventos" (
  "id" uuid NOT NULL,
  "farmacia_id" uuid NOT NULL,
  "previsao_id" uuid NOT NULL,
  "acao" text NOT NULL,
  "canal" text NOT NULL,
  "usuario_id" uuid,
  "usuario_nome" text,
  "criado_em" timestamp with time zone NOT NULL,
  "detalhes" jsonb NOT NULL
);
CREATE TABLE "public"."pfpb_periodicidades" (
  "id" uuid NOT NULL,
  "chave" text NOT NULL,
  "versao" integer NOT NULL,
  "principio_ativo" text NOT NULL,
  "concentracao" text NOT NULL,
  "apresentacao" text NOT NULL,
  "indicacao" text NOT NULL,
  "periodicidade_dias" integer NOT NULL,
  "tipo_item" text NOT NULL,
  "fonte" text NOT NULL,
  "data_vigencia" date NOT NULL,
  "data_fim" date,
  "ativo" boolean NOT NULL,
  "verificado_em" date NOT NULL,
  "observacao" text NOT NULL
);
CREATE TABLE "public"."pfpb_produtos_periodicidade" (
  "id" uuid NOT NULL,
  "ean" text NOT NULL,
  "produto" text NOT NULL,
  "principio_ativo" text NOT NULL,
  "concentracao" text NOT NULL,
  "apresentacao" text NOT NULL,
  "indicacao" text NOT NULL,
  "tipo_item" text NOT NULL,
  "regra_chave" text,
  "fonte" text NOT NULL,
  "pagina_fonte" integer NOT NULL,
  "data_vigencia" date NOT NULL,
  "data_fim" date,
  "versao" text NOT NULL,
  "ativo" boolean NOT NULL,
  "observacao" text NOT NULL
);
CREATE TABLE "public"."dispensacao_itens" (
  "id" uuid NOT NULL,
  "autorizacao_id" uuid NOT NULL,
  "documento_id" uuid NOT NULL,
  "posicao" integer NOT NULL,
  "produto" text,
  "ean" text,
  "unidade" text,
  "quantidade" numeric(15,3),
  "valor_unitario" numeric(15,4),
  "valor_total" numeric(15,2),
  "valor_pfpb" numeric(15,2),
  "principio_ativo" text,
  "indicacao" text,
  "data_dispensacao" date,
  "status" text NOT NULL,
  "origens" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "retirada_prevista_fonte" date,
  "intervalo_retirada_dias" integer,
  "retirada_referencia" text,
  "concentracao" text,
  "apresentacao" text,
  "tipo_item" text
);
CREATE TABLE "public"."proximas_previsoes" (
  "id" uuid NOT NULL,
  "farmacia_id" uuid NOT NULL,
  "contato_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "autorizacao_id" uuid NOT NULL,
  "produto" text NOT NULL,
  "ean" text,
  "unidade" text,
  "ultima_data" date,
  "proxima_data" date,
  "origem" text NOT NULL,
  "intervalo_dias" integer,
  "referencia" text,
  "motivo" text NOT NULL,
  "status" text NOT NULL,
  "ativa" boolean NOT NULL,
  "fonte" jsonb NOT NULL,
  "avisado_em" timestamp with time zone,
  "avisado_por" uuid,
  "versao" integer NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "regra_id" uuid,
  "regra_snapshot" jsonb,
  "alerta_data" date GENERATED ALWAYS AS ((proxima_data - 2)) STORED
);
CREATE TABLE "public"."rbk_crm_clientes" (
  "id" uuid NOT NULL,
  "razao_social" text NOT NULL,
  "cnpj" text,
  "farm_id" uuid,
  "contato" text NOT NULL,
  "whatsapp" text NOT NULL,
  "email" text NOT NULL,
  "cidade" text NOT NULL,
  "uf" text NOT NULL,
  "origem" text NOT NULL,
  "interesses" text[] NOT NULL,
  "ultimo_contato" date,
  "proxima_acao" text NOT NULL,
  "proxima_acao_data" date,
  "responsavel_id" uuid NOT NULL,
  "observacoes" text NOT NULL,
  "status" text NOT NULL,
  "aguardando_credenciamento" boolean NOT NULL,
  "oportunidade_referencia" text NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."rbk_contratos" (
  "id" uuid NOT NULL,
  "cliente_id" uuid NOT NULL,
  "servico" text NOT NULL,
  "valor" numeric(14,2) NOT NULL,
  "forma_pagamento" text NOT NULL,
  "data_contratacao" date NOT NULL,
  "vencimento" date NOT NULL,
  "observacoes" text NOT NULL,
  "plano" text NOT NULL,
  "data_inicio" date NOT NULL,
  "dia_vencimento" integer,
  "status" text NOT NULL,
  "pausa_inicio" date,
  "pausas" jsonb NOT NULL,
  "gateway" text,
  "gateway_reference" text,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."rbk_cobrancas" (
  "id" uuid NOT NULL,
  "contrato_id" uuid NOT NULL,
  "competencia" date NOT NULL,
  "vencimento" date NOT NULL,
  "valor" numeric(14,2) NOT NULL,
  "cancelada" boolean NOT NULL,
  "gateway_reference" text,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."rbk_pagamentos" (
  "id" uuid NOT NULL,
  "cobranca_id" uuid NOT NULL,
  "valor" numeric(14,2) NOT NULL,
  "data_pagamento" date NOT NULL,
  "forma_pagamento" text NOT NULL,
  "observacoes" text NOT NULL,
  "idempotency_key" uuid NOT NULL,
  "origem" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."rbk_comunicados" (
  "id" uuid NOT NULL,
  "titulo" text NOT NULL,
  "texto" text NOT NULL,
  "canal" text NOT NULL,
  "segmento" jsonb NOT NULL,
  "status" text NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE "public"."rbk_gestao_eventos" (
  "id" uuid NOT NULL,
  "entidade" text NOT NULL,
  "entidade_id" uuid NOT NULL,
  "acao" text NOT NULL,
  "antes" jsonb,
  "depois" jsonb,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE OR REPLACE FUNCTION public.is_rbk_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.rbk_admins
    where user_id = auth.uid()
      and ativo = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.aud_manager(op text, aid uuid DEFAULT NULL::uuid, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.manager(op,aid,payload)$function$;

CREATE OR REPLACE FUNCTION public.current_user_farm_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select farm_id
    from public.users
    where id = auth.uid()
      and status = 'active'
    limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.proximas_contexto(p_busca text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select rbk_private.proximas_contexto(p_busca)$function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_sincronizar(p_item uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.can_write_farm(target_farm uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select rbk_private.actor_role() in ('operador', 'gerente_farmacia', 'administrador_farmacia')
    and rbk_private.actor_farm_id() = target_farm
$function$;

CREATE OR REPLACE FUNCTION rbk_private.actor_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when exists (
      select 1 from public.rbk_admins r
      where r.user_id = auth.uid() and r.ativo
    ) then 'superadmin_rbk'
    when u.perfil = 'superadmin_rbk' then null
    when u.perfil = 'farmacia' then 'administrador_farmacia'
    else u.perfil
  end
  from public.users u
  where u.id = auth.uid() and u.status = 'active'
    and (u.farm_id is null or exists (
      select 1 from public.farms f where f.id = u.farm_id and f.status = 'active'
    ))
  limit 1
$function$;

CREATE OR REPLACE FUNCTION rbk_private.actor_farm_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select u.farm_id from public.users u
  where u.id = auth.uid() and u.status = 'active'
    and exists (
      select 1 from public.farms f where f.id = u.farm_id and f.status = 'active'
    )
  limit 1
$function$;

CREATE OR REPLACE FUNCTION rbk_private.can_access_farm(target_farm uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(rbk_private.equipe_operacional(target_farm),false)
 and coalesce(rbk_private.actor_role() in ('administrador_farmacia','gerente_farmacia','gestor_rbk','superadmin_rbk'),false)
$function$;

CREATE OR REPLACE FUNCTION aud_private.summary(aid uuid, internal boolean)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('audit',case when internal then to_jsonb(a) else jsonb_build_object('id',a.id,'pharmacy',a.pharmacy,'cnpj',a.cnpj,'reference',a.reference,'deadline',a.deadline,'collection',a.collection) end,
 'total_files',(select count(*) from public.aud_files f where f.audit_id=aid and f.source='pharmacy' and f.received_at is not null),
 'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=aid and f.source='pharmacy' and f.received_at is not null),0),
 'last_received',(select max(completed_at) from public.aud_batches where audit_id=aid),
 'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'number',b.number,'started_at',b.started_at,'completed_at',b.completed_at,'protocol',b.protocol,
 'files',(select coalesce(jsonb_agg(case when internal then to_jsonb(f)-'fingerprint' else jsonb_build_object('id',f.id,'filename',f.filename,'size',f.size,'received_at',f.received_at) end order by f.filename),'[]') from public.aud_files f where f.batch_id=b.id)) order by b.number)
 from public.aud_batches b where b.audit_id=aid and (internal or b.completed_at is not null)),'[]'))
 from public.aud_audits a where a.id=aid
$function$;

CREATE OR REPLACE FUNCTION aud_private.portal(h text, op text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.aud_audits;l aud_private.links;b public.aud_batches;f public.aud_files;item jsonb;total bigint;count_files integer;sz bigint;ext text;expected_mime text;obj storage.objects;
begin
 -- Lock the audit first; close/revoke/renew serialize on this same row.
 select x.* into a from public.aud_audits x join aud_private.links k on k.audit_id=x.id where k.token_hash=h for update of x;
 if a.id is null then raise exception 'Link indisponível' using errcode='28000';end if;
 select * into l from aud_private.links where token_hash=h;
 if l.revoked_at is not null or l.expires_at<=clock_timestamp() or not exists(select 1 from public.farms where id=a.farm_id and status='active') then raise exception 'Link indisponível' using errcode='28000';end if;
 if op='summary' then
  insert into public.aud_events(audit_id,event) values(a.id,'portal_access');return aud_private.summary(a.id,false);
 end if;
 if a.collection<>'open' then raise exception 'Coleta encerrada';end if;
 if op='begin' then
  select * into b from public.aud_batches where audit_id=a.id and client_key=(payload->>'key')::uuid;
  if b.id is not null then
   if b.manifest is distinct from payload->'files' then raise exception 'Chave já usada por outro manifesto';end if;
  else
   if jsonb_typeof(payload->'files') is distinct from 'array' then raise exception 'Manifesto inválido';end if;
   count_files=jsonb_array_length(payload->'files');
   if count_files not between 1 and 100 then raise exception 'Envie entre 1 e 100 arquivos por lote';end if;
   if (select count(*) from public.aud_files where audit_id=a.id)+count_files>1000 then raise exception 'Limite de 1000 arquivos por auditoria';end if;
   total=0;
   for item in select * from jsonb_array_elements(payload->'files') loop
    sz=(item->>'size')::bigint;ext=lower(substring(item->>'name' from '[.]([a-zA-Z0-9]+)$'));
    expected_mime=case ext when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'png' then 'image/png' when 'tif' then 'image/tiff' when 'tiff' then 'image/tiff' end;
    if sz is null or sz not between 1 and 104857600 or expected_mime is null or item->>'mime' is distinct from expected_mime or
     length(item->>'name') not between 1 and 180 or item->>'name' ~ '[[:cntrl:]/\\]' then raise exception 'Tipo, nome ou tamanho não permitido';end if;
    total=total+sz;
   end loop;
   if total>1073741824 or total+coalesce((select sum(size) from public.aud_files where audit_id=a.id),0)>a.max_bytes then raise exception 'Limite de armazenamento atingido';end if;
   insert into public.aud_batches(audit_id,number,client_key,manifest) values(a.id,a.next_batch,(payload->>'key')::uuid,payload->'files') returning * into b;
   update public.aud_audits set next_batch=next_batch+1 where id=a.id;
   for item in select * from jsonb_array_elements(payload->'files') loop
    insert into public.aud_files(id,audit_id,batch_id,filename,size,mime,fingerprint,storage_path)
    values((item->>'id')::uuid,a.id,b.id,item->>'name',(item->>'size')::bigint,item->>'mime',item->>'fingerprint',a.id::text||'/'||b.id::text||'/'||(item->>'id')||'.'||lower(substring(item->>'name' from '[.]([a-zA-Z0-9]+)$')));
   end loop;
   insert into public.aud_events(audit_id,event,entity_id) values(a.id,'batch_started',b.id);
  end if;
  return jsonb_build_object('id',b.id,'number',b.number,'files',(select jsonb_agg(jsonb_build_object('id',id,'filename',filename,'size',size)) from public.aud_files where batch_id=b.id));
 elsif op in ('ticket','failure') then
  select * into f from public.aud_files where id=(payload->>'file_id')::uuid and audit_id=a.id and source='pharmacy';
  if f.id is null then raise exception 'Arquivo indisponível';end if;
  if op='failure' then
   insert into public.aud_events(audit_id,event,entity_id) values(a.id,'upload_failure',f.id);return '{}';
  end if;
  if f.received_at is not null then raise exception 'Arquivo já recebido';end if;
  insert into public.aud_events(audit_id,event,entity_id) values(a.id,'upload_ticket',f.id);
  return jsonb_build_object('path',f.storage_path,'size',f.size,'mime',f.mime,'exists',exists(select 1 from storage.objects o where o.bucket_id='auditoria-private' and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.size and o.metadata->>'mimetype'=f.mime));
 elsif op='complete' then
  select * into b from public.aud_batches where id=(payload->>'batch_id')::uuid and audit_id=a.id;
  if b.id is null then raise exception 'Lote indisponível';end if;
  if b.completed_at is not null then return jsonb_build_object('protocol',b.protocol);end if;
  for f in select * from public.aud_files where batch_id=b.id loop
   select * into obj from storage.objects where bucket_id='auditoria-private' and name=f.storage_path;
   if obj.id is null or (obj.metadata->>'size')::bigint is distinct from f.size or obj.metadata->>'mimetype' is distinct from f.mime then raise exception 'Upload incompleto ou metadados divergentes';end if;
  end loop;
  update public.aud_files set received_at=clock_timestamp() where batch_id=b.id;
  update public.aud_batches set completed_at=clock_timestamp(),protocol='RBK-'||a.id::text||'-'||b.number::text where id=b.id returning * into b;
  insert into public.aud_events(audit_id,event,entity_id) select a.id,'file_received',id from public.aud_files where batch_id=b.id;
  insert into public.aud_events(audit_id,event,entity_id) values(a.id,'batch_completed',b.id);
  insert into public.aud_jobs(audit_id,batch_id) values(a.id,b.id);
  return jsonb_build_object('protocol',b.protocol);
 end if;
 raise exception 'Operação inválida';
end $function$;

CREATE OR REPLACE FUNCTION public.aud_portal(h text, op text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.portal(h,op,payload)$function$;

CREATE OR REPLACE FUNCTION aud_private.rate(k text, lim integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if length(k)>150 or lim not between 1 and 1000 then return false;end if;
 if k='portal:global' then delete from aud_private.rates where window_start<now()-interval '1 day';end if;
 insert into aud_private.rates(key) values(k) on conflict(key) do update set
 hits=case when aud_private.rates.window_start<now()-interval '1 minute' then 1 else aud_private.rates.hits+1 end,
 window_start=case when aud_private.rates.window_start<now()-interval '1 minute' then now() else aud_private.rates.window_start end returning hits into n;
 return n<=lim;
end $function$;

CREATE OR REPLACE FUNCTION public.aud_rate(k text, lim integer)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.rate(k,lim)$function$;

CREATE OR REPLACE FUNCTION aud_private.scan_result(fid uuid, result text, sha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a uuid;
begin
 if result not in ('clean','infected','error','rejected') or sha is null or sha !~ '^[a-f0-9]{64}$' then raise exception 'Resultado inválido';end if;
 update public.aud_files set scan=result,verified_sha256=sha,scanned_at=clock_timestamp(),scan_attempts=scan_attempts+1,next_scan_at=now()+interval '15 minutes' where id=fid and received_at is not null and scan in ('pending','error') and (result<>'clean' or sha=fingerprint) returning audit_id into a;
 if a is null then raise exception 'Arquivo indisponível';end if;
 insert into public.aud_events(audit_id,event,entity_id) values(a,'scan_'||result,fid);
end $function$;

CREATE OR REPLACE FUNCTION public.aud_scan_result(fid uuid, result text, sha text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.scan_result(fid,result,sha)$function$;

CREATE OR REPLACE FUNCTION aud_private.register_pharmacy_audit(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c text; nm text; fid uuid; r jsonb; total integer; weight integer; dv integer; j integer; k integer; created boolean:=false;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501'; end if;
 c:=regexp_replace(upper(coalesce(payload->'new_farm'->>'cnpj','')),'[./[:space:]-]','','g');
 nm:=btrim(coalesce(payload->'new_farm'->>'name',''));
 if length(nm)<3 or length(nm)>200 then raise exception 'Informe o nome da farmácia (3 a 200 caracteres).' using errcode='22023'; end if;
 if c !~ '^[A-Z0-9]{12}[0-9]{2}$' or c=repeat(substr(c,1,1),14) then raise exception 'CNPJ inválido. Confira os caracteres e os dígitos verificadores.' using errcode='22023'; end if;
 -- Receita Federal: ASCII - 48, pesos cíclicos 2..9 da direita para a esquerda.
 for k in 12..13 loop
  total:=0;weight:=2;
  for j in reverse k..1 loop total:=total+(ascii(substr(c,j,1))-48)*weight;weight:=case when weight=9 then 2 else weight+1 end;end loop;
  dv:=case when total%11<2 then 0 else 11-total%11 end;
  if substr(c,k+1,1)<>dv::text then raise exception 'CNPJ inválido. Confira os caracteres e os dígitos verificadores.' using errcode='22023';end if;
 end loop;
 -- Serialize registrations through this endpoint; do not grant access to an existing tenant.
 perform pg_advisory_xact_lock(hashtextextended('audit-farm:'||c,0));
 select id into fid from public.farms where regexp_replace(upper(cnpj),'[./[:space:]-]','','g')=c order by id limit 1;
 if fid is not null then
  if not coalesce(rbk_private.can_access_farm(fid),false) then raise exception 'Cadastro indisponível para esta operação. Solicite à RBK a conferência do vínculo.' using errcode='42501';end if;
 else
  insert into public.farms(razao_social,cnpj,status) values(nm,c,'active') returning id into fid;
  insert into public.rbk_manager_farms(manager_user_id,farm_id,granted_by) values(auth.uid(),fid,auth.uid());
  created:=true;
 end if;
 r:=aud_private.manager('create',null,(payload-'new_farm')||jsonb_build_object('farm_id',fid));
 if created then insert into public.aud_events(audit_id,event,actor_id) values((r->>'id')::uuid,'pharmacy_registered',auth.uid());end if;
 return r;
end$function$;

CREATE OR REPLACE FUNCTION aud_private.save_contact(aid uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare email text:=btrim(coalesce(payload->>'email','')); phone text:=btrim(coalesce(payload->>'phone',''));
begin
 if not coalesce(aud_private.can_manage(aid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
 if length(email)>254 or (email<>'' and (email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or email ~ '[[:cntrl:]]')) then raise exception 'Informe um e-mail válido.' using errcode='22023';end if;
 if length(phone)>40 or phone ~ '[^0-9+() .-]' then raise exception 'Informe celular com DDD.' using errcode='22023';end if;
 phone:=regexp_replace(phone,'[^0-9]','','g');
 if length(phone) in (10,11) then phone:='55'||phone;end if;
 if phone<>'' and phone !~ '^55[1-9][0-9]{9,10}$' then raise exception 'Informe celular brasileiro com DDD.' using errcode='22023';end if;
 update public.aud_audits set contact_email=email,contact_phone=phone where id=aid;
 insert into public.aud_events(audit_id,event,actor_id) values(aid,'contact_updated',auth.uid());
 return jsonb_build_object('email',email,'phone',phone);
end$function$;

CREATE OR REPLACE FUNCTION public.aud_contact(aid uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.save_contact(aid,payload)$function$;

CREATE OR REPLACE FUNCTION public.aud_register_pharmacy(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 r:=aud_private.register_pharmacy_audit(payload);
 if r->>'id' is not null and payload ? 'contact' then perform aud_private.save_contact((r->>'id')::uuid,payload->'contact');end if;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_validar(p_farm uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_farm is null then raise exception 'Selecione uma farmácia/CNPJ.'; end if;
 if auth.uid() is null or not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem acesso à farmácia selecionada.'; end if;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_farmacias(p_busca text)
 RETURNS SETOF farms
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select f.* from public.farms f where auth.uid() is not null
 and coalesce(rbk_private.can_access_farm(f.id),false)
 and (nullif(trim(p_busca),'') is null
 or position(lower(trim(p_busca)) in lower(coalesce(f.nome_fantasia,'')))>0
 or position(lower(trim(p_busca)) in lower(coalesce(f.razao_social,'')))>0
 or (regexp_replace(coalesce(p_busca,''),'[^0-9]','','g')<>'' and
 position(regexp_replace(p_busca,'[^0-9]','','g') in regexp_replace(f.cnpj,'[^0-9]','','g'))>0))
 order by coalesce(f.nome_fantasia,f.razao_social),f.id limit 50
$function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_autorizacoes(p_farm uuid)
 RETURNS SETOF autorizacoes
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select a.* from public.autorizacoes a join public.users u on u.id=a.user_id where u.farm_id=p_farm;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_itens(p_farm uuid)
 RETURNS SETOF dispensacao_itens
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select i.* from public.dispensacao_itens i join public.autorizacoes a on a.id=i.autorizacao_id join public.users u on u.id=a.user_id where u.farm_id=p_farm;
end $function$;

CREATE OR REPLACE FUNCTION aud_private.confirm_audit(aid uuid, hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.aud_audits; result jsonb;
begin
 if not coalesce(aud_private.can_manage(aid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into strict a from public.aud_audits where id=aid for update;
 if a.confirmed_at is not null then return jsonb_build_object('created',false);end if;
 if a.collection <> 'open' then raise exception 'Reabra a coleta antes de confirmar.' using errcode='22023';end if;
 if a.contact_email='' or a.contact_phone='' then raise exception 'Informe e-mail e WhatsApp do cliente.' using errcode='22023';end if;
 if not exists(select 1 from public.aud_files where audit_id=aid and source='office' and received_at is not null and scan not in ('infected','rejected')) then raise exception 'Anexe o ofício antes de confirmar a auditoria.' using errcode='22023';end if;
 if hash is null or hash !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido' using errcode='22023';end if;
 perform aud_private.manager('link',aid,jsonb_build_object('hash',hash,'days',40));
 update public.aud_audits set confirmed_at=now() where id=aid;
 insert into public.aud_events(audit_id,event,actor_id) values(aid,'audit_confirmed',auth.uid());
 return jsonb_build_object('created',true);
end$function$;

CREATE OR REPLACE FUNCTION public.aud_confirm(aid uuid, hash text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select aud_private.confirm_audit(aid,hash)$function$;

CREATE OR REPLACE FUNCTION aud_private.can_manage(aid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(auth.uid() is not null and rbk_private.actor_role() in ('gestor_rbk','superadmin_rbk') and exists(
 select 1 from public.aud_audits a where a.id=aid and a.deleted_at is null and rbk_private.can_access_farm(a.farm_id)),false)
$function$;

CREATE OR REPLACE FUNCTION public.modulos_farmacias(p_busca text DEFAULT ''::text)
 RETURNS SETOF farms
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select * from rbk_private.modulos_farmacias(p_busca)$function$;

CREATE OR REPLACE FUNCTION public.modulos_autorizacoes(p_farm uuid)
 RETURNS SETOF autorizacoes
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select * from rbk_private.modulos_autorizacoes(p_farm)$function$;

CREATE OR REPLACE FUNCTION public.modulos_itens(p_farm uuid)
 RETURNS SETOF dispensacao_itens
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select * from rbk_private.modulos_itens(p_farm)$function$;

CREATE OR REPLACE FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid)
 RETURNS SETOF documentos
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select * from rbk_private.modulos_documentos(p_farm,p_autorizacao)$function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_documentos(p_farm uuid, p_autorizacao uuid)
 RETURNS SETOF documentos
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select d.* from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id join public.users u on u.id=a.user_id where u.farm_id=p_farm and a.id=p_autorizacao;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.modulos_pode_baixar(p_caminho text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and exists(
 select 1 from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id join public.users u on u.id=a.user_id
 where d.caminho_arquivo=p_caminho and coalesce(rbk_private.can_access_farm(u.farm_id),false))
$function$;

CREATE OR REPLACE FUNCTION public.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text DEFAULT 'preview'::text, p_cnpj text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select rbk_private.farmacia_exclusao(p_actor,p_farm,p_action,p_cnpj)
$function$;

CREATE OR REPLACE FUNCTION public.compras_obter(p_farm uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem acesso à farmácia';end if;
 return (select to_jsonb(e)-'atualizado_por' from public.compras_estoque e where farm_id=p_farm);
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.validar_item_dispensacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare campo text; registro jsonb;
begin
 if not (tg_op='UPDATE' and new.status='pendente' and pg_trigger_depth()>1) and not exists(select 1 from public.documentos d where d.id=new.documento_id and d.autorizacao_id=new.autorizacao_id and d.categoria in ('cupom_fiscal','cupom_vinculado')) then
  raise exception 'Documento de origem deve ser um cupom da mesma autorização.';
 end if;
 registro=to_jsonb(new);
 foreach campo in array array['produto','ean','unidade','quantidade','valor_unitario','valor_total','valor_pfpb','principio_ativo','indicacao','data_dispensacao'] loop
  if registro->campo <> 'null'::jsonb and (jsonb_typeof(new.origens->campo) is distinct from 'string' or length(btrim(coalesce(new.origens->>campo,'')))=0) then
   raise exception 'Informe a origem do campo %.',campo;
  end if;
 end loop;
 if new.status='confirmado' and new.produto is null then raise exception 'Identifique o produto antes de confirmar.'; end if;
 new.updated_at=now();return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.invalidar_itens_cupom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update public.dispensacao_itens set status='pendente'
 where documento_id=new.id and status='confirmado';
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.usuarios_acessos(p_actor uuid)
 RETURNS TABLE(user_id uuid, last_access_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$select * from rbk_private.usuarios_acessos(p_actor)$function$;

CREATE OR REPLACE FUNCTION rbk_private.usuarios_acessos(p_actor uuid)
 RETURNS TABLE(user_id uuid, last_access_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id where a.user_id=p_actor and a.ativo and u.status='active') then raise exception 'Acesso restrito.'; end if;
 return query select u.id,greatest(u.last_access_at,a.last_sign_in_at) from public.users u join auth.users a on a.id=u.id;
end $function$;

CREATE OR REPLACE FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.cre_command(op text, actor uuid DEFAULT NULL::uuid, h text DEFAULT NULL::text, pid uuid DEFAULT NULL::uuid, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.cre_processes; f public.cre_files; snap jsonb; total bigint; size_actual bigint;
begin
 if actor is not null then
  if not exists(select 1 from public.users u where u.id=actor and u.status='active' and (u.perfil='gestor_rbk' or exists(select 1 from public.rbk_admins a where a.user_id=actor and a.ativo))) then raise exception 'Acesso negado'; end if;
  if op='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'ficha',ficha,'updated_at',updated_at,'expires_at',expires_at) order by updated_at desc) from public.cre_processes where owner_id=actor),'[]');end if;
  if op='create' then
   perform pg_advisory_xact_lock(hashtextextended('cre-process:'||actor::text||':'||regexp_replace(upper(coalesce(payload->'ficha'->>'B20','')),'[./[:space:]-]','','g'),0));
   if payload->>'check_duplicate'='true' and coalesce(payload->>'confirm_duplicate','false')<>'true' and exists(
     select 1 from public.cre_processes x where x.owner_id=actor and x.token_hash is not null and x.expires_at>now()
       and regexp_replace(upper(coalesce(x.ficha->>'B20','')),'[./[:space:]-]','','g')=
           regexp_replace(upper(coalesce(payload->'ficha'->>'B20','')),'[./[:space:]-]','','g')) then
     return jsonb_build_object('confirmation_required',true,'message','Já existe um credenciamento em andamento para este CNPJ. Deseja criar um novo mesmo assim?');
   end if;
   insert into public.cre_processes(owner_id,ficha,filial,token_hash,expires_at) values(actor,payload->'ficha',(payload->>'filial')::boolean,payload->>'hash',now()+interval '40 days') returning * into p;
   insert into public.cre_events(process_id,action) values(p.id,'created');
   return jsonb_build_object('id',p.id);
  end if;
  select * into p from public.cre_processes where id=pid and owner_id=actor for update;
 else
  select * into p from public.cre_processes where token_hash=h and expires_at>now() for update;
 end if;
 if p.id is null then raise exception 'Acesso indisponível';end if;
 if actor is null then
  if p.rate_minute=date_trunc('minute',now()) and p.rate_count>=120 then raise exception 'Aguarde para tentar novamente';end if;
  update public.cre_processes set rate_minute=date_trunc('minute',now()),rate_count=case when rate_minute=date_trunc('minute',now()) then rate_count+1 else 1 end where id=p.id;
 end if;
 if op='renew' or op='revoke' then
  if actor is null then raise exception 'Acesso negado';end if;
  update public.cre_processes set token_hash=case when op='renew' then payload->>'hash' else null end,expires_at=case when op='renew' then now()+interval '40 days' else null end where id=p.id;
 elsif op='save' then
  if p.revision<>(payload->>'revision')::int then raise exception 'Ficha alterada. Atualize antes de salvar';end if;
  update public.cre_processes set ficha=payload->'ficha',filial=(payload->>'filial')::boolean,partners=(payload->>'partners')::int,revision=revision+1,updated_at=now() where id=p.id;
 elsif op='init' then
  select * into f from public.cre_files where process_id=p.id and kind=(payload->>'kind')::int and fingerprint=payload->>'fingerprint';
  if f.id is null then
   select coalesce(sum(size),0) into total from public.cre_files where process_id=p.id;
   if total+(payload->>'size')::bigint>209715200 or (select count(*) from public.cre_files where process_id=p.id)>=200 then raise exception 'Limite de armazenamento alcançado';end if;
   insert into public.cre_files(id,process_id,kind,filename,mime,size,fingerprint,storage_path) values((payload->>'id')::uuid,p.id,(payload->>'kind')::int,payload->>'name',payload->>'mime',(payload->>'size')::bigint,payload->>'fingerprint',p.id::text||'/'||(payload->>'id')) returning * into f;
  end if;
  return to_jsonb(f);
 elsif op='confirm' or op='file' then
  select * into f from public.cre_files where id=(payload->>'id')::uuid and process_id=p.id for update;
  if f.id is null then raise exception 'Arquivo indisponível';end if;
  if op='file' then
   if actor is null or f.received_at is null or f.scan in ('infected','rejected') then raise exception 'Arquivo indisponível ou bloqueado';end if;
   return to_jsonb(f);
  end if;
  select (metadata->>'size')::bigint into size_actual from storage.objects where bucket_id='credenciamento-private' and name=f.storage_path;
  if size_actual is distinct from f.size then raise exception 'Envio não confirmado. Repita o envio';end if;
  update public.cre_files set received_at=coalesce(received_at,now()) where id=f.id;
  update public.cre_processes set updated_at=now() where id=p.id;
 elsif op<>'get' then raise exception 'Operação inválida';end if;
 insert into public.cre_events(process_id,action) values(p.id,op);
 select jsonb_build_object('id',id,'ficha',ficha,'filial',filial,'partners',partners,'revision',revision,'expires_at',expires_at) into snap from public.cre_processes where id=p.id;
 return snap||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'filename',filename,'size',size,'received_at',received_at,'scan',case when actor is null then null else scan end) order by created_at,id) from public.cre_files where process_id=p.id and received_at is not null),'[]'));
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.deletion_row_blocked(r jsonb)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from rbk_private.farm_deletions j where
   exists(select 1 from jsonb_each_text(r) kv where kv.key in
     ('id','farm_id','user_id','owner_id','owner','created_by','deleted_by','manager_user_id','granted_by','uploaded_by','atualizado_por','autorizacao_id','authorization_id','document_id','documento_id','client_id','audit_id','batch_id','process_id','credential_id')
     and kv.value=any(j.entity_ids::text[]))
   or exists(select 1 from jsonb_array_elements(j.objects) obj
     where obj->>'name'=r->>'caminho_arquivo' or obj->>'name'=r->>'storage_path')
   or (r ? 'bucket_id' and (
     exists(select 1 from jsonb_array_elements(j.objects) o where o->>'bucket'=r->>'bucket_id' and o->>'name'=r->>'name')
     or string_to_array(r->>'name','/') && j.entity_ids::text[])))
$function$;

CREATE OR REPLACE FUNCTION rbk_private.deletion_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Shared writer lock and exclusive prepare/finalize lock close the eligibility/upload race.
 perform pg_advisory_xact_lock_shared(92836211);
 if rbk_private.deletion_row_blocked(to_jsonb(new)) or
    (tg_op='UPDATE' and rbk_private.deletion_row_blocked(to_jsonb(old))) then
   raise exception 'Farmácia em exclusão definitiva. Não é permitido alterar seus dados.' using errcode='P0001';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 f public.farms; j rbk_private.farm_deletions;
 uids uuid[]; aids uuid[]; cids uuid[]; entities uuid[]; paths jsonb; pending_objects jsonb;
 never_accessed boolean; doc_count integer; auth_count integer; summary jsonb; blocked text;
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id
   where a.user_id=p_actor and a.ativo and u.status='active') then
   raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';
 end if;
 if p_action not in ('preview','prepare','finish') then raise exception 'Operação inválida.'; end if;
 if p_action<>'preview' then perform pg_advisory_xact_lock(92836211); end if;
 select * into j from rbk_private.farm_deletions where farm_id=p_farm;
 if found then
   if p_action<>'preview' and regexp_replace(coalesce(p_cnpj,''),'\D','','g')<>j.cnpj then raise exception 'Digite o CNPJ correto para confirmar.'; end if;
   if j.completed_at is not null then return j.summary || jsonb_build_object('completed',true,'pending',false); end if;
   select coalesce(jsonb_agg(o),'[]') into pending_objects from
     (select obj from jsonb_array_elements(j.objects) obj where exists(select 1 from storage.objects s where s.bucket_id=obj->>'bucket' and s.name=obj->>'name') limit 200) q(o);
   if p_action<>'finish' or jsonb_array_length(pending_objects)>0 then
     return j.summary || jsonb_build_object('pending',true,'objects',pending_objects);
   end if;
   -- All actual objects have been removed. Referential cleanup is one atomic transaction.
   delete from public.invitation_deliveries where audit_id=any(j.audit_ids) or credential_id=any(j.credential_ids);
   delete from public.aud_jobs where audit_id=any(j.audit_ids);
   delete from public.aud_files where audit_id=any(j.audit_ids);
   delete from public.aud_events where audit_id=any(j.audit_ids);
   delete from aud_private.links where audit_id=any(j.audit_ids);
   delete from public.aud_batches where audit_id=any(j.audit_ids);
   delete from public.aud_audits where id=any(j.audit_ids);
   delete from public.cre_files where process_id=any(j.credential_ids);
   delete from public.cre_events where process_id=any(j.credential_ids);
   delete from public.cre_processes where id=any(j.credential_ids);
   delete from public.dispensacao_itens where autorizacao_id in (select id from public.autorizacoes where user_id=any(j.user_ids));
   delete from public.documentos where autorizacao_id in (select id from public.autorizacoes where user_id=any(j.user_ids));
   delete from public.autorizacoes where user_id=any(j.user_ids);
   delete from public.document_versions where document_id in (select d.id from public.documents d join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm);
   delete from public.documents where authorization_id in (select id from public.authorizations where farm_id=p_farm);
   delete from public.authorizations where farm_id=p_farm;
   delete from public.clients where farm_id=p_farm;
   delete from public.compras_estoque where farm_id=p_farm;
   delete from public.audit_logs where farm_id=p_farm;
   delete from public.rbk_manager_farms where farm_id=p_farm;
   delete from public.users where farm_id=p_farm;
   delete from auth.users where id=any(j.user_ids);
   delete from public.farms where id=p_farm;
   update rbk_private.farm_deletions set completed_at=now() where farm_id=p_farm;
   return j.summary || jsonb_build_object('completed',true,'pending',false);
 end if;
 if p_action='finish' then raise exception 'A exclusão ainda não foi confirmada.'; end if;
 select * into f from public.farms where id=p_farm;
 if not found then raise exception 'Farmácia não encontrada.'; end if;
 select coalesce(array_agg(id),'{}') into uids from public.users where farm_id=p_farm;
 if p_action='prepare' and (length(regexp_replace(coalesce(p_cnpj,''),'\D','','g'))<>14 or regexp_replace(p_cnpj,'\D','','g')<>regexp_replace(f.cnpj,'\D','','g')) then
   raise exception 'Digite o CNPJ correto para confirmar.';
 end if;
 select coalesce(array_agg(id),'{}') into aids from public.aud_audits where farm_id=p_farm;
 select coalesce(array_agg(id),'{}') into cids from public.cre_processes where owner_id=any(uids);
 select array_agg(distinct id) into entities from (
   select p_farm id union select unnest(uids) union select unnest(aids) union select unnest(cids)
   union select id from public.autorizacoes where user_id=any(uids)
   union select d.id from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id=any(uids)
   union select id from public.aud_batches where audit_id=any(aids)
   union select id from public.clients where farm_id=p_farm
   union select id from public.authorizations where farm_id=p_farm
   union select d.id from public.documents d join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm
   union select v.id from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm
 ) ids;
 -- Includes dangling file references and uploads which have not yet been attached to a document.
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'name',name)),'[]') into paths from (
   select 'documentos' bucket,d.caminho_arquivo name from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id=any(uids) and nullif(d.caminho_arquivo,'') is not null
   union select 'documentos',v.storage_path from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm and nullif(v.storage_path,'') is not null
   union select 'auditoria-private',storage_path from public.aud_files where audit_id=any(aids) and nullif(storage_path,'') is not null
   union select 'credenciamento-private',storage_path from public.cre_files where process_id=any(cids) and nullif(storage_path,'') is not null
   union select bucket_id,name from storage.objects where owner=any(uids) or owner_id=any(uids::text[]) or (bucket_id='documentos' and split_part(name,'/',1)=any(uids::text[])) or (bucket_id='auditoria-private' and split_part(name,'/',1)=any(aids::text[])) or (bucket_id='credenciamento-private' and split_part(name,'/',1)=any(cids::text[]))
 ) files;
 doc_count:=jsonb_array_length(paths);
 select not exists(select 1 from public.users u join auth.users a on a.id=u.id
   where u.farm_id=p_farm and (u.last_access_at is not null or a.last_sign_in_at is not null)) into never_accessed;
 select count(*) into auth_count from public.autorizacoes where user_id=any(uids);
 if p_actor=any(uids) or exists(select 1 from public.rbk_admins where user_id=any(uids))
   or exists(select 1 from public.users where id=any(uids) and perfil not in ('farmacia','operador','administrador_farmacia'))
   or exists(select 1 from public.rbk_manager_farms where manager_user_id=any(uids) or granted_by=any(uids)) then
   blocked:='Não é permitido excluir a própria conta ou uma farmácia com vínculos administrativos.';
 elsif exists(select 1 from public.aud_audits where id<>all(aids) and (created_by=any(uids) or deleted_by=any(uids)))
   or exists(select 1 from public.authorizations where farm_id<>p_farm and client_id in (select id from public.clients where farm_id=p_farm))
   or exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id<>p_farm and v.uploaded_by=any(uids))
   or exists(select 1 from public.dispensacao_itens i join public.autorizacoes a on a.id=i.autorizacao_id where a.user_id<>all(uids) and i.documento_id in (select d.id from public.documentos d join public.autorizacoes da on da.id=d.autorizacao_id where da.user_id=any(uids)))
   or exists(select 1 from public.aud_files af join public.aud_batches b on b.id=af.batch_id where b.audit_id=any(aids) and af.audit_id<>all(aids))
   or exists(select 1 from public.aud_jobs aj join public.aud_batches b on b.id=aj.batch_id where b.audit_id=any(aids) and aj.audit_id<>all(aids)) then
   blocked:='Há vínculos com outra farmácia. Revise esses vínculos antes de excluir.';
 elsif exists(select 1 from (
   select 'documentos' bucket,caminho_arquivo name from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id<>all(uids)
   union all select 'documentos',storage_path from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id<>p_farm
   union all select 'auditoria-private',storage_path from public.aud_files where audit_id<>all(aids)
   union all select 'credenciamento-private',storage_path from public.cre_files where process_id<>all(cids)
 ) external_file where exists(select 1 from jsonb_array_elements(paths) p where p->>'bucket'=external_file.bucket and p->>'name'=external_file.name)) then
   blocked:='Há arquivos compartilhados com outra farmácia. Revise esses vínculos antes de excluir.';
 elsif not never_accessed and doc_count>0 then
   blocked:='Esta farmácia já acessou e possui documentos enviados. Utilize Inativar farmácia para preservar o histórico.';
 end if;
 summary:=jsonb_build_object('farm_id',p_farm,'name',coalesce(nullif(f.nome_fantasia,''),f.razao_social),'cnpj',f.cnpj,
   'eligible',blocked is null,'reason',blocked,'never_accessed',never_accessed,'documents',doc_count,
   'users',cardinality(uids),'authorizations',auth_count,'audits',cardinality(aids),'credentials',cardinality(cids),'pending',false,'completed',false);
 if p_action='preview' then return summary; end if;
 if blocked is not null then raise exception '%',blocked; end if;
 -- Freeze access before publishing the tombstone used by all writer guards.
 update public.farms set status='inactive' where id=p_farm;
 update public.users set status='inactive' where farm_id=p_farm;
 update auth.users set banned_until=now()+interval '100 years' where id=any(uids);
 delete from auth.sessions where user_id=any(uids);
 insert into rbk_private.farm_deletions(farm_id,actor_id,cnpj,summary,entity_ids,user_ids,audit_ids,credential_ids,objects)
 values(p_farm,p_actor,regexp_replace(f.cnpj,'\D','','g'),summary,entities,uids,aids,cids,paths);
 return rbk_private.farmacia_exclusao(p_actor,p_farm,'prepare',p_cnpj);
end $function$;

CREATE OR REPLACE FUNCTION public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare f public.farms; c text; created boolean:=false;
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id
   where a.user_id=p_actor and a.ativo and u.status='active') then
   raise exception 'Acesso negado' using errcode='42501';
 end if;
 c:=regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g');
 if c !~ '^[A-Z0-9]{12}[0-9]{2}$' then raise exception 'CNPJ inválido' using errcode='22023';end if;
 -- Shared with audit registration to serialize creation of the same master.
 perform pg_advisory_xact_lock(hashtextextended('audit-farm:'||c,0));
 select * into f from public.farms where regexp_replace(upper(cnpj),'[./[:space:]-]','','g')=c order by id limit 1;
 if f.id is null and p_create then
   if length(trim(coalesce(payload->>'razao_social','')))<1 then raise exception 'Razão social obrigatória';end if;
   insert into public.farms(cnpj,razao_social,nome_fantasia,telefone,cidade,estado,status)
   values(c,trim(payload->>'razao_social'),nullif(trim(payload->>'nome_fantasia'),''),nullif(trim(payload->>'telefone'),''),
     nullif(trim(payload->>'cidade'),''),nullif(upper(trim(payload->>'estado')),''),'active') returning * into f;
   created:=true;
 end if;
 return jsonb_build_object('farm',case when f.id is null then null else to_jsonb(f) end,'created',created);
end $function$;

CREATE OR REPLACE FUNCTION public.cre_associate_farm()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 select case when count(*)=1 then (array_agg(f.id))[1] else null end into new.farm_id
 from public.farms f where regexp_replace(upper(f.cnpj),'[./[:space:]-]','','g')=
 regexp_replace(upper(coalesce(nullif(new.ficha->>'B20',''),new.ficha->>'B19','')),'[./[:space:]-]','','g');
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.cre_associate_new_farm()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 update public.cre_processes p set farm_id=new.id
 where p.farm_id is null and
   regexp_replace(upper(coalesce(nullif(p.ficha->>'B20',''),p.ficha->>'B19','')),'[./[:space:]-]','','g')=
   regexp_replace(upper(new.cnpj),'[./[:space:]-]','','g');
 return new;
end $function$;

CREATE OR REPLACE FUNCTION aud_private.manager(op text, aid uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.aud_audits;farm public.farms;fid uuid;result jsonb;days integer;v public.aud_files;doc jsonb;ext text;mime text;obj storage.objects;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501';end if;
 if op='farms' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.razao_social,'cnpj',f.cnpj) order by f.razao_social),'[]') from public.farms f where rbk_private.can_access_farm(f.id));
 elsif op='list' then
  payload:=jsonb_set(payload,'{cnpj}',to_jsonb(regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g')));
  if payload->>'cnpj' !~ '^[A-Z0-9]{0,14}$' then raise exception 'Pesquisa de CNPJ inválida.' using errcode='22023';end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('audit',to_jsonb(x),'can_delete',not exists(select 1 from public.aud_batches b where b.audit_id=x.id) and not exists(select 1 from public.aud_files f where f.audit_id=x.id and f.source='pharmacy'),'total_files',(select count(*) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),0),'last_received',(select max(completed_at) from public.aud_batches where audit_id=x.id),'batches','[]'::jsonb) order by x.created_at desc),'[]') from (select * from public.aud_audits ax where aud_private.can_manage(ax.id) and (coalesce(payload->>'cnpj','')='' or regexp_replace(upper(ax.cnpj),'[./[:space:]-]','','g') like (payload->>'cnpj')||'%') order by created_at desc,id limit 50 offset least(greatest(coalesce((payload->>'offset')::integer,0),0),100000)) x);
 elsif op='usage' then
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select ax.farm_id,ax.pharmacy,to_char(f.received_at at time zone 'America/Sao_Paulo','YYYY-MM') period,sum(f.size) bytes,count(*) files from public.aud_files f join public.aud_audits ax on ax.id=f.audit_id where f.received_at is not null and rbk_private.can_access_farm(ax.farm_id) group by ax.farm_id,ax.pharmacy,period order by period desc,ax.pharmacy limit 1000) x);
 elsif op='create' then
  fid=(payload->>'farm_id')::uuid;
  if not coalesce(rbk_private.can_access_farm(fid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
  select * into strict farm from public.farms where id=fid;
  perform pg_advisory_xact_lock(hashtextextended('audit-process:'||fid::text,0));
  if payload->>'check_duplicate'='true' and coalesce(payload->>'confirm_duplicate','false')<>'true'
     and exists(select 1 from public.aud_audits where farm_id=fid and collection='open' and deleted_at is null) then
    return jsonb_build_object('confirmation_required',true,'message','Já existe uma auditoria em andamento para este CNPJ. Deseja criar uma nova mesmo assim?');
  end if;
  insert into public.aud_audits(farm_id,pharmacy,cnpj,reference,requested,deadline,notes,created_by)
  values(fid,farm.razao_social,farm.cnpj,trim(payload->>'reference'),(payload->>'requested')::integer,(payload->>'deadline')::date,coalesce(payload->>'notes',''),auth.uid()) returning * into a;
  insert into public.aud_events(audit_id,event,actor_id) values(a.id,'audit_created',auth.uid());return to_jsonb(a);
 end if;
 if not aud_private.can_manage(aid) then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into strict a from public.aud_audits where id=aid for update;
 if a.deleted_at is not null then raise exception 'Auditoria excluída da carteira.' using errcode='42501';end if;
 if op='delete_empty' then
  if exists(select 1 from public.aud_batches where audit_id=aid) or exists(select 1 from public.aud_files where audit_id=aid and source='pharmacy') then
   raise exception 'Não é possível excluir: a farmácia já iniciou ou concluiu um envio.' using errcode='22023';
  end if;
  update public.aud_audits set deleted_at=clock_timestamp(),deleted_by=auth.uid(),collection='closed' where id=aid;
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
  insert into public.aud_events(audit_id,event,actor_id) values(aid,'audit_removed_empty',auth.uid());
  return jsonb_build_object('removed',true);
 end if;
 if op='detail' then
  return aud_private.summary(aid,true)||jsonb_build_object('offices',(select coalesce(jsonb_agg(to_jsonb(af)-'fingerprint' order by af.created_at desc),'[]') from public.aud_files af where af.audit_id=aid and af.source='office'),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]') from public.aud_events e where e.audit_id=aid),
  'link',(select jsonb_build_object('expires_at',l.expires_at,'revoked_at',l.revoked_at) from aud_private.links l where l.audit_id=aid order by l.created_at desc limit 1));
 elsif op in ('close','reopen') then
  update public.aud_audits set collection=case when op='close' then 'closed' else 'open' end where id=aid;
 elsif op='link' then
  days=(payload->>'days')::integer;
  if days is null or days not between 1 and 90 or payload->>'hash' is null then raise exception 'Validade inválida';end if;
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
  insert into aud_private.links(audit_id,token_hash,expires_at) values(aid,payload->>'hash',now()+make_interval(days=>days));
 elsif op='revoke' then
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
 elsif op='office_begin' then
  doc=payload->'file';ext=lower(substring(doc->>'name' from '[.]([a-zA-Z0-9]+)$'));
  mime=case ext when 'html' then 'text/html' when 'htm' then 'text/html' when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'png' then 'image/png' when 'tif' then 'image/tiff' when 'tiff' then 'image/tiff' end;
  if doc is null or (doc->>'size')::bigint is null or (doc->>'size')::bigint not between 1 and 104857600 or mime is null or doc->>'mime' is distinct from mime or length(doc->>'name') not between 1 and 180 or doc->>'name' ~ '[[:cntrl:]/\\]' then raise exception 'Ofício inválido';end if;
  select * into v from public.aud_files where audit_id=aid and source='office' and fingerprint=doc->>'fingerprint';
  if v.id is null then
   if (select count(*) from public.aud_files where audit_id=aid and source='office')>=50 or (doc->>'size')::bigint+coalesce((select sum(size) from public.aud_files where audit_id=aid),0)>a.max_bytes then raise exception 'Limite de armazenamento atingido';end if;
   insert into public.aud_files(id,audit_id,batch_id,source,filename,size,mime,fingerprint,storage_path)
   values((doc->>'id')::uuid,aid,null,'office',doc->>'name',(doc->>'size')::bigint,mime,doc->>'fingerprint',aid::text||'/oficios/'||(doc->>'id')||'.'||ext) returning * into v;
  end if;
  result=jsonb_build_object('id',v.id,'path',v.storage_path,'mime',v.mime,'exists',exists(select 1 from storage.objects o where o.bucket_id='auditoria-private' and o.name=v.storage_path and (o.metadata->>'size')::bigint=v.size and o.metadata->>'mimetype'=v.mime));
 elsif op='office_complete' then
  select * into v from public.aud_files where audit_id=aid and source='office' and id=(payload->>'file_id')::uuid;
  if v.id is null then raise exception 'Ofício indisponível';end if;
  if v.received_at is not null then return to_jsonb(v);end if;
  select * into obj from storage.objects where bucket_id='auditoria-private' and name=v.storage_path;
  if obj.id is null or (obj.metadata->>'size')::bigint is distinct from v.size or obj.metadata->>'mimetype' is distinct from v.mime then raise exception 'Upload incompleto ou metadados divergentes';end if;
  update public.aud_files set received_at=clock_timestamp() where id=v.id returning * into v;
  result=to_jsonb(v)-'fingerprint';
 elsif op='download' then
  select jsonb_build_object('path',f.storage_path,'filename',f.filename) into result from public.aud_files f
  where f.audit_id=aid and f.id=(payload->>'file_id')::uuid and f.scan in ('pending','clean','error') and f.received_at is not null;
  if result is null then raise exception 'Arquivo indisponível ou bloqueado por segurança';end if;
 else raise exception 'Operação inválida';end if;
 insert into public.aud_events(audit_id,event,actor_id,entity_id) values(aid,op,auth.uid(),(payload->>'file_id')::uuid);
 return coalesce(result,aud_private.summary(aid,true));
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.equipe_operacional(target_farm uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select target_farm is not null and exists (
    select 1 from public.farms f
    where f.id = target_farm and f.status = 'active'
  ) and (
    rbk_private.actor_role() = 'superadmin_rbk'
    or (
      rbk_private.actor_role() = 'gestor_rbk'
      and exists (
        select 1 from public.rbk_manager_farms m
        where m.manager_user_id = auth.uid() and m.farm_id = target_farm
      )
    )
    or (
      rbk_private.actor_role() in ('operador', 'gerente_farmacia', 'administrador_farmacia')
      and rbk_private.actor_farm_id() = target_farm
    )
  )
$function$;

CREATE OR REPLACE FUNCTION rbk_private.set_authorization_farm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    new.farm_id := rbk_private.actor_farm_id();
    if new.farm_id is null or new.user_id is distinct from auth.uid() then
      raise exception 'Usuário sem farmácia ativa';
    end if;
  elsif new.farm_id is distinct from old.farm_id
      or new.user_id is distinct from old.user_id then
    raise exception 'Não é permitido alterar a farmácia ou o criador';
  elsif new.analysis_status is distinct from old.analysis_status
      and pg_trigger_depth() <= 1 and auth.uid() is not null then
    raise exception 'O estado da análise é controlado pela RBK';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.storage_path_farm(path text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select u.farm_id from public.users u
  where u.id::text = split_part(path, '/', 1)
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.equipe_registrar_convite(p_actor uuid, p_id uuid, p_nome text, p_email text, p_perfil text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f uuid;
begin
 select u.farm_id into f from public.users u join public.farms f on f.id=u.farm_id where u.id=p_actor and u.status='active' and u.perfil in ('farmacia','administrador_farmacia') and f.status='active' and not exists(select 1 from public.rbk_admins r where r.user_id=p_actor and r.ativo);
 if f is null then raise exception 'Acesso restrito.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,917));
 if not exists(select 1 from public.users where id=p_actor and status='active' and perfil in ('farmacia','administrador_farmacia')) then raise exception 'Acesso restrito.';end if;
 if p_nome is null or length(trim(p_nome)) not between 2 and 150 or p_perfil is null or p_perfil not in ('administrador_farmacia','gerente_farmacia','operador') or p_status is null or p_status not in ('active','inactive') or not exists(select 1 from auth.users where id=p_id and lower(email)=lower(p_email)) then raise exception 'Dados inválidos.';end if;
 if exists(select 1 from public.users where id=p_id or lower(email)=lower(p_email)) then raise exception 'E-mail já cadastrado. Não é permitido transferir usuários.';end if;
 insert into public.users(id,farm_id,nome,email,perfil,status,tipo_convite,convidado_por)values(p_id,f,trim(p_nome),lower(p_email),p_perfil,p_status,'funcionario',p_actor);
 insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(f,p_actor,'invite','usuario',p_id,jsonb_build_object('perfil',p_perfil,'status',p_status,'tipo_convite','funcionario'));
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.equipe_admin()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or rbk_private.actor_role() is distinct from 'administrador_farmacia' or rbk_private.actor_farm_id() is null then
 raise exception 'Acesso restrito ao administrador da farmácia.';end if;
 return rbk_private.actor_farm_id();
end $function$;

CREATE OR REPLACE FUNCTION public.equipe_listar()
 RETURNS TABLE(id uuid, nome text, email text, perfil text, status text, created_at timestamp with time zone, convite_enviado_em timestamp with time zone, aceito boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f uuid;
begin
 f:=rbk_private.equipe_admin();
 return query select u.id,u.nome,u.email,u.perfil,u.status,u.created_at,u.convite_enviado_em,
 a.last_sign_in_at is not null from public.users u join auth.users a on a.id=u.id
 where u.farm_id=f order by u.created_at,u.id;
end $function$;

CREATE OR REPLACE FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f uuid; antigo public.users;
begin
 f:=rbk_private.equipe_admin();perform pg_advisory_xact_lock(hashtextextended(f::text,917));
 -- Recheck permission after serializing all membership changes.
 f:=rbk_private.equipe_admin();
 if p_nome is null or length(trim(p_nome)) not between 2 and 150 or p_perfil is null or p_perfil not in ('administrador_farmacia','gerente_farmacia','operador') or p_status is null or p_status not in ('active','inactive') then raise exception 'Dados inválidos.';end if;
 select * into antigo from public.users where id=p_id and farm_id=f for update;
 if not found or antigo.perfil not in ('farmacia','administrador_farmacia','gerente_farmacia','operador') or exists(select 1 from public.rbk_admins where user_id=p_id and ativo) then raise exception 'Usuário indisponível.';end if;
 if p_id=auth.uid() and (p_status<>'active' or p_perfil<>'administrador_farmacia') then raise exception 'Não é permitido remover seu próprio acesso administrativo.';end if;
 if antigo.perfil in ('farmacia','administrador_farmacia') and antigo.status='active' and (p_status<>'active' or p_perfil<>'administrador_farmacia') and not exists(select 1 from public.users where farm_id=f and id<>p_id and perfil in ('farmacia','administrador_farmacia') and status='active') then raise exception 'Mantenha um administrador ativo.';end if;
 update public.users set nome=trim(p_nome),perfil=case when antigo.perfil='farmacia' and p_perfil='administrador_farmacia' then 'farmacia' else p_perfil end,status=p_status where users.id=p_id;
 if p_status='inactive' then delete from auth.sessions where user_id=p_id;end if;
 insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(f,auth.uid(),'update','usuario',p_id,jsonb_build_object('perfil_anterior',antigo.perfil,'perfil',p_perfil,'status_anterior',antigo.status,'status',p_status));
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.equipe_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; f uuid;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='autorizacoes' then f:=(r->>'farm_id')::uuid;
 else select farm_id into f from public.autorizacoes where id=(r->>'autorizacao_id')::uuid;end if;
 if f is not null then insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)
 values(f,auth.uid(),lower(tg_op),case when tg_table_name='autorizacoes' then 'autorizacao' else 'documento' end,(r->>'id')::uuid,
 jsonb_build_object('autorizacao_id',r->>'autorizacao_id','ator_nome',(select nome from public.users where id=auth.uid())));end if;
 if tg_op='DELETE' then return old;end if;return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.equipe_document_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f uuid;
begin
 if tg_op='UPDATE' and new.autorizacao_id is distinct from old.autorizacao_id then raise exception 'Não é permitido transferir documentos.';end if;
 select farm_id into f from public.autorizacoes where id=new.autorizacao_id;
 if auth.uid() is not null and (not coalesce(rbk_private.can_write_farm(f),false) or rbk_private.storage_path_farm(new.caminho_arquivo) is distinct from f) then raise exception 'Documento fora da farmácia.';end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_autorizacao_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i uuid;
begin
 if new.cpf_cliente is distinct from old.cpf_cliente then
  for i in select id from public.dispensacao_itens where autorizacao_id=new.id loop perform rbk_private.proximas_sincronizar(i);end loop;
 end if;return null;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_contexto(p_busca text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare papel text; f jsonb;
begin
 papel=rbk_private.actor_role();
 if auth.uid() is null or papel is null then raise exception 'Sessão sem acesso ativo.';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into f from (
 select id,cnpj,coalesce(nome_fantasia,razao_social,'Farmácia') as nome from public.farms
 where coalesce(rbk_private.equipe_operacional(id),false)
 and (nullif(trim(p_busca),'') is null or position(lower(trim(p_busca)) in lower(coalesce(nome_fantasia,'')||' '||coalesce(razao_social,'')))>0
 or (regexp_replace(coalesce(p_busca,''),'\D','','g')<>'' and position(regexp_replace(p_busca,'\D','','g') in regexp_replace(cnpj,'\D','','g'))>0))
 order by nome,id limit 50) x;
 return jsonb_build_object('gestor',papel in ('gestor_rbk','superadmin_rbk'),'pode_editar',papel in ('operador','gerente_farmacia','administrador_farmacia'),'farmacias',f);
end $function$;

CREATE OR REPLACE FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select rbk_private.proximas_demanda(p_farm,p_inicio,p_fim)$function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_demanda(p_farm uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; faltantes integer;
begin
 perform rbk_private.proximas_validar(p_farm,false,true);
 if p_inicio is null or p_fim is null or p_fim<p_inicio then raise exception 'Período inválido.';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into r from (
 select coalesce(ean,'item:'||item_id::text) as chave,max(produto) as produto,ean,unidade,count(*) as retiradas,count(distinct contato_id) as clientes,
 null::numeric as quantidade_estimada
 from public.proximas_previsoes where farmacia_id=p_farm and ativa and status in ('a_avisar','avisado') and proxima_data between p_inicio and p_fim
 group by coalesce(ean,'item:'||item_id::text),ean,unidade order by max(produto)) x;
 select count(*) into faltantes from public.proximas_previsoes where farmacia_id=p_farm and ativa and status in ('a_avisar','avisado') and proxima_data is null;
 return jsonb_build_object('produtos',r,'nao_calculadas',faltantes);
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_evento(p proximas_previsoes, p_acao text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 insert into public.proximas_eventos(farmacia_id,previsao_id,acao,canal,usuario_id,usuario_nome,detalhes)
 values(p.farmacia_id,p.id,p_acao,case when p_acao='avisado' then 'whatsapp_manual' else 'interno' end,
 auth.uid(),(select nome from public.users where id=auth.uid()),p_detalhes)
$function$;

CREATE OR REPLACE FUNCTION public.proximas_historico(p_farm uuid, p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select rbk_private.proximas_historico(p_farm,p_id)$function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_historico(p_farm uuid, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 perform rbk_private.proximas_validar(p_farm);
 if not exists(select 1 from public.proximas_previsoes where id=p_id and farmacia_id=p_farm) then raise exception 'Previsão indisponível.';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into r from (select acao,canal,usuario_id,usuario_nome,criado_em,detalhes from public.proximas_eventos where previsao_id=p_id and farmacia_id=p_farm order by criado_em desc,id desc) x;return r;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_item_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform rbk_private.proximas_sincronizar(case when tg_op='DELETE' then old.id else new.id end);return null;end $function$;

CREATE OR REPLACE FUNCTION public.proximas_listar(p_farm uuid, p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_filtro text DEFAULT 'periodo'::text, p_pagina integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select rbk_private.proximas_listar(p_farm,p_inicio,p_fim,p_filtro,p_pagina)$function$;

CREATE OR REPLACE FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$select rbk_private.proximas_salvar(p_farm,p_id,p_versao,p_dados)$function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_validar(p_farm uuid, p_escrita boolean DEFAULT false, p_compras boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_farm is null then raise exception 'Selecione uma farmácia/CNPJ.'; end if;
 if auth.uid() is null or not coalesce(rbk_private.equipe_operacional(p_farm),false) then raise exception 'Sem acesso à farmácia selecionada.';end if;
 if p_escrita and not coalesce(rbk_private.can_write_farm(p_farm),false) then raise exception 'Sem permissão para alterar previsões.';end if;
 if p_compras and not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem permissão para consultar compras.';end if;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.pfpb_validar_identidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare campo text;
begin
 foreach campo in array array['concentracao','apresentacao','tipo_item'] loop
  if to_jsonb(new)->campo <> 'null'::jsonb and nullif(btrim(new.origens->>campo),'') is null then raise exception 'Informe a origem do campo %.',campo;end if;
 end loop;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.pfpb_resolver(i dispensacao_itens)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.pfpb_normalizar(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select regexp_replace(translate(upper(coalesce(p,'')),'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ','AAAAEEEIIIOOOOUUUC'),'\s+','','g')
$function$;

CREATE OR REPLACE FUNCTION rbk_private.pfpb_versao_imutavel()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' or (to_jsonb(new)-array['ativo','data_fim']) is distinct from (to_jsonb(old)-array['ativo','data_fim']) then
  raise exception 'Versão imutável. Publique uma nova versão com vigência própria.';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.pfpb_vigencia_unica()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION aud_private.log_credential_scan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.scan is distinct from old.scan or new.scanned_at is distinct from old.scanned_at then
  insert into public.cre_events(process_id,action,entity_id,result)
  values(new.process_id,'security_scan',new.id,new.scan);
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION rbk_private.gestao_acesso(p_cliente uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and exists(select 1 from public.rbk_crm_clientes c where c.id=p_cliente and (
 rbk_private.actor_role()='superadmin_rbk' or (rbk_private.actor_role()='gestor_rbk' and (
 (c.farm_id is null and c.responsavel_id=auth.uid()) or exists(select 1 from public.rbk_manager_farms m where m.farm_id=c.farm_id and m.manager_user_id=auth.uid())))))
$function$;

CREATE OR REPLACE FUNCTION rbk_private.gestao_vencimento(p_mes date, p_dia integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select (date_trunc('month',p_mes)::date + (least(p_dia,extract(day from date_trunc('month',p_mes)+interval '1 month - 1 day')::integer)-1))::date
$function$;

CREATE OR REPLACE FUNCTION rbk_private.gestao_gerar(p_contrato uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end$function$;

CREATE OR REPLACE FUNCTION rbk_private.gestao_dispatch(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end$function$;

CREATE OR REPLACE FUNCTION rbk_private.gestao_cobrancas(p_contrato uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, contrato_id uuid, competencia date, vencimento date, valor numeric, pago numeric, saldo numeric, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select b.id,b.contrato_id,b.competencia,b.vencimento,b.valor,coalesce(p.total,0),case when b.cancelada then 0 else b.valor-coalesce(p.total,0) end,
 case when b.cancelada then 'cancelado' when coalesce(p.total,0)>=b.valor then 'pago' when b.vencimento<timezone('America/Sao_Paulo',now())::date then 'atrasado' else 'pendente' end
 from public.rbk_cobrancas b join public.rbk_contratos k on k.id=b.contrato_id left join lateral(select sum(valor) total from public.rbk_pagamentos p where p.cobranca_id=b.id)p on true
 where (p_contrato is null or k.id=p_contrato) and rbk_private.gestao_acesso(k.cliente_id)
$function$;

CREATE OR REPLACE FUNCTION public.gestao_rbk(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select rbk_private.gestao_dispatch(p_action,p_data)$function$;

ALTER TABLE "public"."clients" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."clients" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."documents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."documents" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
ALTER TABLE "public"."documents" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."document_versions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."document_versions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."authorizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."authorizations" ALTER COLUMN "status" SET DEFAULT 'open'::text;
ALTER TABLE "public"."authorizations" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."documentos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."documentos" ALTER COLUMN "status" SET DEFAULT 'recebido'::text;
ALTER TABLE "public"."documentos" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."documentos" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "public"."farms" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."farms" ALTER COLUMN "status" SET DEFAULT 'active'::text;
ALTER TABLE "public"."farms" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."rbk_admins" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."rbk_admins" ALTER COLUMN "ativo" SET DEFAULT true;
ALTER TABLE "public"."rbk_manager_farms" ALTER COLUMN "granted_at" SET DEFAULT now();
ALTER TABLE "aud_private"."links" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "aud_private"."links" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "aud_private"."rates" ALTER COLUMN "window_start" SET DEFAULT now();
ALTER TABLE "aud_private"."rates" ALTER COLUMN "hits" SET DEFAULT 1;
ALTER TABLE "public"."aud_batches" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."aud_batches" ALTER COLUMN "started_at" SET DEFAULT now();
ALTER TABLE "public"."aud_events" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."aud_jobs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."aud_jobs" ALTER COLUMN "kind" SET DEFAULT 'classify_new'::text;
ALTER TABLE "public"."aud_jobs" ALTER COLUMN "status" SET DEFAULT 'held'::text;
ALTER TABLE "public"."aud_jobs" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."aud_files" ALTER COLUMN "source" SET DEFAULT 'pharmacy'::text;
ALTER TABLE "public"."aud_files" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."aud_files" ALTER COLUMN "scan" SET DEFAULT 'pending'::text;
ALTER TABLE "public"."aud_files" ALTER COLUMN "scan_attempts" SET DEFAULT 0;
ALTER TABLE "public"."aud_files" ALTER COLUMN "next_scan_at" SET DEFAULT now();
ALTER TABLE "public"."aud_audits" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."aud_audits" ALTER COLUMN "notes" SET DEFAULT ''::text;
ALTER TABLE "public"."aud_audits" ALTER COLUMN "collection" SET DEFAULT 'open'::text;
ALTER TABLE "public"."aud_audits" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."aud_audits" ALTER COLUMN "next_batch" SET DEFAULT 1;
ALTER TABLE "public"."aud_audits" ALTER COLUMN "max_bytes" SET DEFAULT '5368709120'::bigint;
ALTER TABLE "public"."aud_audits" ALTER COLUMN "contact_email" SET DEFAULT ''::text;
ALTER TABLE "public"."aud_audits" ALTER COLUMN "contact_phone" SET DEFAULT ''::text;
ALTER TABLE "public"."cre_processes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."cre_processes" ALTER COLUMN "ficha" SET DEFAULT '{}'::jsonb;
ALTER TABLE "public"."cre_processes" ALTER COLUMN "filial" SET DEFAULT false;
ALTER TABLE "public"."cre_processes" ALTER COLUMN "partners" SET DEFAULT 1;
ALTER TABLE "public"."cre_processes" ALTER COLUMN "revision" SET DEFAULT 1;
ALTER TABLE "public"."cre_processes" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."cre_processes" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "public"."cre_processes" ALTER COLUMN "rate_count" SET DEFAULT 0;
ALTER TABLE "public"."cre_files" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."cre_files" ALTER COLUMN "scan" SET DEFAULT 'pending'::text;
ALTER TABLE "public"."cre_files" ALTER COLUMN "scan_attempts" SET DEFAULT 0;
ALTER TABLE "public"."cre_files" ALTER COLUMN "next_scan_at" SET DEFAULT now();
ALTER TABLE "public"."compras_estoque" ALTER COLUMN "versao" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."compras_estoque" ALTER COLUMN "atualizado_em" SET DEFAULT now();
ALTER TABLE "public"."invitation_deliveries" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."invitation_deliveries" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "rbk_private"."farm_deletions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."cre_events" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."autorizacoes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."autorizacoes" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."autorizacoes" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "public"."autorizacoes" ALTER COLUMN "analysis_status" SET DEFAULT 'nao_analisada'::text;
ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."audit_logs" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."users" ALTER COLUMN "perfil" SET DEFAULT 'farmacia'::text;
ALTER TABLE "public"."users" ALTER COLUMN "status" SET DEFAULT 'active'::text;
ALTER TABLE "public"."users" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."proximas_contatos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."proximas_contatos" ALTER COLUMN "versao" SET DEFAULT 1;
ALTER TABLE "public"."proximas_contatos" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "public"."proximas_eventos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."proximas_eventos" ALTER COLUMN "canal" SET DEFAULT 'interno'::text;
ALTER TABLE "public"."proximas_eventos" ALTER COLUMN "criado_em" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."proximas_eventos" ALTER COLUMN "detalhes" SET DEFAULT '{}'::jsonb;
ALTER TABLE "public"."pfpb_periodicidades" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."pfpb_periodicidades" ALTER COLUMN "ativo" SET DEFAULT false;
ALTER TABLE "public"."pfpb_periodicidades" ALTER COLUMN "observacao" SET DEFAULT ''::text;
ALTER TABLE "public"."pfpb_produtos_periodicidade" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."pfpb_produtos_periodicidade" ALTER COLUMN "ativo" SET DEFAULT false;
ALTER TABLE "public"."pfpb_produtos_periodicidade" ALTER COLUMN "observacao" SET DEFAULT ''::text;
ALTER TABLE "public"."dispensacao_itens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."dispensacao_itens" ALTER COLUMN "status" SET DEFAULT 'pendente'::text;
ALTER TABLE "public"."dispensacao_itens" ALTER COLUMN "origens" SET DEFAULT '{}'::jsonb;
ALTER TABLE "public"."dispensacao_itens" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "public"."dispensacao_itens" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "origem" SET DEFAULT 'nao_calculado'::text;
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "motivo" SET DEFAULT 'Sem intervalo ou data de retorno confirmados.'::text;
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "status" SET DEFAULT 'a_avisar'::text;
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "ativa" SET DEFAULT true;
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "versao" SET DEFAULT 1;
ALTER TABLE "public"."proximas_previsoes" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "contato" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "whatsapp" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "email" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "cidade" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "uf" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "origem" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "interesses" SET DEFAULT '{}'::text[];
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "proxima_acao" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "observacoes" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "status" SET DEFAULT 'Novo lead'::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "aguardando_credenciamento" SET DEFAULT false;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "oportunidade_referencia" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_crm_clientes" ALTER COLUMN "updated_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "observacoes" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "plano" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "status" SET DEFAULT 'ativo'::text;
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "pausas" SET DEFAULT '[]'::jsonb;
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_contratos" ALTER COLUMN "updated_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_cobrancas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_cobrancas" ALTER COLUMN "cancelada" SET DEFAULT false;
ALTER TABLE "public"."rbk_cobrancas" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_cobrancas" ALTER COLUMN "updated_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_pagamentos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_pagamentos" ALTER COLUMN "observacoes" SET DEFAULT ''::text;
ALTER TABLE "public"."rbk_pagamentos" ALTER COLUMN "origem" SET DEFAULT 'manual'::text;
ALTER TABLE "public"."rbk_pagamentos" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_pagamentos" ALTER COLUMN "updated_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_comunicados" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_comunicados" ALTER COLUMN "segmento" SET DEFAULT '{}'::jsonb;
ALTER TABLE "public"."rbk_comunicados" ALTER COLUMN "status" SET DEFAULT 'rascunho'::text;
ALTER TABLE "public"."rbk_comunicados" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_comunicados" ALTER COLUMN "updated_at" SET DEFAULT clock_timestamp();
ALTER TABLE "public"."rbk_gestao_eventos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."rbk_gestao_eventos" ALTER COLUMN "created_at" SET DEFAULT clock_timestamp();
ALTER TABLE public.clients ADD CONSTRAINT "clients_pkey" PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT "documents_categoria_check" CHECK ((categoria = ANY (ARRAY['documento_cliente'::text, 'receita_medica'::text, 'cupom_fiscal'::text, 'cupom_vinculado'::text, 'outros'::text])));
ALTER TABLE public.documents ADD CONSTRAINT "documents_pkey" PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT "documents_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'replaced'::text])));
ALTER TABLE public.document_versions ADD CONSTRAINT "document_versions_document_id_version_key" UNIQUE (document_id, version);
ALTER TABLE public.document_versions ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public.authorizations ADD CONSTRAINT "authorizations_farm_id_numero_key" UNIQUE (farm_id, numero);
ALTER TABLE public.authorizations ADD CONSTRAINT "authorizations_pkey" PRIMARY KEY (id);
ALTER TABLE public.authorizations ADD CONSTRAINT "authorizations_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.documentos ADD CONSTRAINT "documentos_categoria_check" CHECK ((categoria = ANY (ARRAY['documento_cliente'::text, 'receita_medica'::text, 'cupom_fiscal'::text, 'cupom_vinculado'::text, 'outros'::text])));
ALTER TABLE public.documentos ADD CONSTRAINT "documentos_pkey" PRIMARY KEY (id);
ALTER TABLE public.documentos ADD CONSTRAINT "documentos_status_check" CHECK ((status = ANY (ARRAY['recebido'::text, 'atencao'::text, 'pendente'::text])));
ALTER TABLE public.farms ADD CONSTRAINT "farms_cnpj_key" UNIQUE (cnpj);
ALTER TABLE public.farms ADD CONSTRAINT "farms_pkey" PRIMARY KEY (id);
ALTER TABLE public.farms ADD CONSTRAINT "farms_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
ALTER TABLE public.rbk_admins ADD CONSTRAINT "rbk_admins_pkey" PRIMARY KEY (user_id);
ALTER TABLE public.rbk_manager_farms ADD CONSTRAINT "rbk_manager_farms_pkey" PRIMARY KEY (manager_user_id, farm_id);
ALTER TABLE aud_private.links ADD CONSTRAINT "links_pkey" PRIMARY KEY (id);
ALTER TABLE aud_private.links ADD CONSTRAINT "links_token_hash_check" CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE aud_private.links ADD CONSTRAINT "links_token_hash_key" UNIQUE (token_hash);
ALTER TABLE aud_private.rates ADD CONSTRAINT "rates_pkey" PRIMARY KEY (key);
ALTER TABLE public.aud_batches ADD CONSTRAINT "aud_batches_audit_id_client_key_key" UNIQUE (audit_id, client_key);
ALTER TABLE public.aud_batches ADD CONSTRAINT "aud_batches_audit_id_number_key" UNIQUE (audit_id, number);
ALTER TABLE public.aud_batches ADD CONSTRAINT "aud_batches_pkey" PRIMARY KEY (id);
ALTER TABLE public.aud_batches ADD CONSTRAINT "aud_batches_protocol_key" UNIQUE (protocol);
ALTER TABLE public.aud_events ADD CONSTRAINT "aud_events_pkey" PRIMARY KEY (id);
ALTER TABLE public.aud_jobs ADD CONSTRAINT "aud_jobs_batch_id_key" UNIQUE (batch_id);
ALTER TABLE public.aud_jobs ADD CONSTRAINT "aud_jobs_pkey" PRIMARY KEY (id);
ALTER TABLE public.aud_jobs ADD CONSTRAINT "aud_jobs_status_check" CHECK ((status = 'held'::text));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_audit_id_source_fingerprint_key" UNIQUE (audit_id, source, fingerprint);
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_check" CHECK ((((source = 'pharmacy'::text) AND (batch_id IS NOT NULL)) OR ((source = 'office'::text) AND (batch_id IS NULL))));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_fingerprint_check" CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_pkey" PRIMARY KEY (id);
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_scan_check" CHECK ((scan = ANY (ARRAY['pending'::text, 'clean'::text, 'infected'::text, 'error'::text, 'rejected'::text])));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_size_check" CHECK (((size >= 1) AND (size <= 104857600)));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_source_check" CHECK ((source = ANY (ARRAY['pharmacy'::text, 'office'::text])));
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_storage_path_key" UNIQUE (storage_path);
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_collection_check" CHECK ((collection = ANY (ARRAY['open'::text, 'closed'::text])));
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_notes_check" CHECK ((length(notes) <= 2000));
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_pkey" PRIMARY KEY (id);
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_reference_check" CHECK (((length(reference) >= 1) AND (length(reference) <= 200)));
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_requested_check" CHECK (((requested >= 0) AND (requested <= 100000)));
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_retention_days_check" CHECK ((retention_days > 0));
ALTER TABLE public.cre_processes ADD CONSTRAINT "cre_processes_partners_check" CHECK (((partners >= 1) AND (partners <= 4)));
ALTER TABLE public.cre_processes ADD CONSTRAINT "cre_processes_pkey" PRIMARY KEY (id);
ALTER TABLE public.cre_processes ADD CONSTRAINT "cre_processes_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_fingerprint_check" CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_kind_check" CHECK (((kind >= 0) AND (kind <= 10)));
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_mime_check" CHECK ((mime = ANY (ARRAY['application/pdf'::text, 'image/png'::text, 'image/jpeg'::text])));
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_pkey" PRIMARY KEY (id);
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_process_id_kind_fingerprint_key" UNIQUE (process_id, kind, fingerprint);
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_scan_check" CHECK ((scan = ANY (ARRAY['pending'::text, 'clean'::text, 'error'::text, 'rejected'::text, 'infected'::text])));
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_size_check" CHECK (((size >= 1) AND (size <= 26214400)));
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_storage_path_key" UNIQUE (storage_path);
ALTER TABLE public.compras_estoque ADD CONSTRAINT "compras_estoque_arquivo_check" CHECK (((length(arquivo) >= 1) AND (length(arquivo) <= 250)));
ALTER TABLE public.compras_estoque ADD CONSTRAINT "compras_estoque_itens_check" CHECK (((jsonb_typeof(itens) = 'array'::text) AND ((jsonb_array_length(itens) >= 1) AND (jsonb_array_length(itens) <= 20000))));
ALTER TABLE public.compras_estoque ADD CONSTRAINT "compras_estoque_pkey" PRIMARY KEY (farm_id);
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_channel_check" CHECK ((channel = ANY (ARRAY['email'::text, 'whatsapp'::text])));
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_check" CHECK ((num_nonnulls(audit_id, credential_id) = 1));
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_link_hash_check" CHECK ((link_hash ~ '^[a-f0-9]{64}$'::text));
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_pkey" PRIMARY KEY (attempt_id);
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'failed'::text, 'manual'::text, 'not_configured'::text, 'invalid_contact'::text, 'unsafe_link'::text, 'unavailable'::text])));
ALTER TABLE rbk_private.farm_deletions ADD CONSTRAINT "farm_deletions_pkey" PRIMARY KEY (farm_id);
ALTER TABLE public.cre_events ADD CONSTRAINT "cre_events_pkey" PRIMARY KEY (id);
ALTER TABLE public.autorizacoes ADD CONSTRAINT "autorizacoes_analysis_status_check" CHECK ((analysis_status = ANY (ARRAY['nao_analisada'::text, 'em_analise'::text, 'requer_conferencia'::text, 'revisada'::text])));
ALTER TABLE public.autorizacoes ADD CONSTRAINT "autorizacoes_crm_valido" CHECK ((((crm IS NULL) AND (crm_uf IS NULL)) OR ((crm IS NOT NULL) AND (crm_uf IS NOT NULL) AND (crm ~ '^[1-9][0-9]{0,9}$'::text) AND (crm_uf = ANY (ARRAY['AC'::text, 'AL'::text, 'AP'::text, 'AM'::text, 'BA'::text, 'CE'::text, 'DF'::text, 'ES'::text, 'GO'::text, 'MA'::text, 'MT'::text, 'MS'::text, 'MG'::text, 'PA'::text, 'PB'::text, 'PR'::text, 'PE'::text, 'PI'::text, 'RJ'::text, 'RN'::text, 'RS'::text, 'RO'::text, 'RR'::text, 'SC'::text, 'SP'::text, 'SE'::text, 'TO'::text])))));
ALTER TABLE public.autorizacoes ADD CONSTRAINT "autorizacoes_pkey" PRIMARY KEY (id);
ALTER TABLE public.audit_logs ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT "users_perfil_check" CHECK ((perfil = ANY (ARRAY['farmacia'::text, 'rbk_admin'::text, 'operador'::text, 'administrador_farmacia'::text, 'gerente_farmacia'::text, 'gestor_rbk'::text, 'superadmin_rbk'::text])));
ALTER TABLE public.users ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT "users_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_farmacia_id_cpf_key" UNIQUE (farmacia_id, cpf);
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_id_farmacia_id_key" UNIQUE (id, farmacia_id);
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_nome_check" CHECK (((nome IS NULL) OR ((length(nome) >= 2) AND (length(nome) <= 150))));
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_pkey" PRIMARY KEY (id);
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_telefone_check" CHECK (((telefone IS NULL) OR (telefone ~ '^[1-9][0-9][0-9]{8,9}$'::text)));
ALTER TABLE public.proximas_eventos ADD CONSTRAINT "proximas_eventos_pkey" PRIMARY KEY (id);
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_chave_versao_key" UNIQUE (chave, versao);
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_check" CHECK (((data_fim IS NULL) OR (data_fim > data_vigencia)));
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_fonte_check" CHECK ((fonte ~~ 'https://%'::text));
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_periodicidade_dias_check" CHECK (((periodicidade_dias >= 1) AND (periodicidade_dias <= 3650)));
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_pkey" PRIMARY KEY (id);
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_tipo_item_check" CHECK ((tipo_item = ANY (ARRAY['medicamento'::text, 'fralda'::text, 'absorvente'::text])));
ALTER TABLE public.pfpb_periodicidades ADD CONSTRAINT "pfpb_periodicidades_versao_check" CHECK ((versao > 0));
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_check" CHECK (((data_fim IS NULL) OR (data_fim > data_vigencia)));
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_ean_check" CHECK ((ean ~ '^([0-9]{8}|[0-9]{12,14})$'::text));
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_ean_versao_key" UNIQUE (ean, versao);
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_fonte_check" CHECK ((fonte ~~ 'https://%'::text));
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_pkey" PRIMARY KEY (id);
ALTER TABLE public.pfpb_produtos_periodicidade ADD CONSTRAINT "pfpb_produtos_periodicidade_tipo_item_check" CHECK ((tipo_item = ANY (ARRAY['medicamento'::text, 'fralda'::text, 'absorvente'::text])));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_autorizacao_id_posicao_key" UNIQUE (autorizacao_id, posicao);
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_ean_check" CHECK (((ean IS NULL) OR (ean ~ '^([0-9]{8}|[0-9]{12,14})$'::text)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_intervalo_retirada_dias_check" CHECK (((intervalo_retirada_dias >= 1) AND (intervalo_retirada_dias <= 3650)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_origens_check" CHECK ((jsonb_typeof(origens) = 'object'::text));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_pkey" PRIMARY KEY (id);
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_posicao_check" CHECK ((posicao > 0));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_produto_check" CHECK (((produto IS NULL) OR (length(btrim(produto)) > 0)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_quantidade_check" CHECK (((quantidade >= (0)::numeric) AND (quantidade < ('1000000000000'::bigint)::numeric)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_status_check" CHECK ((status = ANY (ARRAY['pendente'::text, 'confirmado'::text, 'cancelado'::text])));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_tipo_item_check" CHECK ((tipo_item = ANY (ARRAY['medicamento'::text, 'fralda'::text, 'absorvente'::text])));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_valor_pfpb_check" CHECK (((valor_pfpb >= (0)::numeric) AND (valor_pfpb < ('10000000000000'::bigint)::numeric)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_valor_total_check" CHECK (((valor_total >= (0)::numeric) AND (valor_total < ('10000000000000'::bigint)::numeric)));
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_valor_unitario_check" CHECK (((valor_unitario >= (0)::numeric) AND (valor_unitario < ('100000000000'::bigint)::numeric)));
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_check" CHECK (((proxima_data IS NULL) OR ((ultima_data IS NOT NULL) AND (proxima_data > ultima_data))));
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_intervalo_dias_check" CHECK (((intervalo_dias >= 1) AND (intervalo_dias <= 3650)));
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_item_id_key" UNIQUE (item_id);
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_origem_check" CHECK ((origem = ANY (ARRAY['nao_calculado'::text, 'fonte_confirmada'::text, 'intervalo_fonte'::text, 'manual'::text, 'intervalo_confirmado'::text, 'regra_pfpb'::text])));
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_pkey" PRIMARY KEY (id);
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_status_check" CHECK ((status = ANY (ARRAY['a_avisar'::text, 'avisado'::text, 'retirado'::text, 'nao_retirado'::text])));
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_regra_evidencia" CHECK (((origem <> 'regra_pfpb'::text) OR ((regra_id IS NOT NULL) AND (regra_snapshot IS NOT NULL))));
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_cnpj_check" CHECK ((cnpj ~ '^[0-9]{14}$'::text));
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_cnpj_key" UNIQUE (cnpj);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_farm_id_key" UNIQUE (farm_id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_interesses_check" CHECK ((interesses <@ ARRAY['Credenciamento'::text, 'Auditoria'::text, 'Renovação'::text, 'RBK Digital'::text, 'ANVISA'::text, 'Compra/Venda de CNPJ'::text, 'Notícias/Comunicados PFPB'::text]));
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_pkey" PRIMARY KEY (id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_razao_social_check" CHECK (((length(TRIM(BOTH FROM razao_social)) >= 2) AND (length(TRIM(BOTH FROM razao_social)) <= 200)));
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_status_check" CHECK ((status = ANY (ARRAY['Novo lead'::text, 'Em contato'::text, 'Interessado'::text, 'Aguardando oportunidade'::text, 'Proposta enviada'::text, 'Cliente'::text, 'Sem interesse'::text])));
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_uf_check" CHECK (((uf = ''::text) OR (uf = ANY (ARRAY['AC'::text, 'AL'::text, 'AP'::text, 'AM'::text, 'BA'::text, 'CE'::text, 'DF'::text, 'ES'::text, 'GO'::text, 'MA'::text, 'MT'::text, 'MS'::text, 'MG'::text, 'PA'::text, 'PB'::text, 'PR'::text, 'PE'::text, 'PI'::text, 'RJ'::text, 'RN'::text, 'RS'::text, 'RO'::text, 'RR'::text, 'SC'::text, 'SP'::text, 'SE'::text, 'TO'::text]))));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_check" CHECK ((vencimento >= data_inicio));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_check1" CHECK (((servico <> 'RBK Digital'::text) OR ((length(TRIM(BOTH FROM plano)) > 0) AND (dia_vencimento IS NOT NULL))));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_dia_vencimento_check" CHECK (((dia_vencimento >= 1) AND (dia_vencimento <= 31)));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_forma_pagamento_check" CHECK ((forma_pagamento = ANY (ARRAY['Pix'::text, 'Pix Automático'::text, 'Boleto/Pix'::text, 'Cartão recorrente'::text, 'Transferência'::text, 'Dinheiro'::text, 'Outro'::text])));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_pkey" PRIMARY KEY (id);
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_servico_check" CHECK ((servico = ANY (ARRAY['Auditoria'::text, 'Credenciamento'::text, 'Renovação'::text, 'ANVISA'::text, 'RBK Digital'::text, 'Outros serviços avulsos'::text])));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_status_check" CHECK ((status = ANY (ARRAY['ativo'::text, 'suspenso'::text, 'cancelado'::text])));
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_valor_check" CHECK ((valor > (0)::numeric));
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_contrato_id_competencia_key" UNIQUE (contrato_id, competencia);
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_pkey" PRIMARY KEY (id);
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_valor_check" CHECK ((valor > (0)::numeric));
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_origem_check" CHECK ((origem = 'manual'::text));
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_pkey" PRIMARY KEY (id);
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_valor_check" CHECK ((valor > (0)::numeric));
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_canal_check" CHECK ((canal = ANY (ARRAY['E-mail'::text, 'WhatsApp'::text])));
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_pkey" PRIMARY KEY (id);
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_status_check" CHECK ((status = 'rascunho'::text));
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_texto_check" CHECK (((length(TRIM(BOTH FROM texto)) >= 1) AND (length(TRIM(BOTH FROM texto)) <= 10000)));
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_titulo_check" CHECK (((length(TRIM(BOTH FROM titulo)) >= 1) AND (length(TRIM(BOTH FROM titulo)) <= 200)));
ALTER TABLE public.rbk_gestao_eventos ADD CONSTRAINT "rbk_gestao_eventos_pkey" PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT "clients_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE RESTRICT;
ALTER TABLE public.documents ADD CONSTRAINT "documents_authorization_id_fkey" FOREIGN KEY (authorization_id) REFERENCES authorizations(id) ON DELETE RESTRICT;
ALTER TABLE public.document_versions ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT;
ALTER TABLE public.document_versions ADD CONSTRAINT "document_versions_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.authorizations ADD CONSTRAINT "authorizations_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE public.authorizations ADD CONSTRAINT "authorizations_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE RESTRICT;
ALTER TABLE public.documentos ADD CONSTRAINT "documentos_autorizacao_id_fkey" FOREIGN KEY (autorizacao_id) REFERENCES autorizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.rbk_admins ADD CONSTRAINT "rbk_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rbk_manager_farms ADD CONSTRAINT "rbk_manager_farms_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id);
ALTER TABLE public.rbk_manager_farms ADD CONSTRAINT "rbk_manager_farms_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE public.rbk_manager_farms ADD CONSTRAINT "rbk_manager_farms_manager_user_id_fkey" FOREIGN KEY (manager_user_id) REFERENCES users(id);
ALTER TABLE aud_private.links ADD CONSTRAINT "links_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id);
ALTER TABLE public.aud_batches ADD CONSTRAINT "aud_batches_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id);
ALTER TABLE public.aud_events ADD CONSTRAINT "aud_events_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id);
ALTER TABLE public.aud_jobs ADD CONSTRAINT "aud_jobs_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id);
ALTER TABLE public.aud_jobs ADD CONSTRAINT "aud_jobs_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES aud_batches(id);
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id);
ALTER TABLE public.aud_files ADD CONSTRAINT "aud_files_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES aud_batches(id);
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
ALTER TABLE public.aud_audits ADD CONSTRAINT "aud_audits_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id);
ALTER TABLE public.cre_processes ADD CONSTRAINT "cre_processes_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE SET NULL;
ALTER TABLE public.cre_processes ADD CONSTRAINT "cre_processes_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE public.cre_files ADD CONSTRAINT "cre_files_process_id_fkey" FOREIGN KEY (process_id) REFERENCES cre_processes(id);
ALTER TABLE public.compras_estoque ADD CONSTRAINT "compras_estoque_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id);
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES aud_audits(id) ON DELETE CASCADE;
ALTER TABLE public.invitation_deliveries ADD CONSTRAINT "invitation_deliveries_credential_id_fkey" FOREIGN KEY (credential_id) REFERENCES cre_processes(id) ON DELETE CASCADE;
ALTER TABLE public.cre_events ADD CONSTRAINT "cre_events_process_id_fkey" FOREIGN KEY (process_id) REFERENCES cre_processes(id);
ALTER TABLE public.autorizacoes ADD CONSTRAINT "autorizacoes_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id);
ALTER TABLE public.autorizacoes ADD CONSTRAINT "autorizacoes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD CONSTRAINT "audit_logs_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE RESTRICT;
ALTER TABLE public.audit_logs ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD CONSTRAINT "users_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE RESTRICT;
ALTER TABLE public.users ADD CONSTRAINT "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.proximas_contatos ADD CONSTRAINT "proximas_contatos_farmacia_id_fkey" FOREIGN KEY (farmacia_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE public.proximas_eventos ADD CONSTRAINT "proximas_eventos_farmacia_id_fkey" FOREIGN KEY (farmacia_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE public.proximas_eventos ADD CONSTRAINT "proximas_eventos_previsao_id_fkey" FOREIGN KEY (previsao_id) REFERENCES proximas_previsoes(id) ON DELETE CASCADE;
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_autorizacao_id_fkey" FOREIGN KEY (autorizacao_id) REFERENCES autorizacoes(id) ON DELETE CASCADE;
ALTER TABLE public.dispensacao_itens ADD CONSTRAINT "dispensacao_itens_documento_id_fkey" FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE;
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_contato_id_farmacia_id_fkey" FOREIGN KEY (contato_id, farmacia_id) REFERENCES proximas_contatos(id, farmacia_id);
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_farmacia_id_fkey" FOREIGN KEY (farmacia_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE public.proximas_previsoes ADD CONSTRAINT "proximas_previsoes_regra_id_fkey" FOREIGN KEY (regra_id) REFERENCES pfpb_periodicidades(id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_farm_id_fkey" FOREIGN KEY (farm_id) REFERENCES farms(id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_responsavel_id_fkey" FOREIGN KEY (responsavel_id) REFERENCES users(id);
ALTER TABLE public.rbk_crm_clientes ADD CONSTRAINT "rbk_crm_clientes_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES rbk_crm_clientes(id);
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rbk_contratos ADD CONSTRAINT "rbk_contratos_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES rbk_contratos(id);
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rbk_cobrancas ADD CONSTRAINT "rbk_cobrancas_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_cobranca_id_fkey" FOREIGN KEY (cobranca_id) REFERENCES rbk_cobrancas(id);
ALTER TABLE public.rbk_pagamentos ADD CONSTRAINT "rbk_pagamentos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rbk_comunicados ADD CONSTRAINT "rbk_comunicados_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.rbk_gestao_eventos ADD CONSTRAINT "rbk_gestao_eventos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id);
CREATE INDEX idx_clients_farm_id ON public.clients USING btree (farm_id);
CREATE UNIQUE INDEX clients_farm_cpf_unique ON public.clients USING btree (farm_id, cpf) WHERE (cpf IS NOT NULL);
CREATE INDEX idx_documents_authorization_id ON public.documents USING btree (authorization_id);
CREATE INDEX idx_document_versions_document_id ON public.document_versions USING btree (document_id);
CREATE INDEX idx_authorizations_farm_id ON public.authorizations USING btree (farm_id);
CREATE INDEX idx_authorizations_client_id ON public.authorizations USING btree (client_id);
CREATE INDEX documentos_autorizacao_id_idx ON public.documentos USING btree (autorizacao_id);
CREATE INDEX documentos_categoria_idx ON public.documentos USING btree (categoria);
CREATE UNIQUE INDEX documentos_categoria_unica_idx ON public.documentos USING btree (autorizacao_id, categoria) WHERE (categoria <> 'outros'::text);
CREATE UNIQUE INDEX aud_one_active_link ON aud_private.links USING btree (audit_id) WHERE (revoked_at IS NULL);
CREATE INDEX rates_window_start_idx ON aud_private.rates USING btree (window_start);
CREATE INDEX aud_batches_audit_id_number_idx ON public.aud_batches USING btree (audit_id, number);
CREATE INDEX aud_events_audit_id_created_at_idx ON public.aud_events USING btree (audit_id, created_at);
CREATE INDEX aud_files_batch_id_idx ON public.aud_files USING btree (batch_id);
CREATE INDEX aud_audits_farm_id_created_at_idx ON public.aud_audits USING btree (farm_id, created_at DESC);
CREATE INDEX cre_processes_owner_id_idx ON public.cre_processes USING btree (owner_id);
CREATE INDEX cre_processes_farm_id_idx ON public.cre_processes USING btree (farm_id);
CREATE INDEX cre_files_process_id_idx ON public.cre_files USING btree (process_id);
CREATE INDEX invitation_deliveries_credential_id_created_at_idx ON public.invitation_deliveries USING btree (credential_id, created_at DESC);
CREATE INDEX invitation_deliveries_audit_id_created_at_idx ON public.invitation_deliveries USING btree (audit_id, created_at DESC);
CREATE INDEX cre_events_process_id_idx ON public.cre_events USING btree (process_id);
CREATE INDEX idx_autorizacoes_cpf_cliente ON public.autorizacoes USING btree (cpf_cliente);
CREATE UNIQUE INDEX uq_autorizacoes_numero_normalizado ON public.autorizacoes USING btree (regexp_replace(numero_autorizacao, '[^0-9]'::text, ''::text, 'g'::text));
CREATE UNIQUE INDEX autorizacoes_numero_autorizacao_unique ON public.autorizacoes USING btree (numero_autorizacao);
CREATE INDEX autorizacoes_crm_uf_data_idx ON public.autorizacoes USING btree (crm, crm_uf, data_autorizacao) WHERE (crm IS NOT NULL);
CREATE INDEX autorizacoes_farm_id_idx ON public.autorizacoes USING btree (farm_id);
CREATE INDEX autorizacoes_farm_created_idx ON public.autorizacoes USING btree (farm_id, created_at DESC);
CREATE INDEX idx_audit_logs_farm_id ON public.audit_logs USING btree (farm_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX users_farm_id_idx ON public.users USING btree (farm_id);
CREATE INDEX users_status_idx ON public.users USING btree (status);
CREATE INDEX proximas_eventos_previsao_idx ON public.proximas_eventos USING btree (previsao_id, criado_em);
CREATE INDEX pfpb_periodicidades_chave_idx ON public.pfpb_periodicidades USING btree (chave, data_vigencia);
CREATE INDEX pfpb_produtos_periodicidade_ean_idx ON public.pfpb_produtos_periodicidade USING btree (ean, data_vigencia);
CREATE INDEX dispensacao_itens_documento_idx ON public.dispensacao_itens USING btree (documento_id);
CREATE INDEX proximas_farm_data_idx ON public.proximas_previsoes USING btree (farmacia_id, proxima_data) WHERE ativa;
CREATE INDEX proximas_autorizacao_idx ON public.proximas_previsoes USING btree (autorizacao_id);
CREATE INDEX proximas_alerta_idx ON public.proximas_previsoes USING btree (farmacia_id, alerta_data) WHERE (ativa AND (status = 'a_avisar'::text));
CREATE INDEX rbk_crm_filtros ON public.rbk_crm_clientes USING btree (responsavel_id, status, uf);
CREATE INDEX rbk_crm_interesses ON public.rbk_crm_clientes USING gin (interesses);
CREATE INDEX rbk_contratos_cliente ON public.rbk_contratos USING btree (cliente_id);
CREATE INDEX rbk_cobrancas_vencimento ON public.rbk_cobrancas USING btree (vencimento);
CREATE INDEX rbk_pagamentos_cobranca ON public.rbk_pagamentos USING btree (cobranca_id);
CREATE INDEX rbk_pagamentos_data ON public.rbk_pagamentos USING btree (data_pagamento);
CREATE INDEX rbk_gestao_eventos_entidade ON public.rbk_gestao_eventos USING btree (entidade_id, created_at DESC);
CREATE TRIGGER validar_item_dispensacao BEFORE INSERT OR UPDATE ON public.dispensacao_itens FOR EACH ROW EXECUTE FUNCTION rbk_private.validar_item_dispensacao();
CREATE TRIGGER invalidar_itens_cupom AFTER UPDATE OF caminho_arquivo, categoria, autorizacao_id ON public.documentos FOR EACH ROW WHEN (((old.caminho_arquivo IS DISTINCT FROM new.caminho_arquivo) OR (old.categoria IS DISTINCT FROM new.categoria) OR (old.autorizacao_id IS DISTINCT FROM new.autorizacao_id))) EXECUTE FUNCTION rbk_private.invalidar_itens_cupom();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.farms FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.rbk_admins FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.rbk_manager_farms FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.autorizacoes FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.dispensacao_itens FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.authorizations FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.compras_estoque FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.aud_events FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.cre_events FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.aud_audits FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.aud_files FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.aud_batches FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.aud_jobs FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON aud_private.links FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.cre_processes FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.cre_files FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON public.invitation_deliveries FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER cre_associate_farm BEFORE INSERT OR UPDATE OF ficha ON public.cre_processes FOR EACH ROW EXECUTE FUNCTION cre_associate_farm();
CREATE TRIGGER cre_associate_new_farm AFTER INSERT ON public.farms FOR EACH ROW EXECUTE FUNCTION cre_associate_new_farm();
CREATE TRIGGER trg_authorization_farm BEFORE INSERT OR UPDATE ON public.autorizacoes FOR EACH ROW EXECUTE FUNCTION rbk_private.set_authorization_farm();
CREATE TRIGGER equipe_autorizacao_audit AFTER INSERT OR DELETE OR UPDATE ON public.autorizacoes FOR EACH ROW EXECUTE FUNCTION rbk_private.equipe_audit();
CREATE TRIGGER equipe_documento_audit AFTER INSERT OR DELETE OR UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION rbk_private.equipe_audit();
CREATE TRIGGER equipe_document_guard BEFORE INSERT OR UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION rbk_private.equipe_document_guard();
CREATE TRIGGER proximas_item AFTER INSERT OR DELETE OR UPDATE ON public.dispensacao_itens FOR EACH ROW EXECUTE FUNCTION rbk_private.proximas_item_trigger();
CREATE TRIGGER proximas_autorizacao AFTER UPDATE OF cpf_cliente ON public.autorizacoes FOR EACH ROW EXECUTE FUNCTION rbk_private.proximas_autorizacao_trigger();
CREATE TRIGGER pfpb_regra_imutavel BEFORE DELETE OR UPDATE ON public.pfpb_periodicidades FOR EACH ROW EXECUTE FUNCTION rbk_private.pfpb_versao_imutavel();
CREATE TRIGGER pfpb_produto_imutavel BEFORE DELETE OR UPDATE ON public.pfpb_produtos_periodicidade FOR EACH ROW EXECUTE FUNCTION rbk_private.pfpb_versao_imutavel();
CREATE TRIGGER pfpb_regra_vigencia BEFORE INSERT OR UPDATE ON public.pfpb_periodicidades FOR EACH ROW EXECUTE FUNCTION rbk_private.pfpb_vigencia_unica();
CREATE TRIGGER pfpb_produto_vigencia BEFORE INSERT OR UPDATE ON public.pfpb_produtos_periodicidade FOR EACH ROW EXECUTE FUNCTION rbk_private.pfpb_vigencia_unica();
CREATE TRIGGER pfpb_validar_identidade BEFORE INSERT OR UPDATE ON public.dispensacao_itens FOR EACH ROW EXECUTE FUNCTION rbk_private.pfpb_validar_identidade();
CREATE TRIGGER credential_security_history AFTER UPDATE OF scan, scanned_at ON public.cre_files FOR EACH ROW EXECUTE FUNCTION aud_private.log_credential_scan();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON auth.sessions FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
CREATE TRIGGER farmacia_deletion_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION rbk_private.deletion_guard();
ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."clients" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."documents" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."document_versions" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."authorizations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."authorizations" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."documentos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."documentos" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."farms" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."farms" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_admins" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_admins" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_manager_farms" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_manager_farms" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "aud_private"."links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "aud_private"."links" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "aud_private"."rates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "aud_private"."rates" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."aud_batches" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."aud_batches" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."aud_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."aud_events" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."aud_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."aud_jobs" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."aud_files" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."aud_files" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."aud_audits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."aud_audits" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."cre_processes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."cre_processes" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."cre_files" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."cre_files" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."compras_estoque" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."compras_estoque" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."invitation_deliveries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."invitation_deliveries" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "rbk_private"."farm_deletions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "rbk_private"."farm_deletions" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."cre_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."cre_events" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."autorizacoes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."autorizacoes" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."audit_logs" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."users" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."proximas_contatos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."proximas_contatos" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."proximas_eventos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."proximas_eventos" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."pfpb_periodicidades" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."pfpb_periodicidades" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."pfpb_produtos_periodicidade" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."pfpb_produtos_periodicidade" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."dispensacao_itens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."dispensacao_itens" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."proximas_previsoes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."proximas_previsoes" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_crm_clientes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_crm_clientes" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_contratos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_contratos" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_cobrancas" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_cobrancas" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_pagamentos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_pagamentos" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_comunicados" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_comunicados" FROM anon, authenticated, service_role, PUBLIC;
ALTER TABLE "public"."rbk_gestao_eventos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."rbk_gestao_eventos" FROM anon, authenticated, service_role, PUBLIC;
CREATE POLICY "farm_users_can_view_clients" ON "public"."clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_insert_clients" ON "public"."clients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_update_clients" ON "public"."clients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((farm_id = current_user_farm_id())) WITH CHECK ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_view_authorizations" ON "public"."authorizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_insert_authorizations" ON "public"."authorizations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_update_authorizations" ON "public"."authorizations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((farm_id = current_user_farm_id())) WITH CHECK ((farm_id = current_user_farm_id()));
CREATE POLICY "farm_users_can_view_documents" ON "public"."documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((authorization_id IN ( SELECT authorizations.id
   FROM authorizations
  WHERE (authorizations.farm_id = current_user_farm_id()))));
CREATE POLICY "farm_users_can_insert_documents" ON "public"."documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((authorization_id IN ( SELECT authorizations.id
   FROM authorizations
  WHERE (authorizations.farm_id = current_user_farm_id()))));
CREATE POLICY "farm_users_can_update_documents" ON "public"."documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((authorization_id IN ( SELECT authorizations.id
   FROM authorizations
  WHERE (authorizations.farm_id = current_user_farm_id())))) WITH CHECK ((authorization_id IN ( SELECT authorizations.id
   FROM authorizations
  WHERE (authorizations.farm_id = current_user_farm_id()))));
CREATE POLICY "farm_users_can_view_document_versions" ON "public"."document_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((document_id IN ( SELECT d.id
   FROM (documents d
     JOIN authorizations a ON ((a.id = d.authorization_id)))
  WHERE (a.farm_id = current_user_farm_id()))));
CREATE POLICY "farm_users_can_insert_document_versions" ON "public"."document_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((document_id IN ( SELECT d.id
   FROM (documents d
     JOIN authorizations a ON ((a.id = d.authorization_id)))
  WHERE (a.farm_id = current_user_farm_id()))));
CREATE POLICY "RBK admins can view admin records" ON "public"."rbk_admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "autorizacoes_update_farm" ON "public"."autorizacoes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (rbk_private.can_write_farm(farm_id)) WITH CHECK (rbk_private.can_write_farm(farm_id));
CREATE POLICY "autorizacoes_delete_farm" ON "public"."autorizacoes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (rbk_private.can_write_farm(farm_id));
CREATE POLICY "documentos_read_farm" ON "public"."documentos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE ((a.id = documentos.autorizacao_id) AND rbk_private.equipe_operacional(a.farm_id)))));
CREATE POLICY "documentos_insert_farm" ON "public"."documentos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE ((a.id = documentos.autorizacao_id) AND rbk_private.can_write_farm(a.farm_id)))));
CREATE POLICY "aud_read" ON "public"."aud_audits" AS PERMISSIVE FOR SELECT TO "authenticated" USING (aud_private.can_manage(id));
CREATE POLICY "aud_read" ON "public"."aud_batches" AS PERMISSIVE FOR SELECT TO "authenticated" USING (aud_private.can_manage(audit_id));
CREATE POLICY "aud_read" ON "public"."aud_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (aud_private.can_manage(audit_id));
CREATE POLICY "aud_read" ON "public"."aud_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (aud_private.can_manage(audit_id));
CREATE POLICY "aud_read" ON "public"."aud_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (aud_private.can_manage(audit_id));
CREATE POLICY "aud_storage_no_browser" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon","authenticated" USING ((bucket_id <> 'auditoria-private'::text)) WITH CHECK ((bucket_id <> 'auditoria-private'::text));
CREATE POLICY "dispensacao_itens_leitura" ON "public"."dispensacao_itens" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE (a.id = dispensacao_itens.autorizacao_id))));
CREATE POLICY "compras_leitura" ON "public"."compras_estoque" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.can_access_farm(farm_id));
CREATE POLICY "modulos_documentos_farmacia" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'documentos'::text) AND rbk_private.modulos_pode_baixar(name)));
CREATE POLICY "autorizacoes_read_farm" ON "public"."autorizacoes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.equipe_operacional(farm_id));
CREATE POLICY "autorizacoes_insert_farm" ON "public"."autorizacoes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((rbk_private.can_write_farm(farm_id) AND (user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "documentos_update_farm" ON "public"."documentos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE ((a.id = documentos.autorizacao_id) AND rbk_private.can_write_farm(a.farm_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE ((a.id = documentos.autorizacao_id) AND rbk_private.can_write_farm(a.farm_id)))));
CREATE POLICY "documentos_delete_farm" ON "public"."documentos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM autorizacoes a
  WHERE ((a.id = documentos.autorizacao_id) AND rbk_private.can_write_farm(a.farm_id)))));
CREATE POLICY "farms_read_scope" ON "public"."farms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.equipe_operacional(id));
CREATE POLICY "users_read_scope" ON "public"."users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id = ( SELECT auth.uid() AS uid)) OR (rbk_private.actor_role() = 'superadmin_rbk'::text) OR ((rbk_private.actor_role() = 'gestor_rbk'::text) AND rbk_private.equipe_operacional(farm_id)) OR ((rbk_private.actor_role() = 'administrador_farmacia'::text) AND (farm_id = rbk_private.actor_farm_id()))));
CREATE POLICY "documentos_storage_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'documentos'::text) AND rbk_private.equipe_operacional(rbk_private.storage_path_farm(name))));
CREATE POLICY "documentos_storage_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'documentos'::text) AND (split_part(name, '/'::text, 1) = (( SELECT auth.uid() AS uid))::text) AND rbk_private.can_write_farm(rbk_private.storage_path_farm(name))));
CREATE POLICY "documentos_storage_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'documentos'::text) AND rbk_private.can_write_farm(rbk_private.storage_path_farm(name)))) WITH CHECK (((bucket_id = 'documentos'::text) AND rbk_private.can_write_farm(rbk_private.storage_path_farm(name))));
CREATE POLICY "documentos_storage_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'documentos'::text) AND rbk_private.can_write_farm(rbk_private.storage_path_farm(name))));
CREATE POLICY "equipe_audit_read" ON "public"."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((rbk_private.actor_role() = 'administrador_farmacia'::text) AND (farm_id = rbk_private.actor_farm_id())));
CREATE POLICY "proximas_contatos_escopo" ON "public"."proximas_contatos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.equipe_operacional(farmacia_id));
CREATE POLICY "proximas_previsoes_escopo" ON "public"."proximas_previsoes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.equipe_operacional(farmacia_id));
CREATE POLICY "proximas_eventos_escopo" ON "public"."proximas_eventos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (rbk_private.equipe_operacional(farmacia_id));
REVOKE ALL ON FUNCTION public.is_rbk_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_rbk_admin() TO "postgres";
GRANT EXECUTE ON FUNCTION public.is_rbk_admin() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.is_rbk_admin() TO "service_role";
REVOKE ALL ON FUNCTION public.aud_manager(op text, aid uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_manager(op text, aid uuid, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_manager(op text, aid uuid, payload jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.aud_manager(op text, aid uuid, payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION public.current_user_farm_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_farm_id() TO "postgres";
GRANT EXECUTE ON FUNCTION public.current_user_farm_id() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.current_user_farm_id() TO "service_role";
REVOKE ALL ON FUNCTION public.proximas_contexto(p_busca text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proximas_contexto(p_busca text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.proximas_contexto(p_busca text) TO "service_role";
GRANT EXECUTE ON FUNCTION public.proximas_contexto(p_busca text) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_sincronizar(p_item uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_sincronizar(p_item uuid) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.can_write_farm(target_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.can_write_farm(target_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.can_write_farm(target_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.actor_role() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.actor_role() TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.actor_role() TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.actor_farm_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.actor_farm_id() TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.actor_farm_id() TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.can_access_farm(target_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.can_access_farm(target_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.can_access_farm(target_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION aud_private.summary(aid uuid, internal boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.summary(aid uuid, internal boolean) TO "postgres";
REVOKE ALL ON FUNCTION aud_private.portal(h text, op text, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.portal(h text, op text, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.portal(h text, op text, payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION public.aud_portal(h text, op text, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_portal(h text, op text, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_portal(h text, op text, payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION aud_private.rate(k text, lim integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.rate(k text, lim integer) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.rate(k text, lim integer) TO "service_role";
REVOKE ALL ON FUNCTION public.aud_rate(k text, lim integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_rate(k text, lim integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_rate(k text, lim integer) TO "service_role";
REVOKE ALL ON FUNCTION aud_private.scan_result(fid uuid, result text, sha text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.scan_result(fid uuid, result text, sha text) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.scan_result(fid uuid, result text, sha text) TO "service_role";
REVOKE ALL ON FUNCTION public.aud_scan_result(fid uuid, result text, sha text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_scan_result(fid uuid, result text, sha text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_scan_result(fid uuid, result text, sha text) TO "service_role";
REVOKE ALL ON FUNCTION aud_private.register_pharmacy_audit(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.register_pharmacy_audit(payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.register_pharmacy_audit(payload jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION aud_private.save_contact(aid uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.save_contact(aid uuid, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.save_contact(aid uuid, payload jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.aud_contact(aid uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_contact(aid uuid, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_contact(aid uuid, payload jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.aud_contact(aid uuid, payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION public.aud_register_pharmacy(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_register_pharmacy(payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_register_pharmacy(payload jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.aud_register_pharmacy(payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.modulos_validar(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_validar(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_validar(p_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.modulos_farmacias(p_busca text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_farmacias(p_busca text) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_farmacias(p_busca text) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.modulos_autorizacoes(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_autorizacoes(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_autorizacoes(p_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.modulos_itens(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_itens(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_itens(p_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION aud_private.confirm_audit(aid uuid, hash text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.confirm_audit(aid uuid, hash text) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.confirm_audit(aid uuid, hash text) TO "authenticated";
REVOKE ALL ON FUNCTION public.aud_confirm(aid uuid, hash text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aud_confirm(aid uuid, hash text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.aud_confirm(aid uuid, hash text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.aud_confirm(aid uuid, hash text) TO "service_role";
REVOKE ALL ON FUNCTION aud_private.can_manage(aid uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.can_manage(aid uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.can_manage(aid uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.modulos_farmacias(p_busca text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modulos_farmacias(p_busca text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modulos_farmacias(p_busca text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.modulos_farmacias(p_busca text) TO "service_role";
REVOKE ALL ON FUNCTION public.modulos_autorizacoes(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modulos_autorizacoes(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modulos_autorizacoes(p_farm uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.modulos_autorizacoes(p_farm uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.modulos_itens(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modulos_itens(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modulos_itens(p_farm uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.modulos_itens(p_farm uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.modulos_documentos(p_farm uuid, p_autorizacao uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_documentos(p_farm uuid, p_autorizacao uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_documentos(p_farm uuid, p_autorizacao uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.modulos_pode_baixar(p_caminho text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.modulos_pode_baixar(p_caminho text) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.modulos_pode_baixar(p_caminho text) TO "authenticated";
REVOKE ALL ON FUNCTION public.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) TO "service_role";
REVOKE ALL ON FUNCTION public.compras_obter(p_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compras_obter(p_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.compras_obter(p_farm uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.compras_obter(p_farm uuid) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.validar_item_dispensacao() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.validar_item_dispensacao() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.invalidar_itens_cupom() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.invalidar_itens_cupom() TO "postgres";
REVOKE ALL ON FUNCTION public.usuarios_acessos(p_actor uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.usuarios_acessos(p_actor uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.usuarios_acessos(p_actor uuid) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.usuarios_acessos(p_actor uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.usuarios_acessos(p_actor uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.usuarios_acessos(p_actor uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.cre_command(op text, actor uuid, h text, pid uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cre_command(op text, actor uuid, h text, pid uuid, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.cre_command(op text, actor uuid, h text, pid uuid, payload jsonb) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.deletion_row_blocked(r jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.deletion_row_blocked(r jsonb) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.deletion_guard() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.deletion_guard() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) TO "service_role";
REVOKE ALL ON FUNCTION public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean) TO "service_role";
REVOKE ALL ON FUNCTION public.cre_associate_farm() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cre_associate_farm() TO "postgres";
GRANT EXECUTE ON FUNCTION public.cre_associate_farm() TO "service_role";
REVOKE ALL ON FUNCTION public.cre_associate_new_farm() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cre_associate_new_farm() TO "postgres";
GRANT EXECUTE ON FUNCTION public.cre_associate_new_farm() TO "service_role";
REVOKE ALL ON FUNCTION aud_private.manager(op text, aid uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.manager(op text, aid uuid, payload jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION aud_private.manager(op text, aid uuid, payload jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.equipe_operacional(target_farm uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.equipe_operacional(target_farm uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.equipe_operacional(target_farm uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.storage_path_farm(path text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.storage_path_farm(path text) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.storage_path_farm(path text) TO "authenticated";
REVOKE ALL ON FUNCTION public.equipe_registrar_convite(p_actor uuid, p_id uuid, p_nome text, p_email text, p_perfil text, p_status text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equipe_registrar_convite(p_actor uuid, p_id uuid, p_nome text, p_email text, p_perfil text, p_status text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.equipe_registrar_convite(p_actor uuid, p_id uuid, p_nome text, p_email text, p_perfil text, p_status text) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.equipe_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.equipe_admin() TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.equipe_admin() TO "authenticated";
REVOKE ALL ON FUNCTION public.equipe_listar() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equipe_listar() TO "postgres";
GRANT EXECUTE ON FUNCTION public.equipe_listar() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.equipe_listar() TO "service_role";
REVOKE ALL ON FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text) TO "service_role";
REVOKE ALL ON FUNCTION rbk_private.equipe_audit() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.equipe_audit() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.equipe_document_guard() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.equipe_document_guard() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.proximas_autorizacao_trigger() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_autorizacao_trigger() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.proximas_contexto(p_busca text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_contexto(p_busca text) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.proximas_contexto(p_busca text) TO "authenticated";
REVOKE ALL ON FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) TO "postgres";
GRANT EXECUTE ON FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) TO "service_role";
GRANT EXECUTE ON FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_evento(p proximas_previsoes, p_acao text, p_detalhes jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_evento(p proximas_previsoes, p_acao text, p_detalhes jsonb) TO "postgres";
REVOKE ALL ON FUNCTION public.proximas_historico(p_farm uuid, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proximas_historico(p_farm uuid, p_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.proximas_historico(p_farm uuid, p_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.proximas_historico(p_farm uuid, p_id uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_historico(p_farm uuid, p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_historico(p_farm uuid, p_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.proximas_historico(p_farm uuid, p_id uuid) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_item_trigger() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_item_trigger() TO "postgres";
REVOKE ALL ON FUNCTION public.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) TO "service_role";
GRANT EXECUTE ON FUNCTION public.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) TO "authenticated";
REVOKE ALL ON FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) TO "service_role";
GRANT EXECUTE ON FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_validar(p_farm uuid, p_escrita boolean, p_compras boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_validar(p_farm uuid, p_escrita boolean, p_compras boolean) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.pfpb_validar_identidade() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.pfpb_validar_identidade() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.pfpb_resolver(i dispensacao_itens) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.pfpb_resolver(i dispensacao_itens) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.pfpb_normalizar(p text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.pfpb_normalizar(p text) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.pfpb_versao_imutavel() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.pfpb_versao_imutavel() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.pfpb_vigencia_unica() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.pfpb_vigencia_unica() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION aud_private.log_credential_scan() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION aud_private.log_credential_scan() TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.gestao_acesso(p_cliente uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.gestao_acesso(p_cliente uuid) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.gestao_vencimento(p_mes date, p_dia integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.gestao_vencimento(p_mes date, p_dia integer) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.gestao_gerar(p_contrato uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.gestao_gerar(p_contrato uuid) TO "postgres";
REVOKE ALL ON FUNCTION rbk_private.gestao_dispatch(p_action text, p_data jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.gestao_dispatch(p_action text, p_data jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION rbk_private.gestao_dispatch(p_action text, p_data jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION rbk_private.gestao_cobrancas(p_contrato uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rbk_private.gestao_cobrancas(p_contrato uuid) TO "postgres";
REVOKE ALL ON FUNCTION public.gestao_rbk(p_action text, p_data jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gestao_rbk(p_action text, p_data jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.gestao_rbk(p_action text, p_data jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.gestao_rbk(p_action text, p_data jsonb) TO "service_role";
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('documentos','documentos',false,NULL,NULL);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('email-assets','email-assets',false,NULL,NULL);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('auditoria-private','auditoria-private',false,104857600,ARRAY['application/pdf','text/html','image/jpeg','image/png','image/tiff']::text[]);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('credenciamento-private','credenciamento-private',false,26214400,ARRAY['application/pdf','image/png','image/jpeg']::text[]);
REVOKE EXECUTE ON FUNCTION public.is_rbk_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_manager(op text, aid uuid, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_farm_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proximas_contexto(p_busca text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_sincronizar(p_item uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.can_write_farm(target_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.actor_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.actor_farm_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.can_access_farm(target_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.summary(aid uuid, internal boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.portal(h text, op text, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_portal(h text, op text, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.rate(k text, lim integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_rate(k text, lim integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.scan_result(fid uuid, result text, sha text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_scan_result(fid uuid, result text, sha text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.register_pharmacy_audit(payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.save_contact(aid uuid, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_contact(aid uuid, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_register_pharmacy(payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_validar(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_farmacias(p_busca text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_autorizacoes(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_itens(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.confirm_audit(aid uuid, hash text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aud_confirm(aid uuid, hash text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.can_manage(aid uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modulos_farmacias(p_busca text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modulos_autorizacoes(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modulos_itens(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modulos_documentos(p_farm uuid, p_autorizacao uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_documentos(p_farm uuid, p_autorizacao uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.modulos_pode_baixar(p_caminho text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compras_obter(p_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.validar_item_dispensacao() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.invalidar_itens_cupom() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.usuarios_acessos(p_actor uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.usuarios_acessos(p_actor uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compras_importar(p_farm uuid, p_data date, p_arquivo text, p_itens jsonb, p_versao uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cre_command(op text, actor uuid, h text, pid uuid, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.deletion_row_blocked(r jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.deletion_guard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.farmacia_exclusao(p_actor uuid, p_farm uuid, p_action text, p_cnpj text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cre_associate_farm() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cre_associate_new_farm() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.manager(op text, aid uuid, payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.equipe_operacional(target_farm uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.set_authorization_farm() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.storage_path_farm(path text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipe_registrar_convite(p_actor uuid, p_id uuid, p_nome text, p_email text, p_perfil text, p_status text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.equipe_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipe_listar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipe_salvar(p_id uuid, p_nome text, p_perfil text, p_status text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.equipe_audit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.equipe_document_guard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_autorizacao_trigger() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_contexto(p_busca text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_demanda(p_farm uuid, p_inicio date, p_fim date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_evento(p proximas_previsoes, p_acao text, p_detalhes jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proximas_historico(p_farm uuid, p_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_historico(p_farm uuid, p_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_item_trigger() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_validar(p_farm uuid, p_escrita boolean, p_compras boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.pfpb_validar_identidade() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.pfpb_resolver(i dispensacao_itens) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.pfpb_normalizar(p text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.pfpb_versao_imutavel() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.pfpb_vigencia_unica() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_listar(p_farm uuid, p_inicio date, p_fim date, p_filtro text, p_pagina integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.proximas_salvar(p_farm uuid, p_id uuid, p_versao integer, p_dados jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION aud_private.log_credential_scan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.gestao_acesso(p_cliente uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.gestao_vencimento(p_mes date, p_dia integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.gestao_gerar(p_contrato uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.gestao_dispatch(p_action text, p_data jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rbk_private.gestao_cobrancas(p_contrato uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gestao_rbk(p_action text, p_data jsonb) FROM PUBLIC, anon;
COMMIT;
