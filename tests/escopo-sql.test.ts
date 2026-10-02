import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
it('isola consultas por farmácia e recusa troca, ausência de seleção e IDs cruzados',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated; create role anon; create schema auth; create schema rbk_private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create table users(id uuid, farm_id uuid, perfil text,status text);
 create table farms(id uuid,nome_fantasia text,razao_social text,cnpj text,status text);
 create table autorizacoes(id uuid,user_id uuid,numero_autorizacao text);
 create table dispensacao_itens(id uuid,autorizacao_id uuid);
 create table documentos(id uuid,autorizacao_id uuid,caminho_arquivo text);
 create table rbk_manager_farms(manager_user_id uuid,farm_id uuid);
 create function rbk_private.actor_role() returns text language sql security definer as $$select perfil from public.users where id=auth.uid() and status='active'$$;
 create function rbk_private.can_access_farm(f uuid) returns boolean language sql security definer as $$select exists(select 1 from public.farms where id=f and status='active') and exists(select 1 from public.users where id=auth.uid() and status='active' and (perfil='superadmin_rbk' or (perfil='gestor_rbk' and exists(select 1 from public.rbk_manager_farms where manager_user_id=auth.uid() and farm_id=f)) or (perfil in ('operador','administrador_farmacia') and farm_id=f)))$$;
 insert into farms values('${a}','Alfa','Alfa Ltda','12345678000190','active'),('${b}','Beta','Beta Ltda','98765432000100','active');
 insert into users values('20000000-0000-4000-8000-000000000001','${a}','operador','active'),('20000000-0000-4000-8000-000000000002','${b}','operador','active'),('20000000-0000-4000-8000-000000000003',null,'gestor_rbk','active'),('20000000-0000-4000-8000-000000000004',null,'superadmin_rbk','active');
 insert into rbk_manager_farms values('20000000-0000-4000-8000-000000000003','${a}');
 insert into autorizacoes values('${a}','20000000-0000-4000-8000-000000000001','A'),('${b}','20000000-0000-4000-8000-000000000002','B');
 insert into dispensacao_itens values('${a}','${a}'),('${b}','${b}');
 insert into documentos values('${a}','${a}','a.pdf'),('${b}','${b}','b.pdf');`);
 await db.exec(readFileSync('supabase/modulos-escopo.sql','utf8'));
 const login=async(n:number)=>{await db.exec(`reset role;select set_config('app.uid','20000000-0000-4000-8000-00000000000${n}',false);set role authenticated;`);};
 await login(1);
 expect((await db.query(`select id from modulos_autorizacoes('${a}')`)).rows).toEqual([{id:a}]);
 await expect(db.query(`select * from modulos_autorizacoes('${b}')`)).rejects.toThrow(/acesso/i);
 await expect(db.query(`select * from modulos_autorizacoes(null)`)).rejects.toThrow(/selecione/i);
 expect((await db.query(`select * from modulos_documentos('${a}','${b}')`)).rows).toEqual([]);
 expect((await db.query(`select id from modulos_itens('${a}')`)).rows).toEqual([{id:a}]);
 await login(3);
 expect((await db.query(`select id from modulos_farmacias('12.345.678/0001-90')`)).rows).toEqual([{id:a}]);
 expect((await db.query(`select id from modulos_farmacias('beta')`)).rows).toEqual([]);
 await expect(db.query(`select * from modulos_autorizacoes('${b}')`)).rejects.toThrow(/acesso/i);
 await login(4);
 expect((await db.query(`select id from modulos_autorizacoes('${b}')`)).rows).toEqual([{id:b}]);
 await db.exec(`reset role;update users set status='inactive' where id=auth.uid();set role authenticated;`);
 await expect(db.query(`select * from modulos_autorizacoes('${b}')`)).rejects.toThrow(/acesso/i);
 await db.exec('reset role;set role anon;');
 await expect(db.query(`select * from modulos_autorizacoes('${a}')`)).rejects.toThrow(/permission denied/i);
 }finally{await db.close();}
},20000);
it('RLS do Storage permite somente anexos vinculados a farmácias autorizadas',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create schema rbk_private;create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create function rbk_private.can_access_farm(f uuid) returns boolean language sql as $$select f=auth.uid()$$;
 create table public.users(id uuid,farm_id uuid);create table public.autorizacoes(id uuid,user_id uuid);create table public.documentos(id uuid,autorizacao_id uuid,caminho_arquivo text);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage,rbk_private to authenticated;grant select on storage.objects to authenticated;
 insert into users values('${a}','${a}'),('${b}','${b}');insert into autorizacoes values('${a}','${a}'),('${b}','${b}');insert into documentos values('${a}','${a}','a.pdf'),('${b}','${b}','b.pdf');insert into storage.objects values('documentos','a.pdf'),('documentos','b.pdf'),('documentos','orphan.pdf'),('outro','a.pdf');`);
 await db.exec(readFileSync('supabase/modulos-storage.sql','utf8'));
 await db.exec(`select set_config('app.uid','${a}',false);set role authenticated;`);
 expect((await db.query('select name from storage.objects')).rows).toEqual([{name:'a.pdf'}]);
 }finally{await db.close();}
});
