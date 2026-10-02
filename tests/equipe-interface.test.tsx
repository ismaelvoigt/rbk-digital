// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import Equipe from '../src/app/equipe/page';
const client={auth:{getSession:async()=>({data:{session:{access_token:'session'}}})}};
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>client}));
let host:HTMLDivElement,root:Root;
const users=[{id:'admin',nome:'Admin',email:'admin@a.co',perfil:'farmacia',status:'active',aceito:true,convite_enviado_em:null},{id:'staff',nome:'Ana',email:'ana@a.co',perfil:'operador',status:'active',aceito:false,convite_enviado_em:null}];
let calls:{method:string;body:any}[];
beforeEach(()=>{calls=[];vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{calls.push({method:init.method,body:init.body?JSON.parse(init.body):null});return new Response(JSON.stringify(init.method==='GET'?{usuarios:users,auditoria:[],actorId:'admin',farmacia:{nome:'Alfa',cnpj:'123'}}:{success:true}),{status:200});}));host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('renderiza equipe, reenvia convite e preserva retorno ao Dashboard',async()=>{
 await act(async()=>root.render(<Equipe/>));
 expect(host.textContent).toContain('Atendente');expect(host.textContent).toContain('Ana');
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/farmacia');
 expect(host.textContent).toContain('← Voltar ao Dashboard');
 const resend=[...host.querySelectorAll('button')].find(b=>b.textContent==='Reenviar convite')!;
 await act(async()=>resend.click());
 expect(calls.find(c=>c.method==='POST')?.body).toEqual({id:'staff',reenviar:true});
 expect(host.textContent).toContain('Convite reenviado.');
});
it('edita funcionário sem trocar e-mail ou perder identidade',async()=>{
 await act(async()=>root.render(<Equipe/>));
 await act(async()=>[...host.querySelectorAll('button')].filter(b=>b.textContent==='Editar')[1].click());
 expect((host.querySelector('input[type=email]') as HTMLInputElement).disabled).toBe(true);
 const select=[...host.querySelectorAll('select')][1];
 await act(async()=>{select.value='inactive';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(calls.find(c=>c.method==='PATCH')?.body).toMatchObject({id:'staff',email:'ana@a.co',status:'inactive'});
});
