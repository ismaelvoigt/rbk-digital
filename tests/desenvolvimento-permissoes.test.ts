import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,farmA,rpc} from './fixtures/proximas-db';

let db:PGlite;
beforeAll(async()=>{
 db=await createDatabase();
 await db.exec('reset role; create table rbk_private.revisao_privada(id uuid); revoke usage on schema rbk_private from authenticated; set role authenticated');
 await db.exec('reset role');
 const baseline=readFileSync('supabase/desenvolvimento-estrutura-restrita.sql','utf8');
 for(const name of ['aud_private.manager','public.aud_manager']){
  const definition=baseline.match(new RegExp(`CREATE OR REPLACE FUNCTION ${name.replace('.','\\.')}\\([\\s\\S]*?\\$function\\$;`))?.[0];
  if(!definition)throw new Error(`Função ausente: ${name}`);
  await db.exec(definition);
  await db.exec(`revoke all on function ${name}(text,uuid,jsonb) from public; grant execute on function ${name}(text,uuid,jsonb) to authenticated`);
 }
 await db.exec('set role authenticated');
},30000);
afterAll(async()=>{await db?.close();});
it('recupera a RPC sem abrir schemas ou tabelas privadas ao acesso anônimo',async()=>{
 await expect(rpc(db,'proximas_listar',[farmA,null,null,'nao_calculado',0])).rejects.toThrow(/permission denied for schema rbk_private/);
 await expect(db.query("select public.aud_manager('list')")).rejects.toThrow(/permission denied for schema aud_private/);
 await db.exec('reset role');
 await db.exec(readFileSync('supabase/desenvolvimento-schema-usage.sql','utf8'));
 await db.exec('set role authenticated');
 expect((await rpc(db,'proximas_listar',[farmA,null,null,'nao_calculado',0])).total).toBe(1);
 await expect(db.query("select public.aud_manager('list')")).rejects.toThrow(/Acesso negado/);
 await expect(db.query('select * from rbk_private.revisao_privada')).rejects.toThrow(/permission/);
 await expect(db.query('select * from aud_private.links')).rejects.toThrow(/permission/);
 await db.exec('reset role;set role anon');
 await expect(rpc(db,'proximas_listar',[farmA,null,null,'nao_calculado',0])).rejects.toThrow(/permission/);
 await db.exec('reset role');
 const result=await db.query<{authenticated_aud:boolean;anon_rbk:boolean;anon_aud:boolean;service_rbk:boolean;service_aud:boolean}>(`select
 has_schema_privilege('authenticated','aud_private','USAGE') authenticated_aud,
 has_schema_privilege('anon','rbk_private','USAGE') anon_rbk,
 has_schema_privilege('anon','aud_private','USAGE') anon_aud,
 has_schema_privilege('service_role','rbk_private','USAGE') service_rbk,
 has_schema_privilege('service_role','aud_private','USAGE') service_aud`);
 expect(result.rows[0]).toEqual({authenticated_aud:true,anon_rbk:false,anon_aud:false,service_rbk:true,service_aud:true});
});
