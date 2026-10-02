// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createClient as supabaseClient, type SupabaseClient} from '@supabase/supabase-js';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import Administracao from '../src/components/modulos/Administracao';
import Farmacia from '../src/app/farmacia/page';
vi.mock('next/navigation',()=>({useRouter:()=>({push:()=>{}})}));
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>client}));
declare global { interface Window { happyDOM: {setWindowSize(size: {width:number;height:number}):void} } }
let client:SupabaseClient,root:Root,host:HTMLDivElement,role:string;
let calls:{name:string;args:Record<string,unknown>}[];
const farms=[
 {id:'10000000-0000-4000-8000-000000000001',nome_fantasia:'Farmácia Alfa',razao_social:'Alfa Ltda',cnpj:'12345678000190'},
 {id:'10000000-0000-4000-8000-000000000002',nome_fantasia:'Farmácia Beta',razao_social:'Beta Ltda',cnpj:'98765432000100'},
];
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
const settle=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,400));});};
const click=async(text:string)=>{
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent===text||b.querySelector('h2')?.textContent===text);
 expect(button,`botão ${text}`).toBeTruthy();
 await act(async()=>button!.click());await settle();
};
const select=async(id:string)=>{
 const input=host.querySelector('select#selecao-farmacia') as HTMLSelectElement;
 await act(async()=>{input.value=id;input.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
};
beforeEach(()=>{
 role='gestor_rbk';calls=[];
 window.happyDOM.setWindowSize({width:1440,height:1000});
 client=supabaseClient('https://example.invalid','test-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const name=new URL(String(input)).pathname.split('/').pop()!;
  const args=init?.body?JSON.parse(String(init.body)):{};calls.push({name,args});
  let data:unknown=[];
  if(name==='users')data={perfil:role,status:'active',farm_id:farms[0].id};
  if(name==='rbk_admins')data=null;
  if(name==='modulos_farmacias'){
   const q=String(args.p_busca||'').toLowerCase();
   data=farms.filter((f,i)=>(role==='gestor_rbk'||i===0)&&(!q||f.razao_social.toLowerCase().includes(q)||f.cnpj.includes(q.replace(/\D/g,'')||'INVALID')));
  }
  if(name==='compras_obter')data=null;
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});
 }}});
 vi.spyOn(client.auth,'getUser').mockResolvedValue({data:{user:{id:'20000000-0000-4000-8000-000000000001'}},error:null} as never);
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
it('gestor só vê cards após selecionar; navega pelos três módulos no mesmo CNPJ e troca sem misturar resultados',async()=>{
 await act(async()=>root.render(<Administracao/>));await settle();
 expect(host.textContent).toContain('Selecione uma farmácia/CNPJ');
 expect(host.querySelectorAll('h2')).toHaveLength(0);
 expect(calls.filter(c=>['modulos_autorizacoes','modulos_itens','compras_obter'].includes(c.name))).toEqual([]);
 await select(farms[0].id);
 expect([...host.querySelectorAll('h2')].map(n=>n.textContent)).toEqual(['Vendas e Indicadores','Planejamento de Compras','Relatórios e PDFs']);
 await click('Vendas e Indicadores');
 expect(calls.filter(c=>c.name==='modulos_autorizacoes').length).toBeGreaterThan(0);
 await click('Planejamento de Compras');
 await vi.waitFor(async()=>{await settle();expect(calls.some(c=>c.name==='compras_obter')).toBe(true);},{timeout:5000});
 await click('Relatórios e PDFs');
 await click('Pesquisar');
 expect(calls.filter(c=>c.name==='modulos_autorizacoes').every(c=>c.args.p_farm===farms[0].id)).toBe(true);
 const prior=calls.length;
 await select(farms[1].id);
 expect(host.querySelector('[aria-label="Farmácia selecionada"]')?.textContent).toContain('98.765.432/0001-00');
 expect(host.querySelector('[aria-label="Farmácia selecionada"]')?.textContent).not.toContain('Alfa');
 expect(host.querySelectorAll('h2')).toHaveLength(3);
 await click('Vendas e Indicadores');
 expect(calls.slice(prior).filter(c=>c.name==='modulos_autorizacoes').every(c=>c.args.p_farm===farms[1].id)).toBe(true);
 await select('');
 expect(host.querySelectorAll('h2')).toHaveLength(0);
});
it('farmácia usa o vínculo do login sem seletor e mantém somente um card administrativo no dashboard',async()=>{
 role='farmacia';await act(async()=>root.render(<Farmacia/>));await settle();
 expect(host.querySelectorAll('a[href="/administracao"]')).toHaveLength(1);
 expect(host.querySelectorAll('a[href="/vendas"],a[href="/compras"],a[href="/relatorios"]')).toHaveLength(0);
 expect(host.querySelector('a[href="/nova-autorizacao"]')).toBeTruthy();
 expect(host.querySelector('a[href="/administracao"]')?.className).toContain('hidden');
 expect(host.querySelector('a[href="/administracao"]')?.className).toContain('lg:block');
 await act(async()=>root.render(<Administracao/>));await settle();
 expect(host.querySelector('#selecao-farmacia')).toBeNull();
 expect(host.textContent).toContain('12.345.678/0001-90');
 await click('Vendas e Indicadores');
 expect(calls.filter(c=>c.name==='modulos_autorizacoes').every(c=>c.args.p_farm===farms[0].id)).toBe(true);
});
it('mobile da farmácia não monta os módulos nem consulta seus dados mesmo pelo acesso direto',async()=>{
 role='farmacia';window.happyDOM.setWindowSize({width:390,height:844});
 await act(async()=>root.render(<Administracao moduloInicial="vendas"/>));await settle();
 expect(host.textContent).toContain('disponível na versão desktop');
 expect(host.querySelectorAll('h2')).toHaveLength(0);
 expect(calls.filter(c=>['modulos_autorizacoes','modulos_itens','compras_obter'].includes(c.name))).toEqual([]);
});
it('nova visita exige seleção de novo e parâmetro inválido não abre outro módulo',async()=>{
 await act(async()=>root.render(<Administracao moduloInicial="invalid"/>));await settle();
 await select(farms[0].id);expect(host.querySelectorAll('h2')).toHaveLength(3);
 await act(async()=>root.render(<p>Dashboard</p>));
 await act(async()=>root.render(<Administracao/>));await settle();
 expect(host.querySelectorAll('h2')).toHaveLength(0);
 expect(host.textContent).toContain('Selecione uma farmácia/CNPJ');
});

it.each([
 ['operador',false,false],['gerente_farmacia',true,false],['farmacia',true,true],['administrador_farmacia',true,true],
])('painel %s mostra somente os acessos permitidos',async(perfil,administracao,equipe)=>{
 role=String(perfil);await act(async()=>root.render(<Farmacia/>));await settle();
 expect(!!host.querySelector('a[href="/administracao"]')).toBe(administracao);
 expect(!!host.querySelector('a[href="/equipe"]')).toBe(equipe);
 expect(!!host.querySelector('a[href="/nova-autorizacao"]')).toBe(true);
 expect(!!host.querySelector('a[href="/pendencias"]')).toBe(true);
});
