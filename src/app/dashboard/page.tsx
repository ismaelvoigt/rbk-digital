"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

export default function Dashboard() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/"; return; }
      setEmail(user.email ?? "");
      const { count } = await supabase.from("autorizacoes").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setTotal(count ?? 0);
    }
    carregarUsuario();
  }, [supabase]);

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-5">
          <Link href="/dashboard" aria-label="RBK Digital">
            <RbkBrand compact />
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">Conta</p>
            <p className="mt-1 max-w-[260px] truncate text-sm font-medium text-gray-700">{email}</p>
          </div>
      
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">Visão geral</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Central de acompanhamento das autorizações e documentos.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rbk-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Autorizações</p>
                <p className="mt-3 text-3xl font-bold text-gray-900">{total ?? "—"}</p>
              </div>
    
            </div>
            <p className="mt-4 text-sm text-gray-500">Registros cadastrados no ambiente.</p>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Ações rápidas</h2>
              <p className="mt-1 text-sm text-gray-500">Acesse os principais fluxos do RBK Digital.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/nova-autorizacao" className="rbk-card rbk-card-hover group p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg font-bold text-red-600">+</div>
            <h3 className="text-base font-bold text-gray-900">Nova autorização</h3>
          </div>
              <p className="mt-2 text-sm leading-5 text-gray-500">Cadastre uma nova autorização para acompanhamento documental.</p>
              <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">Cadastrar →</span>
            </Link>

            <Link href="/autorizacoes" className="rbk-card rbk-card-hover group p-6">
                    <h3 className="text-base font-bold text-gray-900">Autorizações cadastradas</h3>
              <p className="mt-2 text-sm leading-5 text-gray-500">Consulte registros e acesse a documentação de cada autorização.</p>
              <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">Consultar →</span>
            </Link>

    
          </div>
        </section>
      </div>
    </main>
  );
}
