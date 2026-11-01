// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import DocumentUploadCard from '../src/components/documentos/DocumentUploadCard';
import DocumentoSucesso from '../src/app/autorizacoes/[id]/documentos/sucesso/page';
const m=vi.hoisted(()=>({client:vi.fn(),storage:vi.fn(),rows:[] as unknown[],info:vi.fn()}));
vi.mock('../src/lib/supabase/client',()=>({createClient:m.client}));
vi.mock('../src/lib/auth/useNavegacaoPerfil',()=>({useNavegacaoPerfil:()=>null}));
vi.mock('next/navigation',()=>({useParams:()=>({id:'synthetic'})}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);m.rows=[];m.info.mockReset();m.info.mockResolvedValue({data:{size:5},error:null});
 m.storage.mockReset();m.storage.mockImplementation(()=>({info:m.info}));
 m.client.mockReturnValue({
   storage:{from:m.storage},
   from:(table:string)=>({select:()=>({eq:()=>{
     if(table==='autorizacoes') return {single:async()=>({data:{numero_autorizacao:'123'},error:null})};
     return Promise.resolve({data:m.rows,error:null});
   }})}),
 });
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove()});
it('selecionar foto indica que ainda não está salva sem iniciar upload',async()=>{
 await act(async()=>root.render(<DocumentUploadCard title="Documento" onFileChange={()=>{}}/>));
 const input=host.querySelector('input[type=file]') as HTMLInputElement;
 Object.defineProperty(input,'files',{value:[new File(['abc'],'foto.jpg',{type:'image/jpeg'})]});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 expect(host.textContent).toContain('Selecionado — ainda não salvo');expect(m.storage).not.toHaveBeenCalled();
});
it('acesso direto à confirmação sem documentos não afirma sucesso',async()=>{
 await act(async()=>root.render(<DocumentoSucesso/>));
 expect(host.textContent).not.toContain('Documento enviado com sucesso!');expect(host.textContent).toContain('Não foi possível confirmar');
});
it('registro sem objeto armazenado não afirma sucesso',async()=>{
 m.rows=[{id:'doc',status:'recebido',caminho_arquivo:'missing'}];m.info.mockResolvedValue({data:null,error:{message:'not found'}});
 await act(async()=>root.render(<DocumentoSucesso/>));expect(host.textContent).not.toContain('Documento enviado com sucesso!');
});
it('confirma sucesso somente depois da verificação do armazenamento',async()=>{
 m.rows=[{id:'doc',status:'recebido',caminho_arquivo:'exists'}];let finish:(v:unknown)=>void=()=>{};
 m.info.mockReturnValue(new Promise(resolve=>{finish=resolve}));
 await act(async()=>root.render(<DocumentoSucesso/>));expect(host.textContent).not.toContain('Documento enviado com sucesso!');
 await act(async()=>finish({data:{size:5},error:null}));expect(host.textContent).toContain('Documento enviado com sucesso!');
});
it('card compacto recolhe a prévia após seleção e permite conferir sem perder o arquivo',async()=>{
 let selected:File|null=null;
 await act(async()=>root.render(<DocumentUploadCard title="Documento" compactarAposSelecionar onFileChange={file=>{selected=file}}/>));
 const input=host.querySelector('input[type=file]') as HTMLInputElement;
 const photo=new File(['abc'],'foto.jpg',{type:'image/jpeg'});
 Object.defineProperty(input,'files',{value:[photo]});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('foto.jpg');expect(host.textContent).toContain('Selecionado — ainda não salvo');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Conferir arquivo')!.click());
 expect(host.querySelector('img')).not.toBeNull();expect(selected).toBe(photo);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Recolher')!.click());expect(host.querySelector('img')).toBeNull();
});
it('card de opcionais compacto permite conferir e remover arquivos',async()=>{
 let selected:File[]=[];
 await act(async()=>root.render(<DocumentUploadCard title="Outros" compactarAposSelecionar multiple onFilesChange={files=>{selected=files}}/>));
 const input=host.querySelector('input[type=file]') as HTMLInputElement;
 Object.defineProperty(input,'files',{value:[new File(['abc'],'outro.pdf',{type:'application/pdf'})]});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 expect(host.textContent).not.toContain('Remover');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Conferir arquivos')!.click());
 expect(host.textContent).toContain('outro.pdf');
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Remover')!.click());expect(selected).toHaveLength(0);
 expect(host.textContent).not.toContain('Conferir arquivos');
});
