import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
let audit: string;
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
      JSON.stringify(payload),
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
        JSON.stringify(payload),
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
 create table public.farms(id uuid primary key default gen_random_uuid(),razao_social text,cnpj text,status text);
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
 insert into public.farms values('${id(10)}','Farmácia Sintética A','12345678000190','active'),('${id(11)}','Farmácia Sintética B','98765432000190','active');`);
  const base = readFileSync(
    "supabase/migrations/20260918152400_rbac_auditoria_base.sql",
    "utf8",
  );
  await db.exec(
    base.slice(0, base.indexOf("alter table public.autorizacoes")) + "commit;",
  );
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
  await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("cria somente para farmácia vinculada e isola dados por RLS", async () => {
  audit = (
    await manager(
      "create",
      { farm_id: id(10), reference: "Ofício sintético", requested: 12 },
      null,
    )
  ).id;
  await expect(
    manager("create", { farm_id: id(11), reference: "Proibido" }, null),
  ).rejects.toThrow();
  expect((await db.query("select * from public.aud_audits")).rows).toHaveLength(
    1,
  );
  await db.exec(`set test.uid='${id(2)}'`);
  expect((await db.query("select * from public.aud_audits")).rows).toHaveLength(
    0,
  );
  await expect(manager("close")).rejects.toThrow();
  await db.exec(`set test.uid='${id(3)}'`);
  await expect(manager("create", { farm_id: id(10) }, null)).rejects.toThrow();
  await db.exec(`set test.uid='${id(1)}'`);
});
it("link hash restrito e manifesto idempotente imutável", async () => {
  await manager("link", { hash, days: 30 });
  expect((await portal("summary")).audit.id).toBe(audit);
  await expect(db.query("select * from aud_private.links")).rejects.toThrow();
  await expect(
    db.query("select public.aud_portal($1,'summary','{}')", [hash]),
  ).rejects.toThrow();
  const payload = {
    key: id(20),
    files: [
      {
        id: id(30),
        name: "sintetico.pdf",
        size: 25000000,
        mime: "application/pdf",
        fingerprint: "b".repeat(64),
      },
    ],
  };
  const b = await portal("begin", payload);
  batch = b.id;
  file = b.files[0].id;
  expect((await portal("begin", payload)).id).toBe(batch);
  await expect(
    portal("begin", { ...payload, files: [{ ...payload.files[0], size: 1 }] }),
  ).rejects.toThrow();
  await expect(db.exec("delete from public.aud_batches")).rejects.toThrow();
  await expect(portal("complete", { batch_id: batch })).rejects.toThrow();
});
it("valida objeto no storage, acumula lotes e protocolo uma única vez", async () => {
  const reserved = await portal("ticket", { file_id: file });
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
    [
      "auditoria-private",
      reserved.path,
      { size: 1, mimetype: "application/pdf" },
    ],
  );
  await db.exec("set role authenticated");
  await expect(portal("complete", { batch_id: batch })).rejects.toThrow();
  await db.exec("reset role");
  await db.query("update storage.objects set metadata=$1", [
    { size: 25000000, mimetype: "application/pdf" },
  ]);
  await db.exec("set role authenticated");
  const result = await portal("complete", { batch_id: batch });
  expect(result.protocol).toContain("RBK-");
  expect((await portal("complete", { batch_id: batch })).protocol).toBe(
    result.protocol,
  );
  const b = await portal("begin", {
    key: id(21),
    files: [
      {
        id: id(31),
        name: "outro.pdf",
        size: 1024,
        mime: "application/pdf",
        fingerprint: "c".repeat(64),
      },
    ],
  });
  const f = await portal("ticket", { file_id: b.files[0].id });
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
    ["auditoria-private", f.path, { size: 1024, mimetype: "application/pdf" }],
  );
  await db.exec("set role authenticated");
  await portal("complete", { batch_id: b.id });
  const view = await portal("summary");
  expect(view.total_bytes).toBe(25001024);
  expect(view.total_files).toBe(2);
  expect(view.batches.map((x: any) => x.number)).toEqual([1, 2]);
  expect(JSON.stringify(view)).not.toContain("storage_path");
  expect(JSON.stringify(view)).not.toContain("notes");
  expect((await db.query("select * from public.aud_jobs")).rows).toHaveLength(
    2,
  );
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await expect(manager("download", { file_id: file })).rejects.toThrow();
});
it("fechamento/reabertura, token inválido/expirado/revogado e IDOR", async () => {
  await manager("close");
  expect((await portal("summary")).audit.collection).toBe("closed");
  await expect(portal("ticket", { file_id: file })).rejects.toThrow();
  await expect(portal("begin", { key: id(25), files: [] })).rejects.toThrow();
  await manager("reopen");
  await expect(portal("ticket", { file_id: id(999) })).rejects.toThrow();
  await expect(portal("summary", {}, "f".repeat(64))).rejects.toThrow();
  await manager("revoke");
  await expect(portal("summary")).rejects.toThrow();
  await manager("link", { hash: "d".repeat(64), days: 1 });
  await db.exec(
    `reset role;update aud_private.links set expires_at=now()-interval '1 minute';set role authenticated`,
  );
  await expect(portal("summary", {}, "d".repeat(64))).rejects.toThrow();
});
it("bloqueia limites, ZIP, conteúdo duplicado e download sem scanner", async () => {
  await manager("link", { hash: "e".repeat(64), days: 1 });
  const p = (files: object[]) =>
    portal("begin", { key: id(50), files }, "e".repeat(64));
  await expect(
    p([
      {
        id: id(51),
        name: "a.exe",
        size: 1,
        mime: "application/pdf",
        fingerprint: "a".repeat(64),
      },
    ]),
  ).rejects.toThrow();
  await expect(
    p([
      {
        id: id(51),
        name: "a.zip",
        size: 1,
        mime: "application/zip",
        fingerprint: "a".repeat(64),
      },
    ]),
  ).rejects.toThrow();
  await expect(
    p([
      {
        id: id(51),
        name: "a.pdf",
        size: 104857601,
        mime: "application/pdf",
        fingerprint: "a".repeat(64),
      },
    ]),
  ).rejects.toThrow();
  await expect(
    p([
      {
        id: id(51),
        name: "copia.pdf",
        size: 25000000,
        mime: "application/pdf",
        fingerprint: "b".repeat(64),
      },
    ]),
  ).rejects.toThrow();
  await db.exec(
    `reset role;update public.users set status='inactive' where id='${id(1)}';set role authenticated`,
  );
  expect((await db.query("select * from public.aud_audits")).rows).toHaveLength(
    0,
  );
  await expect(manager("reopen")).rejects.toThrow();
});
it("dois tokens válidos não permitem acessar lotes/arquivos de outra auditoria", async () => {
  await db.exec(
    `reset role;update public.users set status='active' where id='${id(1)}';set role authenticated`,
  );
  const second = (
    await manager(
      "create",
      { farm_id: id(10), reference: "Segundo processo" },
      null,
    )
  ).id;
  await manager("link", { hash: "f".repeat(64), days: 2 }, second);
  await expect(
    portal("complete", { batch_id: batch }, "f".repeat(64)),
  ).rejects.toThrow();
  await expect(
    portal("ticket", { file_id: file }, "f".repeat(64)),
  ).rejects.toThrow();
  expect((await portal("summary", {}, "f".repeat(64))).total_files).toBe(0);
});
it("somente scanner privilegiado libera downloads e logs são preservados", async () => {
  await expect(
    db.query("select public.aud_scan_result($1,'clean',$2)", [
      file,
      "b".repeat(64),
    ]),
  ).rejects.toThrow();
  await db.exec("set role service_role");
  await db.query("select public.aud_scan_result($1,'clean',$2)", [
    file,
    "b".repeat(64),
  ]);
  await db.exec("set role authenticated");
  expect((await manager("download", { file_id: file })).path).toContain(audit);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await db.exec(`set test.uid='${id(2)}'`);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await db.exec(`set test.uid='${id(4)}'`);
  expect((await db.query("select * from public.aud_audits")).rows).toHaveLength(
    2,
  );
  await db.exec(`set test.uid='${id(1)}'`);
  await expect(db.exec("update public.aud_files set size=1")).rejects.toThrow();
});
it("rate limit persistente e manifesto de 250 MB em vários arquivos", async () => {
  await db.exec("set role service_role");
  for (let i = 0; i < 3; i++) {
    const r = await db.query<{ ok: boolean }>(
      "select public.aud_rate('test',2) ok",
    );
    expect(r.rows[0].ok).toBe(i < 2);
  }
  await db.exec("set role authenticated");
  const files = Array.from({ length: 10 }, (_, i) => ({
    id: id(100 + i),
    name: `sintetico-${i}.pdf`,
    size: 25000000,
    mime: "application/pdf",
    fingerprint: String(i).repeat(64),
  }));
  const b = await portal("begin", { key: id(200), files }, "f".repeat(64));
  expect(b.files).toHaveLength(10);
  const usage = await manager("usage", {}, null);
  expect(usage[0].bytes).toBe(25001024);
  expect(await manager("list", {}, null)).toHaveLength(2);
});
it("ofício do Gestor tem versões próprias e não vaza no portal nem altera os lotes", async () => {
  const manifest = {
    id: id(300),
    name: "Oficio-recebido.pdf",
    size: 2048,
    mime: "application/pdf",
    fingerprint: "ab".repeat(32),
  };
  const office = await manager("office_begin", { file: manifest });
  expect((await manager("office_begin", { file: manifest })).id).toBe(
    office.id,
  );
  await expect(
    portal("ticket", { file_id: office.id }, "e".repeat(64)),
  ).rejects.toThrow();
  await expect(
    manager("office_complete", { file_id: office.id }),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
    [
      "auditoria-private",
      office.path,
      { size: 2048, mimetype: "application/pdf" },
    ],
  );
  await db.exec("set role authenticated");
  await manager("office_complete", { file_id: office.id });
  await manager("office_complete", { file_id: office.id });
  const detail = await manager("detail");
  expect(detail.offices).toHaveLength(1);
  expect(detail.total_files).toBe(2);
  const view = await portal("summary", {}, "e".repeat(64));
  expect(JSON.stringify(view)).not.toContain("Oficio-recebido");
  expect(view.total_files).toBe(2);
  await db.exec(`set test.uid='${id(2)}'`);
  await expect(
    manager("office_begin", {
      file: { ...manifest, id: id(301), fingerprint: "ac".repeat(32) },
    }),
  ).rejects.toThrow();
  await db.exec(`set test.uid='${id(1)}'`);
});

it("cadastra farmácia junto da auditoria, sem duplicar nem apropriar outro tenant", async () => {
 await db.exec(`set test.uid='${id(1)}'`);
 const payload={new_farm:{name:"Farmácia Nova Sintética",cnpj:"11.222.333/0001-81"},reference:"Nova auditoria"};
 const register=async(p: object)=> (await db.query<{r:any}>("select public.aud_register_pharmacy($1) r",[JSON.stringify(p)])).rows[0].r;
 const a=await register(payload);
 expect(a.cnpj).toBe("11222333000181");
 expect((await register(payload)).farm_id).toBe(a.farm_id);
 expect((await manager("farms",{},null)).some((f:any)=>f.id===a.farm_id)).toBe(true);
 await expect(register({...payload,new_farm:{name:"Inválida",cnpj:"11222333000182"}})).rejects.toThrow("CNPJ inválido");
 await db.exec(`set test.uid='${id(2)}'`);
 await expect(register(payload)).rejects.toThrow("Cadastro indisponível");
 await db.exec(`set test.uid='${id(3)}'`);
 await expect(register(payload)).rejects.toThrow("Acesso negado");
 await db.exec(`set test.uid='${id(1)}'`);
 await expect(register({new_farm:{name:"Rollback",cnpj:"12ABC34501DE35"},reference:""})).rejects.toThrow();
 expect((await manager("farms",{},null)).some((f:any)=>f.cnpj==="12ABC34501DE35")).toBe(false);
 const alpha=await register({new_farm:{name:"Alfanumérica Sintética",cnpj:"12ABC34501DE35"},reference:"Alfanumérico"});
 expect(alpha.cnpj).toBe("12ABC34501DE35");
});

it("contatos ficam internos e só podem ser alterados pelo Gestor autorizado", async () => {
 await db.exec(`set test.uid='${id(1)}'`);
 const saved=(await db.query<{r:any}>("select public.aud_contact($1,$2) r",[audit,JSON.stringify({email:"cliente@example.invalid",phone:"(11) 99999-8888"})])).rows[0].r;
 expect(saved.phone).toBe("5511999998888");
 expect((await manager("detail")).audit.contact_email).toBe("cliente@example.invalid");
 await manager("link",{hash:"9".repeat(64),days:1});
 const view=JSON.stringify(await portal("summary",{},"9".repeat(64)));
 expect(view).not.toContain("cliente@example.invalid");expect(view).not.toContain("5511999998888");
 await expect(db.query("select public.aud_contact($1,$2)",[audit,JSON.stringify({email:"invalido",phone:""})])).rejects.toThrow("e-mail válido");
 await db.exec(`set test.uid='${id(2)}'`);
 await expect(db.query("select public.aud_contact($1,$2)",[audit,JSON.stringify({email:"outro@example.invalid"})])).rejects.toThrow("Acesso negado");
 await db.exec(`set test.uid='${id(1)}'`);
});

it("ofício HTML/HTM fica privado, em quarentena e fora do portal do cliente", async () => {
 await db.exec(`set test.uid='${id(1)}'`);
 await manager("link", {hash:"7".repeat(64), days:1});
 for (const ext of ["html","htm"]) {
 const manifest={id:crypto.randomUUID(), name:`oficio.${ext}`, size:200, mime:"text/html", fingerprint:(ext === "html" ? "6" : "5").repeat(64)};
 const ticket=await manager("office_begin",{file:manifest});
 await db.exec("reset role");
 await db.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",["auditoria-private",ticket.path,{size:200,mimetype:"text/html"}]);
 await db.exec("set role authenticated");
 await manager("office_complete",{file_id:ticket.id});
 await expect(manager("download",{file_id:ticket.id})).rejects.toThrow();
 await expect(portal("begin",{key:crypto.randomUUID(),files:[manifest]},"7".repeat(64))).rejects.toThrow();
 expect(JSON.stringify(await portal("summary",{},"7".repeat(64)))).not.toContain(`oficio.${ext}`);
 }
});

it("confirmação exige ofício e contatos, cria link de 40 dias uma vez e respeita escopo", async () => {
 await db.exec(`set test.uid='${id(1)}'`);
 const a = (await manager("create",{farm_id:id(10),reference:"Confirmação"},null)).id;
 const confirm = () => db.query<{r:any}>("select public.aud_confirm($1,$2) r",[a,"2".repeat(64)]);
 await expect(confirm()).rejects.toThrow();
 await db.query("select public.aud_contact($1,$2)",[a,{email:"teste@example.invalid",phone:"11999999999"}]);
 await expect(confirm()).rejects.toThrow();
 const f=await manager("office_begin",{file:{id:crypto.randomUUID(),name:"oficio.pdf",size:50,mime:"application/pdf",fingerprint:"1".repeat(64)}},a);
 await db.exec("reset role");
 await db.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",["auditoria-private",f.path,{size:50,mimetype:"application/pdf"}]);
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
 await manager("office_complete",{file_id:f.id},a);
 await db.exec(`set test.uid='${id(2)}'`);await expect(confirm()).rejects.toThrow();
 await db.exec(`set test.uid='${id(1)}'`);
 expect((await confirm()).rows[0].r.created).toBe(true);
 expect((await confirm()).rows[0].r.created).toBe(false);
 await db.exec("reset role");
 const links=await db.query<{days:number}>("select extract(epoch from (expires_at-created_at))/86400 days from aud_private.links where audit_id=$1",[a]);
 expect(links.rows).toHaveLength(1);expect(Number(links.rows[0].days)).toBeCloseTo(40,3);
 await db.exec("set role authenticated");
});

it("exclui apenas auditoria vazia, preserva ofício e farmácia e revoga link",async()=>{
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
 const a=(await manager('create',{farm_id:id(10),reference:'Exclusão sintética'},null)).id;
 const h='91'.repeat(32);
 await manager('link',{hash:h,days:40},a);
 const office=await manager('office_begin',{file:{id:crypto.randomUUID(),name:'oficio.pdf',size:30,mime:'application/pdf',fingerprint:'8'.repeat(64)}},a);
 expect((await manager('list')).find((s:any)=>s.audit.id===a).can_delete).toBe(true);
 await db.exec(`set test.uid='${id(2)}'`);
 await expect(manager('delete_empty',{},a)).rejects.toThrow('Acesso negado');
 await db.exec(`set test.uid='${id(3)}'`);
 await expect(manager('delete_empty',{},a)).rejects.toThrow('Acesso negado');
 await db.exec(`set test.uid='${id(1)}'`);
 expect(await manager('delete_empty',{},a)).toEqual({removed:true});
 expect((await manager('list')).some((s:any)=>s.audit.id===a)).toBe(false);
 await expect(manager('detail',{},a)).rejects.toThrow();
 await expect(manager('link',{hash:'0'.repeat(64),days:40},a)).rejects.toThrow();
 await expect(portal('summary',{},h)).rejects.toThrow('Link indisponível');
 await db.exec('reset role');
 expect((await db.query('select id from public.farms where id=$1',[id(10)])).rows).toHaveLength(1);
 expect((await db.query('select id from public.aud_files where id=$1',[office.id])).rows).toHaveLength(1);
 expect((await db.query("select id from public.aud_events where audit_id=$1 and event='audit_removed_empty'",[a])).rows).toHaveLength(1);
 await db.exec('set role authenticated');
});
it("bloqueia exclusão quando lote começou, mesmo sem recebimento concluído",async()=>{
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
 const a=(await manager('create',{farm_id:id(10),reference:'Envio em andamento'},null)).id;
 const h='6'.repeat(64);await manager('link',{hash:h,days:40},a);
 await portal('begin',{key:crypto.randomUUID(),files:[{id:crypto.randomUUID(),name:'teste.pdf',size:30,mime:'application/pdf',fingerprint:'5'.repeat(64)}]},h);
 const listed=(await manager('list')).find((s:any)=>s.audit.id===a);
 expect(listed.total_files).toBe(0);expect(listed.can_delete).toBe(false);
 await expect(manager('delete_empty',{},a)).rejects.toThrow('já iniciou ou concluiu');
 await expect(manager('delete_empty',{},audit)).rejects.toThrow();
});
it('pesquisa CNPJ com máscara ou parcial antes da paginação, mantendo isolamento',async()=>{
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
 const target=await db.query<{r:any}>("select public.aud_register_pharmacy($1) r",[{new_farm:{name:'Busca sintética',cnpj:'11.222.333/0001-81'},reference:'Pesquisa'}]);
 const targetId=target.rows[0].r.id;
 for(let i=0;i<51;i++) await manager('create',{farm_id:id(10),reference:`Paginação ${i}`},null);
 const found=await manager('list',{cnpj:'11.222.333/0001-81'});
 expect(found.some((s:any)=>s.audit.id===targetId)).toBe(true);
 expect(found.every((s:any)=>s.audit.cnpj==='11222333000181')).toBe(true);
 expect(await manager('list',{cnpj:'11222'})).toEqual(found);
 expect(await manager('list',{cnpj:'11222',offset:50})).toEqual([]);
 expect(await manager('list',{cnpj:'99999999999999'})).toEqual([]);
 await expect(manager('list',{cnpj:'%'})).rejects.toThrow('Pesquisa de CNPJ inválida');
 await db.exec(`set test.uid='${id(2)}'`);
 expect(await manager('list',{cnpj:'11222333000181'})).toEqual([]);
 await db.exec(`set test.uid='${id(1)}'`);
 await manager('delete_empty',{},targetId);
 expect(await manager('list',{cnpj:'11222333000181'})).not.toContainEqual(expect.objectContaining({audit:expect.objectContaining({id:targetId})}));
});

it("CNPJ fictício requer configuração privada e mantém 14 números e isolamento", async () => {
 await db.exec("reset role");
 await db.exec(readFileSync("supabase/migrations/20260919183000_audit_test_cnpj.sql", "utf8"));
 await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
 const payload={new_farm:{name:"Teste CNPJ livre",cnpj:"99999999999999"},reference:"Teste"};
 const register=(p:object)=>db.query("select public.aud_register_pharmacy($1)",[JSON.stringify(p)]);
 await expect(register(payload)).rejects.toThrow("CNPJ inválido");
 await expect(db.exec("insert into aud_private.test_settings values(true,true)")).rejects.toThrow();
 await db.exec("reset role;insert into aud_private.test_settings values(true,true);set role authenticated");
 await register(payload);
 await expect(register({...payload,new_farm:{name:"Curto",cnpj:"999"}})).rejects.toThrow("CNPJ inválido");
 await db.exec(`set test.uid='${id(2)}'`);
 await expect(register(payload)).rejects.toThrow("Cadastro indisponível");
 await db.exec(`set test.uid='${id(1)}'`);
});
