// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import DocumentosAutorizacao from '../src/app/autorizacoes/[id]/documentos/page';
const m=vi.hoisted(()=>({client:vi.fn(),router:{push:vi.fn(),replace:vi.fn()}}));
vi.mock('../src/lib/supabase/client',()=>({createClient:m.client}));
vi.mock('../src/lib/auth/useNavegacaoPerfil',()=>({useNavegacaoPerfil:()=>null}));
vi.mock('next/navigation',()=>({useParams:()=>({id:'synthetic'}),useRouter:()=>m.router}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());host.remove()});
it('oferece retorno enquanto a consulta está pendente',async()=>{
 m.client.mockReturnValue({auth:{getUser:()=>new Promise(()=>{})}});
 await act(async()=>root.render(<DocumentosAutorizacao/>));
 expect(host.textContent).toContain('Carregando documentos');expect(host.querySelector('a[href="/autorizacoes"]')).not.toBeNull();
});
it('falha de rede mostra erro e permite nova tentativa sem afirmar lista vazia',async()=>{
 const getUser=vi.fn(async()=>{throw Error('offline')});m.client.mockReturnValue({auth:{getUser}});
 await act(async()=>root.render(<DocumentosAutorizacao/>));expect(host.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar');
 expect(host.textContent).not.toContain('Documentos arquivados');
 const anteriores=getUser.mock.calls.length;
 await act(async()=>host.querySelector('button')!.click());expect(getUser).toHaveBeenCalledTimes(anteriores+1);
});
it.each(['operador','gerente_farmacia','administrador_farmacia','farmacia'])('conferência de cupons respeita o perfil %s sem afetar documentos',async perfil=>{
 const consultas:string[]=[];
 m.client.mockReturnValue({auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}},error:null})},from:(table:string)=>{
  consultas.push(table);
  const b={select:()=>b,eq:()=>b,in:()=>b,order:()=>b,
   single:async()=>({data:{numero_autorizacao:'123'},error:null}),
   maybeSingle:async()=>({data:table==='users'?{perfil,status:'active'}:null,error:null}),
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve)};
  return b;
 }});
 await act(async()=>root.render(<DocumentosAutorizacao/>));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
 expect(host.textContent).toContain('Documentos da autorização');expect([...host.querySelectorAll('button')].some(b=>b.textContent?.includes('Confirmar'))).toBe(true);
 if(perfil==='operador'){
  expect(host.textContent).not.toContain('Itens dos cupons');expect(consultas).not.toContain('cupom_extracoes');
 }else{
  expect(host.textContent).toContain('Itens dos cupons');expect(consultas).toContain('cupom_extracoes');
 }
});
