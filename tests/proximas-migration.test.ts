import {it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createDatabase,login,rpc,farmA} from './fixtures/proximas-db';
it('migrações publicadas conferem a carga completa e conserva dados anteriores como não calculados',async()=>{
 const db=await createDatabase(false);
 try{
 await db.exec('reset role');for(const f of readdirSync('supabase/migrations').filter(f=>/_(pfpb_|proximas_periodicidades)/.test(f)).sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 expect((await db.query<{n:number}>('select count(*)::int as n from pfpb_periodicidades')).rows[0].n).toBe(42);
 expect((await db.query<{n:number}>('select count(*)::int as n from pfpb_produtos_periodicidade')).rows[0].n).toBe(2035);
 await login(db);const r=await rpc(db,'proximas_listar',[farmA,null,null,'nao_calculado',0]);expect(r.linhas.length).toBe(1);expect(r.linhas[0].proxima_data).toBeNull();
 }finally{await db.close();}
},30000);
