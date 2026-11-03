import {it,expect} from 'vitest';
import {ExportEngine,sha256,type ExportJob,type ExportPart} from '../src/lib/auditoria/export-engine';
import {localRecord,centralDirectory,crc32,localLength} from '../src/lib/auditoria/export-zip64';
it.runIf(process.env.RBK_EXPORT_STRESS==='1')('processes and verifies over 4 GiB through short checkpoints with bounded memory',async()=>{
 const source=Buffer.alloc(32*1024**2,17),hash=sha256(source),crc=crc32(source),count=130;
 const j={id:'stress',state:'queued',files:Array.from({length:count},(_,i)=>({name:`Lote 001/ficticio-${i}.pdf`,path:String(i),size:source.length,sha256:hash})),expires_at:new Date(Date.now()+86400000).toISOString(),upload_id:null,prepared_files:0,verified_parts:0,total_files:count} as ExportJob;
 const parts:ExportPart[]=[];let length=0,peak=process.memoryUsage().rss;
 const store={get:async()=>j,update:async(v:Partial<ExportJob>)=>{Object.assign(j,v);},parts:async()=>parts,save:async(p:ExportPart)=>{const i=parts.findIndex(x=>x.number===p.number);if(i<0)parts.push(p);else parts[i]=p;},purge:async()=>{}};
 const engine=new ExportEngine(store,{begin:async()=> 'multipart',source:async()=>source,upload:async(_id,n)=>{peak=Math.max(peak,process.memoryUsage().rss);return 'etag-'+n;},complete:async()=>{length=parts.reduce((n,p)=>n+p.bytes,0);},head:async()=>length,
 range:async(start,end)=>{const part=parts.find(p=>p.start_offset===start)!;const entry=part.entries[0];const local=localRecord({...entry,crc},source);const data=part.number===count?Buffer.concat([local,centralDirectory(parts.flatMap(p=>p.entries),entry.offset+localLength(entry.name,entry.size))]):local;expect(data.length).toBe(end-start+1);return data;},
 abort:async()=>{},remove:async()=>{},savePending:async()=>{throw Error('Unexpected staging');},readPending:async()=>{throw Error('Unexpected staging');},discard:async()=>{}},async()=>{});
 await engine.initialize();let cursor=0;while(!await engine.advance(cursor))cursor++;expect(cursor+1).toBe(count);await engine.finish();for(let i=1;i<=parts.length;i++)await engine.verify(i);await engine.ready();
 expect(j.state).toBe('ready');expect(length).toBeGreaterThan(4*1024**3);expect(parts.at(-1)!.entries[0].offset).toBeGreaterThan(0xffffffff);expect(peak).toBeLessThan(1024**3);
},300000);
