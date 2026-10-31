// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import NovaAutorizacao from '../src/app/nova-autorizacao/page';
const m=vi.hoisted(()=>({client:vi.fn(),ocr:vi.fn(()=>new Promise(()=>{}))}));
vi.mock('../src/lib/supabase/client',()=>({createClient:m.client}));
vi.mock('../src/lib/cupons/client',()=>({dispararExtracao:m.ocr}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
vi.mock('../src/components/RbkBrand',()=>({RbkBrand:()=>null}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root,fail:boolean,objects:Map<string,number>,rows:Map<string,Record<string,unknown>>,authorizations:Record<string,unknown>[],loseAuthorization:boolean,confirmationOffline:boolean,upload:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);fail=false;objects=new Map();rows=new Map();authorizations=[];loseAuthorization=false;confirmationOffline=false;
 upload=vi.fn(async(path:string,file:File)=>{if(fail&&path.includes('cupom_fiscal'))return{data:null,error:{message:'offline'}};objects.set(path,file.size);return{data:{path},error:null}});
 m.client.mockReturnValue({
  auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}},error:null})},
  storage:{from:()=>({upload,info:async(path:string)=>({data:objects.has(path)?{size:objects.get(path)}:null,error:null})})},
  from:(table:string)=>({
   insert:(row:Record<string,unknown>)=>({select:()=>({single:async()=>{
     if(table==='autorizacoes'){
      if(authorizations.some(a=>a.id===row.id || a.numero_autorizacao===row.numero_autorizacao))return{data:null,error:{code:'23505'}};
      authorizations.push(row);if(loseAuthorization){loseAuthorization=false;throw new Error('lost acknowledgement')}
     }else rows.set(row.id as string,row);
     return{data:row,error:null};
   }})}),
   select:()=>({eq:(_field:string,id:string)=>({maybeSingle:async()=>table==='autorizacoes'
     ? confirmationOffline ? {data:null,error:{message:'offline'}} : {data:authorizations.find(a=>a.id===id)??null,error:null}
     : {data:rows.get(id)??null,error:null}})}),
  }),
 });
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove()});
async function fillAndAttach(){
 await act(async()=>root.render(<NovaAutorizacao/>));
 for(const [placeholder,value] of [['000.000.000-00','12345678901'],['Ex.: 000.000.000.000.000','111222333444555']]){
  const input=host.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 const cameras=[...host.querySelectorAll<HTMLInputElement>('input[capture]')];
 for(const input of cameras.slice(0,4)){
  Object.defineProperty(input,'files',{value:[new File(['synthetic'],'foto.jpg',{type:'image/jpeg'})]});
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 }
}
async function submit(){await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('confirma documentos sem aguardar leitura de cupons e bloqueia alterações durante retomada',async()=>{
 await fillAndAttach();fail=true;await submit();
 expect(host.textContent).toContain('Tentar novamente');expect(host.textContent).not.toContain('Documentação salva com sucesso');
 expect(authorizations).toHaveLength(1);expect(rows.size).toBe(3);
 expect(host.querySelector('fieldset')?.disabled).toBe(true);
 fail=false;await submit();expect(host.textContent).toContain('Documentação salva com sucesso');expect(authorizations).toHaveLength(1);expect(rows.size).toBe(4);expect(upload).toHaveBeenCalledTimes(5);
});

it('preserva id após duplicidade da própria tentativa e consulta de recuperação offline',async()=>{
 await fillAndAttach();loseAuthorization=true;confirmationOffline=true;
 await submit();await submit();expect(authorizations).toHaveLength(1);
 confirmationOffline=false;await submit();
 expect(host.textContent).toContain('Documentação salva com sucesso');expect(authorizations).toHaveLength(1);expect(rows.size).toBe(4);
});
it('duplicidade de outra autorização informa o erro e libera correção do número',async()=>{
 await fillAndAttach();authorizations.push({id:'other',numero_autorizacao:'111222333444555'});
 await submit();expect(host.textContent).toContain('Esta autorização já está cadastrada');expect(host.querySelector('fieldset')?.disabled).toBe(false);expect(rows.size).toBe(0);
});
