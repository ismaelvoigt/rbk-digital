import {afterAll,beforeAll,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,login,rpc,farmA,farmB,admin,gestor,operador} from './fixtures/proximas-db';
let db:PGlite;let pos=20;
beforeAll(async()=>{db=await createDatabase();await db.exec('reset role');if(existsSync('supabase/pfpb-periodicidades.sql'))await db.exec(readFileSync('supabase/pfpb-periodicidades.sql','utf8'));if(existsSync('supabase/pfpb-periodicidades-seed.sql'))await db.exec(readFileSync('supabase/pfpb-periodicidades-seed.sql','utf8'));},30000);
afterAll(async()=>db?.close());
async function item(ean:string|null,date='2026-09-27',fields:Record<string,unknown>={}){
 await db.exec('reset role');const catalog=ean?(await db.query<{produto:string}>('select produto from pfpb_produtos_periodicidade where ean=$1 limit 1',[ean])).rows[0]:null;const data={autorizacao_id:farmA,documento_id:farmA,posicao:++pos,produto:catalog?.produto??'Produto confirmado',ean,unidade:'unidade',data_dispensacao:date,status:'confirmado',...fields};
 const keys=Object.keys(data);const values=Object.values(data);keys.push('origens');values.push(JSON.stringify(Object.fromEntries(Object.keys(data).map(k=>[k,'Documento conferido']))));
 const r=await db.query<{id:string}>(`insert into dispensacao_itens(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,values);return r.rows[0].id;
}
async function previsao(id:string){await db.exec('reset role');return (await db.query<any>('select *, proxima_data::text as proxima, ultima_data::text as ultima, alerta_data::text as alerta from proximas_previsoes where item_id=$1',[id])).rows[0];}
it('catálogo oficial contém as seis periodicidades e mantém dapagliflozina pendente',async()=>{
 const r=await db.query<any>('select distinct periodicidade_dias from pfpb_periodicidades where ativo order by 1');expect(r.rows.map(x=>x.periodicidade_dias)).toEqual([10,25,30,56,80,90]);
 expect((await db.query<any>("select ativo from pfpb_periodicidades where principio_ativo='DAPAGLIFLOZINA'")).rows.every(x=>!x.ativo)).toBe(true);
});
it.each([
 ['fralda',10,'2026-10-07','2026-10-05'],['7896006234050',25,'2026-10-22','2026-10-20'],['7896112126478',30,'2026-10-27','2026-10-25'],
 ['absorvente',56,'2026-11-22','2026-11-20'],['7896006234005',80,'2026-12-16','2026-12-14'],['7894916502900',90,'2026-12-26','2026-12-24'],
])('calcula %s em %s dias com alerta D-2 e snapshot',async(ean,n,proxima,alerta)=>{
 await db.exec('reset role');if(['fralda','absorvente'].includes(ean))ean=(await db.query<any>('select ean from pfpb_produtos_periodicidade where tipo_item=$1 and ativo and regra_chave is not null limit 1',[ean])).rows[0].ean;
 const p=await previsao(await item(ean));expect(p).toMatchObject({intervalo_dias:n,proxima,alerta,origem:'regra_pfpb'});expect(p.regra_snapshot.periodicidade_dias).toBe(n);expect(p.regra_snapshot.fonte).toMatch(/^https:\/\//);expect(p.regra_snapshot.versao).toBe(1);
});
it('EAN desconhecido, data anterior à vigência e contraceptivo sem apresentação não calculam',async()=>{
 for(const [ean,date,fields] of [['7891234567895','2026-09-27',{}],['7896006234050','2026-09-26',{}],[null,'2026-09-27',{principio_ativo:'ETINILESTRADIOL + LEVONORGESTREL',concentracao:'0,03MG + 0,15MG',indicacao:'ANTICONCEPÇÃO',tipo_item:'medicamento'}]] as const){
  expect((await previsao(await item(ean,date,fields))).proxima).toBeNull();
 }
});
it('identidade estruturada completa é alternativa segura sem EAN; EAN desconhecido não cai nela',async()=>{
 const f={principio_ativo:'ETINILESTRADIOL + LEVONORGESTREL',concentracao:'0,03MG + 0,15MG',apresentacao:'3 CARTELAS COM 21 COMPRIMIDOS',indicacao:'ANTICONCEPÇÃO',tipo_item:'medicamento'};
 expect((await previsao(await item(null,'2026-09-27',f))).intervalo_dias).toBe(80);
 expect((await previsao(await item('7891234567895','2026-09-27',f))).proxima).toBeNull();
 expect((await previsao(await item('7896006234050','2026-09-27',f))).proxima).toBeNull();
});
it('mudança normativa não reescreve passado, e nova versão só vale na sua vigência',async()=>{
 const old=await previsao(await item('7896006234050'));await db.exec('reset role');
 await expect(db.query('update pfpb_periodicidades set periodicidade_dias=26 where id=$1',[old.regra_id])).rejects.toThrow(/imutável/);
 await db.query("update pfpb_periodicidades set data_fim='2026-10-01' where id=$1",[old.regra_id]);
 await db.query("insert into pfpb_periodicidades(chave,versao,principio_ativo,concentracao,apresentacao,indicacao,periodicidade_dias,tipo_item,fonte,data_vigencia,ativo,verificado_em) select chave,2,principio_ativo,concentracao,apresentacao,indicacao,26,tipo_item,fonte,'2026-10-01',true,'2026-09-27' from pfpb_periodicidades where id=$1",[old.regra_id]);
 await db.query('update dispensacao_itens set updated_at=now() where id=$1',[old.item_id]);expect(await previsao(old.item_id)).toMatchObject({proxima:old.proxima,regra_snapshot:old.regra_snapshot});
 expect((await previsao(await item('7896006234050','2026-10-01'))).intervalo_dias).toBe(26);
});
it('editar somente contato preserva regra e alterar fonte conserva evidência no histórico',async()=>{
 const id=await item('7896006234005');const p=await previsao(id);await login(db,admin);
 let row=(await rpc(db,'proximas_listar',[farmA,null,null,'historico',0])).linhas.find((x:any)=>x.id===p.id);
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',modo:'manter',nome:'Cliente Teste',telefone:'11999998888',contato_versao:row.contato_versao,referencia:'Contato atualizado'}]);
 expect(await previsao(id)).toMatchObject({origem:'regra_pfpb',regra_snapshot:p.regra_snapshot,proxima:p.proxima});
 await db.query('update dispensacao_itens set quantidade=1,origens=origens||\'{"quantidade":"Conferido"}\' where id=$1',[id]);expect((await previsao(id)).proxima).toBeNull();await login(db,admin);
 const hist=await rpc(db,'proximas_historico',[farmA,p.id]);expect(hist.some((x:any)=>x.detalhes.antes?.regra?.periodicidade_dias===80)).toBe(true);
});
it('compras usa as mesmas datas e limita acesso por farmácia, perfil e catálogo',async()=>{
 await login(db,admin);const d=await rpc(db,'proximas_demanda',[farmA,'2026-11-01','2026-12-31']);expect(d.produtos.some((x:any)=>x.ean==='7894916502900')).toBe(true);
 await expect(rpc(db,'proximas_demanda',[farmB,'2026-09-01','2026-12-31'])).rejects.toThrow(/acesso/);
 await expect(db.exec('update pfpb_periodicidades set ativo=false')).rejects.toThrow(/permission/);
 await login(db,operador);await expect(rpc(db,'proximas_demanda',[farmA,'2026-09-01','2026-12-31'])).rejects.toThrow(/permissão/);
 await login(db,gestor);await expect(rpc(db,'proximas_listar',[null,null,null,'historico',0])).rejects.toThrow(/Selecione/);
});
it('timolol é 25 dias; apresentações não confirmadas e dapagliflozina não recebem padrão',async()=>{
 await db.exec('reset role');
 for(const [principio,expected] of [['MALEATO DE TIMOLOL',25],['DAPAGLIFLOZINA',null],['DIPROPIONATO DE BECLOMETASONA',null]] as const){
  const q=principio==='DIPROPIONATO DE BECLOMETASONA'?" and concentracao='200MCG'":'';
  const e=(await db.query<any>('select ean from pfpb_produtos_periodicidade where ativo and principio_ativo=$1'+q+' limit 1',[principio])).rows[0].ean;
  expect((await previsao(await item(e))).intervalo_dias).toBe(expected);
 }
});
it('virada do ano e ano bissexto usam dias corridos, não meses',async()=>{
 expect((await previsao(await item('7896112126478','2027-01-31'))).proxima).toBe('2027-03-02');
 expect((await previsao(await item('7896112126478','2028-01-31'))).proxima).toBe('2028-03-01');
});
it('alertas só iniciam no D-2 e compras exclui sem cálculo e encerrados',async()=>{
 await db.exec('reset role');const today=(await db.query<any>("select (now() at time zone 'America/Sao_Paulo')::date::text as d")).rows[0].d;
 const id=await item(null,today,{intervalo_retirada_dias:2,retirada_referencia:'Fonte específica confirmada'});const p=await previsao(id);
 await login(db,admin);let alertas=await rpc(db,'proximas_listar',[farmA,null,null,'alertas',0]);expect(alertas.linhas.some((r:any)=>r.id===p.id)).toBe(true);
 const early=await previsao(await item(null,today,{intervalo_retirada_dias:3,retirada_referencia:'Fonte específica confirmada'}));await login(db,admin);
 alertas=await rpc(db,'proximas_listar',[farmA,null,null,'alertas',0]);expect(alertas.linhas.some((r:any)=>r.id===early.id)).toBe(false);
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'retirado'}]);alertas=await rpc(db,'proximas_listar',[farmA,null,null,'alertas',0]);expect(alertas.linhas.some((r:any)=>r.id===p.id)).toBe(false);
});
it('não permite vigências sobrepostas nem uso de regra desativada',async()=>{
 await db.exec('reset role');const r=(await db.query<any>("select * from pfpb_periodicidades where principio_ativo='NORETISTERONA'")).rows[0];
 await expect(db.query("insert into pfpb_periodicidades(chave,versao,principio_ativo,concentracao,apresentacao,indicacao,periodicidade_dias,tipo_item,fonte,data_vigencia,ativo,verificado_em) select chave,2,principio_ativo,concentracao,apresentacao,indicacao,periodicidade_dias,tipo_item,fonte,'2026-10-01',true,verificado_em from pfpb_periodicidades where id=$1",[r.id])).rejects.toThrow(/sobrepostas/);
 const old=await previsao(await item('7896241274903'));await db.query('update pfpb_periodicidades set ativo=false where id=$1',[r.id]);
 expect((await previsao(old.item_id)).proxima).toBe(old.proxima);expect((await previsao(await item('7896241274903'))).proxima).toBeNull();
});

it('EAN e nome de produto contraditórios exigem revisão',async()=>{
 expect((await previsao(await item('7894916502900','2026-09-27',{produto:'LOSARTANA'}))).proxima).toBeNull();
});
