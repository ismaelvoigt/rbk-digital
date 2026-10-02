import { credentialMessage } from "../../../public/convite-message.mjs";
import { createHash, randomUUID } from 'node:crypto';
import type { ChannelResult, DeliveryResult, DeliveryStatus } from './types';
export type Invitation = {
 kind: 'auditoria' | 'credenciamento'; id: string; name: string;
 email: string; phone: string; link: string;
};
export type DeliveryRecord = {
 attempt_id: string; kind: Invitation['kind']; invitation_id: string;
 link_hash: string; channel: 'email' | 'whatsapp'; status: DeliveryStatus;
};
export type EmailMessage = { to: string; subject: string; text: string };
type Dependencies = {
 configured: boolean; publicOrigin?: string;
 sendEmail: (message: EmailMessage) => Promise<void>;
 record: (record: DeliveryRecord) => Promise<void>;
};
export function validEmail(value: string) {
 return value.length <= 254 && /^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(value);
}
function shareable(invite: Invitation, origin?: string) {
 try {
  const url = new URL(invite.link), configured = new URL(origin || '');
  return url.origin === configured.origin && url.protocol === 'https:' &&
   !url.username && !url.password && !url.search &&
   !/^(localhost|127\.|\[::1\])/.test(url.hostname) &&
   url.pathname === `/portal/${invite.kind}` && /^#[A-Za-z0-9_-]{43}$/.test(url.hash);
 } catch { return false; }
}
export async function deliverInvitation(invite: Invitation, deps: Dependencies): Promise<DeliveryResult> {
 const safe = shareable(invite, deps.publicOrigin);
 const email = invite.email.trim();
 const digits = invite.phone.replace(/\D/g, '');
 const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
 const phoneValid = /^55[1-9][0-9]{9,10}$/.test(phone);
 const title = invite.kind === 'auditoria' ? 'Auditoria' : 'Credenciamento';
 const text = invite.kind === 'credenciamento' ? credentialMessage(invite.name, invite.link) : `Olá, equipe da ${invite.name}!\n\nA RBK Assessoria disponibilizou seu convite de ${title} do Farmácia Popular.\n\nAcesse: ${invite.link}\n\nVocê pode enviar aos poucos e voltar pelo mesmo link, válido por 40 dias enquanto estiver ativo. Envie os documentos pelo portal. Não compartilhe este acesso com terceiros.\n\nEquipe RBK Assessoria`;
 const base = { kind: invite.kind, invitation_id: invite.id, link_hash: createHash('sha256').update(invite.link).digest('hex') };
 async function channel(channel: 'email' | 'whatsapp'): Promise<ChannelResult> {
  const attempt_id = randomUUID();
  let recorded = true;
  const save = async (status: DeliveryStatus) => {
   try { await deps.record({...base, attempt_id, channel, status}); }
   catch { recorded = false; }
  };
  await save('pending');
  let status: DeliveryStatus;
  let url: string | undefined;
  if (!safe) status = 'unsafe_link';
  else if (channel === 'whatsapp') {
   status = phoneValid ? 'manual' : 'invalid_contact';
   if (phoneValid) url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  } else if (!validEmail(email)) status = 'invalid_contact';
  else if (!deps.configured) status = 'not_configured';
  else if (!recorded) status = 'unavailable';
  else {
   try { await deps.sendEmail({to:email,subject:`RBK Assessoria | Convite de ${title}`,text}); status = 'accepted'; }
   catch { status = 'failed'; }
  }
  await save(status);
  return {status, recorded, ...(url ? {url} : {})};
 }
 const [emailResult, whatsapp] = await Promise.all([channel('email'),channel('whatsapp')]);
 return {email:emailResult,whatsapp};
}
