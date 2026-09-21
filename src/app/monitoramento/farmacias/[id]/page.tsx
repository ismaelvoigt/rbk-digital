"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RbkBrand } from "../../../../components/RbkBrand";
import { createClient } from "../../../../lib/supabase/client";

type Farm = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string };
type Authorization = { id: string; numero_autorizacao: string; data_autorizacao: string | null; analysis_status: string };
const tabs = ["Visão Geral", "Autorizações", "Ocorrências", "Auditoria", "Relatórios"] as const;

export default function FarmMonitoringPage() {
  const { id } = useParams<{ id: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Visão Geral");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function load() {
      const { data: farmData, error: farmError } = await supabase
        .from("farms")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (farmError || !farmData) {
        setError("Farmácia não encontrada ou fora da sua carteira.");
        setLoading(false);
        return;
      }
      const { data, error: authError } = await supabase
        .from("autorizacoes")
        .select("id, numero_autorizacao, data_autorizacao, analysis_status")
        .eq("farm_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (authError) setError("Não foi possível carregar as autorizações.");
      else {
        setFarm(farmData);
        setAuthorizations(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [id]);

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <RbkBrand compact />
          <Link href="/monitoramento" className="text-sm font-bold text-gray-600">← Monitoramento</Link>
        </div>
      </header>
      <div className="rbk-container py-8 sm:py-10">
        {loading && <p className="text-sm text-gray-600">Carregando farmácia...</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {farm && !error && <>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">Detalhe da farmácia</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">{farm.nome_fantasia || farm.razao_social}</h1>
          <p className="mt-2 text-sm text-gray-600">{farm.razao_social} · CNPJ {farm.cnpj}</p>
          <div role="tablist" aria-label="Seções da farmácia"
            className="mt-7 flex gap-2 overflow-x-auto border-b border-gray-200 pb-3">
            {tabs.map((name) => <button key={name} type="button" role="tab"
              aria-selected={tab === name} onClick={() => setTab(name)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === name ? "bg-red-600 text-white" : "bg-white text-gray-700"}`}>
              {name}
            </button>)}
          </div>
          {tab === "Visão Geral" && <section className="rbk-card mt-6 p-6">
            <h2 className="text-lg font-bold text-gray-900">Resumo da operação</h2>
            <p className="mt-3 text-sm text-gray-600">{authorizations.length} autorizações recentes carregadas.</p>
            <p className="mt-2 text-sm text-gray-500">A análise automática será exibida após a definição da Matriz de Regras RBK.</p>
          </section>}
          {tab === "Autorizações" && <section className="mt-6 grid gap-3">
            {authorizations.length === 0 && <p className="rbk-card p-6 text-sm text-gray-600">Nenhuma autorização encontrada.</p>}
            {authorizations.map((authorization) =>
              <Link key={authorization.id} href={`/autorizacoes/${authorization.id}/documentos`}
                className="rbk-card block p-5 text-sm font-semibold text-gray-800">
                {authorization.numero_autorizacao} · {authorization.data_autorizacao ?? "Sem data"} →
              </Link>)}
          </section>}
          {tab === "Ocorrências" && <p className="rbk-card mt-6 p-6 text-sm text-gray-600">Revisão de possíveis ocorrências disponível após implantação da Matriz de Regras.</p>}
          {tab === "Auditoria" && <p className="rbk-card mt-6 p-6 text-sm text-gray-600">Histórico de análises disponível quando o Motor de Auditoria estiver ativo.</p>}
          {tab === "Relatórios" && <p className="rbk-card mt-6 p-6 text-sm text-gray-600">Relatórios RBK Monitora serão exibidos após revisão e liberação pela RBK.</p>}
        </>}
      </div>
    </main>
  );
}
