import { beforeEach, expect, test, vi } from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),dispatch:vi.fn(),history:vi.fn()}));
vi.mock('../src/lib/auditoria/server',()=>({
 body:(r:Request)=>r.json(), validateFiles:()=>{},signUpload:()=>{}, assertStaging:()=>{},validateOrigin:()=>{},
 managerClient:async()=>({rpc:m.rpc,auth:{getUser:async()=>({data:{user:{id:'manager'}}})}}),
 newToken:()=> 'a'.repeat(43),tokenHash:()=> 'b'.repeat(64),validUuid:(v:unknown)=>typeof v==='string'&&v.length===36,
 PortalError:class extends Error{constructor(public status:number,message:string){super(message);}},
 response:(v:unknown)=>Response.json(v),failure:(e:{status?:number})=>Response.json({error:'failed'},{status:e.status||500}),
}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:m.rpc})}));
vi.mock('../src/lib/convites/server',()=>({dispatchInvitation:m.dispatch,deliveryHistory:m.history,unavailableDelivery:()=>({email:{status:'unavailable'},whatsapp:{status:'unavailable'}})}));
import { POST as audit } from '../src/app/api/auditorias/[[...segments]]/route';
import { POST as credential } from '../src/app/api/credenciamento/route';
const id='11111111-1111-4111-8111-111111111111';
const request=(body:object)=>new Request('https://portal.example.com/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();m.dispatch.mockResolvedValue({email:{status:'failed',recorded:true},whatsapp:{status:'manual',recorded:true}});m.history.mockResolvedValue([]);});
test('audit confirmation uses saved contacts and preserves generated URL when email fails',async()=>{
 m.rpc.mockResolvedValueOnce({data:{created:true},error:null}).mockResolvedValueOnce({data:{audit:{pharmacy:'Saved',contact_email:'saved@example.com',contact_phone:'11999991234'}},error:null});
 const r=await audit(request({email:'attacker@example.com'}),{params:Promise.resolve({segments:[id,'confirm']})});
 expect(r.status).toBe(200);const data=await r.json();expect(data.url).toBe('https://portal.example.com/portal/auditoria#'+'a'.repeat(43));expect(data.delivery.email.status).toBe('failed');
 expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({email:'saved@example.com',link:data.url}));
});
test('denied audit never sends',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'42501'}});
 expect((await audit(request({}),{params:Promise.resolve({segments:[id,'link']})})).status).toBe(403);
 expect(m.dispatch).not.toHaveBeenCalled();
});
test('already-confirmed audit does not resend',async()=>{
 m.rpc.mockResolvedValue({data:{created:false},error:null});
 const r=await audit(request({}),{params:Promise.resolve({segments:[id,'confirm']})});
 expect(r.status).toBe(200);expect(m.dispatch).not.toHaveBeenCalled();
});
test('contact lookup outage after creation preserves audit link',async()=>{
 m.rpc.mockResolvedValueOnce({data:{created:true},error:null}).mockRejectedValueOnce(Error('offline'));
 const r=await audit(request({}),{params:Promise.resolve({segments:[id,'confirm']})});
 expect(r.status).toBe(200);expect((await r.json()).url).toContain('#');expect(m.dispatch).not.toHaveBeenCalled();
});
test('credential creation uses validated ficha and returns invite despite delivery failure',async()=>{
 m.rpc.mockResolvedValue({data:{id},error:null});
 const r=await credential(request({op:'create',manager:true,filial:false,ficha:{B19:'11222333000181',B20:'11222333000181',B21:'Farmacia',B32:'farm@example.com',B33:'11999991234'}}));
 expect(r.status).toBe(200);const data=await r.json();expect(data.link).toContain('/portal/credenciamento#');expect(data.delivery.email.status).toBe('failed');
 expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({id,email:'farm@example.com',link:data.link}));
});
test('credential public caller cannot create or send',async()=>{
 expect((await credential(request({op:'create',token:'a'}))).status).toBe(403);
 expect(m.dispatch).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();
});
test('credential renewal uses saved contacts and new link',async()=>{
 m.rpc.mockResolvedValue({data:{id,ficha:{B21:'Saved',B32:'saved@example.com',B33:'11999991234'}},error:null});
 const r=await credential(request({op:'renew',manager:true,id,email:'attacker@example.com'}));
 const data=await r.json();expect(r.status).toBe(200);
 expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({email:'saved@example.com',link:data.link}));
});
test('public credential reads never load private delivery history',async()=>{
 m.rpc.mockResolvedValue({data:{id,ficha:{}},error:null});
 const r=await credential(request({op:'get',token:'test'}));
 expect(r.status).toBe(200);expect((await r.json()).deliveries).toBeUndefined();expect(m.history).not.toHaveBeenCalled();
});
test('denied manager credential read never loads delivery history',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
 expect((await credential(request({op:'get',manager:true,id}))).status).toBe(409);expect(m.history).not.toHaveBeenCalled();
});
test('unexpected notification failure preserves credential creation',async()=>{
 m.rpc.mockResolvedValue({data:{id},error:null});m.dispatch.mockRejectedValue(Error('unexpected'));
 const r=await credential(request({op:'create',manager:true,filial:false,ficha:{B19:'11222333000181',B20:'11222333000181',B21:'Farmacia'}}));
 expect(r.status).toBe(200);const data=await r.json();expect(data.link).toContain('#');expect(data.delivery.email.status).toBe('unavailable');
});
test('duplicate credential advisory creates no invitation, email or link until confirmed',async()=>{
 m.rpc.mockResolvedValue({data:{confirmation_required:true,message:'Confirmar novo processo?'},error:null});
 const r=await credential(request({op:'create',manager:true,filial:false,ficha:{B19:'11222333000181',B21:'Farmacia'}}));
 expect(await r.json()).toEqual({confirmation_required:true,message:'Confirmar novo processo?'});expect(m.dispatch).not.toHaveBeenCalled();
});
