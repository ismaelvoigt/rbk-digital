"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { RbkBrand } from "../components/RbkBrand";

export default function Home() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="rbk-shell flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div className="mb-7 flex justify-center">
            <RbkBrand />
          </div>
          <p className="text-sm font-medium text-gray-500">Gestão documental inteligente</p>
          <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400" />
        </div>

        <section className="rbk-card p-7 sm:p-8">
          <div className="mb-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-red-600">Acesso seguro</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Entrar</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">Acesse sua conta para continuar no RBK Digital.</p>
          </div>

          <form onSubmit={entrar} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-700">E-mail</label>
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} placeholder="Digite seu e-mail" required className="rbk-input" />
            </div>

            <div>
              <label htmlFor="senha" className="mb-2 block text-sm font-semibold text-gray-700">Senha</label>
              <input id="senha" type="password" autoComplete="current-password" value={senha}
                onChange={(event) => setSenha(event.target.value)} placeholder="Digite sua senha" required className="rbk-input" />
            </div>

            {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{erro}</div>}

            <button type="submit" disabled={carregando}
              className="rbk-primary w-full rounded-[13px] px-4 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60">
              {carregando ? "Entrando..." : "Entrar no RBK Digital"}
            </button>
          </form>

          <button type="button" className="mt-6 w-full text-center text-sm font-semibold text-gray-500 transition hover:text-red-600">
            Esqueci minha senha
          </button>
        </section>

        <p className="mt-7 text-center text-xs text-gray-400">RBK Digital • Gestão e rastreabilidade documental</p>
      </div>
    </main>
  );
}
