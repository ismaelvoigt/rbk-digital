import { expect, test, vi } from 'vitest';
vi.mock('../src/lib/auditoria/server', () => ({
 assertStaging: () => {}, validateOrigin: () => {}, body: (r: Request) => r.json(),
 tokenHash: () => 'hash', newToken: () => 'token',
 managerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'manager' } } }) } }),
 PortalError: class extends Error { constructor(public status: number, message: string) { super(message); } },
 failure: (e: {status:number,message:string}) => Response.json({error:e.message},{status:e.status}),
 response: (data: unknown) => Response.json(data),
}));
vi.mock('../src/lib/supabase/admin', () => ({ createAdminClient: () => ({
 rpc: async (_name: string, args: any) => ({ data: { id: args.payload.id, storage_path: 'test/file' }, error: null }),
 storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: { signedUrl: 'https://example.test/upload' }, error: null }) }) },
}) }));
import { POST } from '../src/app/api/credenciamento/route';
test.each([7,8,9,10])('accepts document category %s including existing ids', async kind => {
 const response = await POST(request(kind)); expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({ url: 'https://example.test/upload' });
});
test.each([-1,11,1.5,'10'])('rejects invalid category %s', async kind => {
 expect((await POST(request(kind))).status).toBe(400);
});
function request(kind: unknown) { return new Request('https://example.test/api/credenciamento', { method: 'POST', body: JSON.stringify({op:'init', token:'test', file:{ id:'11111111-1111-4111-8111-111111111111', name:'residencial.pdf', mime:'application/pdf', size:100, kind, fingerprint:'a'.repeat(64) }}) }); }
