import {S3Client,CreateMultipartUploadCommand,ListMultipartUploadsCommand,UploadPartCommand,CompleteMultipartUploadCommand,AbortMultipartUploadCommand,HeadObjectCommand,GetObjectCommand,DeleteObjectCommand,PutObjectCommand,ListObjectsV2Command,DeleteObjectsCommand} from '@aws-sdk/client-s3';
import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminClient} from '../supabase/admin';
import {ExportEngine,sha256,type ExportJob,type ExportPart,type ExportFile} from './export-engine';
import {selectZipFiles,type ZipFile} from './zip';
import {BUCKET} from './domain';
export const EXPORT_BUCKET='auditoria-exports';
export function assertExportEnvironment(){if(process.env.NEXT_PUBLIC_RBK_ENV!=='development'||process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'')!=='https://ympeqcycjadvvumanmwm.supabase.co')throw Error('Preparação de ZIP disponível somente no desenvolvimento.');}
export type AuditDetail=Parameters<typeof selectZipFiles>[0]&{audit:{id:string;pharmacy:string}};
export const snapshotHash=(files:ZipFile[],batch?:string|null)=>sha256(JSON.stringify({batch:batch||null,files:files.map(f=>({name:f.name,path:f.path,size:f.size}))}));
export async function freezeFiles(admin:SupabaseClient,auditId:string,files:ZipFile[]):Promise<ExportFile[]>{
 const hashes=new Map<string,string>();
 for(let i=0;i<files.length;i+=200){const {data,error}=await admin.from('aud_files').select('storage_path,fingerprint,verified_sha256').eq('audit_id',auditId).in('storage_path',files.slice(i,i+200).map(f=>f.path));if(error)throw Error('Não foi possível conferir os arquivos.');for(const row of data||[])hashes.set(row.storage_path,row.verified_sha256||row.fingerprint);}
 return files.map(f=>{const hash=hashes.get(f.path);if(!hash||!/^[a-f0-9]{64}$/.test(hash))throw Error('Documento sem identificação de integridade.');return {...f,sha256:hash};});
}
export function exportStore(admin:SupabaseClient,id:string){return {
 async get(){const {data,error}=await admin.from('aud_exports').select('*').eq('id',id).single();if(error||!data)throw Error('Exportação indisponível.');return data as ExportJob;},
 async update(v:Partial<ExportJob>){const {error}=await admin.from('aud_exports').update({...v,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw Error('Não foi possível salvar o progresso.');},
 async parts(){const result:ExportPart[]=[];for(let offset=0;offset<10000;offset+=500){const {data,error}=await admin.from('aud_export_parts').select('*').eq('job_id',id).order('number').range(offset,offset+499);if(error)throw Error('Não foi possível consultar as partes.');result.push(...(data||[]) as ExportPart[]);if(!data||data.length<500)break;}return result;},
 async purge(state:'failed'|'expired'){const {error}=await admin.rpc('aud_export_cleanup',{p_job:id,p_state:state});if(error)throw Error('Não foi possível concluir a limpeza.');},
 async save(p:ExportPart){const {error}=await admin.from('aud_export_parts').upsert(p,{onConflict:'job_id,number'});if(error)throw Error('Não foi possível salvar a parte.');},
};}
async function bounded(stream:ReadableStream<Uint8Array>,size:number){const reader=stream.getReader(),chunks:Buffer[]=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>size)throw Error('Tamanho divergente.');chunks.push(Buffer.from(value));}if(total!==size)throw Error('Arquivo incompleto.');return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});}}
function missing(e:unknown){return !!e&&typeof e==='object'&&('$metadata' in e)&&Number((e.$metadata as {httpStatusCode?:number})?.httpStatusCode)===404;}
export function exportStorage(admin:SupabaseClient,job:ExportJob){
 const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
 const sessionToken=process.env.SUPABASE_SERVICE_ROLE_KEY!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 if(!sessionToken?.startsWith('eyJ')||!anon?.startsWith('eyJ'))throw Error('S3 exige as credenciais JWT do servidor.');
 const s3=new S3Client({region:'us-east-1',endpoint:`https://${ref}.storage.supabase.co/storage/v1/s3`,forcePathStyle:true,credentials:{accessKeyId:ref,secretAccessKey:anon,sessionToken},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:3});
 const object={Bucket:EXPORT_BUCKET,Key:job.object_path};
 return {
 async begin(){const listed=await s3.send(new ListMultipartUploadsCommand({Bucket:EXPORT_BUCKET,Prefix:job.object_path}));const existing=listed.Uploads?.find(u=>u.Key===job.object_path);if(existing?.UploadId)return existing.UploadId;
  const r=await s3.send(new CreateMultipartUploadCommand({...object,ContentType:'application/zip',CacheControl:'private, no-store',ContentDisposition:`attachment; filename="${job.filename}"`}));if(!r.UploadId)throw Error('Não foi possível iniciar o ZIP.');return r.UploadId;},
 async source(file:ExportFile){const {data,error}=await admin.storage.from(BUCKET).createSignedUrl(file.path,60);if(error||!data)throw Error('Arquivo original indisponível.');const url=new URL(data.signedUrl);if(url.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin)throw Error('Origem inválida.');const r=await fetch(url,{signal:AbortSignal.timeout(60000),cache:'no-store',redirect:'error'});if(!r.ok||!r.body)throw Error('Arquivo original indisponível.');return bounded(r.body,file.size);},
 async upload(uploadId:string,number:number,bytes:Buffer){const r=await s3.send(new UploadPartCommand({...object,UploadId:uploadId,PartNumber:number,Body:bytes,ContentLength:bytes.length,ContentMD5:createHash('md5').update(bytes).digest('base64')}),{abortSignal:AbortSignal.timeout(60000)});if(!r.ETag)throw Error('Parte não confirmada.');return r.ETag;},
 async complete(uploadId:string,parts:ExportPart[]){try{const h=await s3.send(new HeadObjectCommand(object));if(h.ContentLength===parts.reduce((n,p)=>n+p.bytes,0))return;}catch(e){if(!missing(e))throw e;}await s3.send(new CompleteMultipartUploadCommand({...object,UploadId:uploadId,MultipartUpload:{Parts:parts.map(p=>({ETag:p.etag,PartNumber:p.number}))}}),{abortSignal:AbortSignal.timeout(60000)});},
 async head(){return Number((await s3.send(new HeadObjectCommand(object))).ContentLength);},
 async range(start:number,end:number){const r=await s3.send(new GetObjectCommand({...object,Range:`bytes=${start}-${end}`}),{abortSignal:AbortSignal.timeout(60000)});if(!r.Body||r.ContentRange!==`bytes ${start}-${end}/${job.archive_bytes}`)throw Error('Intervalo ZIP divergente.');return bounded(r.Body.transformToWebStream(),end-start+1);},
 async abort(uploadId:string){try{await s3.send(new AbortMultipartUploadCommand({...object,UploadId:uploadId}));}catch(e){if(!missing(e))throw e;}},
 async savePending(key:string,data:Buffer){if(!key.startsWith(`${job.id}/_staging/`))throw Error('Caminho inválido.');await s3.send(new PutObjectCommand({Bucket:EXPORT_BUCKET,Key:key,Body:data,ContentType:'application/zip',ContentMD5:createHash('md5').update(data).digest('base64')}),{abortSignal:AbortSignal.timeout(60000)});},
 async readPending(key:string,size:number){if(!key.startsWith(`${job.id}/_staging/`))throw Error('Caminho inválido.');const r=await s3.send(new GetObjectCommand({Bucket:EXPORT_BUCKET,Key:key}),{abortSignal:AbortSignal.timeout(60000)});if(!r.Body)throw Error('Etapa indisponível.');return bounded(r.Body.transformToWebStream(),size);},
 async discard(key:string){if(!key.startsWith(`${job.id}/_staging/`))throw Error('Caminho inválido.');await s3.send(new DeleteObjectCommand({Bucket:EXPORT_BUCKET,Key:key}));},
 async remove(){
  const pending=await s3.send(new ListMultipartUploadsCommand({Bucket:EXPORT_BUCKET,Prefix:job.object_path}));
  for(const upload of pending.Uploads||[])if(upload.Key===job.object_path&&upload.UploadId)await s3.send(new AbortMultipartUploadCommand({...object,UploadId:upload.UploadId}));
  let token:string|undefined;do{const list=await s3.send(new ListObjectsV2Command({Bucket:EXPORT_BUCKET,Prefix:`${job.id}/`,ContinuationToken:token,MaxKeys:500}));const keys=(list.Contents||[]).flatMap(o=>o.Key?[{Key:o.Key}]:[]);if(keys.length){const result=await s3.send(new DeleteObjectsCommand({Bucket:EXPORT_BUCKET,Delete:{Objects:keys}}));if(result.Errors?.length)throw Error('Limpeza incompleta.');}token=list.IsTruncated?list.NextContinuationToken:undefined;}while(token);
 },
 };
}
export async function makeExportEngine(id:string){
 assertExportEnvironment();const admin=createAdminClient(),store=exportStore(admin,id),job=await store.get();
 return new ExportEngine(store,exportStorage(admin,job),async(snapshot=false)=>{
  if(!snapshot){const {data,error}=await admin.rpc('aud_export_allowed',{p_job:id});if(error||data!==true)throw Error('Acesso à auditoria revogado.');return;}
  const {data,error}=await admin.rpc('aud_export_detail',{p_job:id});if(error||!data)throw Error('Acesso à auditoria revogado.');
  const files=selectZipFiles(data,job.audit_id,job.batch_id||undefined);if(snapshotHash(files,job.batch_id)!==job.snapshot_hash)throw Error('A auditoria mudou. Prepare um novo ZIP.');
 });
}
