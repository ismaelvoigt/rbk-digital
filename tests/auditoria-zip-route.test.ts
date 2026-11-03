import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),sign:vi.fn(),factory:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:(...args:unknown[])=>{m.factory(...args);return {auth:{getUser:m.user},rpc:m.rpc};}}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({storage:{from:()=>({createSignedUrl:m.sign})}})}));
import {GET} from '../src/app/api/auditorias/arquivo-zip/route';
const aid='11111111-1111-4111-8111-111111111111', bid='22222222-2222-4222-8222-222222222222';
function request(query=`auditoria=${aid}&lote=${bid}`,headers={}){return new NextRequest(`https://app.test/api/auditorias/arquivo-zip?${query}`,{headers});}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('AUDIT_PORTAL_ENABLED','true');vi.stubEnv('AUDIT_STAGING_PROJECT_REF','testref');vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://testref.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public');m.user.mockResolvedValue({data:{user:{id:'manager'}},error:null});m.rpc.mockResolvedValue({data:{audit:{id:aid,pharmacy:'Farmácia Exemplo',cnpj:'11222333000181'},batches:[{id:bid,number:1,completed_at:'2026-11-01',files:[{id:'f',filename:'original.pdf',size:3,source:'pharmacy',audit_id:aid,batch_id:bid,storage_path:`${aid}/${bid}/f.pdf`,received_at:'2026-11-01'}]}]},error:null});m.sign.mockResolvedValue({data:{signedUrl:'https://testref.supabase.co/storage/file'},error:null});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]))));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('streams private ZIP using validated cookie session and fresh audit permission',async()=>{
 const r=await GET(request());expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/zip');expect(r.headers.get('content-disposition')).toContain('attachment;');expect(r.headers.get('cache-control')).toContain('no-store');expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(3);expect(m.rpc).toHaveBeenCalledWith('aud_manager',{op:'detail',aid,payload:{}});expect(m.sign).toHaveBeenCalledWith(`${aid}/${bid}/f.pdf`,60);
});
it('rejects missing session or audit permission before accessing storage',async()=>{
 m.user.mockResolvedValueOnce({data:{user:null},error:null});expect((await GET(request())).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();
 m.rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}});expect((await GET(request())).status).toBe(403);expect(m.sign).not.toHaveBeenCalled();
});
it('rejects malformed selection, cross-site requests, and unavailable source without generating a successful ZIP',async()=>{
 expect((await GET(request('auditoria=invalid'))).status).toBe(400);
 expect((await GET(request(undefined,{'sec-fetch-site':'cross-site'}))).status).toBe(403);
 expect((await GET(request(`auditoria=${aid}&lote=33333333-3333-4333-8333-333333333333`))).status).toBe(404);
 vi.mocked(fetch).mockResolvedValueOnce(new Response('not found',{status:404}));expect((await GET(request())).status).toBe(502);
});
it('preserves refreshed session cookies on the streamed response',async()=>{
 m.factory.mockImplementation((_url,_key,options)=>options.cookies.setAll([{name:'sb-test-auth-token',value:'synthetic-refreshed',options:{path:'/',sameSite:'lax',maxAge:3600}}]));
 const r=await GET(request());expect(r.headers.get('set-cookie')).toContain('sb-test-auth-token=synthetic-refreshed');expect(r.headers.get('set-cookie')).not.toContain('Max-Age=3600');await r.arrayBuffer();
});

it('names ZIPs after the pharmacy and selected batch',async()=>{
 const batch=await GET(request());expect(batch.headers.get('content-disposition')).toContain('Farmacia-Exemplo-lote-1.zip');await batch.arrayBuffer();
 vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array([1,2,3])));
 const all=await GET(request(`auditoria=${aid}`));expect(all.headers.get('content-disposition')).toContain('Farmacia-Exemplo-todos-lotes.zip');await all.arrayBuffer();
});
