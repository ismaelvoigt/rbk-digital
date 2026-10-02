"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export function GestorLogout() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");

    try {
      const result = await createClient().auth.signOut({ scope: "local" });

      if (result.error) {
        throw result.error;
      }

      window["location"].replace("/");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="rbk-gestor-logout">
      <button
        type="button"
        disabled={busy}
        onClick={() => void logout()}
      >
        {busy ? "Saindo…" : "Sair"}
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
