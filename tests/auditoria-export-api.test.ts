import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),admin:vi.fn(),start:vi.fn(),job:null as Record<string,unknown>|null,info:vi.fn(),sign:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:()=>({auth:{getUser:m.user},rpc:m.rpc})}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({from:m.admin,storage:{from:()=>({info:m.info,createSignedUrl:m.sign})}})}));
vi.mock('workflow/api',()=>({start:m.start}));
vi.mock('../src/workflows/auditoria-export',()=>({prepararAuditoriaZip:vi.fn()}));
import {GET} from '../src/app/api/auditorias/exportacoes/route';
import {snapshotHash} from '../src/lib/auditoria/export-server';
const aid='11111111-1111-4111-8111-111111111111',bid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
function request(download=false){return new NextRequest(`https://app.test/api/auditorias/exportacoes?id=${id}${download?'&download=1':''}`);}
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_RBK_ENV','development');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://ympeqcycjadvvumanmwm.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','anon');
 m.user.mockResolvedValue({data:{user:{id:'actor'}},error:null});m.job={id,audit_id:aid,actor_id:'actor',batch_id:null,state:'preparing',prepared_files:0,verified_parts:0,total_files:1,files:[{name:'Lote 001/x.pdf',path:`${aid}/${bid}/x.pdf`,size:3,sha256:'a'.repeat(64)}],expires_at:new Date(Date.now()+86400000).toISOString(),filename:'Farmacia.zip',object_path:`${id}/auditoria.zip`};m.job.snapshot_hash=snapshotHash(m.job.files as never);
 m.admin.mockImplementation(()=>{const q={select:()=>q,eq:vi.fn(()=>q),single:async()=>({data:m.job,error:null})};return q;});
 m.rpc.mockResolvedValue({data:{audit:{id:aid},batches:[{id:bid,number:1,completed_at:'2026-11-01',files:[{id:'x',filename:'x.pdf',size:3,source:'pharmacy',audit_id:aid,batch_id:bid,storage_path:`${aid}/${bid}/x.pdf`,received_at:'2026-11-01'}]}]},error:null});
 m.info.mockResolvedValue({data:{size:150},error:null});m.sign.mockResolvedValue({data:{signedUrl:'https://storage.test/private'},error:null});
});
afterEach(()=>vi.unstubAllEnvs());
it('rejects signed-out callers before accessing privileged storage',async()=>{m.user.mockResolvedValueOnce({data:{user:null},error:null});expect((await GET(request())).status).toBe(401);expect(m.admin).not.toHaveBeenCalled();});
it('rejects revoked managers and incomplete archives without signing anything',async()=>{
 m.rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}});expect((await GET(request())).status).toBe(403);
 expect((await GET(request(true))).status).toBe(409);expect(m.sign).not.toHaveBeenCalled();
});
it('rechecks expiry, size and validation before redirecting to private Storage',async()=>{
 Object.assign(m.job!,{state:'ready',validated_at:new Date().toISOString(),archive_bytes:150});const response=await GET(request(true));expect(response.status).toBe(302);expect(response.headers.get('location')).toBe('https://storage.test/private');expect(m.sign).toHaveBeenCalledWith(`${id}/auditoria.zip`,expect.any(Number),{download:'Farmacia.zip'});
 m.info.mockResolvedValueOnce({data:{size:149},error:null});expect((await GET(request(true))).status).toBe(409);
 m.job!.expires_at='2020-01-01';expect((await GET(request(true))).status).toBe(410);
});
it('rejects source manifest changes and production environment',async()=>{
 m.job!.snapshot_hash='changed';expect((await GET(request())).status).toBe(409);vi.stubEnv('NEXT_PUBLIC_RBK_ENV','production');expect((await GET(request())).status).toBe(503);
});
