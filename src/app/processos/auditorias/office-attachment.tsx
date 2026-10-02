"use client";
import { useRef, useState } from "react";
import { uploadOffice } from "../../../lib/auditoria/office";
import { bytes, date, type AuditFile } from "../../../lib/auditoria/domain";
export default function OfficeAttachment({ id, files, onRefresh, onDownload }: {
  id: string; files: (AuditFile & { created_at: string })[];
  onRefresh: () => Promise<void>; onDownload: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const received = files.filter(f => f.received_at);
  const current = received[0];
  async function send() {
    if (!file || busy) return;
    setBusy(true); setMessage("");
    try {
      await uploadOffice(id, file, setProgress);
      await onRefresh();
      setFile(null); setEditing(false); setProgress(0);
      if (input.current) input.current.value = "";
      setMessage("Ofício anexado.");
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="aud-office" aria-label="Ofício da auditoria">
    <div className="aud-row">
      <div className="aud-office-name"><strong>{current ? "Ofício anexado" : "Ofício obrigatório"}</strong>
        <span>{current ? `${current.filename} · ${bytes(current.size)}` : "Anexe o ofício para completar o cadastro."}</span>
      </div>
      <div className="aud-actions">
        {current?.scan === "clean" && <button onClick={() => onDownload(current.id)}>Baixar</button>}
        {current && <button className="aud-primary" disabled={busy} onClick={() => {setEditing(!editing);setMessage("");}}>{editing ? "Cancelar substituição" : "Substituir ofício"}</button>}
      </div>
    </div>
    {current && ["infected", "rejected"].includes(current.scan || "") && <p role="alert">Arquivo bloqueado por segurança. Substitua o ofício.</p>}
    {(!current || editing) && <div className="aud-office-edit">
      <label className="aud-drop"><strong>1. Selecione o ofício recebido</strong><span className="aud-upload-help">Clique no botão abaixo para escolher o arquivo no seu aparelho.</span><input aria-label="Selecionar ofício" ref={input} type="file" accept=".pdf,.html,.htm,.jpg,.jpeg,.png,.tif,.tiff" disabled={busy} onChange={e => {setFile(e.target.files?.[0] || null);setProgress(0);setMessage("");}} /></label>
      {file && <p className="aud-selection" role="status">Selecionado: <strong>{file.name}</strong> · {bytes(file.size)}</p>}
      <small>PDF, HTML ou imagem, até 100 MB. A substituição preserva o histórico.</small>
      {busy && <progress aria-label="Progresso do ofício" max={file?.size || 1} value={progress} />}
      <button className="aud-primary" disabled={busy || !file} onClick={() => void send()}>{busy ? "Enviando…" : "2. Enviar ofício"}</button>
    </div>}
    {received.length > 1 && <details className="aud-office-history"><summary>Versões anteriores ({received.length - 1})</summary>
      {received.slice(1).map(f => <div className="aud-row" key={f.id}><span>{f.filename} · {date(f.received_at)} · {bytes(f.size)}</span>{f.scan === "clean" && <button onClick={() => onDownload(f.id)}>Baixar</button>}</div>)}
    </details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
