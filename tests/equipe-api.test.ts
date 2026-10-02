import {it,expect,beforeEach,afterEach,vi} from 'vitest';
const m=vi.hoisted(()=>({perfil:'farmacia',status:'active',rbk:false,duplicate:false,smtpFail:false,registered:false,sent:false,metadata:null as any}));
vi.mock('../src/lib/cadastro/invitation',()=>({preparePharmacyInvitation:async()=>async()=>{if(m.smtpFail)throw Error('secret smtp');m.sent=true;}}));
vi.mock('../src/lib/supabase/admin',async()=>{const {createClient}=await import('@supabase/supabase-js');return {createAdminClient:()=>createClient('https://example.invalid','server-test',{auth:{persistSession:false,autoRefreshToken:false}})};});
import {GET,POST,PATCH} from '../src/app/api/equipe/route';
const id='20000000-0000-4000-8000-000000000001';
const input={nome:'Ana',email:'ana@example.invalid',perfil:'operador',status:'active'};
const request=(method:string,body?:unknown,auth=true)=>new Request('https://rbk-digital.vercel.app/api/equipe',{method,headers:auth?{authorization:'Bearer actor','content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
beforeEach(()=>{Object.assign(m,{perfil:'farmacia',status:'active',rbk:false,duplicate:false,smtpFail:false,registered:false,sent:false,metadata:null});vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','test');vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
 const path=new URL(String(url));const name=path.pathname.split('/').pop();let data:any=null;
 if(path.pathname==='/auth/v1/user')data={id};
 if(name==='users')data=path.searchParams.has('email')?(m.duplicate?[{id}]:[]):{perfil:m.perfil,status:m.status,farm_id:'farm'};
 if(name==='rbk_admins')data=m.rbk?{user_id:id}:null;
 if(name==='farms')data={id:'farm',cnpj:'123',nome_fantasia:'Alfa',status:'active'};
 if(name==='equipe_listar'||name==='audit_logs')data=[];
 if(name==='equipe_registrar_convite'){m.registered=true;data=null;}
 if(name==='generate_link'){m.metadata=JSON.parse(init.body).data;data={id:'new',email:input.email,action_link:'https://example.invalid/link',hashed_token:'secret-hash',verification_type:'invite',redirect_to:'https://rbk-digital.vercel.app/primeiro-acesso'};}
 return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('nega anônimo, atendente, gerente, inativo e administrador RBK',async()=>{
 expect((await GET(request('GET',undefined,false))).status).toBe(401);
 for(const perfil of ['operador','gerente_farmacia']){m.perfil=perfil;expect((await POST(request('POST',input))).status).toBe(403);}
 m.perfil='farmacia';m.status='inactive';expect((await PATCH(request('PATCH',input))).status).toBe(403);
 m.status='active';m.rbk=true;expect((await GET(request('GET'))).status).toBe(403);
 expect(m.registered).toBe(false);
});
it('lista equipe somente com administrador ativo',async()=>{expect((await GET(request('GET'))).status).toBe(200);});
it('impede reatribuir e-mail já cadastrado',async()=>{m.duplicate=true;expect((await POST(request('POST',input))).status).toBe(409);expect(m.registered).toBe(false);});
it('convite persiste contexto e não vaza link na resposta',async()=>{
 const res=await POST(request('POST',input));expect(res.status).toBe(201);expect(m.registered).toBe(true);expect(m.sent).toBe(true);
 expect(m.metadata).toMatchObject({farmacia_id:'farm',tipo_convite:'funcionario',perfil:'operador'});
 expect(JSON.stringify(await res.json())).not.toContain('secret-hash');
});
it('falha de SMTP preserva cadastro reenviável sem expor erro privado',async()=>{
 m.smtpFail=true;const res=await POST(request('POST',input));expect(res.status).toBe(502);expect(m.registered).toBe(true);expect(JSON.stringify(await res.json())).not.toContain('secret smtp');
});
