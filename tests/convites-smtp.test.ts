import { beforeEach, afterEach, expect, test, vi } from 'vitest';
const mock=vi.hoisted(()=>({send:vi.fn(),upsert:vi.fn(),transport:vi.fn(),close:vi.fn()}));
vi.mock('nodemailer',()=>({default:{createTransport:mock.transport}}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({from:()=>({upsert:mock.upsert})})}));
import { dispatchInvitation } from '../src/lib/convites/server';
const invite={kind:'credenciamento' as const,id:'11111111-1111-4111-8111-111111111111',name:'Farmacia',email:'farm@example.com',phone:'11999991234',link:'https://portal.example.com/portal/credenciamento#'+'a'.repeat(43)};
beforeEach(()=>{
 vi.resetAllMocks();
 for(const [key,value]of Object.entries({INVITE_SMTP_HOST:'smtp.example.com',INVITE_SMTP_USER:'user',INVITE_SMTP_PASSWORD:'secret',INVITE_EMAIL_FROM:'rbk@example.com',INVITE_SMTP_PORT:'587',INVITE_PUBLIC_ORIGIN:'https://portal.example.com'}))vi.stubEnv(key,value);
 mock.transport.mockReturnValue({sendMail:mock.send,close:mock.close});mock.upsert.mockResolvedValue({error:null});
 mock.send.mockResolvedValue({accepted:['farm@example.com'],rejected:[]});
});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
test('uses TLS, one recipient and persists separate channel outcomes without secrets',async()=>{
 const r=await dispatchInvitation(invite);expect(r.email.status).toBe('accepted');
 expect(mock.transport).toHaveBeenCalledWith(expect.objectContaining({requireTLS:true,secure:false,logger:false,debug:false}));
 expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({envelope:{from:'rbk@example.com',to:['farm@example.com']}}));
 const records=mock.upsert.mock.calls.map(c=>c[0]);expect(records).toContainEqual(expect.objectContaining({channel:'email',status:'accepted',credential_id:invite.id,audit_id:null}));
 expect(JSON.stringify(records)).not.toContain(invite.link);expect(JSON.stringify(records)).not.toContain('secret');
});
test('SMTP recipient rejection is failure, not accepted',async()=>{
 mock.send.mockResolvedValue({accepted:[],rejected:['farm@example.com']});
 expect((await dispatchInvitation(invite)).email.status).toBe('failed');
});
test('bounds SMTP wait and preserves manual WhatsApp',async()=>{
 vi.useFakeTimers();mock.send.mockImplementation(()=>new Promise(()=>{}));
 const promise=dispatchInvitation(invite);await vi.advanceTimersByTimeAsync(15001);const r=await promise;
 expect(r.email.status).toBe('failed');expect(r.whatsapp.status).toBe('manual');expect(mock.close).toHaveBeenCalled();
});
test('missing table prevents unlogged SMTP and returns honest warning',async()=>{
 mock.upsert.mockResolvedValue({error:{message:'private DB detail'}});
 const r=await dispatchInvitation(invite);expect(r.email.status).toBe('unavailable');expect(r.email.recorded).toBe(false);expect(mock.send).not.toHaveBeenCalled();
});
