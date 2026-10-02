import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
let audit: string | null = null;
let batch: string;
let file: string;
const hash = "a".repeat(64);
async function manager(
  op: string,
  payload: object = {},
  aid: string | null = audit,
) {
  return (
    await db.query<{ r: any }>("select public.aud_manager($1,$2,$3) r", [
      op,
      aid,
      JSON.stringify({check_duplicate:true,...payload}),
    ])
  ).rows[0].r;
}
async function portal(op: string, payload: object = {}, h = hash) {
  await db.exec("set role service_role");
  try {
    return (
      await db.query<{ r: any }>("select public.aud_portal($1,$2,$3) r", [
        h,
        op,
        JSON.stringify({check_duplicate:true,...payload}),
      ])
    ).rows[0].r;
  } finally {
    await db.exec("set role authenticated");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.farms(id uuid primary key default gen_random_uuid(),razao_social text,cnpj text unique,status text,nome_fantasia text,telefone text,cidade text,estado text,created_at timestamptz default now());
 create table public.users(id uuid primary key,farm_id uuid,perfil text,status text);
 create table public.rbk_admins(user_id uuid,ativo boolean);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to authenticated,service_role;grant select on storage.objects to authenticated;
 insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
 insert into public.users select id,null,'gestor_rbk','active' from auth.users;
 update public.users set perfil='farmacia',farm_id='${id(10)}' where id='${id(3)}';
 insert into public.rbk_admins values('${id(4)}',true);
 insert into public.farms(id,razao_social,cnpj,status) values('${id(10)}','Farmácia Sintética A','12345678000190','active'),('${id(11)}','Farmácia Sintética B','98765432000190','active');`);
  await db.exec(readFileSync("supabase/convites-production-base.sql", "utf8"));
  await db.exec(
    `insert into public.rbk_manager_farms(manager_user_id,farm_id) values('${id(1)}','${id(10)}'),('${id(2)}','${id(11)}');`,
  );
  await db.exec(readFileSync("supabase/auditoria-schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919001143_audit_register_pharmacy.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919011523_audit_contact_messages.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919012048_audit_office_html.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919013016_audit_confirmation.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919034053_audit_remove_empty.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919035419_audit_cnpj_search.sql", "utf8"));
  await db.exec(readFileSync("supabase/credenciamento-portal.sql", "utf8"));
  const migration = readdirSync('supabase/migrations').find(n=>n.endsWith('_cnpj_multiplos_processos.sql'));
  if (migration) await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
  await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
}, 30000);
afterAll(async () => {
  await db?.close();
});

it('warns before a second open audit, confirms a new independent audit, and permits repetition after closure',async()=>{
 const first=await manager('create',{farm_id:id(10),reference:'Primeira'},null);
 const warning=await manager('create',{farm_id:id(10),reference:'Segunda'},null);
 expect(warning.confirmation_required).toBe(true);
 expect((await db.query('select id from aud_audits')).rows).toHaveLength(1);
 const second=await manager('create',{farm_id:id(10),reference:'Segunda',confirm_duplicate:true},null);
 expect(second.id).not.toBe(first.id);expect(second.farm_id).toBe(first.farm_id);
 await manager('close',{},first.id);await manager('close',{},second.id);
 expect((await manager('create',{farm_id:id(10),reference:'Terceira'},null)).id).toBeTruthy();
 await expect(manager('create',{farm_id:id(11),reference:'Sem acesso',confirm_duplicate:true},null)).rejects.toThrow('Acesso negado');
});
it('register-pharmacy wrapper returns warning without saving contact against a missing audit',async()=>{
 const payload={new_farm:{name:'Sintética C',cnpj:'11.222.333/0001-81'},reference:'Período 1',contact:{email:'test@example.com',phone:'11999999999'}};
 const register=async(p:object)=>(await db.query<{r:any}>('select aud_register_pharmacy($1) r',[JSON.stringify({check_duplicate:true,...p})])).rows[0].r;
 const first=await register(payload);expect(first.id).toBeTruthy();
 expect((await register(payload)).confirmation_required).toBe(true);
 const next=await register({...payload,confirm_duplicate:true});expect(next.id).not.toBe(first.id);expect(next.farm_id).toBe(first.farm_id);
});
it('credential creates independent records, ignores expired invitations, and links the master without replacing snapshots',async()=>{
 await db.exec('reset role');
 const cmd=async(payload:object)=>(await db.query<{r:any}>("select cre_command('create',$1,null,null,$2) r",[id(1),JSON.stringify({check_duplicate:true,...payload})])).rows[0].r;
 const ficha={B19:'12.345.678/0001-90',B20:'12.345.678/0001-90',B21:'Snapshot do processo'};
 const first=await cmd({ficha,filial:false,hash:'c'.repeat(64)});
 expect((await cmd({ficha,filial:false,hash:'d'.repeat(64)})).confirmation_required).toBe(true);
 const second=await cmd({ficha,filial:false,hash:'d'.repeat(64),confirm_duplicate:true});
 expect(second.id).not.toBe(first.id);
 const rows=(await db.query<{farm_id:string;ficha:any}>('select farm_id,ficha from cre_processes')).rows;
 expect(rows).toHaveLength(2);expect(rows[0].farm_id).toBe(id(10));expect(rows[0].ficha.B21).toBe('Snapshot do processo');
 await db.exec("update cre_processes set expires_at=now()-interval '1 day'");
 expect((await cmd({ficha,filial:false,hash:'e'.repeat(64)})).id).toBeTruthy();
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
});
it('master resolver normalizes CNPJ, reuses without overwriting history and is service-only',async()=>{
 await db.exec('reset role');
 const resolve=async(cnpj:string,create=true)=>(await db.query<{r:any}>('select cadastro_farmacia_cnpj($1,$2,$3) r',[id(4),JSON.stringify({cnpj,razao_social:'Novo nome'}),create])).rows[0].r;
 const result=await resolve('12.345.678/0001-90');expect(result.farm.id).toBe(id(10));expect(result.created).toBe(false);expect(result.farm.razao_social).toBe('Farmácia Sintética A');
 const created=await resolve('99888777000166');expect(created.created).toBe(true);
 expect((await resolve('99.888.777/0001-66')).farm.id).toBe(created.farm.id);
 expect((await resolve('11223344000188',false)).farm).toBeNull();
 await db.exec('set role authenticated');await expect(resolve('99888777000166')).rejects.toThrow('permission denied');
});

it('credential confirmation cannot be used by another owner to access existing records',async()=>{
 await db.exec('reset role');
 const rows=(await db.query<{id:string}>('select id from cre_processes limit 1')).rows;
 await expect(db.query("select cre_command('get',$1,null,$2,'{}')",[id(2),rows[0].id])).rejects.toThrow('Acesso indisponível');
 await db.exec('set role authenticated');
});
it('links an earlier credential when its master pharmacy is subsequently registered',async()=>{
 await db.exec('reset role');
 const ficha={B19:'99888555000166',B20:'99.888.555/0001-66',B21:'Nome histórico'};
 const created=(await db.query<{r:any}>("select cre_command('create',$1,null,null,$2) r",[id(1),JSON.stringify({ficha,filial:false,hash:'f'.repeat(64)})])).rows[0].r;
 const farm=(await db.query<{r:any}>('select cadastro_farmacia_cnpj($1,$2,true) r',[id(4),JSON.stringify({cnpj:'99888555000166',razao_social:'Nome principal'})])).rows[0].r.farm;
 const linked=(await db.query<{farm_id:string;ficha:any}>('select farm_id,ficha from cre_processes where id=$1',[created.id])).rows[0];
 expect(linked.farm_id).toBe(farm.id);expect(linked.ficha.B21).toBe('Nome histórico');
 await db.exec('set role authenticated');
});
