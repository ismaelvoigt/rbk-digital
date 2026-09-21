import {it,expect,vi,afterEach} from 'vitest';
const signed=vi.hoisted(()=>vi.fn(async()=>({data:{token:'object-scoped-signature'},error:null})));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({storage:{from:()=>({createSignedUploadUrl:signed})}})}));
import {signUpload} from '../src/lib/auditoria/server';
afterEach(()=>vi.unstubAllEnvs());
it('gera ticket TUS na rota assinada sem conceder sessão de usuário ou sobrescrita',async()=>{
 vi.stubEnv('AUDIT_PORTAL_ENABLED','true');vi.stubEnv('AUDIT_STAGING_PROJECT_REF','syntheticstage');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://syntheticstage.supabase.co');
 const t=await signUpload({path:'audit/file.pdf',mime:'application/pdf',exists:false});
 expect(t).toEqual({token:'object-scoped-signature',path:'audit/file.pdf',mime:'application/pdf',endpoint:'https://syntheticstage.storage.supabase.co/storage/v1/upload/resumable/sign'});
 expect(signed).toHaveBeenCalledWith('audit/file.pdf',{upsert:false});
});
