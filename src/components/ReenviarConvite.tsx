"use client";
import { useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
export function ReenviarConvite({
  id,
  emailSalvo,
  emailAtual,
  disabled = false,
}: {
  id: string;
  emailSalvo: string;
  emailAtual: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const sending = useRef(false);
  const dirty =
    emailSalvo.trim().toLowerCase() !== emailAtual.trim().toLowerCase();
  async function resend() {
    if (disabled || dirty || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch("/api/usuarios/convite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, email: emailSalvo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "O envio não foi confirmado.");
      setMessage([data.mensagem, data.aviso].filter(Boolean).join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={disabled || dirty || busy}
        className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Reenviando…" : "Reenviar convite"}
      </button>
      <p className="mt-2 break-all text-xs text-gray-500">
        Novo link para definir a senha, enviado ao e-mail salvo: {emailSalvo}.
      </p>
      {dirty && (
        <p className="mt-2 text-sm text-amber-800">
          Salve o novo e-mail antes de reenviar.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
