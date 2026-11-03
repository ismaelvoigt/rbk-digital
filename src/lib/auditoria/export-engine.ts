import {createHash} from 'node:crypto';
import {centralDirectory,crc32,localLength,localRecord,planGroups,PART_TARGET,type Entry} from './export-zip64';
export type ExportFile={name:string;path:string;size:number;sha256:string};
export type Build={step:number;index:number;part:number;offset:number;pendingKey:string|null;pendingBytes:number;pendingSha:string;entries:Entry[];done:boolean;obsoleteKey?:string|null};
export type ExportJob={id:string;actor_id:string;audit_id:string;batch_id:string|null;state:string;files:ExportFile[];snapshot_hash:string;filename:string;expires_at:string;object_path:string;upload_id:string|null;prepared_files:number;verified_parts:number;total_files:number;archive_bytes?:number;validated_at?:string;error_code?:string;updated_at?:string;run_id?:string;build?:Build};
export type ExportPart={job_id:string;number:number;bytes:number;start_offset:number;sha256:string;etag:string;entries:Entry[];verified:boolean};
export type ExportStore={get:()=>Promise<ExportJob>;update:(v:Partial<ExportJob>)=>Promise<void>;parts:()=>Promise<ExportPart[]>;purge:(state:'failed'|'expired')=>Promise<void>;save:(p:ExportPart)=>Promise<void>};
export type ExportStorage={begin:()=>Promise<string>;source:(f:ExportFile)=>Promise<Buffer>;upload:(uploadId:string,number:number,bytes:Buffer)=>Promise<string>;complete:(uploadId:string,parts:ExportPart[])=>Promise<void>;head:()=>Promise<number>;range:(start:number,end:number)=>Promise<Buffer>;abort:(uploadId:string)=>Promise<void>;remove:()=>Promise<void>;savePending:(key:string,data:Buffer)=>Promise<void>;readPending:(key:string,size:number)=>Promise<Buffer>;discard:(key:string)=>Promise<void>};
export const sha256=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const initial:Build={step:0,index:0,part:1,offset:0,pendingKey:null,pendingBytes:0,pendingSha:'',entries:[],done:false};
/** Durable checkpoints bound each preparation step by file count AND time, independently of multipart minimum size. */
export class ExportEngine{
 constructor(private store:ExportStore,private storage:ExportStorage,private authorize:(snapshot?:boolean)=>Promise<void>){}
 private async active(snapshot=false){const j=await this.store.get();if(Date.parse(j.expires_at)<=Date.now()||['expired','failed'].includes(j.state))throw Error('Exportação expirada ou indisponível.');await this.authorize(snapshot);return j;}
 async initialize(){const j=await this.active(true);planGroups(j.files);if(!j.upload_id){const upload_id=await this.storage.begin();await this.store.update({upload_id,state:'preparing'});}return j.files.length;}
 async advance(step:number){
  const j=await this.active(),b=j.build||initial;
  if(step<b.step){if(b.obsoleteKey)await this.storage.discard(b.obsoleteKey);return b.done;}
  if(step!==b.step||!j.upload_id)throw Error('Etapa inválida.');if(b.done)return true;
  const started=Date.now(),chunks:Buffer[]=[];let bytes=b.pendingBytes,index=b.index,processed=0;
  const entries=[...b.entries];
  if(b.pendingKey){const pending=await this.storage.readPending(b.pendingKey,b.pendingBytes);if(sha256(pending)!==b.pendingSha)throw Error('Etapa temporária divergente.');chunks.push(pending);}
  while(index<j.files.length&&processed<16&&(processed===0||Date.now()-started<45000)){
   const f=j.files[index],data=await this.storage.source(f);if(data.length!==f.size||sha256(data)!==f.sha256)throw Error('Arquivo original divergente.');
   const e={name:f.name,size:f.size,crc:crc32(data),offset:b.offset+bytes};entries.push(e);chunks.push(localRecord(e,data));bytes+=localLength(f.name,f.size);index++;processed++;
   if(bytes>=PART_TARGET)break;
  }
  const done=index===j.files.length;
  if(done){const previous=await this.store.parts();chunks.push(centralDirectory([...previous.filter(p=>p.number<b.part).flatMap(p=>p.entries),...entries],b.offset+bytes));}
  const data=Buffer.concat(chunks),flush=bytes>=PART_TARGET||done;
  let next:Build;
  if(flush){
   const etag=await this.storage.upload(j.upload_id,b.part,data);
   await this.store.save({job_id:j.id,number:b.part,bytes:data.length,start_offset:b.offset,sha256:sha256(data),etag,entries,verified:false});
   next={...initial,step:step+1,index,part:b.part+1,offset:b.offset+data.length,done,obsoleteKey:b.pendingKey};
  }else{
   const key=`${j.id}/_staging/step-${step}.zip`;await this.storage.savePending(key,data);
   next={step:step+1,index,part:b.part,offset:b.offset,pendingKey:key,pendingBytes:data.length,pendingSha:sha256(data),entries,done:false,obsoleteKey:b.pendingKey};
  }
  await this.store.update({prepared_files:index,build:next});if(b.pendingKey)await this.storage.discard(b.pendingKey);return done;
 }
 async finish(){
  const j=await this.active(true),parts=(await this.store.parts()).sort((a,b)=>a.number-b.number);
  if(!j.build?.done||parts.length!==planGroups(j.files).length||parts.flatMap(p=>p.entries).length!==j.files.length||!j.upload_id)throw Error('ZIP ainda incompleto.');
  const size=parts.reduce((n,p)=>n+p.bytes,0);await this.storage.complete(j.upload_id,parts);
  if(await this.storage.head()!==size)throw Error('Tamanho do ZIP divergente.');
  if(j.state!=='ready')await this.store.update({archive_bytes:size,state:'validating'});return parts.length;
 }
 async verify(number:number){const j=await this.active();const parts=await this.store.parts(),p=parts.find(p=>p.number===number);if(!p)throw Error('Parte ausente.');if(p.verified)return;if(j.state!=='validating')throw Error('ZIP não concluído.');
  const bytes=await this.storage.range(p.start_offset,p.start_offset+p.bytes-1);if(bytes.length!==p.bytes||sha256(bytes)!==p.sha256)throw Error('Integridade do ZIP divergente.');
  await this.store.save({...p,verified:true});await this.store.update({verified_parts:parts.filter(x=>x.verified).length+1});
 }
 async ready(){const j=await this.active(true),parts=await this.store.parts();if(!['validating','ready'].includes(j.state)||parts.length!==planGroups(j.files).length||parts.some(p=>!p.verified)||await this.storage.head()!==Number(j.archive_bytes))throw Error('ZIP ainda não validado.');if(j.state!=='ready')await this.store.update({state:'ready',validated_at:new Date().toISOString()});return j.expires_at;}
 async cleanup(state:'failed'|'expired'){
  const j=await this.store.get();if(j.upload_id)await this.storage.abort(j.upload_id);await this.storage.remove();await this.store.purge(state);
 }
}
