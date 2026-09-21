import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertStaging } from '../../../lib/auditoria/server';
export const runtime='nodejs';
export async function GET(){try{assertStaging();return new Response(await readFile(join(process.cwd(),'src/lib/credenciamento/form.html'),'utf8'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co; frame-ancestors 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'"}});}catch{return new Response('Portal indisponível',{status:503});}}
