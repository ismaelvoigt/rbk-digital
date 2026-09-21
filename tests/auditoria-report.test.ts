import {it,expect} from 'vitest';
import {receiptFindings} from '../src/lib/auditoria/report';
import type {Summary} from '../src/lib/auditoria/domain';
const sample = {audit:{id:'a'},batches:[],offices:[]} as unknown as Summary;
it('aponta ofício ausente sem inferir irregularidade nas autorizações',()=>{
 expect(receiptFindings(sample).map(x=>x.id)).toEqual(['office','empty']);
});
it('distingue arquivo recebido, bloqueado e envio não concluído',()=>{
 const d={...sample,offices:[{id:'o',received_at:'2026-09-19',scan:'clean'}],batches:[{id:'b',completed_at:null,files:[{id:'f',filename:'teste.pdf',received_at:null,scan:'pending'}]}]} as Summary;
 expect(receiptFindings(d).map(x=>x.id)).toEqual(['empty','batch-b']);
 const ready={...d,batches:[{...d.batches[0],completed_at:'2026-09-19',files:[{...d.batches[0].files[0],received_at:'2026-09-19',scan:'clean'}]}]};
 expect(receiptFindings(ready)).toEqual([]);
 expect(receiptFindings({...ready,batches:[{...ready.batches[0],files:[{...ready.batches[0].files[0],scan:'infected'}]}]})[0].level).toBe('blocked');
});
