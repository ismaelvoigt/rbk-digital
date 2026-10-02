import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({getUser:vi.fn(),list:vi.fn(),generate:vi.fn(),oldInvite:vi.fn(),deleteUser:vi.fn(),prepare:vi.fn(),send:vi.fn(),operations:[] as string[],adminAllowed:true,insertFails:false,existingFarm:false,lastCnpj:"",existingUser:null as null | {id:string;farm_id:string;perfil:string}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:m.getUser}})}));
vi.mock('../src/lib/cadastro/invitation',()=>({preparePharmacyInvitation:m.prepare}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({
 rpc:async (_name:string,args:any)=>{m.lastCnpj=args.payload.cnpj;return {data:{farm:m.existingFarm?{id:'existing-farm',razao_social:'Original'}:args.p_create?{id:'new-farm'}:null,created:!m.existingFarm&&!!args.p_create},error:null};},
 auth:{admin:{listUsers:m.list,generateLink:m.generate,inviteUserByEmail:m.oldInvite,deleteUser:m.deleteUser}},
 from:(table:string)=>{
  const q={select:()=>q,eq:()=>q,insert:()=>{m.operations.push(`${table}:insert`);return q;},delete:()=>{m.operations.push(`${table}:delete`);return q;},
   maybeSingle:async()=>({data:table==='rbk_admins'&&m.adminAllowed?{user_id:'admin'}:table==='farms'&&m.existingFarm?{id:'existing-farm'}:table==='users'?m.existingUser:null,error:null}),
   single:async()=>table==='users'&&m.insertFails?{data:null,error:{message:'db_failed'}}:{data:{id:table==='farms'?'new-farm':'new-user'},error:null},
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:null,error:null}).then(resolve),
  };return q;
 }
})}));
import {POST} from '../src/app/api/usuarios/route';
function request(auth=true){return new Request('https://rbk-digital.vercel.app/api/usuarios',{method:'POST',headers:auth?{authorization:'Bearer test'}:{},body:JSON.stringify({razao_social:'Farmácia Teste',cnpj:'12345678000199',email:'client@example.com'})});}
beforeEach(()=>{
 vi.clearAllMocks();m.operations.length=0;m.adminAllowed=true;m.insertFails=false;m.existingFarm=false;m.existingUser=null;
 vi.spyOn(console,'error').mockImplementation(()=>{});
 m.getUser.mockResolvedValue({data:{user:{id:'admin'}},error:null});
 m.list.mockResolvedValue({data:{users:[]},error:null});
 const result={data:{user:{id:'new-user'},properties:{hashed_token:'invite-hash',action_link:'https://example.supabase.co/auth/v1/verify?token=test&type=invite'}},error:null};
 m.generate.mockResolvedValue(result);m.oldInvite.mockResolvedValue(result);
 m.prepare.mockResolvedValue(m.send);m.send.mockImplementation(async()=>{m.operations.push('email:send');});m.deleteUser.mockResolvedValue({error:null});
});
afterEach(()=>vi.restoreAllMocks());
it('registers the pharmacy before sending exactly one invitation with the generated link',async()=>{
 const res=await POST(request());expect(res.status).toBe(201);
 expect(m.generate).toHaveBeenCalledWith({type:'invite',email:'client@example.com',options:{redirectTo:'https://rbk-digital.vercel.app/primeiro-acesso'}});
 expect(m.oldInvite).not.toHaveBeenCalled();expect(m.send).toHaveBeenCalledWith('client@example.com','Farmácia Teste','https://rbk-digital.vercel.app/primeiro-acesso?type=invite&token_hash=invite-hash');
 expect(m.operations.indexOf('users:insert')).toBeLessThan(m.operations.indexOf('email:send'));
 expect(JSON.stringify(await res.json())).not.toContain('token=test');
});
it('blocks unauthenticated and non-admin requests before creating accounts or sending',async()=>{
 expect((await POST(request(false))).status).toBe(401);m.adminAllowed=false;expect((await POST(request())).status).toBe(403);
 expect(m.generate).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});
it('fails without creating any record when SMTP or guide preparation fails',async()=>{
 m.prepare.mockRejectedValue(new Error('missing'));
 expect((await POST(request())).status).toBe(503);expect(m.operations).toEqual([]);expect(m.generate).not.toHaveBeenCalled();
});
it('does not send an invitation if the user record cannot be saved',async()=>{
 m.insertFails=true;expect((await POST(request())).status).toBe(500);expect(m.send).not.toHaveBeenCalled();expect(m.deleteUser).toHaveBeenCalledWith('new-user');
});
it('rolls back the new registration when SMTP rejects it and returns no secret',async()=>{
 m.send.mockRejectedValue(new Error('private SMTP info'));
 const res=await POST(request());expect(res.status).toBe(502);
 expect(m.deleteUser).toHaveBeenCalledWith('new-user');expect(m.operations).toContain('users:delete');expect(m.operations).not.toContain('farms:delete');
 expect(JSON.stringify(await res.json())).not.toContain('private');
});
it('keeps existing-account linking without creating or sending another invite',async()=>{
 m.list.mockResolvedValue({data:{users:[{id:'existing',email:'client@example.com'}]},error:null});
 const res=await POST(request());expect(res.status).toBe(201);expect((await res.json()).tipo_acesso).toBe('existente');expect(m.generate).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});

it('reuses the master pharmacy previously created by an audit',async()=>{
 m.existingFarm=true;const res=await POST(request());expect(res.status).toBe(201);
 expect((await res.json()).farm.id).toBe('existing-farm');expect(m.operations).not.toContain('farms:insert');
});
it('preserves an existing pharmacy and its history if invitation delivery fails',async()=>{
 m.existingFarm=true;m.send.mockRejectedValue(new Error('unavailable'));
 expect((await POST(request())).status).toBe(502);expect(m.operations).not.toContain('farms:delete');
});
it('returns the existing access for the same pharmacy and email without creating another',async()=>{
 m.existingFarm=true;m.existingUser={id:'existing',farm_id:'existing-farm',perfil:'farmacia'};
 m.list.mockResolvedValue({data:{users:[{id:'existing',email:'client@example.com'}]},error:null});
 const res=await POST(request());expect(res.status).toBe(200);expect((await res.json()).usuario.id).toBe('existing');
 expect(m.operations).toEqual([]);
});
it('does not move an existing email from another pharmacy',async()=>{
 m.existingFarm=true;m.existingUser={id:'existing',farm_id:'other-farm',perfil:'farmacia'};
 m.list.mockResolvedValue({data:{users:[{id:'existing',email:'client@example.com'}]},error:null});
 expect((await POST(request())).status).toBe(409);expect(m.operations).toEqual([]);
});

it('preserves letters while resolving the same alphanumeric CNPJ used by an audit',async()=>{
 m.existingFarm=true;
 const res=await POST(new Request('https://rbk-digital.vercel.app/api/usuarios',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({razao_social:'Farmácia Teste',cnpj:'12.ABC.345/01DE-35',email:'client@example.com'})}));
 expect(res.status).toBe(201);expect(m.lastCnpj).toBe('12ABC34501DE35');
});
it.each(['119999999999','123','telefone12345678901'])('rejects invalid phone %s before creating records or invitations',async telefone=>{
 const res=await POST(new Request('https://rbk-digital.vercel.app/api/usuarios',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({razao_social:'Farmácia Teste',cnpj:'11222333000181',email:'client@example.com',telefone})}));
 expect(res.status).toBe(400);expect((await res.json()).error).toContain('telefone');expect(m.operations).toEqual([]);expect(m.generate).not.toHaveBeenCalled();
});
