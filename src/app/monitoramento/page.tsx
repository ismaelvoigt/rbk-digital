"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RbkBrand } from "../../components/RbkBrand";
import { createClient } from "../../lib/supabase/client";

type Farm = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
};

export default function MonitoramentoPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function load() {
      const { data, error: queryError } = await supabase
        .from("farms")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("status", "active")
        .order("razao_social");
      if (!active) return;
      if (queryError) setError("Não foi possível carregar a carteira de farmácias.");
      else setFarms(data ?? []);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <RbkBrand compact light />
        </div>
      </header>
      <div className="rbk-container py-8 sm:py-10">
        <Link href="/dashboard" className="mb-4 inline-block text-sm font-bold text-red-700">← Voltar ao Dashboard</Link>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">RBK Digital</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold text-gray-900">
          <svg
            className="h-8 w-8 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="m6 10 3-3 3 6 3-3" />
          </svg>
          <span>Centro de Monitoramento</span>
        </h1>
        <p className="mt-2 text-sm text-gray-600">Farmácias da carteira vinculada ao seu perfil.</p>
        {loading && <p className="mt-8 text-sm text-gray-600">Carregando farmácias...</p>}
        {error && <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && farms.length === 0 &&
          <p className="rbk-card mt-8 p-6 text-sm text-gray-600">Nenhuma farmácia vinculada à sua carteira.</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {farms.map((farm) => (
            <Link key={farm.id} href={`/monitoramento/farmacias/${farm.id}`}
              className="rbk-card rbk-card-hover block p-6">
              <h2 className="text-lg font-bold text-gray-900">
                {farm.nome_fantasia || farm.razao_social}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{farm.razao_social}</p>
              <p className="mt-3 text-sm text-gray-500">CNPJ {farm.cnpj}</p>
              <span className="mt-5 inline-block text-sm font-bold text-red-600">Ver farmácia →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
