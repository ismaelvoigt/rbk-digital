import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export const farmA='10000000-0000-4000-8000-000000000001', farmB='10000000-0000-4000-8000-000000000002';
export const admin='20000000-0000-4000-8000-000000000001', operador='20000000-0000-4000-8000-000000000002', gestor='20000000-0000-4000-8000-000000000003', outro='20000000-0000-4000-8000-000000000004';
export const itemA='30000000-0000-4000-8000-000000000001',itemB='30000000-0000-4000-8000-000000000002';
export async function login(db:PGlite,id=operador){await db.exec(`reset role;select set_config('app.uid','${id}',false);set role authenticated`);}
export async function rpc<T=any>(db:PGlite,name:string,args:unknown[]=[]):Promise<T>{
 if(!/^proximas_[a-z_]+$/.test(name))throw new Error('RPC inválida');
 const r=await db.query<{value:T}>(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,args);
 return r.rows[0].value;
}
export async function createDatabase(initializeModule=true){
 const db=new PGlite();
 await db.exec(readFileSync('tests/fixtures/exclusao-schema.sql','utf8'));
 await db.exec(`alter table auth.users add column email text;create table cupom_extracoes(documento_id uuid);create schema rbk_private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 alter table autorizacoes add primary key(id);alter table autorizacoes alter column id set default gen_random_uuid();
 alter table documentos add primary key(id);alter table documentos add foreign key(autorizacao_id) references autorizacoes(id) on delete cascade;
 alter table audit_logs alter column id set default gen_random_uuid();alter table audit_logs alter column created_at set default now();
 grant usage on schema auth,storage,rbk_private to authenticated;
 alter table autorizacoes enable row level security;alter table documentos enable row level security;alter table users enable row level security;
 insert into farms(id,cnpj,nome_fantasia,status)values('${farmA}','11111111000111','Farmácia Alfa (teste)','active'),('${farmB}','22222222000122','Farmácia Beta (teste)','active');
 insert into auth.users(id)values('${admin}'),('${operador}'),('${gestor}'),('${outro}');
 insert into users(id,farm_id,nome,email,perfil,status)values('${admin}','${farmA}','Ana Administradora','ana@example.invalid','farmacia','active'),('${operador}','${farmA}','Carlos Atendente','carlos@example.invalid','operador','active'),('${gestor}',null,'Gestor Teste','gestor@example.invalid','gestor_rbk','active'),('${outro}','${farmB}','Outro Admin','outro@example.invalid','farmacia','active');
 insert into rbk_manager_farms(manager_user_id,farm_id) values('${gestor}','${farmA}');`);
 await db.exec(readFileSync('supabase/migrations/20260927011830_equipe_farmacia.sql','utf8'));
 await db.exec('drop table dispensacao_itens');
 await db.exec(readFileSync('supabase/vendas-schema.sql','utf8'));
 if(initializeModule)await db.exec(readFileSync('supabase/proximas-dispensacoes.sql','utf8'));
 for(const [farm,user,item,cpf] of [[farmA,admin,itemA,'11122233344'],[farmB,outro,itemB,'55566677788']]){
 await db.exec(`select set_config('app.uid','${user}',false);
 insert into autorizacoes(id,user_id,cpf_cliente,data_autorizacao)values('${farm}','${user}','${cpf}',current_date);
 insert into documentos(id,autorizacao_id,categoria,caminho_arquivo)values('${farm}','${farm}','cupom_fiscal','${user}/cupom.pdf');
 insert into dispensacao_itens(id,autorizacao_id,documento_id,posicao,produto,ean,unidade,quantidade,data_dispensacao,status,origens)
 values('${item}','${farm}','${farm}',1,'Losartana 50 mg','7891234567895','comprimido',30,(now() at time zone 'America/Sao_Paulo')::date-20,'confirmado',
 '{"produto":"cupom conferido","ean":"cupom conferido","unidade":"cupom conferido","quantidade":"cupom conferido","data_dispensacao":"cupom conferido"}');`);
 }
 await login(db);return db;
}
