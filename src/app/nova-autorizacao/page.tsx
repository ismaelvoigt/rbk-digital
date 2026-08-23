"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

export default function NovaAutorizacao() {
  const router = useRouter();
  const supabase = createClient();
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  });
  const [farmacia, setFarmacia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    setCarregando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMensagem("Sessão expirada. Faça login novamente."); setCarregando(false); return; }

    const { data: autorizacao, error } = await supabase.from("autorizacoes").insert({
      numero_autorizacao: numero.trim(),
      data_autorizacao: data || null,
      farmacia: farmacia.trim(),
      observacao: observacao.trim() || null,
      user_id: user.id,
    }).select("id").single();

    if (error) { setMensagem(error.message); setCarregando(false); return; }
    setMensagem("Autorização cadastrada com sucesso.");
    setTimeout(() => router.push(`/autorizacoes/${autorizacao.id}/documentos`), 500);
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <Link href="/dashboard"><RbkBrand compact /></Link>
          <Link href="/autorizacoes" className="text-sm font-bold text-gray-500 hover:text-red-600">← Autorizações</Link>
        </div>
      </header>

      <div className="rbk-container max-w-3xl py-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Novo registro</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Nova autorização</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Cadastre uma autorização para iniciar o acompanhamento documental.</p>
        </div>

        <section className="rbk-card p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-4 rounded-2xl bg-gray-50 p-4">
            <div className="rbk-mark">01</div>
            <div><p className="text-sm font-bold text-gray-900">Dados da autorização</p><p className="mt-1 text-xs text-gray-500">Preencha os dados principais para criar o registro.</p></div>
          </div>

          <form onSubmit={salvar} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Número da autorização</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} required placeholder="Ex.: 123456789" className="rbk-input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Data da autorização</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rbk-input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Farmácia</label>
              <input value={farmacia} onChange={(e) => setFarmacia(e.target.value)} required placeholder="Nome da farmácia" className="rbk-input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Observação <span className="font-normal text-gray-400">(opcional)</span></label>
              <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={4} placeholder="Informações adicionais..." className="rbk-input resize-y" />
            </div>

            {mensagem && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{mensagem}</div>}

            <button type="submit" disabled={carregando} className="rbk-primary w-full rounded-[13px] px-4 py-3.5 text-sm font-bold transition disabled:opacity-60">
              {carregando ? "Salvando autorização..." : "Cadastrar autorização"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
