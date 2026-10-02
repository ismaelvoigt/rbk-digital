"use client";
import { deliveryLabels, type DeliveryResult, type DeliveryEvent } from "../../../lib/convites/types";
import { useState } from "react";
import type { Summary } from "../../../lib/auditoria/domain";
import { date } from "../../../lib/auditoria/domain";
export default function ContactMessages({ audit, onSave, delivery, history }: {
  audit: Summary["audit"]; link: string; expires?: string;
  delivery?: DeliveryResult; history?: DeliveryEvent[] | null;
  onSave: (contact: { email: string; phone: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState(audit.contact_email || "");
  const [phone, setPhone] = useState(audit.contact_phone || "");
  const [saving, setSaving] = useState(false);
  return <section className="aud-link-panel" aria-label="Entrega do acesso">
    <strong>Entrega do acesso</strong>
    <p>{audit.contact_email || "E-mail não informado"} · {audit.contact_phone || "WhatsApp não informado"}</p>
    {delivery && <div role="status">{(["email","whatsapp"] as const).map(channel=><p key={channel}>
      {channel === "email" ? "E-mail" : "WhatsApp"}: {deliveryLabels[delivery[channel].status]}
      {!delivery[channel].recorded && " · Não foi possível salvar o registro desta tentativa."}
    </p>)}</div>}
    {history === null && <p>Histórico de envio indisponível.</p>}
    {!!history?.length && <details><summary>Histórico de envio</summary><ul>{history.map((event,index)=><li key={index}>
      {date(event.created_at)} · {event.channel === "email" ? "E-mail" : "WhatsApp"}: {deliveryLabels[event.status]}
    </li>)}</ul></details>}
    {!delivery && !history?.length && <small>Nenhum envio registrado. Compartilhe o link existente ou gere um novo convite.</small>}
    <details className="aud-office-history"><summary>Alterar contatos</summary>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); try { await onSave({email,phone}); } finally { setSaving(false); } }}>
        <div className="aud-grid">
          <label>E-mail do cliente<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Celular / WhatsApp<input type="tel" required maxLength={40} placeholder="(DDD) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)} /></label>
        </div>
        <button disabled={saving}>{saving ? "Salvando…" : "Salvar contato"}</button>
      </form>
    </details>
  </section>;
}
