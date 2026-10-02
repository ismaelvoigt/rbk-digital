"use client";

import { useId, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Preview = { farm_id: string; name: string; cnpj: string; eligible: boolean; reason: string | null; never_accessed: boolean; documents: number; users: number; authorizations: number; audits: number; credentials: number; pending: boolean; completed: boolean };
export function ExcluirFarmacia({ farmId, onDeleted }: { farmId: string; onDeleted: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function call(method: "GET" | "DELETE") {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) throw new Error("Sessão expirada. Faça login novamente.");
    const response = await fetch(`/api/usuarios/exclusao${method === "GET" ? `?farm_id=${farmId}` : ""}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      ...(method === "DELETE" ? { body: JSON.stringify({ farm_id: farmId, cnpj }) } : {}),
    });
    const data = await response.json();
    if (data.pending) setPending(true);
    if (!response.ok) throw new Error(data.error ?? "Não foi possível verificar a exclusão.");
    return data as Preview;
  }
  async function open() {
    setBusy(true); setError(""); setPreview(null); setCnpj(""); setPending(false);
    dialog.current?.showModal();
    try { const data = await call("GET"); if (data.completed) { dialog.current?.close(); onDeleted(); } else { setPreview(data); setPending(data.pending); } }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível verificar a exclusão."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try {
      let result: Preview;
      let batches = 0;
      do { result = await call("DELETE"); batches += 1; } while (result.pending && !result.completed && batches < 50);
      if (result.pending && !result.completed) setError("A exclusão ainda está em andamento. Clique em Retomar exclusão para remover os próximos arquivos.");
      if (result.completed) { dialog.current?.close(); onDeleted(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir a exclusão. Consulte a situação antes de tentar novamente."); }
    finally { setBusy(false); }
  }
  const confirmed = preview && cnpj.replace(/\D/g, "") === preview.cnpj.replace(/\D/g, "");
  return <>
    <button type="button" onClick={open} disabled={busy} className="rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">{pending ? "Retomar exclusão" : "Excluir definitivamente"}</button>
    <dialog ref={dialog} onCancel={(e) => { if (busy) e.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/40" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-xl font-bold text-gray-900">Excluir farmácia definitivamente</h2>
      {busy && !preview && <p className="mt-4 text-gray-600" role="status">Verificando acessos e documentos…</p>}
      {preview && <div className="mt-4 space-y-4">
        <div><p className="font-semibold text-gray-900">{preview.name}</p><p className="text-sm text-gray-600">CNPJ: {preview.cnpj}</p></div>
        {preview.eligible || pending ? <>
          <p className="text-sm text-gray-600">{pending ? "A exclusão já foi iniciada e precisa ser concluída." : preview.never_accessed ? "Nenhum usuário desta farmácia acessou o sistema." : "Esta farmácia não possui documentos enviados."}</p>
          <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-900">Esta ação não pode ser desfeita. Serão apagados o cadastro, {preview.users} acesso(s), {preview.authorizations} autorização(ões), {preview.documents} arquivo(s), os dados de vendas e estoque e os processos vinculados ({preview.audits} auditoria(s) e {preview.credentials} credenciamento(s)).</p>
          <label className="block text-sm font-semibold text-gray-800">Digite o CNPJ para confirmar<input autoComplete="off" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(e.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal" /></label>
        </> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">{preview.reason}</p>}
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => dialog.current?.close()} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">{preview?.eligible ? "Cancelar" : "Fechar"}</button>
        {(preview?.eligible || pending) && <button type="button" onClick={remove} disabled={busy || !confirmed} className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Excluindo…" : pending ? "Retomar exclusão" : "Excluir definitivamente"}</button>}
      </div>
    </dialog>
  </>;
}
