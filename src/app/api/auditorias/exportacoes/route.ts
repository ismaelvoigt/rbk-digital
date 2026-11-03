import {createServerClient,type CookieOptions} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';
import {start,getRun} from 'workflow/api';
import {HookConflictError} from 'workflow/errors';
import {prepararAuditoriaZip} from '../../../../workflows/auditoria-export';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {assertExportEnvironment,freezeFiles,snapshotHash,EXPORT_BUCKET} from '../../../../lib/auditoria/export-server';
import {exportName,planGroups} from '../../../../lib/auditoria/export-zip64';
import {selectZipFiles} from '../../../../lib/auditoria/zip';
import {type ExportJob} from '../../../../lib/auditoria/export-engine';
import {validUuid,validateOrigin,PortalError,failure,headers} from '../../../../lib/auditoria/server';
import {PERSISTENCE_COOKIE,sessionCookieOptions} from '../../../../lib/auth/sessionPersistence';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
function status(j:ExportJob){return {id:j.id,state:j.state,preparedFiles:j.prepared_files,totalFiles:j.total_files,verifiedParts:j.verified_parts,totalParts:j.files.length?planGroups(j.files).length:0,expiresAt:j.expires_at,filename:j.filename};}
async function handle(req:NextRequest,create:boolean){
 const cookies:{name:string;value:string;options:CookieOptions}[]=[];
 const persistent=req.cookies.get(PERSISTENCE_COOKIE)?.value==='farmacia';
 function respond(r:Response){const response=new NextResponse(r.body,{status:r.status,headers:r.headers});for(const c of cookies)response.cookies.set(c.name,c.value,sessionCookieOptions(persistent,c.options));return response;}
 try{
  assertExportEnvironment();validateOrigin(req);if(req.headers.get('sec-fetch-site')==='cross-site')throw new PortalError(403,'Origem não permitida.');
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>req.cookies.getAll(),setAll:v=>{cookies.push(...v);}}});
  const {data:auth,error}=await client.auth.getUser();if(error||!auth.user)throw new PortalError(401,'Entre novamente para preparar o ZIP.');
  const admin=createAdminClient();let job:ExportJob;
  if(create){
   const input=await req.json().catch(()=>null);if(!input||!validUuid(input.auditId)||(input.batchId&&!validUuid(input.batchId)))throw new PortalError(400,'Selecione uma auditoria e um lote válidos.');
   const {data:detail,error}=await client.rpc('aud_manager',{op:'detail',aid:input.auditId,payload:{}});if(error||!detail)throw new PortalError(403,'Você não tem acesso a esta auditoria.');
   const files=selectZipFiles(detail,input.auditId,input.batchId||undefined);planGroups(files);const hash=snapshotHash(files,input.batchId);
   const frozen=await freezeFiles(admin,input.auditId,files);
   const {data:inserted,error:admissionError}=await admin.rpc('aud_export_start',{p_actor:auth.user.id,p_audit:input.auditId,p_batch:input.batchId||null,p_hash:hash,p_files:frozen,p_filename:exportName(detail.audit.pharmacy,input.batchId?detail.batches.find((b:{id:string})=>b.id===input.batchId)?.number:undefined)});
   if(admissionError||!inserted)throw new PortalError(admissionError?.code==='P0001'?429:503,admissionError?.code==='P0001'?'Aguarde a preparação atual antes de iniciar outra.':'Não foi possível preparar o ZIP agora.');
   job=inserted as ExportJob;
   // The deterministic hook prevents duplicate workflows even after a lost response.
   if(job.state==='queued'){
    let runId:string;
    try{runId=(await start(prepararAuditoriaZip,[job.id],{hook:{token:`auditoria-export:${job.id}`}})).runId;}
    catch(e){if(HookConflictError.is(e)){if(!e.conflictingRunId)throw e;runId=e.conflictingRunId;}else throw new PortalError(503,'Não foi possível iniciar agora. Clique novamente para retomar.');}
    const {error}=await admin.from('aud_exports').update({run_id:runId}).eq('id',job.id);if(error)throw error;
   }
  }else{
   const id=req.nextUrl.searchParams.get('id');if(!validUuid(id))throw new PortalError(400,'Exportação inválida.');
   const {data,error}=await admin.from('aud_exports').select('*').eq('id',id).eq('actor_id',auth.user.id).single();if(error||!data)throw new PortalError(404,'Exportação indisponível.');job=data as ExportJob;
   const {data:detail,error:accessError}=await client.rpc('aud_manager',{op:'detail',aid:job.audit_id,payload:{}});if(accessError||!detail)throw new PortalError(403,'Você não tem acesso a esta auditoria.');
   if(snapshotHash(selectZipFiles(detail,job.audit_id,job.batch_id||undefined),job.batch_id)!==job.snapshot_hash)throw new PortalError(409,'A auditoria mudou. Prepare um novo ZIP.');
  }
  if(job.run_id&&['queued','preparing','validating'].includes(job.state)){
   const workflowState=await getRun(job.run_id).status;
   if(workflowState==='failed'||workflowState==='cancelled'){
    const {error}=await admin.from('aud_exports').update({state:'failed',error_code:'workflow_failed',updated_at:new Date().toISOString()}).eq('id',job.id);if(error)throw error;job={...job,state:'failed'};
   }
  }
  if(Date.parse(job.expires_at)<=Date.now()||job.state==='expired')throw new PortalError(410,'O ZIP temporário expirou. Prepare novamente.');
  if(req.nextUrl.searchParams.get('download')==='1'){
   if(job.state!=='ready'||!job.validated_at||!job.archive_bytes)throw new PortalError(409,'Aguarde a conclusão e a validação do ZIP.');
   const {data:info,error:infoError}=await admin.storage.from(EXPORT_BUCKET).info(job.object_path);if(infoError||Number(info?.size)!==Number(job.archive_bytes))throw new PortalError(409,'O ZIP precisa ser preparado novamente.');
   const seconds=Math.max(1,Math.min(60,Math.floor((Date.parse(job.expires_at)-Date.now())/1000)));
   const {data,error}=await admin.storage.from(EXPORT_BUCKET).createSignedUrl(job.object_path,seconds,{download:job.filename});if(error||!data)throw Error('Download indisponível.');
   return respond(new Response(null,{status:302,headers:{...headers,Location:data.signedUrl}}));
  }
  return respond(Response.json(status(job),{headers}));
 }catch(e){return respond(e instanceof PortalError?failure(e):Response.json({error:'Não foi possível preparar o ZIP. Tente novamente.'},{status:503,headers}));}
}
export async function POST(req:NextRequest){return handle(req,true);}
export async function GET(req:NextRequest){return handle(req,false);}
