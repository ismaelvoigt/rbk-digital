// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({api:vi.fn(),upload:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(),useRouter:()=>({push:m.push})}));
vi.mock('../src/lib/auditoria/client',()=>({managerApi:m.api}));
vi.mock('../src/lib/auditoria/office',()=>({uploadOffice:m.upload,validateOffice:()=>{}}));
import Audits from '../src/app/processos/auditorias/audits';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.resetAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);m.api.mockImplementation(async(path,method,payload)=>method!=='POST'?[]:path===''?(payload.confirm_duplicate?{id:'second'}:{confirmation_required:true,message:'Já existe uma auditoria em andamento. Deseja criar outra?'}):{created:true});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
it.each([true,false])('audit confirmation %s keeps the existing process and only uploads into the accepted new one',async accept=>{
 window.confirm=vi.fn(()=>accept);
 await act(async()=>root.render(<Audits/>));
 const open=[...host.querySelectorAll('button')].find(b=>b.textContent?.includes('Nova auditoria'))!;
 await act(async()=>open.click());
 const form=host.querySelector('form.aud-card')!;
 const cnpj=form.querySelector('input[name=cnpj]') as HTMLInputElement;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(cnpj,'11.222.333/0001-81');cnpj.dispatchEvent(new Event('input',{bubbles:true}));cnpj.dispatchEvent(new Event('change',{bubbles:true}));});
 // Use the browser's FormData shape, with a synthetic local office file.
 const RealFormData=globalThis.FormData;
 vi.stubGlobal('FormData',class extends RealFormData{constructor(){super();this.set('cnpj','11.222.333/0001-81');this.set('pharmacy_name','Teste');this.set('email','test@example.com');this.set('phone','11999999999');this.set('office',new File(['oficio'],'oficio.pdf',{type:'application/pdf'}));}});
 try {
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(window.confirm).toHaveBeenCalledOnce();
 if(accept){expect(m.push).toHaveBeenCalledWith('/processos/auditorias?id=second');expect(m.upload).toHaveBeenCalledWith('second',expect.any(File),expect.any(Function));}
 else {expect(m.upload).not.toHaveBeenCalled();expect(m.push).not.toHaveBeenCalled();expect(host.textContent).toContain('Nova auditoria');}
 }finally{vi.unstubAllGlobals();}
});
it('requires the selected audit CNPJ, clears it when switching audit, and sends confirmation',async()=>{
 const sample=(id:string,cnpj:string,reference:string)=>({audit:{id,cnpj,reference,pharmacy:'Farmácia teste',created_at:'2026-11-01T12:00:00Z',collection:'open',status:'created'},can_delete:true,total_files:0,total_bytes:0,batches:[]});
 m.api.mockResolvedValue([sample('one','11222333000181','Referência A'),sample('two','99888777000166','Referência B')]);
 await act(async()=>root.render(<Audits/>));
 const deletes=()=>[...host.querySelectorAll('button')].filter(b=>b.textContent==='Excluir');
 await act(async()=>deletes()[0].click());
 const region=()=>host.querySelector('[aria-label="Confirmar exclusão"]')!;
 expect(region().textContent).toContain('Referência A');
 const confirm=()=>[...region().querySelectorAll('button')].find(b=>b.textContent==='Confirmar exclusão')!;
 expect(confirm().disabled).toBe(true);
 async function type(value:string){const input=region().querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
 await type('99.888.777/0001-66');expect(confirm().disabled).toBe(true);
 await type('11.222.333/0001-81');expect(confirm().disabled).toBe(false);
 await act(async()=>deletes()[1].click());expect(confirm().disabled).toBe(true);
 expect(region().textContent).toContain('Referência B');
 await type('99.888.777/0001-66');await act(async()=>confirm().click());
 expect(m.api).toHaveBeenCalledWith('/two/delete_empty','POST',{cnpj:'99888777000166',confirmed:true});
});
