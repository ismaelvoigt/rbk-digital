import {describe,it,expect,vi} from 'vitest';
import {validarLinkDeSenha} from '../src/lib/auth/linkDeSenha';
const base='https://rbk-digital.vercel.app';
const session={access_token:'token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u'}};
function auth(){return {
 getClaims:vi.fn().mockResolvedValue({data:{claims:{amr:[{method:'otp'}],exp:session.expires_at}},error:null}),
 setSession:vi.fn().mockResolvedValue({data:{session},error:null}),
 exchangeCodeForSession:vi.fn().mockResolvedValue({data:{session,redirectType:'recovery'},error:null}),
 verifyOtp:vi.fn().mockResolvedValue({data:{session},error:null}),
 getUser:vi.fn().mockResolvedValue({data:{user:{id:'u'}},error:null}),
 getSession:vi.fn().mockResolvedValue({data:{session},error:null}),
};}
describe('links exclusivos de senha',()=>{
 it('não aceita sessão anterior sem link',async()=>expect(await validarLinkDeSenha(auth(),base+'/redefinir-senha','recovery')).toBe(false));
 it.each(['invite','recovery'] as const)('aceita token hash %s verificado pelo servidor',async type=>{
  const a=auth();expect(await validarLinkDeSenha(a,base+'/?token_hash=secret&type='+type,type)).toBe(true);
  expect(a.verifyOtp).toHaveBeenCalledWith({token_hash:'secret',type});
 });
 it('convite exige token de convite verificável, nunca fragmento de sessão rotulado como invite',async()=>{
  expect(await validarLinkDeSenha(auth(),base+'/#access_token=token&refresh_token=refresh&type=invite','invite')).toBe(false);
 });
 it('recovery aceita fragmento OTP validado no Auth',async()=>{
  const a=auth();expect(await validarLinkDeSenha(a,base+'/#access_token=token&refresh_token=refresh&type=recovery','recovery')).toBe(true);
  expect(a.getUser).toHaveBeenCalledWith('token');
 });
 it.each(['invite','recovery'] as const)('rejeita finalidade diferente de %s',async type=>{
  expect(await validarLinkDeSenha(auth(),base+'/#access_token=token&refresh_token=refresh&type='+(type==='invite'?'recovery':'invite'),type)).toBe(false);
 });
 it('rejeita token expirado antes de renová-lo',async()=>{
  const a=auth();a.getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}} as never);
  expect(await validarLinkDeSenha(a,base+'/#access_token=old&refresh_token=refresh&type=recovery','recovery')).toBe(false);
  expect(a.setSession).not.toHaveBeenCalled();
 });
 it('rejeita sessão expirada retornada pela validação',async()=>{
  const a=auth();a.verifyOtp.mockResolvedValue({data:{session:{...session,expires_at:1}},error:null});
  expect(await validarLinkDeSenha(a,base+'/?token_hash=x&type=invite','invite')).toBe(false);
 });
 it('aceita PKCE de recuperação e rejeita PKCE genérico',async()=>{
  const a=auth();expect(await validarLinkDeSenha(a,base+'/?code=x','recovery')).toBe(true);
  a.exchangeCodeForSession.mockResolvedValue({data:{session,redirectType:null},error:null} as never);
  expect(await validarLinkDeSenha(a,base+'/?code=x','recovery')).toBe(false);
  expect(await validarLinkDeSenha(auth(),base+'/?code=x','invite')).toBe(false);
 });
 it.each(['#error=denied','?error_code=otp_expired','#type=invite&access_token=x','?code=x&token_hash=y&type=invite','?token_hash=x&type=recovery&type=invite'])('rejeita link incompleto/ambíguo %s',async suffix=>{
  expect(await validarLinkDeSenha(auth(),base+'/'+suffix,'invite')).toBe(false);
 });
 it('falha fechada quando o serviço rejeita OTP',async()=>{
  const a=auth();a.verifyOtp.mockResolvedValue({data:{session:null},error:{message:'invalid'}} as never);
  expect(await validarLinkDeSenha(a,base+'/?token_hash=x&type=invite','invite')).toBe(false);
 });
});
it('rejeita token de login comum rotulado como recovery',async()=>{
 const a=auth();Object.assign(a,{getClaims:vi.fn().mockResolvedValue({data:{claims:{amr:[{method:'password'}],exp:Math.floor(Date.now()/1000)+3600}},error:null})});
 expect(await validarLinkDeSenha(a,base+'/#access_token=token&refresh_token=refresh&type=recovery','recovery')).toBe(false);
});
it('SDK real exige verificador PKCE de recuperação e rejeita outro tipo de troca',async()=>{
 const {createClient}=await import('@supabase/supabase-js');
 for(const kind of ['recovery','signup','missing']){
  const store=new Map(kind==='missing'?[]:[['test-code-verifier',JSON.stringify('verifier/'+kind)]]);
  const c=createClient('https://example.invalid','public-key',{auth:{flowType:'pkce',storageKey:'test',detectSessionInUrl:false,autoRefreshToken:false,storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>{store.set(k,v)},removeItem:k=>{store.delete(k)}}},global:{fetch:async()=>new Response(JSON.stringify({access_token:'token',refresh_token:'refresh',token_type:'bearer',expires_in:3600,user:{id:'u'}}),{headers:{'Content-Type':'application/json'}})}});
  expect(await validarLinkDeSenha(c.auth,base+'/?code=code','recovery')).toBe(kind==='recovery');
 }
});
