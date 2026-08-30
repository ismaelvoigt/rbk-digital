"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { RbkBrand } from "../../../components/RbkBrand";

function formatarCnpj(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 14);

  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function NovaFarmaciaPage() {
  const supabase = createClient();

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  async function cadastrarFarmacia(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setSucesso(false);
    setEnviando(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = "/";
        return;
      }

      const resposta = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          razao_social: razaoSocial.trim(),
          nome_fantasia: nomeFantasia.trim(),
          cnpj: cnpj.replace(/\D/g, ""),
          email: email.trim(),
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErro(
          resultado.error ??
            "Não foi possível cadastrar a farmácia."
        );
        return;
      }

      setSucesso(true);

      setRazaoSocial("");
      setNomeFantasia("");
      setCnpj("");
      setEmail("");
    } catch (error) {
      console.error(
        "Erro ao cadastrar farmácia:",
        error
      );

      setErro(
        "Ocorreu um erro ao cadastrar a farmácia."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <Link
            href="/dashboard"
            aria-label="RBK Digital"
          >
            <RbkBrand compact />
          </Link>

          <Link
            href="/usuarios"
            className="text-sm font-semibold text-gray-500 transition hover:text-red-600"
          >
            ← Voltar para usuários
          </Link>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
            Administração
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Nova farmácia
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Cadastre a farmácia e crie o acesso do
            responsável ao RBK Digital.
          </p>
        </div>

        <section className="rbk-card max-w-3xl p-6 sm:p-8">
          {sucesso && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
              <p className="font-bold">
                Farmácia cadastrada com sucesso.
              </p>

              <p className="mt-1">
                O convite de acesso foi enviado para o
                e-mail informado.
              </p>
            </div>
          )}

          {erro && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-700">
              {erro}
            </div>
          )}

          <form
            onSubmit={cadastrarFarmacia}
            className="space-y-7"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
                Dados da farmácia
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Essas informações identificarão a empresa
                dentro do RBK Digital.
              </p>
            </div>

            <div>
              <label
                htmlFor="razaoSocial"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Razão Social
              </label>

              <input
                id="razaoSocial"
                type="text"
                value={razaoSocial}
                onChange={(event) =>
                  setRazaoSocial(event.target.value)
                }
                placeholder="Digite a razão social"
                required
                disabled={enviando}
                className="rbk-input"
              />
            </div>

            <div>
              <label
                htmlFor="nomeFantasia"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Nome Fantasia
              </label>

              <input
                id="nomeFantasia"
                type="text"
                value={nomeFantasia}
                onChange={(event) =>
                  setNomeFantasia(event.target.value)
                }
                placeholder="Digite o nome fantasia"
                disabled={enviando}
                className="rbk-input"
              />
            </div>

            <div>
              <label
                htmlFor="cnpj"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                CNPJ
              </label>

              <input
                id="cnpj"
                type="text"
                inputMode="numeric"
                value={cnpj}
                onChange={(event) =>
                  setCnpj(formatarCnpj(event.target.value))
                }
                placeholder="00.000.000/0000-00"
                required
                disabled={enviando}
                className="rbk-input"
              />
            </div>

            <div className="border-t border-gray-100 pt-7">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
                Acesso ao RBK Digital
              </p>

              <p className="mt-1 text-sm text-gray-500">
                O convite será enviado para este endereço.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                E-mail de acesso
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Digite o e-mail do responsável"
                required
                disabled={enviando}
                className="rbk-input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                  Perfil
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-700">
                  Farmácia
                </p>
              </div>

              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-green-600">
                  Status inicial
                </p>

                <p className="mt-1 text-sm font-semibold text-green-700">
                  Ativo
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                Como funciona
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Ao concluir o cadastro, a farmácia será
                registrada no RBK Digital e o responsável
                receberá um convite por e-mail para criar
                sua senha e acessar o sistema.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
              <Link
                href="/usuarios"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={enviando}
                className="rbk-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando
                  ? "Cadastrando..."
                  : "Cadastrar farmácia e enviar convite"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
