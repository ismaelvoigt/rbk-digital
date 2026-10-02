import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createAdminClient} from '../../../lib/supabase/admin';
import {preparePharmacyInvitation} from '../../../lib/cadastro/invitation';
import {convidarFuncionario,validarFuncionario,perfisEquipe} from '../../../lib/equipe/convite';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
class EquipeError extends Error {constructor(message:string,public status=400){super(message);}}
async function contexto(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new EquipeError('Faça login novamente.',401);
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)throw new EquipeError('Sessão inválida.',401);
 const admin=createAdminClient();
 const [{data:p,error:pe},{data:rbk,error:re}]=await Promise.all([
  admin.from('users').select('perfil,status,farm_id').eq('id',user.id).maybeSingle(),
  admin.from('rbk_admins').select('user_id').eq('user_id',user.id).eq('ativo',true).maybeSingle(),
 ]);
 if(pe||re)throw new EquipeError('Não foi possível verificar o acesso.',503);
 if(!p||p.status!=='active'||!['farmacia','administrador_farmacia'].includes(p.perfil)||!p.farm_id||rbk)throw new EquipeError('Acesso restrito ao administrador da farmácia.',403);
 const {data:f,error:fe}=await admin.from('farms').select('id,cnpj,nome_fantasia,razao_social,status').eq('id',p.farm_id).single();
 if(fe||!f||f.status!=='active')throw new EquipeError('Farmácia indisponível.',403);
 return {client,admin,actorId:user.id,farmId:f.id,cnpj:f.cnpj,nome:f.nome_fantasia||f.razao_social};
}
function validar(value:unknown){try{return validarFuncionario(value);}catch{throw new EquipeError('Confira nome, e-mail, perfil e status.');}}
function failure(e:unknown){return e instanceof EquipeError?json({error:e.message},e.status):json({error:'Não foi possível concluir a operação. Tente novamente.'},500);}
export async function GET(request:Request){try{
 const c=await contexto(request);const {data,error}=await c.client.rpc('equipe_listar');
 if(error)throw new EquipeError('Não foi possível consultar a equipe.',503);
 const audit=await c.client.from('audit_logs').select('id,user_id,action,entity_type,entity_id,metadata,created_at').eq('farm_id',c.farmId).order('created_at',{ascending:false}).limit(50);
 if(audit.error)throw new EquipeError('Não foi possível consultar o histórico.',503);
 return json({usuarios:data,auditoria:audit.data,actorId:c.actorId,farmacia:{nome:c.nome,cnpj:c.cnpj}});
 }catch(e){return failure(e);}}
export async function PATCH(request:Request){try{
 const c=await contexto(request);const body=await request.json();
 const input=validar(body);
 if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))throw new EquipeError('Usuário inválido.');
 const {error}=await c.client.rpc('equipe_salvar',{p_id:body.id,p_nome:input.nome,p_perfil:input.perfil,p_status:input.status});
 if(error)throw new EquipeError('Não foi possível alterar este usuário. Mantenha seu próprio acesso e um administrador ativo.',403);
 return json({success:true});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const c=await contexto(request);const body=await request.json();
 let input;let existingId:string|undefined;
 if(body.reenviar){
  if(typeof body.id!=='string')throw new EquipeError('Usuário inválido.');
  const {data:u,error}=await c.admin.from('users').select('id,nome,email,perfil,status,tipo_convite,convite_enviado_em').eq('id',body.id).eq('farm_id',c.farmId).single();
  if(error||!u||u.tipo_convite!=='funcionario')throw new EquipeError('Convite indisponível.',404);
  const auth=await c.admin.auth.admin.getUserById(u.id);
  if(auth.error||!auth.data.user||auth.data.user.last_sign_in_at)throw new EquipeError('Este usuário já acessou. Utilize a recuperação de senha.');
  if(u.convite_enviado_em&&Date.now()-Date.parse(u.convite_enviado_em)<60000)throw new EquipeError('Aguarde um minuto antes de reenviar.',429);
  input=validar(u);existingId=u.id;
 }else{
  input=validar(body);
  const duplicate=await c.admin.from('users').select('id').ilike('email',input.email).limit(1);
  if(duplicate.error)throw new EquipeError('Não foi possível verificar o e-mail.',503);
  if(duplicate.data?.length)throw new EquipeError('Este e-mail já possui um acesso. Use outro e-mail ou edite o usuário cadastrado.',409);
 }
 let send:Awaited<ReturnType<typeof preparePharmacyInvitation>>;
 try{send=await preparePharmacyInvitation({tipo_convite:'funcionario',nome:input.nome,perfil:perfisEquipe[input.perfil]});}catch{throw new EquipeError('O envio de convites está indisponível. Tente novamente mais tarde.',503);}
 await convidarFuncionario(input,c,{
  generate:async metadata=>{
   const {data,error}=await c.admin.auth.admin.generateLink({type:'invite',email:input.email,options:{redirectTo:'https://rbk-digital.vercel.app/primeiro-acesso',data:metadata}});
   if(error||!data.user||!data.properties?.hashed_token)throw new EquipeError('Não foi possível gerar o convite. Confira se o e-mail já possui acesso.',409);
   if(existingId&&data.user.id!==existingId)throw new EquipeError('O convite não corresponde ao usuário.',409);
   return {id:data.user.id,hash:data.properties.hashed_token};
  },
  register:async id=>{
   if(existingId)return;
   const {error}=await c.admin.rpc('equipe_registrar_convite',{p_actor:c.actorId,p_id:id,p_nome:input.nome,p_email:input.email,p_perfil:input.perfil,p_status:input.status});
   if(error)throw new EquipeError('Não foi possível vincular o funcionário. Nenhum acesso foi transferido.',409);
  },
  send:async link=>{try{await send(input.email,c.nome,link);}catch{throw new EquipeError('Funcionário cadastrado, mas o e-mail não pôde ser enviado. Use Reenviar convite.',502);}},
  markSent:async id=>{
   const {error}=await c.admin.from('users').update({convite_enviado_em:new Date().toISOString()}).eq('id',id).eq('farm_id',c.farmId);
   if(error)throw new EquipeError('Convite enviado, mas não foi possível atualizar a confirmação na lista.',503);
  },
 });
 return json({success:true,mensagem:'Convite enviado. O funcionário poderá criar sua senha pelo e-mail.'},201);
 }catch(e){return failure(e);}}
