"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  data_autorizacao: string | null;
  created_at: string;
  farmacia: string;
  observacao: string | null;
};

export default function Autorizacoes() {
  const supabase = createClient();
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarAutorizacoes() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErro("Sessão expirada. Faça login novamente."); setCarregando(false); return; }
      const { data, error } = await supabase.from("autorizacoes")
        .select("id, numero_autorizacao, data_autorizacao, farmacia, observacao, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) { setErro(error.message); setCarregando(false); return; }
      setAutorizacoes(data || []);
      setCarregando(false);
    }
    carregarAutorizacoes();
  }, [supabase]);

  function formatarData(data: string | null) {
    if (!data) return "Data não informada";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <Link href="/dashboard"><RbkBrand compact /></Link>
          <Link href="/nova-autorizacao" className="rbk-primary rounded-xl px-4 py-2.5 text-sm font-bold">+ Nova autorização</Link>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm font-semibold text-gray-500 hover:text-red-600">← Voltar ao dashboard</Link>
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Gestão</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Autorizações</h1>
              <p className="mt-2 text-sm text-gray-500">Consulte e gerencie as autorizações cadastradas.</p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200">
              {autorizacoes.length} registro{autorizacoes.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {carregando && <div className="rbk-card p-8 text-sm text-gray-500">Carregando autorizações...</div>}
        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{erro}</div>}

        {!carregando && !erro && autorizacoes.length === 0 && (
          <div className="rbk-card p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-600">+</div>
            <h2 className="mt-5 text-xl font-bold text-gray-900">Nenhuma autorização cadastrada</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Cadastre a primeira autorização para começar o acompanhamento documental.</p>
            <Link href="/nova-autorizacao" className="rbk-primary mt-6 inline-flex rounded-xl px-6 py-3 text-sm font-bold">Cadastrar autorização</Link>
          </div>
        )}

        {!carregando && !erro && autorizacoes.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {autorizacoes.map((autorizacao) => (
              <Link key={autorizacao.id} href={`/autorizacoes/${autorizacao.id}/documentos`}
                className="rbk-card rbk-card-hover block p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Autorização</p>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">#{autorizacao.numero_autorizacao}</h2>
                  </div>
                  <span className="rbk-status bg-green-50 text-green-700">● Ativa</span>
                </div>
                <div className="mt-6 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">Cadastrada em</p><p className="mt-1 text-sm font-semibold text-gray-800">{formatarData(autorizacao.created_at.slice(0, 10))}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">Farmácia</p><p className="mt-1 text-sm font-semibold text-gray-800">{autorizacao.farmacia}</p></div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm font-bold text-gray-500">Gerenciar documentos</span>
                  <span className="text-lg font-bold text-red-600">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
