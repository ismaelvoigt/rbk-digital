import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { it, expect } from 'vitest';
it('preserva autorizações antigas e impede CRM incompleto ou inválido no banco', async () => {
  const db=new PGlite();
  try {
    await db.exec("create table public.autorizacoes(id text primary key,data_autorizacao date); insert into autorizacoes(id) values ('antiga');");
    const file=readdirSync('supabase/migrations').find(f=>f.endsWith('_autorizacoes_crm_relatorios.sql'))!;
    await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
    expect((await db.query('select crm,crm_uf from autorizacoes')).rows).toEqual([{crm:null,crm_uf:null}]);
    await db.exec("update autorizacoes set crm='1234',crm_uf='SP';");
    await expect(db.exec("update autorizacoes set crm_uf=null;")).rejects.toThrow();
    await expect(db.exec("update autorizacoes set crm='123a';")).rejects.toThrow();
    await expect(db.exec("update autorizacoes set crm_uf='XX';")).rejects.toThrow();
    await db.exec("update autorizacoes set crm=null,crm_uf=null;");
  } finally {await db.close();}
});
