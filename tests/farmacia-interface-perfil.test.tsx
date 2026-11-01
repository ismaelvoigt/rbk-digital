// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import FarmaciaPage from '../src/app/farmacia/page';
import NovaAutorizacao from '../src/app/nova-autorizacao/page';
const m=vi.hoisted(()=>({plano:'completo',nomeFantasia:'Farmácia Alfa',perfil:'operador',admin:false,client:vi.fn(),contexto:vi.fn(),listar:vi.fn(),router:{push:vi.fn()}}));
vi.mock('../src/lib/supabase/client',()=>({createClient:m.client}));
vi.mock('../src/lib/proximas/repository',()=>({supabaseRepository:{contexto:m.contexto,listar:m.listar}}));
vi.mock('next/navigation',()=>({useRouter:()=>m.router}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
vi.mock('next/image',()=>({default:({src,alt}:{src:string;alt:string})=><img src={src} alt={alt}/>}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);m.plano='completo';m.nomeFantasia='Farmácia Alfa';m.perfil='operador';m.admin=false;m.contexto.mockReset();m.listar.mockReset();
 m.contexto.mockResolvedValue({gestor:false,farmacias:[{id:'farm'}]});m.listar.mockResolvedValue({resumo:{hoje:0,dias2:0,dias7:0,dias30:0,alertas:0}});
 m.client.mockReturnValue({auth:{getUser:async()=>({data:{user:{id:'user',email:'synthetic@example.invalid'}},error:null})},from:(table:string)=>{
  const b={select:()=>b,eq:()=>b,order:()=>b,range:async()=>({data:[],error:null}),maybeSingle:async()=>({data:table==='users'?{perfil:m.perfil,status:'active',farm_id:'farm'}:table==='farms'?{plano:m.plano,nome_fantasia:m.nomeFantasia,razao_social:'Alfa Ltda'}:m.admin?{user_id:'user'}:null,error:null})};return b;
 }});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove()});
it('atendente vê cadastro e consulta sem busca, próximas dispensações ou pendências',async()=>{
 await act(async()=>root.render(<FarmaciaPage/>));
 expect(host.querySelector('a[href="/nova-autorizacao"]')).not.toBeNull();expect(host.querySelector('a[href="/autorizacoes"]')).not.toBeNull();
 expect(host.textContent).not.toContain('Próximas Dispensações');expect(host.querySelector('a[href="/pendencias"]')).toBeNull();expect(host.querySelector('input[type="search"]')).toBeNull();expect(m.contexto).not.toHaveBeenCalled();
});
it.each(['gerente_farmacia','administrador_farmacia','farmacia'])('mantém acompanhamento e pesquisa para %s',async perfil=>{
 m.perfil=perfil;await act(async()=>root.render(<FarmaciaPage/>));
 expect(host.textContent).toContain('Próximas Dispensações');expect(host.querySelector('a[href="/pendencias"]')).not.toBeNull();expect(host.querySelector('input[type="search"]')).not.toBeNull();
});
it.each(['operador','gerente_farmacia'])('textos introdutórios seguem perfil %s sem ocultar progresso ou envio',async perfil=>{
 m.perfil=perfil;await act(async()=>root.render(<NovaAutorizacao/>));
 for(const text of ['Informe o CPF, o número da autorização e anexe os documentos.','As fotos ficam selecionadas nesta tela','Selecionar não salva.']){
  if(perfil==='operador')expect(host.textContent).not.toContain(text);else expect(host.textContent).toContain(text);
 }
 expect(host.textContent).toContain('0 de 4 documentos obrigatórios selecionados');expect(host.querySelector('button[type="submit"]')?.textContent).toContain('Salvar autorização');
});

it('preserva busca administrativa quando rbk_admins prevalece sobre perfil legado operador',async()=>{
 m.admin=true;await act(async()=>root.render(<FarmaciaPage/>));
 const input=host.querySelector<HTMLInputElement>('input[type="search"]');expect(input).not.toBeNull();
 await act(async()=>input!.focus());expect(host.querySelector('a[href="/usuarios/novo"]')).not.toBeNull();
});

it('administrador no plano armazenamento mantém equipe, sem atalhos avançados',async()=>{
 m.perfil='administrador_farmacia';m.plano='armazenamento';await act(async()=>root.render(<FarmaciaPage/>));
 expect(host.querySelector('a[href="/equipe"]')).not.toBeNull();expect(host.querySelector('a[href="/administracao"]')).toBeNull();expect(host.querySelector('a[href="/pendencias"]')).toBeNull();expect(m.contexto).not.toHaveBeenCalled();
 const input=host.querySelector<HTMLInputElement>('input[type="search"]')!;await act(async()=>input.focus());expect(host.querySelector('a[href="/vendas"]')).toBeNull();expect(host.querySelector('a[href="/equipe"]')).not.toBeNull();
});
it.each([['Farmácia Alfa','Farmácia Alfa'],['','Alfa Ltda']])('nome inicial usa cadastro da farmácia: %s',async(nome,expected)=>{
 m.nomeFantasia=nome;await act(async()=>root.render(<FarmaciaPage/>));expect(host.querySelector('h1')?.textContent?.trim()).toBe(expected);
});
