"use client";

import { FormEvent, useState } from "react";

import { createClient } from "../lib/supabase/client";
import { RbkBrand } from "../components/RbkBrand";
import { getRouteForPerfil } from "../lib/auth/routeForPerfil";

export default function Home() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  async function recuperarSenha() {
    setMensagem("");
    setErro("");

    const emailRecuperacao = email.trim();

    if (!emailRecuperacao) {
      setMensagem("Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setEnviandoRecuperacao(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailRecuperacao,
        {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        }
      );

      if (error) {
        setMensagem(error.message);
        return;
      }

      setMensagem(
        "Link de recuperação enviado! Verifique seu e-mail para continuar."
      );
    } catch {
      setMensagem(
        "Não foi possível enviar o link de recuperação. Tente novamente."
      );
    } finally {
      setEnviandoRecuperacao(false);
    }
  }


  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error || !data.user) {
      setErro(error?.message ?? "Não foi possível autenticar.");
      setCarregando(false);
      return;
    }

    const userId = data.user.id;

    const { data: administrador, error: adminError } = await supabase
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError) {
      console.error("Erro ao verificar administrador:", adminError);
      await supabase.auth.signOut();
      setErro("Não foi possível validar o perfil de acesso.");
      setCarregando(false);
      return;
    }

    if (administrador) {
      window.location.href = getRouteForPerfil("admin");
      return;
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from("users")
      .select("perfil, status")
      .eq("id", userId)
      .maybeSingle();

    if (usuarioError) {
      console.error("Erro ao verificar perfil do usuário:", usuarioError);
      await supabase.auth.signOut();
      setErro("Não foi possível validar o perfil de acesso.");
      setCarregando(false);
      return;
    }

    if (usuario?.status !== "active") {
      await supabase.auth.signOut();
      setErro("Seu acesso não está ativo. Entre em contato com a RBK Assessoria.");
      setCarregando(false);
      return;
    }

    const rota = getRouteForPerfil(usuario.perfil);

    if (rota === "/") {
      await supabase.auth.signOut();
      setErro("Perfil de acesso não reconhecido.");
      setCarregando(false);
      return;
    }

    window.location.href = rota;
  }



return (
    <main className="relative min-h-screen overflow-hidden bg-[#06142b] px-4 py-7 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-52 -top-52 h-[760px] w-[760px] rounded-full border border-yellow-300/25" />
        <div className="absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full border border-yellow-400/15" />
        <div className="absolute -bottom-72 -left-64 h-[780px] w-[780px] rounded-full border border-red-500/20" />
        <div className="absolute -bottom-56 -left-48 h-[620px] w-[620px] rounded-full border border-orange-400/15" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_84%,rgba(239,68,68,0.17),transparent_29%),radial-gradient(circle_at_88%_12%,rgba(245,158,11,0.14),transparent_31%)]" />

        <div className="absolute left-0 top-20 grid grid-cols-5 gap-3 opacity-20">
          {Array.from({ length: 35 }).map((_, index) => (
            <span key={`left-dot-${index}`} className="h-1.5 w-1.5 rounded-sm bg-red-500" />
          ))}
        </div>

        <div className="absolute bottom-24 right-0 grid grid-cols-5 gap-3 opacity-20">
          {Array.from({ length: 35 }).map((_, index) => (
            <span key={`right-dot-${index}`} className="h-1.5 w-1.5 rounded-sm bg-red-500" />
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[760px] flex-col items-center justify-center">
        <div className="mb-8 w-full text-center sm:mb-10">
          <div className="mb-5 flex justify-center sm:mb-6">
            <div className="rbk-login-brand relative h-[105px] w-[470px] max-w-[92vw] sm:h-[118px] sm:w-[530px]">
              <img
                src="/rbk-login-brand.png"
                alt="RBK Digital"
                className="h-full w-full object-contain mix-blend-screen"
                draggable="false"
              />
            </div>
          </div>

          <p className="text-base font-medium text-white/70 sm:text-lg">
            Gestão documental inteligente
          </p>

          <div className="mx-auto mt-6 h-1 w-32 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400" />
        </div>

        <section className="w-full rounded-[30px] border border-white/15 bg-white/[0.98] p-7 shadow-2xl shadow-black/35 backdrop-blur-sm sm:p-10">
          <div className="mb-7 sm:mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-red-600 sm:text-sm">
              Acesso seguro
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Entrar
            </h1>

            <p className="mt-3 text-base leading-6 text-slate-500 sm:text-lg">
              Acesse sua conta para continuar no RBK Digital.
            </p>
          </div>

          <form onSubmit={entrar} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-base font-semibold text-slate-800">
                E-mail
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Digite seu e-mail"
                required
                className="rbk-input w-full rounded-2xl border border-slate-300 bg-white px-5 py-5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
              />
            </div>

            <div>
              <label htmlFor="senha" className="mb-2 block text-base font-semibold text-slate-800">
                Senha
              </label>

              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite sua senha"
                required
                className="rbk-input w-full rounded-2xl border border-slate-300 bg-white px-5 py-5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
              />
            </div>

            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-2xl bg-red-600 px-4 py-5 text-base font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Entrando..." : "Entrar no RBK Digital  →"}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4 text-sm text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            id="recuperar-senha"
            type="button"
            className="mx-auto flex items-center justify-center gap-3 text-base font-medium text-slate-700 transition hover:text-red-600"
           onClick={recuperarSenha} disabled={enviandoRecuperacao}>
            <span className="text-red-600" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <path d="M12 14v2" />
              </svg>
            </span>
            Esqueci minha senha
          </button>
          {mensagem && (
            <p
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm leading-5 text-red-700"
              aria-live="polite"
            >
              {mensagem}
            </p>
          )}

        </section>

        <p className="mt-7 text-center text-sm text-white/60 sm:mt-8">
          RBK Digital • Gestão e rastreabilidade documental
        </p>
      </div>
    </main>
  )


}
