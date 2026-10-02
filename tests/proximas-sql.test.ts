import {afterAll,beforeAll,expect,it} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,login,rpc,farmA,farmB,operador,gestor,itemA,admin} from './fixtures/proximas-db';
let db:PGlite;
beforeAll(async()=>{db=await createDatabase();},30000);
afterAll(async()=>{await db?.close();});
const list=()=>rpc(db,'proximas_listar',[farmA,null,null,'nao_calculado',0]);
it('não inventa 30 dias, mascara CPF e mantém uma previsão por item',async()=>{
 const r=await list();expect(r.total).toBe(1);expect(r.linhas[0]).toMatchObject({proxima_data:null,cpf_mascarado:'***.222.333-**',status:'a_avisar',origem:'nao_calculado'});
 expect(JSON.stringify(r)).not.toContain('11122233344');
 await db.exec('reset role');await db.exec(`update dispensacao_itens set updated_at=now() where id='${itemA}'`);await login(db);
 expect((await list()).total).toBe(1);
});
it('RPC exige CNPJ, recusa outra farmácia, gestor edita nunca, e tabelas são fechadas',async()=>{
 await expect(rpc(db,'proximas_listar',[null,null,null,'nao_calculado',0])).rejects.toThrow(/Selecione/);
 await expect(rpc(db,'proximas_listar',[farmB,null,null,'nao_calculado',0])).rejects.toThrow(/acesso/);
 await expect(db.query('select * from proximas_previsoes')).rejects.toThrow(/permission/);
 const row=(await list()).linhas[0];await login(db,gestor);
 expect((await list()).total).toBe(1);
 await expect(rpc(db,'proximas_salvar',[farmA,row.id,row.versao,{acao:'status',status:'retirado'}])).rejects.toThrow(/permissão/);
 await login(db);
});
it('calcula intervalo confirmado, registra aviso explicitamente e rejeita versão obsoleta',async()=>{
 const row=(await list()).linhas[0];
 await rpc(db,'proximas_salvar',[farmA,row.id,row.versao,{acao:'previsao',nome:'Maria Teste',telefone:'11999998888',contato_versao:row.contato_versao,modo:'intervalo',intervalo_dias:21,referencia:'Intervalo conferido na autorização de teste'}]);
 const next=await rpc(db,'proximas_listar',[farmA,'2000-01-01','2100-01-01','periodo',0]);const updated=next.linhas[0];
 expect(updated.origem).toBe('intervalo_confirmado');expect(updated.status).toBe('a_avisar');
 expect(new Date(updated.proxima_data).getTime()-new Date(updated.ultima_data).getTime()).toBe(21*86400000);
 await rpc(db,'proximas_salvar',[farmA,row.id,updated.versao,{acao:'status',status:'avisado',contato_versao:updated.contato_versao}]);
 const history=await rpc(db,'proximas_historico',[farmA,row.id]);expect(history.some((e:any)=>e.acao==='avisado'&&e.usuario_id===operador&&e.usuario_nome==='Carlos Atendente'&&e.criado_em)).toBe(true);
 await expect(rpc(db,'proximas_salvar',[farmA,row.id,updated.versao,{acao:'status',status:'avisado',contato_versao:updated.contato_versao}])).rejects.toThrow(/alterado/);
});
it('demanda é separada, operacional não consulta compras, retirado sai da previsão',async()=>{
 await expect(rpc(db,'proximas_demanda',[farmA,'2000-01-01','2100-01-01'])).rejects.toThrow(/permissão/);
 await login(db,admin);
 const d=await rpc(db,'proximas_demanda',[farmA,'2000-01-01','2100-01-01']);expect(d.produtos[0].retiradas).toBe(1);expect(d.produtos[0].quantidade_estimada).toBeNull();
 const row=(await rpc(db,'proximas_listar',[farmA,'2000-01-01','2100-01-01','periodo',0])).linhas[0];
 await rpc(db,'proximas_salvar',[farmA,row.id,row.versao,{acao:'status',status:'retirado'}]);
 expect((await rpc(db,'proximas_demanda',[farmA,'2000-01-01','2100-01-01'])).produtos).toHaveLength(0);
});
it('exclusão da fonte preserva auditoria e invalida previsão',async()=>{
 await db.exec('reset role');await db.exec(`delete from dispensacao_itens where id='${itemA}'`);await login(db);
 const r=await rpc(db,'proximas_listar',[farmA,null,null,'historico',0]);expect(r.linhas[0].ativa).toBe(false);
 expect((await rpc(db,'proximas_historico',[farmA,r.linhas[0].id])).some((e:any)=>e.acao==='fonte_invalidada')).toBe(true);
});
it('inativo e anônimo não consultam mesmo com identificadores válidos',async()=>{
 await db.exec(`reset role;update users set status='inactive' where id='${operador}'`);await login(db);
 await expect(list()).rejects.toThrow(/acesso/);
 await db.exec('reset role;set role anon');await expect(list()).rejects.toThrow(/permission/);
});
