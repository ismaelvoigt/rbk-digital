import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('create, list and reopen preserve ownership and public invitation access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create table public.users(id uuid, perfil text, status text);
      create table public.rbk_admins(user_id uuid, ativo boolean);
      create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,metadata jsonb);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
      insert into public.users select id,'gestor_rbk','active' from auth.users;
    `);
    await db.exec(readFileSync('supabase/credenciamento-portal.sql', 'utf8'));
    const actor = '00000000-0000-0000-0000-000000000001';
    const other = '00000000-0000-0000-0000-000000000002';
    const command = async (op: string, owner: string | null, id: string | null = null, hash: string | null = null, payload = {}) =>
      (await db.query<{result: any}>('select public.cre_command($1,$2,$3,$4,$5) result', [op,owner,hash,id,JSON.stringify(payload)])).rows[0].result;
    const ficha = { B19: '11222333000181', B20: '11222333000181', B21: 'Teste isolado' };
    const created = await command('create',actor,null,null,{ficha,filial:false,hash:'a'.repeat(64)});
    expect(created.id).toBeTruthy();
    expect(await command('list',actor)).toMatchObject([{id:created.id,ficha}]);
    expect(await command('get',actor,created.id)).toMatchObject({id:created.id,ficha,files:[],revision:1});
    expect(await command('get',null,null,'a'.repeat(64))).toMatchObject({id:created.id,ficha});
    expect(await command('list',other)).toEqual([]);
    await expect(command('get',other,created.id)).rejects.toThrow('Acesso indisponível');
    await expect(command('get',null,null,'b'.repeat(64))).rejects.toThrow('Acesso indisponível');
  } finally { await db.close(); }
});
