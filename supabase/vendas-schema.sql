-- Estrutura mínima de itens canônicos de dispensação. Não extrai nem preenche cupons antigos.
-- Executar uma vez no ambiente escolhido. Compatível com RLS legado e por farm_id.
begin;
create table public.dispensacao_itens (
 id uuid primary key default gen_random_uuid(),
 autorizacao_id uuid not null references public.autorizacoes(id) on delete cascade,
 documento_id uuid not null references public.documentos(id) on delete cascade,
 posicao integer not null check (posicao>0),
 produto text check (produto is null or length(btrim(produto))>0),
 ean text check (ean is null or ean ~ '^([0-9]{8}|[0-9]{12,14})$'),
 unidade text,
 quantidade numeric(15,3) check (quantidade>=0 and quantidade<1000000000000),
 valor_unitario numeric(15,4) check (valor_unitario>=0 and valor_unitario<100000000000),
 valor_total numeric(15,2) check (valor_total>=0 and valor_total<10000000000000),
 valor_pfpb numeric(15,2) check (valor_pfpb>=0 and valor_pfpb<10000000000000),
 principio_ativo text,
 indicacao text,
 data_dispensacao date,
 status text not null default 'pendente' check (status in ('pendente','confirmado','cancelado')),
 origens jsonb not null default '{}' check (jsonb_typeof(origens)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(autorizacao_id,posicao)
);
create index dispensacao_itens_documento_idx on public.dispensacao_itens(documento_id);
create schema if not exists rbk_private;
create or replace function rbk_private.validar_item_dispensacao() returns trigger
language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function rbk_private.validar_item_dispensacao() from public;
create trigger validar_item_dispensacao before insert or update on public.dispensacao_itens for each row execute function rbk_private.validar_item_dispensacao();
alter table public.dispensacao_itens enable row level security;
revoke all on public.dispensacao_itens from public,anon,authenticated;
grant select on public.dispensacao_itens to authenticated;
grant select,insert,update,delete on public.dispensacao_itens to service_role;
create policy dispensacao_itens_leitura on public.dispensacao_itens for select to authenticated
 using (exists(select 1 from public.autorizacoes a where a.id=dispensacao_itens.autorizacao_id));
comment on table public.dispensacao_itens is 'Uma linha canônica por item da autorização, reconciliada entre cupom fiscal e vinculado; nunca importar ambos em duplicidade. Somente confirmados entram no painel. Escrita reservada à integração no servidor.';
comment on column public.dispensacao_itens.posicao is 'Posição canônica na autorização; chave para upsert idempotente, não reiniciar a numeração para cada tipo de cupom.';
comment on column public.dispensacao_itens.origens is 'Mapa campo -> referência real: documento/linha ou cadastro/versão/campo. Obrigatório para cada campo não nulo. Não inferir informações ausentes.';
comment on column public.dispensacao_itens.valor_total is 'Total líquido do item identificado no cupom, em BRL. Não derivar silenciosamente de quantidade vezes preço.';
comment on column public.dispensacao_itens.valor_pfpb is 'Valor do item explicitamente identificado como devido pelo PFPB na fonte; null quando ausente. Não equivale a pagamento recebido nem ao preço de venda.';
comment on column public.dispensacao_itens.data_dispensacao is 'Data expressa no cupom, se disponível. Filtros do módulo usam data_autorizacao para incluir registros ainda sem extração.';
-- Trocar o arquivo de um cupom invalida a extração anterior imediatamente.
-- Definer estritamente para invalidar itens a partir de uma edição de documento
-- já autorizada pelo RLS de documentos; nenhuma função pública de escrita.
create or replace function rbk_private.invalidar_itens_cupom() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.dispensacao_itens set status='pendente'
 where documento_id=new.id and status='confirmado';
 return new;
end $$;
revoke all on function rbk_private.invalidar_itens_cupom() from public,anon,authenticated;
create trigger invalidar_itens_cupom after update of caminho_arquivo,categoria,autorizacao_id on public.documentos
 for each row when (old.caminho_arquivo is distinct from new.caminho_arquivo or old.categoria is distinct from new.categoria or old.autorizacao_id is distinct from new.autorizacao_id)
 execute function rbk_private.invalidar_itens_cupom();
commit;
