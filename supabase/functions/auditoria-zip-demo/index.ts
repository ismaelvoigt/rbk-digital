// Development-only fixture generator. No client documents or email delivery.
import {createClient} from '@supabase/supabase-js';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const project='https://ympeqcycjadvvumanmwm.supabase.co';
const aid='a0285013-6073-4a11-87eb-7bd8da3fe601',bid='a0285013-6073-4a11-87eb-7bd8da3fe602',farm='fd54d028-ebf4-447a-8c06-357760e76f09';
Deno.serve(async(req:Request)=>{
 try{
  if(Deno.env.get('SUPABASE_URL')!==project||req.method!=='POST')return new Response('Unavailable',{status:404});
  const header=req.headers.get('authorization')||'',anon=createClient(project,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:header}}});
  const {data:{user},error}=await anon.auth.getUser();if(error||!user)return Response.json({error:'Unauthorized'},{status:401});
  const admin=createClient(project,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const [profile,role]=await Promise.all([admin.from('users').select('status').eq('id',user.id).single(),admin.from('rbk_admins').select('ativo').eq('user_id',user.id).eq('ativo',true).single()]);
  if(profile.data?.status!=='active'||!role.data?.ativo)return Response.json({error:'Forbidden'},{status:403});
  const {index}=await req.json();if(!Number.isInteger(index)||index<0||index>40)return Response.json({error:'Invalid index'},{status:400});
  const check=(v:{error:unknown})=>{if(v.error)throw Error('Fixture operation failed');};
  if(index===0){
   const f=await admin.from('farms').select('nome_fantasia').eq('id',farm).single();if(f.data?.nome_fantasia!=='Farmácia Fictícia - Balcão')throw Error('Fixture farm mismatch');
   const existing=await admin.from('aud_audits').select('reference').eq('id',aid).maybeSingle();if(existing.data&&existing.data.reference!=='RBK-ZIP-DEMO-20261103')throw Error('Fixture mismatch');
   if(!existing.data)check(await admin.from('aud_audits').insert({id:aid,farm_id:farm,pharmacy:'Farmácia Fictícia - Teste ZIP',cnpj:'00000000000000',reference:'RBK-ZIP-DEMO-20261103',requested:40,deadline:'2026-12-31',created_by:user.id}));
   const batch=await admin.from('aud_batches').select('id').eq('id',bid).maybeSingle();if(!batch.data)check(await admin.from('aud_batches').insert({id:bid,audit_id:aid,number:1,client_key:bid,manifest:[]}));
   return Response.json({auditId:aid});
  }
  const id=`a0285013-6073-4a11-87eb-${String(700+index).padStart(12,'0')}`;
  const existing=await admin.from('aud_files').select('id').eq('id',id).maybeSingle();if(existing.data){if(index===40)check(await admin.from('aud_batches').update({completed_at:new Date().toISOString(),protocol:'RBK-ZIP-DEMO-20261103'}).eq('id',bid));return Response.json({index,existing:true});}
  const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('DOCUMENTO FICTICIO - SEM VALIDADE',{x:35,y:780,size:17,font,color:rgb(0.8,0,0)});page.drawText(`Teste ZIP ${index} - Nenhum dado real`,{x:35,y:740,size:12,font});
  const filler=new Uint8Array(index<=3?4*1024**2:100*1024);for(let offset=0;offset<filler.length;offset+=65536)crypto.getRandomValues(filler.subarray(offset,Math.min(filler.length,offset+65536)));
  await pdf.attach(filler,'dados-ficticios.bin');const data=await pdf.save();const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const path=`${aid}/${bid}/ficticio-${index}.pdf`;
  check(await admin.storage.from('auditoria-private').upload(path,data,{contentType:'application/pdf',upsert:true}));
  const info=await admin.storage.from('auditoria-private').info(path);if(info.error||info.data.size!==data.length)throw Error('Unconfirmed fixture upload');
  check(await admin.from('aud_files').insert({id,audit_id:aid,batch_id:bid,source:'pharmacy',filename:`ficticio-${index}.pdf`,size:data.length,mime:'application/pdf',fingerprint:sha,storage_path:path,received_at:new Date().toISOString()}));
  if(index===40)check(await admin.from('aud_batches').update({completed_at:new Date().toISOString(),protocol:'RBK-ZIP-DEMO-20261103'}).eq('id',bid));
  return Response.json({index,size:data.length});
 }catch{return Response.json({error:'Fixture could not be prepared'},{status:500});}
});
