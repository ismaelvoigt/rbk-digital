import 'server-only';
import nodemailer from 'nodemailer';
import { createAdminClient } from '../supabase/admin';
import { deliverInvitation, validEmail, type Invitation, type EmailMessage } from './delivery';
import type { DeliveryEvent, DeliveryResult } from './types';

function smtpConfig() {
 const env = process.env;
 const port = Number(env.INVITE_SMTP_PORT || '587');
 if (!env.INVITE_SMTP_HOST || !env.INVITE_SMTP_USER || !env.INVITE_SMTP_PASSWORD ||
     !env.INVITE_EMAIL_FROM || !validEmail(env.INVITE_EMAIL_FROM) || ![465,587].includes(port)) return null;
 return {host:env.INVITE_SMTP_HOST,port,secure:port===465,requireTLS:true,
  auth:{user:env.INVITE_SMTP_USER,pass:env.INVITE_SMTP_PASSWORD},
  connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000,dnsTimeout:5000,
  disableFileAccess:true,disableUrlAccess:true,logger:false as const,debug:false};
}
async function sendEmail(message: EmailMessage) {
 const config = smtpConfig();
 if (!config) throw new Error('smtp_not_configured');
 const transport = nodemailer.createTransport(config);
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const info = await Promise.race([
   transport.sendMail({...message,from:process.env.INVITE_EMAIL_FROM!,to:{address:message.to,name:''},envelope:{from:process.env.INVITE_EMAIL_FROM!,to:[message.to]}}),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>{transport.close();reject(new Error('smtp_timeout'));},15000);}),
  ]);
  if (!info.accepted?.length || info.rejected?.length) throw new Error('smtp_rejected');
 } finally { if(timer)clearTimeout(timer);transport.close(); }
}

// Called only after the existing RPC has authorized and persisted the invitation.
// Never accept a destination or link from a separate public sending endpoint.
export async function dispatchInvitation(invite: Invitation): Promise<DeliveryResult> {
 try {
  return await deliverInvitation(invite,{
   configured:!!smtpConfig(),publicOrigin:process.env.INVITE_PUBLIC_ORIGIN,sendEmail,
   record:async event=>{
    const {error}=await createAdminClient().from('invitation_deliveries').upsert({
     attempt_id:event.attempt_id,
     audit_id:event.kind==='auditoria'?event.invitation_id:null,
     credential_id:event.kind==='credenciamento'?event.invitation_id:null,
     link_hash:event.link_hash,channel:event.channel,status:event.status,updated_at:new Date().toISOString(),
    },{onConflict:'attempt_id'});
    if(error)throw new Error('delivery_log_failed');
   },
  });
 } catch { return unavailableDelivery(); }
}
export function unavailableDelivery(): DeliveryResult {
 return {email:{status:'unavailable',recorded:false},whatsapp:{status:'unavailable',recorded:false}};
}
export async function deliveryHistory(kind: Invitation['kind'], id: string): Promise<DeliveryEvent[] | null> {
 try {
  const {data,error}=await createAdminClient().from('invitation_deliveries')
   .select('channel,status,created_at').eq(kind==='auditoria'?'audit_id':'credential_id',id)
   .order('created_at',{ascending:false}).limit(20);
  return error ? null : data as DeliveryEvent[];
 } catch { return null; }
}
