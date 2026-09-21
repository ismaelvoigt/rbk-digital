import { assertStaging, validateOrigin, body, newToken, tokenHash, managerClient, PortalError, failure, response } from '../../../lib/auditoria/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { validateFicha } from '../../../lib/processos/domain';
import { missingFichaFields } from '../../../lib/credenciamento/validation';
export const runtime='nodejs';
export async function POST(req:Request){try{
 assertStaging();validateOrigin(req);const b=await body(req);let actor:string|null=null;let h:string|null=null;
 if(b.manager===true){const c=await managerClient(req);const {data,error}=await c.auth.getUser();if(error||!data.user)throw new PortalError(401,'Entre novamente.');actor=data.user.id;}else h=tokenHash(b.token||'');
 const op=b.op;const allowed=actor?['list','create','get','save','init','confirm','file','renew','revoke']:['get','save','init','confirm'];
 if(!allowed.includes(op))throw new PortalError(403,'Operação indisponível.');
 const payload:Record<string,unknown>={};let token='';
 if(op==='create'||op==='save'){
  const ficha=validateFicha(b.ficha);if(typeof b.filial!=='boolean')throw new PortalError(400,'Informe matriz ou filial.');
  if(!b.filial)ficha.B20=ficha.B19||'';
  if(op==='create'&&(!ficha.B21||!/^\d{14}$/.test((ficha.B19||'').replace(/\D/g,''))||!/^\d{14}$/.test((ficha.B20||'').replace(/\D/g,''))))throw new PortalError(400,'Confira a razão social e os CNPJs.');
  if(b.filial&&ficha.B19&&ficha.B19.replace(/\D/g,'')===ficha.B20?.replace(/\D/g,''))throw new PortalError(400,'O CNPJ da filial deve ser diferente do CNPJ da matriz.');
  if(op==='save'){const missing=missingFichaFields(ficha,b.partners??1);if(missing.length)throw new PortalError(400,'Preencha os campos obrigatórios antes de salvar: '+missing.join(', ')+'.');}
  Object.assign(payload,{ficha,filial:b.filial,partners:b.partners??1,revision:b.revision});
 }
 if(op==='renew'||op==='create'){token=newToken();payload.hash=tokenHash(token);}
 if(op==='init'){
  const f=b.file;const types:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
  const ext=typeof f?.name==='string'?f.name.split('.').pop()?.toLowerCase():'';
  if(!f||!ext||!types[ext]||f.mime!==types[ext]||f.name.length>180||/[\x00-\x1f/\\]/.test(f.name)||!Number.isInteger(f.size)||f.size<1||f.size>26214400||!Number.isInteger(f.kind)||f.kind<0||f.kind>9||!/^[-0-9a-f]{36}$/.test(f.id)||!/^[a-f0-9]{64}$/.test(f.fingerprint))throw new PortalError(400,'Arquivo inválido. Use PDF, JPG ou PNG até 25 MB.');
  Object.assign(payload,f);
 }
 if(op==='confirm'||op==='file')payload.id=b.fileId;
 const admin=createAdminClient();const {data,error}=await admin.rpc('cre_command',{op,actor,h,pid:actor?b.id||null:null,payload});
 if(error)throw new PortalError(409,op==='save'?'Não foi possível salvar. Atualize a ficha e confira os dados.':'Acesso ou operação indisponível. Confira o link e tente novamente.');
 if(op==='init'){
  if(data.received_at)return response({id:data.id,received:true});
  const signed=await admin.storage.from('credenciamento-private').createSignedUploadUrl(data.storage_path,{upsert:false});if(signed.error)throw new PortalError(503,'Não foi possível iniciar o envio.');
  return response({id:data.id,url:signed.data.signedUrl,path:data.storage_path});
 }
 if(op==='file'){const signed=await admin.storage.from('credenciamento-private').createSignedUrl(data.storage_path,60,{download:data.filename});if(signed.error)throw new PortalError(503,'Download indisponível.');return response({url:signed.data.signedUrl});}
 return response(token?{...data,link:new URL('/portal/credenciamento',req.url).origin+'/portal/credenciamento#'+token}:data);
}catch(e){return failure(e);}}
