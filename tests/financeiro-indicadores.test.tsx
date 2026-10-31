// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import Financeiro from '../src/components/gestao/Financeiro';
import {gestao} from '../src/lib/gestao/client';
vi.mock('../src/lib/gestao/client',async importOriginal=>({...await importOriginal<object>(),gestao:vi.fn()}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement;
const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,10));});
const report=(atrasados:number)=>({
 items:[],
 total:0,
 indicadores:{mrr:120,recebido_mes:100,a_receber:50,atrasados,quantidade_atrasados:atrasados?1:0,assinaturas_ativas:2},
});
async function renderFinanceiro(atrasados:number){
 vi.mocked(gestao).mockImplementation(async action=>action==='financeiro'?report(atrasados) as never:undefined as never);
 await act(async()=>root.render(<Financeiro/>));
 await settle();
}
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(gestao).mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('mostra os cinco indicadores com as cores, ícones e valores esperados',async()=>{
 await renderFinanceiro(0);
 const metrics=[
  ['MRR RBK Digital','#6366F1','120,00','Receita recorrente'],
  ['Recebido no mês','#16A34A','100,00','Valores recebidos'],
  ['A receber','#2563EB','50,00','Pagamentos pendentes'],
  ['Em atraso','#DC2626','0,00','Sem atrasos'],
  ['Assinaturas ativas','#7C3AED','2','Clientes ativos'],
 ];
 for(const [label,color,value,description] of metrics){
  const card=[...host.querySelectorAll('article')].find(element=>element.textContent?.includes(label));
  expect(card,`card ${label}`).toBeDefined();
  expect(card?.className).toContain('bg-white');
  expect(card?.textContent).toContain(value);
  expect(card?.textContent).toContain(description);
  expect(card?.querySelector('[data-color]')?.getAttribute('data-color')).toBe(color);
  expect(card?.querySelector('svg')).not.toBeNull();
 }
 expect(host.textContent).toContain('Sem atrasos');
});
it('destaca valores vencidos em vermelho quando há atraso',async()=>{
 await renderFinanceiro(75);
 const card=[...host.querySelectorAll('article')].find(element=>element.textContent?.includes('Em atraso'));
 expect(card?.textContent).toContain('75,00');
 expect(card?.textContent).toContain('Valores vencidos');
 expect(card?.textContent).not.toContain('Sem atrasos');
 expect(card?.querySelector('[data-status="overdue"]')?.className).toContain('text-red-700');
});