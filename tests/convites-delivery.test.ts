import { expect, test, vi } from 'vitest';
import { deliverInvitation } from '../src/lib/convites/delivery';
const input = { kind: 'auditoria' as const, id:'11111111-1111-4111-8111-111111111111', name:'Farmácia Teste', email:'contato@example.com', phone:'(11) 99999-1234', link:'https://portal.example.com/portal/auditoria#'+'a'.repeat(43) };
function setup(send = vi.fn(async () => {})) {
 const records: unknown[] = [];
 return { records, send, deps: { sendEmail: send, configured: true, publicOrigin:'https://portal.example.com', record: async (value: unknown) => {records.push(value);} } };
}
test('SMTP failure does not suppress manual WhatsApp or leak provider error', async () => {
 const s=setup(vi.fn(async()=>{throw Error('SECRET provider body');}));
 const r=await deliverInvitation(input,s.deps);
 expect(r.email.status).toBe('failed'); expect(r.whatsapp.status).toBe('manual');
 expect(new URL(r.whatsapp.url!).pathname).toBe('/5511999991234');
 expect(new URL(r.whatsapp.url!).searchParams.get('text')).toContain(input.link);
 expect(JSON.stringify(r)).not.toContain('SECRET');
 expect(JSON.stringify(s.records)).not.toContain(input.link);
 expect(s.records).toHaveLength(4);
});
test('accepted email contains the existing complete fragment link', async()=>{
 const s=setup(); const r=await deliverInvitation(input,s.deps);
 expect(r.email.status).toBe('accepted');
 expect(s.send).toHaveBeenCalledWith(expect.objectContaining({to:input.email,text:expect.stringContaining(input.link)}));
});
test('missing SMTP configuration preserves WhatsApp fallback',async()=>{
 const s=setup(); const r=await deliverInvitation(input,{...s.deps,configured:false});
 expect(r.email.status).toBe('not_configured');expect(r.whatsapp.status).toBe('manual');expect(s.send).not.toHaveBeenCalled();
});
test.each(['other@example.com,third@example.com','a@example.com\r\nBcc:other@example.com',''])('invalid email is isolated: %s',async email=>{
 const s=setup(); const r=await deliverInvitation({...input,email},s.deps);
 expect(r.email.status).toBe('invalid_contact');expect(r.whatsapp.status).toBe('manual');expect(s.send).not.toHaveBeenCalled();
});
test.each(['https://evil.example/portal/auditoria#token','http://localhost:3000/portal/auditoria#token'])('does not share untrusted or local URLs',async link=>{
 const s=setup();const r=await deliverInvitation({...input,link},s.deps);
 expect(r.email.status).toBe('unsafe_link');expect(r.whatsapp.url).toBeUndefined();expect(s.send).not.toHaveBeenCalled();
});
test('log outage preserves invitation and prevents untracked automatic sending',async()=>{
 const s=setup();const r=await deliverInvitation(input,{...s.deps,record:async()=>{throw Error('database secret');}});
 expect(r.email.status).toBe('unavailable');expect(r.email.recorded).toBe(false);expect(s.send).not.toHaveBeenCalled();
 expect(r.whatsapp.status).toBe('manual');expect(r.whatsapp.recorded).toBe(false);
});
test('invalid phone does not suppress email',async()=>{
 const s=setup();const r=await deliverInvitation({...input,phone:'123'},s.deps);
 expect(r.email.status).toBe('accepted');expect(r.whatsapp.status).toBe('invalid_contact');
});
