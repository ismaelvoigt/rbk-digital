import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
const farm='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const actor='20000000-0000-4000-8000-000000000001',user='20000000-0000-4000-8000-000000000002',user2='20000000-0000-4000-8000-000000000003';
async function setup(){const db=new PGlite();await db.exec(readFileSync('tests/fixtures/exclusao-schema.sql','utf8'));await db.exec(readFileSync('tests/fixtures/exclusao-fks.sql','utf8'));await db.exec(`
insert into auth.users(id) values('${actor}'),('${user}'),('${user2}');
insert into farms(id,cnpj,razao_social,status) values('${farm}','12345678000190','Alfa','active'),('${other}','98765432000100','Beta','active');
insert into users(id,farm_id,perfil,status) values('${actor}','${other}','farmacia','active'),('${user}','${farm}','farmacia','active'),('${user2}','${farm}','operador','active');
insert into rbk_admins(user_id,ativo) values('${actor}',true);
insert into autorizacoes(id,user_id) values('${farm}','${user}'),('${other}','${actor}');
insert into documentos(id,autorizacao_id,caminho_arquivo) values('${farm}','${farm}','${user}/doc.pdf'),('${other}','${other}','${actor}/other.pdf');
insert into storage.objects(bucket_id,name,owner_id) values('documentos','${user}/doc.pdf','${user}'),('documentos','${actor}/other.pdf','${actor}');`);await db.exec(readFileSync('supabase/farmacia-exclusao.sql','utf8'));return db;}
async function run(db:PGlite,action='preview',cnpj='12345678000190',who=actor,target=farm){const r=await db.query<{r:Record<string,unknown>}>(`select public.farmacia_exclusao($1::uuid,$2::uuid,$3,$4) r`,[who,target,action,cnpj]);return r.rows[0].r;}
it('aplica OU real, todos os logins, permissão administrativa e CNPJ confirmado',async()=>{const db=await setup();try{
expect(await run(db)).toMatchObject({eligible:true,never_accessed:true,documents:1});
await db.exec(`update auth.users set last_sign_in_at=now() where id='${user2}'`);
expect(await run(db)).toMatchObject({eligible:false,never_accessed:false});
await expect(run(db,'prepare')).rejects.toThrow(/acessou.*documentos/i);
await expect(run(db,'preview','',user)).rejects.toThrow(/restrito/i);
await expect(run(db,'prepare','00000000000000')).rejects.toThrow(/CNPJ/i);
await db.exec(`delete from storage.objects where owner_id='${user}';update documentos set caminho_arquivo=null where id='${farm}'`);
expect(await run(db)).toMatchObject({eligible:true,never_accessed:false,documents:0});
await expect(run(db,'prepare','98765432000100',actor,other)).rejects.toThrow(/administrativ|própri/i);
await db.exec('set role authenticated');await expect(run(db)).rejects.toThrow(/permission denied/i);
}finally{await db.close();}},20000);
it('congela alvo, exige remover Storage antes de finalizar, retoma e preserva outra farmácia',async()=>{const db=await setup();try{
const prepared=await run(db,'prepare');expect(prepared).toMatchObject({pending:true,documents:1});
expect(await run(db,'finish')).toMatchObject({pending:true});
await expect(db.exec(`insert into storage.objects(bucket_id,name) values('documentos','${user}/new.pdf')`)).rejects.toThrow(/exclusão/i);
await expect(db.exec(`update users set farm_id='${other}' where id='${user}'`)).rejects.toThrow(/exclusão/i);
await expect(db.exec(`insert into autorizacoes(id,user_id) values(gen_random_uuid(),'${user}')`)).rejects.toThrow(/exclusão/i);
await expect(db.exec(`update auth.users set last_sign_in_at=now() where id='${user}'`)).rejects.toThrow(/exclusão/i);
expect(await run(db,'prepare')).toMatchObject({pending:true});
// Simulates a successful Storage API removal, in the isolated test database only.
await db.exec(`delete from storage.objects where owner_id='${user}'`);
expect(await run(db,'finish')).toMatchObject({completed:true});
expect((await db.query('select id from farms')).rows).toEqual([{id:other}]);
expect((await db.query('select id from auth.users')).rows).toEqual([{id:actor}]);
expect((await db.query('select id from documentos')).rows).toEqual([{id:other}]);
expect(await run(db,'prepare')).toMatchObject({completed:true});
await expect(db.exec(`insert into storage.objects(bucket_id,name) values('documentos','${user}/stale-token.pdf')`)).rejects.toThrow(/exclusão/i);
}finally{await db.close();}},20000);
it('recusa referências cruzadas antes de apagar e impede anexar arquivos congelados em outro cadastro',async()=>{const db=await setup();try{
await db.exec(`insert into authorizations(id,farm_id) values('${other}','${other}');insert into documents(id,authorization_id) values('${other}','${other}');insert into document_versions(id,document_id,uploaded_by,storage_path) values('${other}','${other}','${user}','elsewhere.pdf')`);
expect(await run(db)).toMatchObject({eligible:false});await expect(run(db,'prepare')).rejects.toThrow(/vínculos/i);
await db.exec(`delete from document_versions where id='${other}'`);await run(db,'prepare');
await expect(db.exec(`update documentos set caminho_arquivo='${user}/doc.pdf' where id='${other}'`)).rejects.toThrow(/exclusão/i);
await expect(db.exec(`insert into document_versions(id,document_id,storage_path) values('${other}','${other}','${user}/doc.pdf')`)).rejects.toThrow(/exclusão/i);
}finally{await db.close();}},20000);
it('remove vínculos de auditoria, credenciamento, estoque e cadastros modernos usando as FKs reais',async()=>{const db=await setup();try{
await db.exec(`insert into clients(id,farm_id) values('${farm}','${farm}');
insert into authorizations(id,farm_id,client_id) values('${farm}','${farm}','${farm}');
insert into documents(id,authorization_id) values('${farm}','${farm}');
insert into document_versions(id,document_id,uploaded_by,storage_path) values('${farm}','${farm}','${user}','modern.pdf');
insert into aud_audits(id,farm_id,created_by) values('${farm}','${farm}','${actor}');
insert into aud_batches(id,audit_id) values('${farm}','${farm}');
insert into aud_files(id,audit_id,batch_id,storage_path) values('${farm}','${farm}','${farm}','audit.pdf');
insert into aud_jobs(id,audit_id,batch_id) values('${farm}','${farm}','${farm}');
insert into aud_events(id,audit_id) values(1,'${farm}');
insert into aud_private.links(id,audit_id) values('${farm}','${farm}');
insert into cre_processes(id,owner_id) values('${farm}','${user}');
insert into cre_files(id,process_id,storage_path) values('${farm}','${farm}','credential.pdf');
insert into cre_events(id,process_id) values(1,'${farm}');
insert into invitation_deliveries(attempt_id,audit_id,credential_id) values('${farm}','${farm}','${farm}');
insert into compras_estoque(farm_id) values('${farm}');
insert into audit_logs(id,farm_id,user_id) values('${farm}','${farm}','${user}');
insert into rbk_manager_farms(manager_user_id,farm_id,granted_by) values('${actor}','${farm}','${actor}');
insert into storage.objects(bucket_id,name) values('auditoria-private','audit.pdf'),('credenciamento-private','credential.pdf'),('documentos','modern.pdf');`);
expect(await run(db,'prepare')).toMatchObject({pending:true,documents:4,audits:1,credentials:1});
await db.exec(`delete from storage.objects where name<>'${actor}/other.pdf'`);
expect(await run(db,'finish')).toMatchObject({completed:true});
for (const table of ['aud_audits','aud_files','aud_jobs','aud_batches','aud_private.links','cre_processes','cre_files','documents','document_versions','authorizations','clients','compras_estoque','audit_logs','rbk_manager_farms']) expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
}finally{await db.close();}},20000);

