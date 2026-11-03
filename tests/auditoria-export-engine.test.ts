import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {ZipReader,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';
import {ExportEngine,type ExportJob,type ExportPart} from '../src/lib/auditoria/export-engine';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const source=Buffer.from('PDF fictício sem validade');
 const job={id:'j',state:'queued',files:[{name:'Lote 001/ficticio.pdf',path:'src',size:source.length,sha256:sha(source)}],expires_at:new Date(Date.now()+86400000).toISOString(),object_path:'j.zip',upload_id:null,total_files:1,prepared_files:0,verified_parts:0} as ExportJob;
 const pending=new Map<string,Buffer>();const parts:ExportPart[]=[];const uploaded=new Map<number,Buffer>();let archive=Buffer.alloc(0);
 const storage={savePending:vi.fn(async(k:string,b:Buffer)=>{pending.set(k,b);}),readPending:vi.fn(async(k:string)=>pending.get(k)!),discard:vi.fn(async(k:string)=>{pending.delete(k);}),begin:vi.fn(async()=> 'upload'),source:vi.fn(async()=>source),upload:vi.fn(async(_u:string,n:number,b:Buffer)=>{uploaded.set(n,b);return 'etag-'+n;}),complete:vi.fn(async()=>{archive=Buffer.concat([...uploaded.values()]);}),head:vi.fn(async()=>archive.length),range:vi.fn(async(start:number,end:number)=>archive.subarray(start,end+1)),abort:vi.fn(async()=>{}),remove:vi.fn(async()=>{})};
 const store={purge:async(state:string)=>{parts.splice(0);job.state=state;job.files=[];},get:async()=>job,update:async(v:Partial<ExportJob>)=>{Object.assign(job,v);},parts:async()=>parts,save:async(p:ExportPart)=>{const i=parts.findIndex(x=>x.number===p.number);if(i>=0)parts[i]=p;else parts.push(p);}};
 const authorize=vi.fn(async()=>{});return {engine:new ExportEngine(store,storage,authorize),store,job,parts,storage,authorize,archive:()=>archive};
}
it('does not release an archive until every stored part has been read and verified',async()=>{
 const f=fixture();const total=await f.engine.initialize();expect(total).toBe(1);
 await f.engine.advance(0);await f.engine.finish();expect(f.job.state).toBe('validating');
 await expect(f.engine.ready()).rejects.toThrow();await f.engine.verify(1);await f.engine.ready();expect(f.job.state).toBe('ready');await f.engine.ready();expect(f.job.state).toBe('ready');
 const r=new ZipReader(new Uint8ArrayReader(f.archive()));const entries=await r.getEntries();if(entries[0].directory)throw Error('directory');expect(Buffer.from(await entries[0].getData!(new Uint8ArrayWriter(),{checkSignature:true})).toString()).toContain('fictício');await r.close();
});
it('resumes an already prepared part without fetching the source twice',async()=>{
 const f=fixture();await f.engine.initialize();await f.engine.advance(0);await f.engine.advance(0);expect(f.storage.source).toHaveBeenCalledTimes(1);expect(f.parts).toHaveLength(1);
});
it('blocks checksum changes, revoked access and corrupted stored bytes',async()=>{
 const f=fixture();await f.engine.initialize();f.storage.source.mockResolvedValueOnce(Buffer.from('x'.repeat(f.job.files[0].size)));await expect(f.engine.advance(0)).rejects.toThrow();expect(f.storage.upload).not.toHaveBeenCalled();
 const g=fixture();await g.engine.initialize();await g.engine.advance(0);await g.engine.finish();g.storage.range.mockResolvedValueOnce(Buffer.from('corrupt'));await expect(g.engine.verify(1)).rejects.toThrow();expect(g.job.state).not.toBe('ready');
 g.authorize.mockRejectedValueOnce(Error('revoked'));await expect(g.engine.verify(1)).rejects.toThrow('revoked');
});
it('expiry cleans temporary data and never modifies sources',async()=>{
 const f=fixture();await f.engine.initialize();await f.engine.cleanup('expired');expect(f.storage.abort).toHaveBeenCalled();expect(f.storage.remove).toHaveBeenCalled();expect(f.job.state).toBe('expired');
});

it('checkpoints many tiny files independently of multipart minimum size',async()=>{const f=fixture();f.job.files=Array.from({length:40},(_,i)=>({...f.job.files[0],name:`Lote 001/${i}.pdf`,path:String(i)}));f.job.total_files=40;await f.engine.initialize();expect(await f.engine.advance(0)).toBe(false);expect(f.storage.source).toHaveBeenCalledTimes(16);expect(f.storage.upload).not.toHaveBeenCalled();expect(f.job.prepared_files).toBe(16);await f.engine.advance(0);expect(f.storage.source).toHaveBeenCalledTimes(16);expect(await f.engine.advance(1)).toBe(false);expect(await f.engine.advance(2)).toBe(true);await f.engine.finish();await f.engine.verify(1);await f.engine.ready();expect(f.parts[0].entries).toHaveLength(40);});

it('retries a lost final checkpoint without duplicating central-directory entries',async()=>{
 const f=fixture();await f.engine.initialize();const update=f.store.update;let interrupted=false;
 f.store.update=async value=>{if(value.build&&!interrupted){interrupted=true;throw Error('lost checkpoint');}await update(value);};
 await expect(f.engine.advance(0)).rejects.toThrow('lost checkpoint');expect(f.parts).toHaveLength(1);
 await f.engine.advance(0);await f.engine.finish();await f.engine.verify(1);await f.engine.ready();
 const reader=new ZipReader(new Uint8ArrayReader(f.archive()));expect((await reader.getEntries()).map(e=>e.filename)).toEqual(['Lote 001/ficticio.pdf']);await reader.close();
});
