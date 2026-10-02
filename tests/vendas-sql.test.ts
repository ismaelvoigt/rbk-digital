import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("isola itens pela autorização, bloqueia escrita do navegador, duplicidade e origem inválida", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table autorizacoes(id uuid primary key,user_id uuid);
 create table documentos(id uuid primary key,autorizacao_id uuid references autorizacoes,categoria text,caminho_arquivo text);
 alter table autorizacoes enable row level security;create policy own on autorizacoes for select to authenticated using(user_id=auth.uid());
 grant usage on schema auth to authenticated;grant select on autorizacoes,documentos to authenticated;
 insert into autorizacoes values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022');
 insert into documentos(id,autorizacao_id,categoria) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','cupom_fiscal'),('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','cupom_vinculado');`);
    await db.exec(readFileSync("supabase/vendas-schema.sql", "utf8"));
    const insert = `insert into dispensacao_itens(autorizacao_id,documento_id,posicao,produto,quantidade,origens,status) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'Produto',2,'{"produto":"cupom linha 1","quantidade":"cupom linha 1"}','confirmado')`;
    await db.exec(insert);
    await expect(db.exec(insert)).rejects.toThrow(/unique|duplicate/i);
    await expect(
      db.exec(
        `update dispensacao_itens set documento_id='00000000-0000-0000-0000-000000000004'`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`update dispensacao_itens set valor_pfpb=10`),
    ).rejects.toThrow(/origem/i);
    await expect(
      db.exec(`update dispensacao_itens set quantidade=-1`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update dispensacao_itens set quantidade='NaN'`),
    ).rejects.toThrow();
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false)`,
    );
    expect(
      (await db.query("select produto from dispensacao_itens")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(`update dispensacao_itens set quantidade=100`),
    ).rejects.toThrow(/permission/i);
    await db.exec(
      `select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false)`,
    );
    expect(
      (await db.query("select * from dispensacao_itens")).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await db.exec(
      "update documentos set caminho_arquivo='novo-cupom.jpg' where id='00000000-0000-0000-0000-000000000003'",
    );
    expect(
      (await db.query("select status from dispensacao_itens")).rows,
    ).toEqual([{ status: "pendente" }]);
    await db.exec("set role anon");
    await expect(db.query("select * from dispensacao_itens")).rejects.toThrow(
      /permission/i,
    );
  } finally {
    await db.close();
  }
}, 20000);
