import {createServerClient,type CookieOptions} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';
import {assertStaging,validateOrigin,validUuid,PortalError,failure,headers} from '../../../../lib/auditoria/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {PERSISTENCE_COOKIE,sessionCookieOptions} from '../../../../lib/auth/sessionPersistence';
import {BUCKET} from '../../../../lib/auditoria/domain';
import {selectZipFiles,zipStream,type ZipFile} from '../../../../lib/auditoria/zip';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

/** Cookie-authenticated navigation lets the browser stream ZIP directly to disk. */
export async function GET(request:NextRequest){
 const updated:{name:string;value:string;options:CookieOptions}[]=[];
 const persistent=request.cookies.get(PERSISTENCE_COOKIE)?.value==='farmacia';
 function withCookies(response:Response){const result=new NextResponse(response.body,{status:response.status,headers:response.headers});for(const c of updated)result.cookies.set(c.name,c.value,sessionCookieOptions(persistent,c.options));return result;}
 try{
  assertStaging();validateOrigin(request);
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new PortalError(403,'Origem não permitida.');
  const query=request.nextUrl.searchParams, aid=query.get('auditoria'),batch=query.get('lote')||undefined;
  if(!validUuid(aid)||(batch&&!validUuid(batch)))throw new PortalError(400,'Selecione uma auditoria e um lote válidos.');
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{updated.push(...values);}}});
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth.user)throw new PortalError(401,'Entre no RBK Digital para baixar os lotes.');
  const {data,error}=await client.rpc('aud_manager',{op:'detail',aid,payload:{}});
  if(error||!data)throw new PortalError(403,'Você não tem acesso a esta auditoria.');
  const files=selectZipFiles(data,aid,batch);
  const admin=createAdminClient();
  async function open(file:ZipFile,signal:AbortSignal){
   signal.throwIfAborted();
   const {data:signed,error:signError}=await admin.storage.from(BUCKET).createSignedUrl(file.path,60);
   if(signError||!signed?.signedUrl)throw new PortalError(502,'Não foi possível acessar um arquivo. Tente baixar o lote novamente.');
   const url=new URL(signed.signedUrl);
   if(url.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin)throw new Error('Unexpected storage origin');
   const source=await fetch(url,{signal,cache:'no-store',redirect:'error'});
   if(!source.ok||!source.body)throw new PortalError(502,'Um arquivo está indisponível. Tente baixar o lote novamente.');
   return source.body;
  }
  // Detect a missing first object before sending attachment headers.
  const first=await open(files[0],request.signal);
  const stream=zipStream(files,(file,signal)=>file===files[0]?Promise.resolve(first):open(file,signal),request.signal);
  const cnpj=String(data.audit.cnpj||'').replace(/[^A-Za-z0-9]/g,'')||aid;
  const suffix=batch?`lote-${data.batches.find((b:{id:string})=>b.id===batch).number}`:'completa';
  return withCookies(new Response(stream,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="auditoria-${cnpj}-${suffix}.zip"`,'X-Accel-Buffering':'no'}}));
 }catch(error){return withCookies(failure(error));}
}
