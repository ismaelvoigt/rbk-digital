"use client";
import { useState } from "react";
import type { Summary } from "../../../lib/auditoria/domain";
import { date } from "../../../lib/auditoria/domain";
export default function ContactMessages({ audit, link, expires, onSave }: {
  audit: Summary["audit"]; link: string; expires?: string;
  onSave: (contact: { email: string; phone: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState(audit.contact_email || "");
  const [phone, setPhone] = useState(audit.contact_phone || "");
  const [saving, setSaving] = useState(false);
  return <section className="aud-link-panel" aria-label="Entrega do acesso">
    <strong>Entrega do acesso</strong>
    <p>{audit.contact_email || "E-mail não informado"} · {audit.contact_phone || "WhatsApp não informado"}</p>
    <small>E-mail e WhatsApp não enviados — envio automático ainda não ativado neste portal.</small>
    <details className="aud-office-history"><summary>Alterar contatos</summary>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); try { await onSave({email,phone}); } finally { setSaving(false); } }}>
        <div className="aud-grid">
          <label>E-mail do cliente<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Celular / WhatsApp<input type="tel" required maxLength={40} placeholder="(DDD) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)} /></label>
        </div>
        <button disabled={saving}>{saving ? "Salvando…" : "Salvar contato"}</button>
      </form>
    </details>
    {link && <details className="aud-office-history"><summary>Ver mensagens e copiar link</summary><Drafts key={`${link}:${expires}`} audit={audit} link={link} email={email} phone={phone} expires={expires} /></details>}
  </section>;
}
function Drafts({audit,link,email,phone,expires}: {audit:Summary["audit"];link:string;email:string;phone:string;expires?:string}) {
  const greeting=`Olá, equipe da ${audit.pharmacy}!`;
  const validity=expires ? `\nEste link é válido até ${date(expires)}, enquanto a coleta estiver aberta.` : "";
  const [subject,setSubject]=useState(`RBK Assessoria | Envio de documentos — ${audit.pharmacy}`);
  const [mail,setMail]=useState(`${greeting}\n\nA RBK Assessoria disponibilizou seu portal seguro para envio dos documentos de auditoria do Programa Farmácia Popular.\n\nCNPJ: ${audit.cnpj}\nAcesse: ${link}\n\nVocê pode enviar os arquivos aos poucos e voltar ao mesmo link para continuar. Cada envio terá um comprovante de recebimento RBK, disponível no histórico. Não é necessário criar uma conta.${validity}\n\nUse o WhatsApp para falar conosco e o portal para enviar os documentos. Não encaminhe este link a terceiros.\n\nAtenciosamente,\nEquipe RBK Assessoria`);
  const [whats,setWhats]=useState(`${greeting} Aqui é a equipe RBK Assessoria.\n\nSeu link para enviar os documentos da auditoria do Farmácia Popular é:\n${link}\n\nPode enviar aos poucos e voltar ao mesmo link. Os comprovantes ficam no histórico do portal.${validity}\n\nSe precisar, fale conosco por aqui. Os documentos devem ser enviados pelo portal. Guarde este link e não o compartilhe com terceiros.`);
  const [notice,setNotice]=useState("");
  const online=link.startsWith("https://") && !new URL(link).hostname.match(/^(localhost|127\.)/);
  const digits=phone.replace(/\D/g,""); const destination=digits.length===10||digits.length===11 ? `55${digits}` : digits;
  const copy=async(text:string)=>{try {await navigator.clipboard.writeText(text);setNotice("Mensagem copiada.");}catch{setNotice("Selecione e copie o texto da mensagem.");}};
  return <div>
    <p>Revise e personalize os textos. Abrir o aplicativo prepara a mensagem; o envio é confirmado por você.</p>
    {!online && <p role="status">Teste local: este link funciona somente neste computador. Publique o portal em HTTPS antes de enviar a clientes.</p>}
    <h3>Mensagem por e-mail</h3>
    <label>Assunto<input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)} /></label>
    <label>Texto do e-mail<textarea rows={10} value={mail} onChange={e=>setMail(e.target.value)} /></label>
    <div className="aud-actions"><button onClick={()=>void copy(`${subject}\n\n${mail}`)}>Copiar e-mail</button>
    {online && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && <a href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mail)}`} rel="noreferrer">Abrir no aplicativo de e-mail</a>}</div>
    <h3>Mensagem por WhatsApp</h3>
    <label>Texto do WhatsApp<textarea rows={8} value={whats} onChange={e=>setWhats(e.target.value)} /></label>
    <div className="aud-actions"><button onClick={()=>void copy(whats)}>Copiar mensagem do WhatsApp</button>
    {online && /^55[1-9][0-9]{9,10}$/.test(destination) && <a href={`https://wa.me/${destination}?text=${encodeURIComponent(whats)}`} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>}</div>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
