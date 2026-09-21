"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { validarLinkDeSenha } from "../../lib/auth/linkDeSenha";

export default function RedefinirSenhaPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, auth: { detectSessionInUrl: false } }
  ));
  const validacao = useRef<Promise<boolean> | null>(null);
  const [validando, setValidando] = useState(true);
  const [recuperacaoValida, setRecuperacaoValida] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    // PASSWORD_RECOVERY e convites são validados antes de mostrar o formulário.
    if (!validacao.current) {
      validacao.current = validarLinkDeSenha(supabase.auth, window.location.href)
        .catch(() => false);
    }
    validacao.current.then((valida) => {
      if (!ativo) return;
      setRecuperacaoValida(valida);
      setValidando(false);
      // Retira tokens e códigos do endereço após a tentativa de validação.
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => { ativo = false; };
  }, [supabase]);

  async function atualizarSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem("");
    setErro("");

    if (!recuperacaoValida || validando) return;

    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    setSalvando(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) {
        setErro(error.message);
        return;
      }

      setMensagem(
        "Senha alterada com sucesso! Você será direcionado ao login."
      );

      await supabase.auth.signOut();

      window.setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch {
      setErro("Não foi possível alterar a senha. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <img
            src="/rbk-digital-logo-original.png"
            alt="RBK Digital"
            className="mx-auto mb-6 h-16 w-auto object-contain"
          />
          <h1 className="text-2xl font-semibold text-slate-900">
            Criar ou redefinir senha
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Crie uma nova senha para acessar o RBK Digital.
          </p>
        </div>

        {validando ? (
          <p className="text-sm text-slate-500">Validando seu link...</p>
        ) : !recuperacaoValida ? (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            O link é inválido ou expirou. Solicite um novo convite ao administrador
            ou use a recuperação de senha na tela de login.
          </div>
        ) : (
          <form onSubmit={atualizarSenha} className="space-y-4">
            <div>
              <label
                htmlFor="novaSenha"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nova senha
              </label>
              <input
                id="novaSenha"
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(event) => setNovaSenha(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                placeholder="Digite a nova senha"
                required
              />
            </div>

            <div>
              <label
                htmlFor="confirmacao"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Confirmar nova senha
              </label>
              <input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-700"
                placeholder="Digite novamente a nova senha"
                required
              />
            </div>

            {erro && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {erro}
              </p>
            )}

            {mensagem && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {mensagem}
              </p>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar nova senha →"}
            </button>
          </form>
        )}

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
