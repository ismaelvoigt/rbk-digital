import {afterEach,beforeEach,expect,it} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,login,rpc,farmA,itemA,operador} from './fixtures/proximas-db';
let db:PGlite;
beforeEach(async()=>{db=await createDatabase();},30000);afterEach(async()=>db?.close());
async function source(sql:string){await db.exec('reset role');await db.exec(sql);await login(db);}
async function all(){return (await rpc(db,'proximas_listar',[farmA,null,null,'historico',0])).linhas;}
it('atualiza a fonte, calcula 10 dias e invalida dados manuais se fonte muda',async()=>{
 await source(`update dispensacao_itens set intervalo_retirada_dias=10,retirada_referencia='Regra e documento confirmados' where id='${itemA}'`);
 let p=(await all())[0];expect(p.origem).toBe('intervalo_fonte');expect(p.intervalo_dias).toBe(10);
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',nome:'Maria',telefone:'11999998888',contato_versao:p.contato_versao,modo:'intervalo',intervalo_dias:22,referencia:'Revisão manual confirmada'}]);
 await source(`update dispensacao_itens set quantidade=60 where id='${itemA}'`);p=(await all())[0];expect(p.origem).toBe('nao_calculado');expect(p.proxima_data).toBeNull();
 expect((await rpc(db,'proximas_historico',[farmA,p.id])).some((e:any)=>e.acao==='fonte_atualizada')).toBe(true);
});
it('intervalo sem referência, data inválida e falta da última data ficam não calculados',async()=>{
 await source(`update dispensacao_itens set intervalo_retirada_dias=10 where id='${itemA}'`);expect((await all())[0].proxima_data).toBeNull();
 await source(`update dispensacao_itens set retirada_prevista_fonte=data_dispensacao-1,retirada_referencia='Data conferida' where id='${itemA}'`);expect((await all())[0].proxima_data).toBeNull();
 await source(`update dispensacao_itens set data_dispensacao=null where id='${itemA}'`);const p=(await all())[0];
 await expect(rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',nome:'Maria',telefone:'11999998888',contato_versao:p.contato_versao,modo:'intervalo',intervalo_dias:10,referencia:'Conferido'}])).rejects.toThrow(/última/);
});
it('não aceita forjar autoria, editar contato com versão antiga ou intervalo decimal',async()=>{
 const p=(await all())[0];
 await expect(rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'retirado',usuario_id:operador}])).rejects.toThrow(/Dados/);
 await expect(rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',contato_versao:99,modo:'nao_calculado',referencia:'Sem regra'}])).rejects.toThrow(/Contato alterado/);
 await expect(rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',contato_versao:p.contato_versao,modo:'intervalo',intervalo_dias:1.2,referencia:'Sem regra'}])).rejects.toThrow();
});
it('RLS mantém isolamento mesmo com concessão acidental de SELECT',async()=>{
 await db.exec('reset role;grant select on proximas_previsoes,proximas_contatos,proximas_eventos to authenticated');await login(db);
 expect((await db.query('select distinct farmacia_id from proximas_previsoes')).rows).toEqual([{farmacia_id:farmA}]);
 await expect(db.exec('update proximas_previsoes set status=\'retirado\'')).rejects.toThrow(/permission/);
});

it('histórico preserva cálculo anterior e novo sem revelar CPF completo',async()=>{
 await source(`update dispensacao_itens set intervalo_retirada_dias=10,retirada_referencia='Regra v1' where id='${itemA}'`);
 const p=(await all())[0];
 await source(`update dispensacao_itens set intervalo_retirada_dias=21,retirada_referencia='Regra v2' where id='${itemA}'`);
 const history=await rpc(db,'proximas_historico',[farmA,p.id]);
 const event=history.find((e:any)=>e.detalhes.antes?.origem==='intervalo_fonte');
 expect(event.detalhes.antes.referencia).toBe('Regra v1');
 expect(event.detalhes.depois.referencia).toBe('Regra v2');
 expect(JSON.stringify(history)).not.toContain('11122233344');
});
it('sem unidade confirmada, intervalo automático não calcula',async()=>{
 await source(`update dispensacao_itens set unidade=null,intervalo_retirada_dias=10,retirada_referencia='Regra v1' where id='${itemA}'`);
 expect((await all())[0].proxima_data).toBeNull();
});
it('concluídos saem do filtro normal e continuam no histórico',async()=>{
 let p=(await all())[0];
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',nome:'Maria',telefone:'11999998888',contato_versao:p.contato_versao,modo:'intervalo',intervalo_dias:21,referencia:'Conferido'}]);p=(await all())[0];
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'retirado'}]);
 expect((await rpc(db,'proximas_listar',[farmA,'2000-01-01','2100-01-01','periodo',0])).total).toBe(0);
 expect((await all())[0].status).toBe('retirado');
});
it('novo aviso confirmado gera outro evento e recusa contato desatualizado',async()=>{
 let p=(await all())[0];
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'previsao',nome:'Maria',telefone:'11999998888',contato_versao:p.contato_versao,modo:'intervalo',intervalo_dias:21,referencia:'Conferido'}]);p=(await all())[0];
 await expect(rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'avisado',contato_versao:p.contato_versao-1}])).rejects.toThrow(/Contato alterado/);
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'avisado',contato_versao:p.contato_versao}]);p=(await all())[0];
 await rpc(db,'proximas_salvar',[farmA,p.id,p.versao,{acao:'status',status:'avisado',contato_versao:p.contato_versao}]);
 expect((await rpc(db,'proximas_historico',[farmA,p.id])).filter((e:any)=>e.acao==='avisado')).toHaveLength(2);
});
