import {expect,it} from 'vitest';
import {periodo,hojeLocal,whatsappUrl,mensagemPadrao} from '../src/lib/proximas/domain';
it('próximos dias excluem hoje e atravessam mês/ano',()=>{
 expect(periodo('2dias','2026-12-31')).toEqual({inicio:'2027-01-01',fim:'2027-01-02',filtro:'periodo'});
 expect(periodo('hoje','2026-09-26')).toEqual({inicio:'2026-09-26',fim:'2026-09-26',filtro:'periodo'});
 expect(periodo('personalizado','2026-09-26','2026-09-01','2026-09-30').fim).toBe('2026-09-30');
 expect(()=>periodo('personalizado','2026-09-26','2026-02-30','2026-03-01')).toThrow();
 expect(()=>periodo('personalizado','2026-09-26','2026-10-01','2026-09-01')).toThrow();
});
it('usa data de São Paulo e não data UTC',()=>expect(hojeLocal(new Date('2026-09-27T01:00:00Z'))).toBe('2026-09-26'));
it('prepara mensagem e link codificado sem dados desnecessários',()=>{
 const msg=mensagemPadrao('Maria','2026-09-28','Farmácia Alfa');
 expect(msg).toBe('Olá, Maria. Tudo bem? Sua próxima retirada de medicamentos pelo Programa Farmácia Popular está prevista para 28/09/2026. Esta é uma mensagem da Farmácia Alfa.');
 const url=new URL(whatsappUrl('(11) 99999-8888',msg));
 expect(url.hostname).toBe('wa.me');expect(url.pathname).toBe('/5511999998888');expect(url.searchParams.get('text')).toBe(msg);
 expect(()=>whatsappUrl('11999998888123',msg)).toThrow();expect(()=>whatsappUrl('texto11999998888',msg)).toThrow();
});

it('resposta incompleta de compras vira erro legível, nunca total parcial',async()=>{
 const {repository}=await import('../src/lib/proximas/repository');
 await expect(repository(async()=>[]).demanda('farm','2026-09-01','2026-09-30')).rejects.toThrow(/incompleta/);
});
