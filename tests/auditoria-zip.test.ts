import {expect,it} from 'vitest';
import {ZipReader,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';
import {selectZipFiles,zipStream} from '../src/lib/auditoria/zip';
const aid='11111111-1111-4111-8111-111111111111';
const batch='22222222-2222-4222-8222-222222222222';
const file=(id:string,filename='original.pdf',extra={})=>({id,filename,size:3,received_at:'2026-11-01',source:'pharmacy',audit_id:aid,batch_id:batch,storage_path:`${aid}/${batch}/${id}.pdf`,...extra});
const detail={audit:{id:aid,cnpj:'11222333000181'},batches:[{id:batch,number:1,completed_at:'2026-11-01',files:[file('a'),file('b'),file('c','../CON.pdf'),file('d','pendente.pdf',{received_at:null})]},{id:'open',number:2,completed_at:null,files:[file('e')]}]};
it('selects only complete batches and received pharmacy files with safe unique paths',()=>{
 const selected=selectZipFiles(detail,aid);
 expect(selected.map(f=>f.name)).toEqual(['Lote 001/original.pdf','Lote 001/original (2).pdf','Lote 001/.._CON.pdf']);
 expect(selectZipFiles(detail,aid,batch)).toHaveLength(3);
 expect(()=>selectZipFiles(detail,aid,'other')).toThrow();
 expect(()=>selectZipFiles(detail,aid,'open')).toThrow();
 expect(()=>selectZipFiles({...detail,batches:[]},aid)).toThrow();
 expect(()=>selectZipFiles({...detail,batches:[{...detail.batches[0],files:[file('a','x.pdf',{storage_path:'other/secret'})]}]},aid)).toThrow();
});
it('streams a real ZIP64 preserving bytes and every batch folder',async()=>{
 const files=selectZipFiles(detail,aid);const opened:string[]=[];
 const stream=zipStream(files,async(f)=>{opened.push(f.name);return new Response(new Uint8Array([1,2,3])).body!;});
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 const reader=new ZipReader(new Uint8ArrayReader(bytes));
 try{
 const entries=await reader.getEntries();expect(entries.map(e=>e.filename)).toEqual(files.map(f=>f.name));
 for(const e of entries)if(!e.directory)expect(await e.getData!(new Uint8ArrayWriter(),{useWebWorkers:false})).toEqual(new Uint8Array([1,2,3]));
 expect(opened).toHaveLength(3);
 }finally{await reader.close();}
});
it('fails the entire transfer if any file fails or its confirmed size differs',async()=>{
 const files=selectZipFiles(detail,aid);
 await expect(new Response(zipStream(files,async()=>new Response(new Uint8Array([1])).body!)).arrayBuffer()).rejects.toThrow();
 await expect(new Response(zipStream(files,async()=>{throw Error('missing')})).arrayBuffer()).rejects.toThrow('missing');
});
it('cancels source downloads when the output is cancelled',async()=>{
 const controller=new AbortController();let stopped=false;
 const stream=zipStream(selectZipFiles(detail,aid),async(_f,signal)=>{signal.addEventListener('abort',()=>{stopped=true});return new ReadableStream({pull(){}})},controller.signal);
 const reader=stream.getReader();await reader.cancel();await new Promise(r=>setTimeout(r,0));expect(stopped).toBe(true);
});
it('keeps batches separated and writes ZIP64 directory records for large archive compatibility',async()=>{
 const other='33333333-3333-4333-8333-333333333333';
 const selected=selectZipFiles({...detail,batches:[detail.batches[0],{id:other,number:3,completed_at:'2026-11-01',files:[file('z','original.pdf',{batch_id:other,storage_path:`${aid}/${other}/z.pdf`})]}]},aid);
 expect(selected.at(-1)?.name).toBe('Lote 003/original.pdf');
 const bytes=new Uint8Array(await new Response(zipStream(selected,async()=>new Response(new Uint8Array([1,2,3])).body!)).arrayBuffer());
 expect(bytes.some((v,i)=>v===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x06&&bytes[i+3]===0x06)).toBe(true);
});
