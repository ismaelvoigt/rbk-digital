"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export function GestorNavigation({ home = "/dashboard" }: { home?: string }) {
  const path = usePathname();
  const internal = ["/dashboard", "/usuarios", "/autorizacoes", "/processos", "/monitoramento", "/pendencias"].some(prefix => path === prefix || path.startsWith(prefix + "/"));
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    if (!internal) return;
    const client = createClient();
    async function check() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { if (live) setAllowed(false); return; }
      const [profile, admin] = await Promise.all([
        client.from("users").select("perfil,status").eq("id", user.id).maybeSingle(),
        client.from("rbk_admins").select("user_id").eq("user_id", user.id).eq("ativo", true).maybeSingle(),
      ]);
      if (live) setAllowed(!profile.error && profile.data?.status === "active" && (profile.data.perfil === "gestor_rbk" || Boolean(admin.data && !admin.error)));
    }
    void check().catch(() => { if (live) setAllowed(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT" && live) setAllowed(false); });
    return () => { live = false; subscription.unsubscribe(); };
  }, [internal]);
  if (!internal || !allowed || path === "/dashboard") return null;
  return <nav aria-label="Navegação do Gestor" className="rbk-gestor-nav">
    <Link href={home}>← Voltar ao painel do Gestor</Link>
  </nav>;
}

export function GestorLogout() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace("/");
    } catch { setError("Não foi possível sair. Tente novamente."); setBusy(false); }
  }
  return <div className="rbk-gestor-logout">
    <button type="button" disabled={busy} onClick={() => void logout()}>{busy ? "Saindo…" : "Sair"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
