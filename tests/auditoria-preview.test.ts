import {it,expect,vi,afterEach} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
vi.mock('../src/lib/supabase/proxy',()=>({updateSession:vi.fn(async()=>NextResponse.next())}));
import {proxy,config} from '../src/proxy';
afterEach(()=>vi.unstubAllEnvs());
it('homologação dedicada bloqueia módulos e APIs fora da auditoria',async()=>{
 vi.stubEnv('AUDIT_STAGING_ONLY','true');
 for(const path of ['/api/usuarios','/api/processos/a.jpg','/usuarios','/farmacia'])expect((await proxy(new NextRequest(`https://stage.example${path}`))).status).toBe(404);
 expect(config.matcher).toContain('/api/:path*');
});
it('preserva rotas do portal e permite início do Gestor e redireciona processos para auditorias',async()=>{
 vi.stubEnv('AUDIT_STAGING_ONLY','true');
 for(const path of ['/','/dashboard','/portal/auditoria','/api/portal-auditoria','/api/auditorias','/processos/auditorias'])expect((await proxy(new NextRequest(`https://stage.example${path}`))).status).toBe(200);
 expect((await proxy(new NextRequest('https://stage.example/processos'))).headers.get('location')).toBe('https://stage.example/processos/auditorias');
});