it('congela lotes distintos para impedir novos vínculos com auditorias externas',async()=>{const db=await setup();try{
const batch='30000000-0000-4000-8000-000000000001';
await db.exec(`insert into aud_audits(id,farm_id) values('${farm}','${farm}'),('${other}','${other}');insert into aud_batches(id,audit_id) values('${batch}','${farm}')`);
await run(db,'prepare');
await expect(db.exec(`insert into aud_files(id,audit_id,batch_id) values(gen_random_uuid(),'${other}','${batch}')`)).rejects.toThrow(/exclusão/i);
await expect(db.exec(`insert into aud_jobs(id,audit_id,batch_id) values(gen_random_uuid(),'${other}','${batch}')`)).rejects.toThrow(/exclusão/i);
}finally{await db.close();}},20000);

it('IDs coincidentes entre tabelas não ampliam o escopo da remoção',async()=>{const db=await setup();try{
await db.exec(`insert into autorizacoes(id,user_id) values('${user}','${actor}');insert into documentos(id,autorizacao_id,caminho_arquivo) values('${user}','${user}','${actor}/collision.pdf');insert into storage.objects(bucket_id,name,owner_id) values('documentos','${actor}/collision.pdf','${actor}'),('documentos','${actor}/${user}/orphan.pdf','${actor}')`);
const prep=await run(db,'prepare');expect(prep.documents).toBe(1);
await db.exec(`delete from storage.objects where owner_id='${user}'`);expect(await run(db,'finish')).toMatchObject({completed:true});
expect((await db.query(`select id from documentos where id='${user}'`)).rows).toHaveLength(1);
expect((await db.query(`select name from storage.objects where owner_id='${actor}'`)).rows).toHaveLength(3);
}finally{await db.close();}},20000);
