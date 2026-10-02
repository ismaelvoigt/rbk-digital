import {it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {PDFDocument} from 'pdf-lib';
import {validarLinkDeSenha} from '../src/lib/auth/linkDeSenha';
it.skipIf(process.env.RBK_EQUIPE_LIVE_TEST!=='1')('equipe real: convite, senha, login, perfil, duas farmácias e desativação',async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,opts);
 const clients=[createClient(url,key,opts),createClient(url,key,opts),createClient(url,key,opts)];
 const ids:string[]=[],farms:string[]=[];const stamp=Date.now(),password=`RBK!${crypto.randomUUID()}`;
 let authorization:string|undefined, documentId:string|undefined, storagePath:string|undefined;
 try{
  for(let i=0;i<2;i++){
   const f=await admin.from('farms').insert({razao_social:`Teste Equipe ${stamp} ${i}`,nome_fantasia:`Teste Equipe ${i}`,cnpj:`98${String(stamp).slice(-11)}${i}`,status:'active'}).select('id').single();
   expect(f.error).toBeNull();farms.push(f.data!.id);
   const email=`rbk-team-admin-${stamp}-${i}@example.invalid`;
   const u=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(u.error).toBeNull();ids.push(u.data.user!.id);
   expect((await admin.from('users').insert({id:ids[i],farm_id:farms[i],nome:'Administrador teste',email,perfil:'farmacia',status:'active'})).error).toBeNull();
   expect((await clients[i].auth.signInWithPassword({email,password})).error).toBeNull();
  }
  const email=`rbk-team-staff-${stamp}@example.invalid`;
  const invite=await admin.auth.admin.generateLink({type:'invite',email,options:{redirectTo:'https://rbk-digital.vercel.app/primeiro-acesso',data:{tipo_convite:'funcionario',farmacia_id:farms[0],perfil:'operador'}}});
  expect(invite.error).toBeNull();ids.push(invite.data.user!.id);
  expect((await admin.rpc('equipe_registrar_convite',{p_actor:ids[0],p_id:ids[2],p_nome:'Funcionário teste',p_email:email,p_perfil:'operador',p_status:'active'})).error).toBeNull();
  const link=`https://rbk-digital.vercel.app/primeiro-acesso?type=invite&token_hash=${invite.data.properties!.hashed_token}`;
  expect(await validarLinkDeSenha(clients[2].auth,link,'invite')).toBe(true);
  expect((await clients[2].auth.updateUser({password})).error).toBeNull();
  await clients[2].auth.signOut();expect((await clients[2].auth.signInWithPassword({email,password})).error).toBeNull();
  expect(await validarLinkDeSenha(createClient(url,key,opts).auth,link,'invite')).toBe(false);
  if(process.env.RBK_EQUIPE_BASE_URL){
   const base=process.env.RBK_EQUIPE_BASE_URL;
   for(const [index,status] of [[0,200],[2,403]] as const){
    const session=(await clients[index].auth.getSession()).data.session!;
    const response=await fetch(`${base}/api/equipe`,{headers:{Authorization:`Bearer ${session.access_token}`}});
    expect(response.status).toBe(status);
   }
   const cookies:Record<string,string>={};
   const browser=createServerClient(url,key,{cookies:{getAll:()=>Object.entries(cookies).map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>{cookies[name]=value;})}});
   const session=(await clients[2].auth.getSession()).data.session!;
   await browser.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
   const cookie=Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; ');
   for(const route of ['/equipe','/administracao','/vendas','/compras','/relatorios']){
    const page=await fetch(`${base}${route}`,{headers:{cookie},redirect:'manual'});
    expect([302,303,307,308]).toContain(page.status);expect(new URL(page.headers.get('location')!,base).pathname).toBe('/farmacia');
   }
   expect((await fetch(`${base}/farmacia`,{headers:{cookie},redirect:'manual'})).status).toBe(200);
  }
  const profile=await clients[2].from('users').select('farm_id,perfil,status').eq('id',ids[2]).single();
  expect(profile.data).toEqual({farm_id:farms[0],perfil:'operador',status:'active'});
  const a=await clients[0].from('autorizacoes').insert({user_id:ids[0],numero_autorizacao:`98${stamp}`,data_autorizacao:'2026-09-26',cpf_cliente:'00000000000',farmacia:'Teste Equipe'}).select('id').single();
  expect(a.error).toBeNull();authorization=a.data!.id;
  expect((await clients[2].from('autorizacoes').select('id').eq('id',authorization)).data).toHaveLength(1);
  expect((await clients[1].from('autorizacoes').select('id').eq('id',authorization)).data).toEqual([]);
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
  storagePath=`${ids[2]}/${authorization}/equipe-teste.pdf`;
  expect((await clients[2].storage.from('documentos').upload(storagePath,bytes,{contentType:'application/pdf'})).error).toBeNull();
  const doc=await clients[2].from('documentos').insert({autorizacao_id:authorization,categoria:'receita_medica',nome_arquivo:'equipe-teste.pdf',caminho_arquivo:storagePath,status:'recebido'}).select('id').single();
  expect(doc.error).toBeNull();documentId=doc.data!.id;
  expect((await clients[0].storage.from('documentos').download(storagePath)).error).toBeNull();
  expect((await clients[1].storage.from('documentos').download(storagePath)).error).not.toBeNull();
  const docLog=await clients[0].from('audit_logs').select('user_id,action').eq('entity_id',documentId);
  expect(docLog.data).toContainEqual({user_id:ids[2],action:'insert'});
  expect((await clients[2].rpc('modulos_autorizacoes',{p_farm:farms[0]})).error).not.toBeNull();
  expect((await clients[2].rpc('equipe_listar')).error).not.toBeNull();
  expect((await clients[2].from('users').update({perfil:'administrador_farmacia'}).eq('id',ids[2])).error).not.toBeNull();
  // User-editable metadata cannot grant access.
  expect((await clients[2].auth.updateUser({data:{perfil:'administrador_farmacia',farmacia_id:farms[1]}})).error).toBeNull();
  expect((await clients[2].rpc('equipe_listar')).error).not.toBeNull();
  expect((await clients[0].rpc('equipe_salvar',{p_id:ids[2],p_nome:'Gerente teste',p_perfil:'gerente_farmacia',p_status:'active'})).error).toBeNull();
  expect((await clients[2].rpc('modulos_autorizacoes',{p_farm:farms[0]})).error).toBeNull();
  expect((await clients[2].rpc('modulos_autorizacoes',{p_farm:farms[1]})).error).not.toBeNull();
  expect((await clients[2].rpc('equipe_listar')).error).not.toBeNull();
  expect((await clients[2].from('autorizacoes').update({observacao:'Alterado por funcionário teste'}).eq('id',authorization)).error).toBeNull();
  const logs=await clients[0].from('audit_logs').select('user_id,action').eq('entity_id',authorization).eq('action','update');expect(logs.error).toBeNull();expect(logs.data).toContainEqual({user_id:ids[2],action:'update'});
  expect((await clients[0].rpc('equipe_salvar',{p_id:ids[2],p_nome:'Gerente teste',p_perfil:'gerente_farmacia',p_status:'inactive'})).error).toBeNull();
  expect((await clients[2].from('autorizacoes').select('id').eq('id',authorization)).data).toEqual([]);
  expect((await clients[2].rpc('modulos_autorizacoes',{p_farm:farms[0]})).error).not.toBeNull();
  expect((await clients[2].storage.from('documentos').download(storagePath)).error).not.toBeNull();
  expect((await admin.from('users').select('id').eq('id',ids[2])).data).toHaveLength(1);
 }finally{
  for(const client of clients)await client.auth.signOut().catch(()=>{});
  if(storagePath)expect((await admin.storage.from('documentos').remove([storagePath])).error).toBeNull();
  if(documentId)expect((await admin.from('documentos').delete().eq('id',documentId)).error).toBeNull();
  if(authorization)expect((await admin.from('autorizacoes').delete().eq('id',authorization)).error).toBeNull();
  if(farms.length)expect((await admin.from('audit_logs').delete().in('farm_id',farms)).error).toBeNull();
  if(ids.length)expect((await admin.from('users').delete().in('id',ids)).error).toBeNull();
  for(const id of ids)expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  if(farms.length)expect((await admin.from('farms').delete().in('id',farms)).error).toBeNull();
 }
},60000);
