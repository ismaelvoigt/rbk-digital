import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const actor = "20000000-0000-4000-8000-000000000001",
  target = "20000000-0000-4000-8000-000000000002",
  other = "20000000-0000-4000-8000-000000000003",
  farm = "10000000-0000-4000-8000-000000000001";
async function setup() {
  const db = new PGlite();
  await db.exec(readFileSync("tests/fixtures/exclusao-schema.sql", "utf8"));
  await db.exec(readFileSync("tests/fixtures/exclusao-fks.sql", "utf8"));
  await db.exec(`
alter table auth.users add column email text;create schema rbk_private;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
alter table audit_logs alter column id set default gen_random_uuid();alter table audit_logs alter column created_at set default now();
insert into farms(id,status,cnpj)values('${farm}','active','11111111111111');
insert into auth.users(id,email)values('${actor}','admin@test.invalid'),('${target}','client@test.invalid'),('${other}','staff@test.invalid');
insert into users(id,farm_id,email,perfil,status)values('${actor}',null,'admin@test.invalid','rbk_admin','active'),('${target}','${farm}','client@test.invalid','operador','active'),('${other}','${farm}','staff@test.invalid','operador','inactive');
insert into rbk_admins(user_id,ativo)values('${actor}',true);`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260927011830_equipe_farmacia.sql",
      "utf8",
    ),
  );
  await db.exec(
    `update users set tipo_convite='farmacia' where id='${target}'`,
  );
  await db.exec(readFileSync("supabase/farmacia-exclusao.sql", "utf8"));
  await db.exec(
    `alter table dispensacao_itens enable row level security;grant select on dispensacao_itens,autorizacoes to authenticated;create policy legacy_read on dispensacao_itens for select to authenticated using(true);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261101190848_teste_armazenamento_acesso_exclusao.sql",
      "utf8",
    ),
  );
  return db;
}
async function run(
  db: PGlite,
  action: string,
  email = "client@test.invalid",
  who = actor,
) {
  return (
    await db.query<{ r: any }>(
      "select public.usuario_sem_uso_excluir($1::uuid,$2::uuid,$3,$4) r",
      [who, target, action, email],
    )
  ).rows[0].r;
}
it("promove a mesma conta sem liberar gestão; plano e equipe são independentes", async () => {
  const db = await setup();
  try {
    expect((await db.query("select plano from farms")).rows[0]).toEqual({
      plano: "completo",
    });
    await db.exec(
      `update farms set plano='armazenamento';select set_config('app.uid','${target}',false)`,
    );
    await db.query(
      `select public.farmacia_acesso_alterar($1::uuid,$2::uuid,'promover',null)`,
      [actor, target],
    );
    expect(
      (await db.query(`select perfil from users where id='${target}'`)).rows[0],
    ).toEqual({ perfil: "administrador_farmacia" });
    expect(
      (await db.query(`select rbk_private.can_access_farm('${farm}') allowed`))
        .rows[0],
    ).toEqual({ allowed: false });
    expect(
      (await db.query("select rbk_private.equipe_admin() f")).rows[0],
    ).toEqual({ f: farm });
    await expect(
      db.query(`select rbk_private.proximas_validar('${farm}')`),
    ).rejects.toThrow(/plano/i);
    await db.exec(
      `insert into autorizacoes(id,user_id)values('${farm}','${target}');insert into dispensacao_itens(id,autorizacao_id,produto)values('${farm}','${farm}','Produto');set role authenticated;`,
    );
    expect(
      (await db.query("select produto from dispensacao_itens")).rows,
    ).toEqual([]);
    await db.exec("reset role");
    await db.query(
      `select public.farmacia_acesso_alterar($1::uuid,$2::uuid,'plano','completo')`,
      [actor, target],
    );
    expect(
      (await db.query(`select rbk_private.can_access_farm('${farm}') allowed`))
        .rows[0],
    ).toEqual({ allowed: true });
    await db.exec("set role authenticated");
    expect(
      (await db.query("select produto from dispensacao_itens")).rows,
    ).toEqual([{ produto: "Produto" }]);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    await expect(
      db.query(
        `select public.farmacia_acesso_alterar($1::uuid,$2::uuid,'plano','completo')`,
        [actor, target],
      ),
    ).rejects.toThrow(/permission denied/i);
  } finally {
    await db.close();
  }
}, 25000);
it("exclui somente login vazio, exige e-mail e bloqueia gravações com token antigo", async () => {
  const db = await setup();
  try {
    expect(await run(db, "preview")).toMatchObject({ eligible: true });
    await expect(run(db, "delete", "wrong@test.invalid")).rejects.toThrow(
      /e-mail/i,
    );
    await expect(
      run(db, "delete", "client@test.invalid", target),
    ).rejects.toThrow(/restrito/i);
    expect(await run(db, "delete")).toMatchObject({ completed: true });
    expect(
      (await db.query(`select id from auth.users where id='${target}'`)).rows,
    ).toEqual([]);
    expect((await db.query("select id from farms")).rows).toHaveLength(1);
    expect(
      (await db.query(`select id from users where id='${other}'`)).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name)values('documentos','${target}/late.pdf')`,
      ),
    ).rejects.toThrow(/excluído/i);
  } finally {
    await db.close();
  }
}, 25000);
it("recusa autorização, Storage órfão, histórico de documento, vínculos de negócio e conta RBK", async () => {
  const db = await setup();
  try {
    await db.exec(
      `select set_config('app.uid','${target}',false);insert into autorizacoes(id,user_id)values('${farm}','${target}');select set_config('app.uid','${target}',false)`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
    await expect(run(db, "delete")).rejects.toThrow(/vinculad/i);
    await db.exec(
      `delete from autorizacoes;insert into storage.objects(bucket_id,name)values('documentos','${target}/orphan.pdf')`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
    await db.exec(
      `delete from storage.objects;insert into audit_logs(user_id,entity_type,action)values('${target}','documento','insert')`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
    await db.exec(
      `delete from audit_logs;insert into rbk_manager_farms(manager_user_id,farm_id)values('${target}','${farm}')`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
    await db.exec(
      `delete from rbk_manager_farms;insert into rbk_admins(user_id,ativo)values('${target}',false)`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
  } finally {
    await db.close();
  }
}, 25000);
it("preserva edição da equipe e origem do convite após remover responsável sem uso", async () => {
  const db = await setup();
  try {
    await db.exec(
      `update users set perfil='administrador_farmacia' where id='${target}';update users set perfil='administrador_farmacia',status='active',convidado_por='${target}' where id='${other}'`,
    );
    expect(await run(db, "delete")).toMatchObject({ completed: true });
    await db.exec(
      `update users set nome='Outro administrador' where id='${other}'`,
    );
    expect(
      (
        await db.query(
          `select nome,convidado_por from users where id='${other}'`,
        )
      ).rows[0],
    ).toEqual({ nome: "Outro administrador", convidado_por: target });
  } finally {
    await db.close();
  }
}, 25000);
it("recusa autoria de estoque sem FK para preservar edição futura dos registros", async () => {
  const db = await setup();
  try {
    await db.exec(
      `insert into compras_estoque(farm_id,atualizado_por)values('${farm}','${target}')`,
    );
    expect(await run(db, "preview")).toMatchObject({ eligible: false });
    await expect(run(db, "delete")).rejects.toThrow(/vinculad/i);
  } finally {
    await db.close();
  }
}, 25000);
