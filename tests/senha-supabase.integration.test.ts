import {it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {validarLinkDeSenha} from '../src/lib/auth/linkDeSenha';
it.skipIf(process.env.RBK_AUTH_LIVE_TEST!=='1')('Supabase real: convite, finalidade incorreta, senha, recovery, consumo e login',async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,options),client=createClient(url,key,options);
 const email=`rbk-password-check-${Date.now()}@example.invalid`,password=`Rbk!${crypto.randomUUID()}`;
 let id:string|undefined;
 try{
  const invite=await admin.auth.admin.generateLink({type:'invite',email,options:{redirectTo:'https://rbk-digital.vercel.app/primeiro-acesso'}});
  expect(invite.error).toBeNull();id=invite.data.user!.id;
  expect(new URL(invite.data.properties!.action_link).searchParams.get('redirect_to')).toBe('https://rbk-digital.vercel.app/primeiro-acesso');
  const hash=invite.data.properties!.hashed_token;
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/primeiro-acesso?type=recovery&token_hash=${hash}`,'invite')).toBe(false);
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/primeiro-acesso?type=invite&token_hash=${hash}`,'invite')).toBe(true);
  const first=(await client.auth.getSession()).data.session!;
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/primeiro-acesso#type=invite&access_token=${first.access_token}&refresh_token=${first.refresh_token}`,'invite')).toBe(false);
  expect((await client.auth.updateUser({password})).error).toBeNull();
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/primeiro-acesso?type=invite&token_hash=${hash}`,'invite')).toBe(false);
  const recovery=await admin.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:'https://rbk-digital.vercel.app/redefinir-senha'}});
  expect(recovery.error).toBeNull();
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/primeiro-acesso?type=invite&token_hash=${recovery.data.properties!.hashed_token}`,'invite')).toBe(false);
  const recoveryUrl=`https://rbk-digital.vercel.app/redefinir-senha?type=recovery&token_hash=${recovery.data.properties!.hashed_token}`;
  expect(await validarLinkDeSenha(client.auth,recoveryUrl,'recovery')).toBe(true);
  const secondPassword=`Rbk!${crypto.randomUUID()}`;
  expect((await client.auth.updateUser({password:secondPassword})).error).toBeNull();
  expect((await client.auth.signOut()).error).toBeNull();
  expect(await validarLinkDeSenha(client.auth,recoveryUrl,'recovery')).toBe(false);
  expect((await client.auth.signInWithPassword({email,password:secondPassword})).error).toBeNull();
  const ordinary=(await client.auth.getSession()).data.session!;
  expect(await validarLinkDeSenha(client.auth,`https://rbk-digital.vercel.app/redefinir-senha#type=recovery&access_token=${ordinary.access_token}&refresh_token=${ordinary.refresh_token}`,'recovery')).toBe(false);
  expect(await validarLinkDeSenha(client.auth,'https://rbk-digital.vercel.app/redefinir-senha','recovery')).toBe(false);
 }finally{if(id)expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();}
},45000);
