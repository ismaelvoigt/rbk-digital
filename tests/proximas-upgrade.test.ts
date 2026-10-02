import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createDatabase,itemA} from './fixtures/proximas-db';
it('upgrade preserva previsão manual sem mudanças materiais na fonte',async()=>{
 const db=await createDatabase();try{
 await db.exec("reset role;update proximas_previsoes set origem='intervalo_confirmado',intervalo_dias=30,proxima_data=ultima_data+30,referencia='Posologia conferida' where item_id='"+itemA+"'");
 const old=(await db.query('select proxima_data::text as data from proximas_previsoes where item_id=$1',[itemA])).rows[0];
 await db.exec(readFileSync('supabase/pfpb-periodicidades.sql','utf8'));
 await db.query('update dispensacao_itens set updated_at=now() where id=$1',[itemA]);
 expect((await db.query('select proxima_data::text as data from proximas_previsoes where item_id=$1',[itemA])).rows[0]).toEqual(old);
 }finally{await db.close();}
},30000);
