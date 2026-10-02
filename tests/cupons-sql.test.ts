import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
const a = "00000000-0000-0000-0000-000000000001",
  u = "00000000-0000-0000-0000-000000000011",
  d = "00000000-0000-0000-0000-000000000003",
  d2 = "00000000-0000-0000-0000-000000000004";
it("fila, lease, revisão isolada, substituição e confirmação sem duplicar cupons", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table rbk_admins(user_id uuid,ativo boolean);create table farms(id uuid,status text);insert into farms values('10000000-0000-4000-8000-000000000001','active');create table users(id uuid primary key,status text,perfil text default 'farmacia',farm_id uuid default '10000000-0000-4000-8000-000000000001');insert into users(id,status) values('${u}','active');
 create table autorizacoes(id uuid primary key,user_id uuid);insert into autorizacoes values('${a}','${u}');
 create table documentos(id uuid primary key,autorizacao_id uuid references autorizacoes,categoria text,caminho_arquivo text,status text);
 alter table autorizacoes enable row level security;create policy own on autorizacoes for select to authenticated using(user_id=auth.uid());grant usage on schema auth to authenticated;grant select on autorizacoes,documentos to authenticated;`);
    await db.exec(readFileSync("supabase/vendas-schema.sql", "utf8"));
    await db.exec(readFileSync("supabase/cupons-extracao.sql", "utf8"));
    await db.exec(
      `insert into documentos values('${d}','${a}','cupom_fiscal','arquivo1.pdf','recebido')`,
    );
    const claim = async (id = d) =>
      (
        await db.query<{
          j: { documento_id: string; versao: string; lease_token: string };
        }>(`select public.cupom_claim('${id}') as j`)
      ).rows[0].j;
    let job = await claim();
    expect(job.documento_id).toBe(d);
    expect(await claim()).toBeNull();
    await db.exec(
      `update documentos set caminho_arquivo='arquivo2.pdf' where id='${d}'`,
    );
    const complete = async (j: typeof job) =>
      (
        await db.query<{ ok: boolean }>(
          "select cupom_concluir($1,$2,$3,$4,$5,$6,$7) as ok",
          [
            j.documento_id,
            j.versao,
            j.lease_token,
            "revisao",
            "{}",
            "a".repeat(64),
            "",
          ],
        )
      ).rows[0].ok;
    expect(await complete(job)).toBe(false);
    job = await claim();
    expect(await complete(job)).toBe(true);
    const items = JSON.stringify([
      {
        produto: "Produto teste",
        ean: null,
        unidade: "CX",
        quantidade: 2,
        valor_unitario: 10,
        valor_total: 20,
        valor_pfpb: null,
        principio_ativo: null,
        indicacao: null,
        data_dispensacao: null,
        fonte: "página 1 linha 1",
      },
    ]);
    const review = (who = u, version = job.versao, doc = d, replace = false) =>
      db.query("select cupom_confirmar($1,$2,$3,$4,$5)", [
        doc,
        version,
        who,
        items,
        replace,
      ]);
    await expect(
      review("00000000-0000-0000-0000-000000000022"),
    ).rejects.toThrow();
    await review();
    expect(
      (
        await db.query(
          "select count(*)::int n from dispensacao_itens where status='confirmado'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
    await expect(review()).rejects.toThrow();
    await db.exec(
      `insert into documentos values('${d2}','${a}','cupom_vinculado','vinculado.pdf','recebido')`,
    );
    const other = await claim(d2);
    await complete(other);
    await expect(review(u, other.versao, d2, false)).rejects.toThrow(
      /substitui/i,
    );
    await review(u, other.versao, d2, true);
    expect(
      (await db.query("select count(*)::int n from dispensacao_itens")).rows,
    ).toEqual([{ n: 1 }]);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${u}',false)`,
    );
    expect((await db.query("select * from cupom_extracoes")).rows).toHaveLength(
      2,
    );
    await expect(db.query("select cupom_claim(null)")).rejects.toThrow(
      /permission/i,
    );
    await expect(
      db.exec("update cupom_extracoes set tentativas=0"),
    ).rejects.toThrow(/permission/i);
    await db.exec(
      "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false)",
    );
    expect((await db.query("select * from cupom_extracoes")).rows).toHaveLength(
      0,
    );
    await db.exec("reset role");
    await db.exec(`update documentos set status='pendente' where id='${d2}'`);
    expect(
      (
        await db.query(
          "select count(*)::int n from dispensacao_itens where status='confirmado'",
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (
        await db.query(
          `select * from cupom_extracoes where documento_id='${d2}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("set role anon");
    await expect(db.query("select * from cupom_extracoes")).rejects.toThrow(
      /permission/i,
    );
  } finally {
    await db.close();
  }
}, 20000);
