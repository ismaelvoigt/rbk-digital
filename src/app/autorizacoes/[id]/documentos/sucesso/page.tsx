"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/client";
import { RbkBrand } from "../../../../../components/RbkBrand";

export default function DocumentoSucesso() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [numeroAutorizacao, setNumeroAutorizacao] = useState("");

  useEffect(() => {
    async function carregarAutorizacao() {
      const { data } = await supabase.from("autorizacoes")
        .select("numero_autorizacao").eq("id", id).single();
      if (data) setNumeroAutorizacao(data.numero_autorizacao);
    }
    carregarAutorizacao();
  }, [id, supabase]);

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <Link href="/dashboard"><RbkBrand compact /></Link>
          <Link href={`/autorizacoes/${id}/documentos`} className="text-sm font-bold text-gray-500 hover:text-red-600">← Voltar</Link>
        </div>
      </header>

      <div className="rbk-container max-w-3xl py-10 sm:py-14">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50 shadow-sm ring-1 ring-green-100">
            <span className="text-5xl font-black text-green-600">✓</span>
          </div>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-green-600">Operação concluída</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Documento enviado com sucesso!</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">Seu documento foi salvo e vinculado à autorização.</p>
        </div>

        <div className="rbk-card mt-9 p-7 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Autorização</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{numeroAutorizacao ? `#${numeroAutorizacao}` : ""}</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Documento vinculado ao registro
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/nova-autorizacao" className="rbk-primary rounded-[13px] px-6 py-4 text-center text-sm font-bold">Cadastrar nova autorização</Link>
          <Link href="/dashboard" className="rbk-secondary rounded-[13px] px-6 py-4 text-center text-sm font-bold">Voltar para o início</Link>
        </div>
      </div>
    </main>
  );
}
