import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
const smtp = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), close: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: smtp.create } }));
import { preparePharmacyInvitation } from '../src/lib/cadastro/invitation';
beforeEach(() => {
 vi.clearAllMocks();
 for(const [k,v] of Object.entries({ INVITE_SMTP_HOST:'smtp.example.com', INVITE_SMTP_PORT:'465', INVITE_SMTP_USER:'sender', INVITE_SMTP_PASSWORD:'secret', INVITE_EMAIL_FROM:'sender@example.com' })) vi.stubEnv(k,v);
 smtp.create.mockReturnValue({sendMail:smtp.send,close:smtp.close});
 smtp.send.mockResolvedValue({accepted:['client@example.com'], rejected:[]});
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it('sends the approved guide as a PDF attachment and preserves the complete signup link in both bodies', async () => {
 const send = await preparePharmacyInvitation();
 const link='https://example.supabase.co/auth/v1/verify?token=secret&type=invite&redirect_to=https%3A%2F%2Frbk-digital.vercel.app%2Fredefinir-senha';
 await send('client@example.com','Farmácia <Teste> & Cia',link);
 const mail=smtp.send.mock.calls[0]?.[0];
 expect(mail).toBeDefined();
 expect(mail.text).toContain(link);
 expect(mail.text).toContain('em anexo');
 expect(mail.html).toContain('Farmácia &lt;Teste&gt; &amp; Cia');
 expect(mail.html).not.toContain('Farmácia <Teste>');
 expect(mail.html).toContain('type=invite&amp;redirect_to=');
 expect(mail.attachments).toHaveLength(1);
 expect(mail.attachments[0].contentType).toBe('application/pdf');
 expect(mail.attachments[0].content).toEqual(await readFile('public/guias/RBK_Digital_Guia_Tela_Inicial.pdf'));
 expect(mail.envelope.to).toEqual(['client@example.com']);
 expect(smtp.close).toHaveBeenCalled();
});
it('refuses missing SMTP credentials before any send',async()=>{
 vi.stubEnv('INVITE_SMTP_PASSWORD','');
 await expect(preparePharmacyInvitation()).rejects.toThrow('smtp_not_configured');
 expect(smtp.send).not.toHaveBeenCalled();
});
it('requires TLS and reports SMTP rejection without exposing provider errors',async()=>{
 const send=await preparePharmacyInvitation();
 smtp.send.mockResolvedValue({accepted:[],rejected:['client@example.com']});
 await expect(send('client@example.com','Teste','https://example.com/invite')).rejects.toThrow('invitation_delivery_failed');
 expect(smtp.create.mock.calls[0][0]).toMatchObject({secure:true,requireTLS:true,disableFileAccess:true,disableUrlAccess:true});
 expect(smtp.close).toHaveBeenCalled();
});
it('closes timed-out connections instead of retrying a possibly accepted invitation',async()=>{
 const send=await preparePharmacyInvitation();
 vi.useFakeTimers(); smtp.send.mockImplementation(()=>new Promise(()=>{}));
 const pending=expect(send('client@example.com','Teste','https://example.com/invite')).rejects.toThrow('invitation_delivery_failed');
 await vi.advanceTimersByTimeAsync(15000);await pending;
 expect(smtp.send).toHaveBeenCalledTimes(1);expect(smtp.close).toHaveBeenCalled();
});
