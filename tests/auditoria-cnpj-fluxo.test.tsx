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
