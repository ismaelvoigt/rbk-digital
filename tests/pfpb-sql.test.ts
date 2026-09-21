import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("RLS, revisão da versão atual e histórico protegido em PostgreSQL", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth,storage to authenticated;create table public.users(id uuid,perfil text,status text);create table public.rbk_admins(user_id uuid,ativo boolean);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');insert into public.users select id,'gestor_rbk','active' from auth.users;update public.users set perfil='farmacia' where id='00000000-0000-0000-0000-000000000003';`,
  );
  await db.exec(readFileSync("supabase/pfpb-schema.sql", "utf8"));
  await db.exec(
    `set role authenticated;set test.uid='00000000-0000-0000-0000-000000000001'`,
  );
  const call = async (op: string, pid: string | null, payload: object) =>
    (
      await db.query<{ r: { id: string; revision: number; deleted_at?: string } }>(
        "select public.pfpb_command($1,$2,$3) r",
        [op, pid, JSON.stringify(payload)],
      )
    ).rows[0].r;
  const p = await call("create", null, {
    ficha: { B20: "12345678000190", B21: "Sintética" },
  });
  expect(p.id).toBeTruthy();
  await expect(
    db.exec(
      `insert into public.pfpb_events(process_id,action,actor_id) values('${p.id}','forjado',auth.uid())`,
    ),
  ).rejects.toThrow();
  await expect(call("form", p.id, { confirmed: true })).rejects.toThrow();
  await db.exec(`set test.uid='00000000-0000-0000-0000-000000000002'`);
  expect(
    (await db.query("select * from public.pfpb_processes")).rows,
  ).toHaveLength(0);
  await expect(
    call("ficha", p.id, { revision: 1, ficha: { B21: "intruso" } }),
  ).rejects.toThrow();
  await db.exec(`set test.uid='00000000-0000-0000-0000-000000000003'`);
  await expect(
    call("create", null, {
      ficha: { B20: "12345678000190", B21: "Bloqueada" },
    }),
  ).rejects.toThrow();
  await db.exec(`set test.uid='00000000-0000-0000-0000-000000000001'`);
  const v1 = "10000000-0000-0000-0000-000000000001",
    v2 = "10000000-0000-0000-0000-000000000002";
  for (const id of [v1, v2]) {
    await db.query("insert into storage.objects values($1,$2)", [
      "pfpb-private",
      `${p.id}/${id}.pdf`,
    ]);
    await call("upload", p.id, {
      id,
      path: `${p.id}/${id}.pdf`,
      kind: "cnpj",
      filename: "teste.pdf",
      size: 10,
    });
  }
  await expect(
    call("review", p.id, { version_id: v1, decision: "Aprovado" }),
  ).rejects.toThrow(/substituída/);
  await call("review", p.id, { version_id: v2, decision: "Aprovado" });
  await expect(db.exec(`delete from public.pfpb_reviews`)).rejects.toThrow();
  await expect(
    call("form", p.id, { revision: 3, confirmed: true }),
  ).rejects.toThrow(/onze/);
  const kinds = [
    "contrato_social",
    "endereco",
    "licenca_sanitaria",
    "afe",
    "cnd",
    "crt",
    "representante",
    "rt",
    "banco",
    "rta",
  ];
  for (const [index, kind] of kinds.entries()) {
    const vid = `20000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;
    await db.query("insert into storage.objects values($1,$2)", [
      "pfpb-private",
      `${p.id}/${vid}.pdf`,
    ]);
    await call("upload", p.id, {
      id: vid,
      path: `${p.id}/${vid}.pdf`,
      kind,
      filename: "sintetico.pdf",
      size: 10,
    });
    await call("review", p.id, { version_id: vid, decision: "Aprovado" });
  }
  const formed = await call("form", p.id, { revision: 13, confirmed: true });
  expect(formed).toMatchObject({ revision: 13, formed_revision: 13 });
  await call("review", p.id, {
    version_id: v2,
    decision: "Substituir",
    observation: "Conferência sintética",
  });
  const again = await db.query<{formed_revision:number|null}>(
    "select formed_revision from public.pfpb_processes where id=$1",
    [p.id],
  );
  expect(again.rows[0].formed_revision).toBeNull();
  await expect(call("cancel", p.id, {revision:12,confirmed:true})).rejects.toThrow();
  await expect(call("cancel", p.id, {revision:13})).rejects.toThrow();
  const cancelled = await call("cancel", p.id, {revision:13,confirmed:true});
  expect(cancelled.deleted_at).toBeTruthy();
  expect((await db.query("select * from public.pfpb_processes where deleted_at is null")).rows).toHaveLength(0);
  expect((await db.query("select * from public.pfpb_versions")).rows.length).toBeGreaterThan(0);
  expect((await db.query("select * from public.pfpb_events where action='Processo excluído por desistência'")).rows).toHaveLength(1);
  await expect(call("form", p.id, {revision:14,confirmed:true})).rejects.toThrow(/excluído/);

  await db.exec(
    `reset role;update public.users set status='inactive' where id='00000000-0000-0000-0000-000000000001';set role authenticated`,
  );
  expect(
    (await db.query("select * from public.pfpb_versions")).rows,
  ).toHaveLength(0);
  await db.close();
});
