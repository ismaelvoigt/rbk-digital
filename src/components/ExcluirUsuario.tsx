"use client";
import { useId, useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";
type Preview = { eligible: boolean; reason?: string };
export function ExcluirUsuario({
  id,
  email,
  onDeleted,
}: {
  id: string;
  email: string;
  onDeleted: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState("");
  async function headers() {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente.");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }
  async function show() {
    setOpen(true);
    setBusy(true);
    setPreview(null);
    setError("");
    setConfirmation("");
    try {
      const res = await fetch(
        `/api/usuarios/remover?id=${encodeURIComponent(id)}`,
        { headers: await headers() },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Não foi possível verificar o usuário.");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (
      busy ||
      !preview?.eligible ||
      confirmation.trim().toLowerCase() !== email.toLowerCase()
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/usuarios/remover", {
        method: "DELETE",
        headers: await headers(),
        body: JSON.stringify({ id, email: confirmation.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.completed)
        throw new Error(
          data.error || "Exclusão não confirmada. Atualize a lista.",
        );
      setOpen(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na exclusão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void show()}
        className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700"
      >
        Excluir usuário
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id={titleId} className="text-xl font-bold">
              Excluir usuário
            </h2>
            <p className="mt-3 break-all font-semibold">{email}</p>
            <p className="mt-3 text-sm text-gray-600">
              Esta ação remove definitivamente o login. A farmácia permanece
              cadastrada. Só é permitido excluir usuários sem documentos,
              autorizações ou outros registros vinculados.
            </p>
            {busy && (
              <p role="status" className="mt-4">
                Verificando…
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}
            {preview && !preview.eligible && (
              <p className="mt-4 text-sm text-amber-800">
                {preview.reason || "Este usuário não pode ser excluído."}
              </p>
            )}
            {preview?.eligible && (
              <form onSubmit={remove} className="mt-4">
                <label className="block text-sm font-semibold">
                  Digite o e-mail do usuário para confirmar
                  <input
                    type="email"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border p-3"
                    required
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    confirmation.trim().toLowerCase() !== email.toLowerCase()
                  }
                  className="mt-4 w-full rounded-xl bg-red-600 p-3 font-semibold text-white disabled:opacity-50"
                >
                  Excluir definitivamente este usuário
                </button>
              </form>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl border p-3 disabled:opacity-50"
            >
              Cancelar
            </button>
          </section>
        </div>
      )}
    </>
  );
}
