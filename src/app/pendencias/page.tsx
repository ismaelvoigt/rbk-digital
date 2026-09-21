"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RbkBrand } from "../../components/RbkBrand";
import { getPendenciasDocumentais, type DocumentoStatus } from "../../lib/documentos/pendencias";
import { createClient } from "../../lib/supabase/client";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  data_autorizacao: string | null;
  documentos: DocumentoStatus[];
};

export default function PendenciasPage() {
  const [items, setItems] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setError("Faça login para consultar as pendências.");
        if (active) setLoading(false);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("farm_id, perfil, status")
        .eq("id", user.id)
        .single();
      if (profileError || !profile?.farm_id || profile.status !== "active" ||
        !["farmacia", "operador", "administrador_farmacia"].includes(profile.perfil)) {
        if (active) {
          setError("Seu perfil não está vinculado a uma farmácia ativa.");
          setLoading(false);
        }
        return;
      }
      const { data, error: queryError } = await supabase
        .from("autorizacoes")
        .select("id, numero_autorizacao, data_autorizacao, documentos(categoria, status)")
        .eq("farm_id", profile.farm_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (queryError) setError("Não foi possível carregar as pendências.");
      else setItems((data ?? []) as Autorizacao[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const pendentes = items.map((item) => ({
    ...item,
    pendencias: getPendenciasDocumentais(item.documentos ?? []),
  })).filter((item) => item.pendencias.length > 0);

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <RbkBrand compact />
          <Link href="/farmacia" className="text-sm font-bold text-gray-600">← Voltar ao início</Link>
        </div>
      </header>
      <div className="rbk-container py-8 sm:py-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">Rotina da farmácia</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Pendências</h1>
        <p className="mt-2 text-sm text-gray-600">
          Confira documentos ausentes ou marcados para atenção. Isto não é uma conclusão de auditoria.
        </p>
        {loading && <p className="mt-8 text-sm text-gray-600">Carregando pendências...</p>}
        {error && <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && pendentes.length === 0 &&
          <p className="rbk-card mt-8 p-6 text-sm text-gray-600">Nenhuma pendência documental encontrada nas últimas 100 autorizações.</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {pendentes.map((item) => (
            <article key={item.id} className="rbk-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Requer conferência</p>
              <h2 className="mt-2 text-lg font-bold text-gray-900">Autorização {item.numero_autorizacao}</h2>
              <p className="mt-1 text-sm text-gray-500">{item.data_autorizacao ?? "Data não informada"}</p>
              <p className="mt-4 text-sm text-gray-700">{item.pendencias.join(", ")}</p>
              <Link href={`/autorizacoes/${item.id}/documentos`}
                className="mt-5 inline-block rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white">
                Conferir documentos →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
