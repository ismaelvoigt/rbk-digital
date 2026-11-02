"use client";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";
export function AcessoFarmacia({
  id,
  perfil,
  plano,
}: {
  id: string;
  perfil: string;
  plano: string;
}) {
  const [role, setRole] = useState(perfil),
    [plan, setPlan] = useState(plano),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function change(acao: "promover" | "plano", next?: string) {
    const text =
      acao === "promover"
        ? "Promover este responsável a administrador da farmácia? O plano permanecerá o mesmo."
        : next === "completo"
          ? "Liberar os módulos de gestão para toda a farmácia?"
          : "Retornar toda a farmácia ao plano de armazenamento?";
    if (busy || !window.confirm(text)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const res = await fetch("/api/usuarios/acesso", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, acao, plano: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.completed)
        throw new Error(data.error || "Alteração não confirmada.");
      if (acao === "promover") setRole("administrador_farmacia");
      else setPlan(next!);
      setMessage(
        "Acesso atualizado. O cliente verá a alteração ao atualizar a página.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível alterar o acesso.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-bold">Perfil e plano da farmácia</h2>
      <p className="mt-3 text-sm">
        Responsável:{" "}
        <strong>
          {role === "operador"
            ? "Atendente"
            : "Administrador da farmácia"}
        </strong>
      </p>
      <p className="mt-2 text-sm">
        Plano:{" "}
        <strong>
          {plan === "completo" ? "Armazenamento e gestão" : "Armazenamento"}
        </strong>
      </p>
      <p className="mt-3 text-sm text-gray-600">
        Promover o responsável permite administrar a equipe. Os módulos
        avançados são liberados separadamente para a farmácia.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {role === "operador" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change("promover")}
            className="rounded-xl border p-3 font-semibold disabled:opacity-50"
          >
            Promover para administrador
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void change(
              "plano",
              plan === "completo" ? "armazenamento" : "completo",
            )
          }
          className="rounded-xl border p-3 font-semibold disabled:opacity-50"
        >
          {plan === "completo"
            ? "Voltar para armazenamento"
            : "Liberar módulos de gestão"}
        </button>
      </div>
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
    </section>
  );
}
