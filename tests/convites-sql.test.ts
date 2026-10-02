import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
test('delivery log is private, persists per-channel results, and cascades with invitation',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table public.aud_audits(id uuid primary key);create table public.cre_processes(id uuid primary key);
   insert into aud_audits values ('11111111-1111-4111-8111-111111111111');`);
  await db.exec(readFileSync('supabase/invitation-deliveries.sql','utf8'));
  await db.exec('set role service_role');
  await db.query(`insert into invitation_deliveries(attempt_id,audit_id,link_hash,channel,status) values
   ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',$1,'email','pending')`,['a'.repeat(64)]);
  await db.exec(`update invitation_deliveries set status='failed'`);
  expect((await db.query<{status:string}>('select status from invitation_deliveries')).rows[0].status).toBe('failed');
  await db.exec('reset role;set role authenticated');
  await expect(db.query('select * from invitation_deliveries')).rejects.toThrow(/permission denied/);
  await expect(db.exec(`insert into invitation_deliveries default values`)).rejects.toThrow(/permission denied/);
  await db.exec('reset role;set role anon');
  await expect(db.query('select * from invitation_deliveries')).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
  await db.exec('delete from aud_audits');
  expect((await db.query('select * from invitation_deliveries')).rows).toEqual([]);
 }finally{await db.close();}
});
