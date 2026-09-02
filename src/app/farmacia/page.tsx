"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

export default function FarmaciaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarUsuario() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      setEmail(user.email ?? "");
      setCarregando(false);
    }

    carregarUsuario();
  }, [supabase]);

  async function sairDaConta() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (carregando) {
    return (
      <main className="rbk-shell flex min-h-screen items-center justify-center">
        <div className="text-sm text-gray-500">
          Carregando painel...
        </div>
      </main>
    );
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-5">
          <RbkBrand compact />

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                Farmácia
              </p>

              <p className="mt-1 max-w-[280px] truncate text-sm font-medium text-gray-700">
                {email}
              </p>
            </div>

            <button
              type="button"
              onClick={sairDaConta}
              aria-label="Sair"
              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
            Área da farmácia
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            RBK Digital
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Gestão das autorizações e documentação da sua farmácia.
          </p>
        </div>

        <section className="grid gap-5 sm:grid-cols-2">
          <Link
            href="/nova-autorizacao"
            className="rbk-card rbk-card-hover group p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl font-bold text-red-600">
                +
              </div>

              <h2 className="text-base font-bold text-gray-900">
                Nova autorização
              </h2>
            </div>

            <p className="text-sm leading-6 text-gray-500">
              Cadastre uma nova autorização e envie a documentação necessária.
            </p>

            <span className="mt-5 inline-block text-sm font-bold text-red-600 transition group-hover:text-red-700">
              Cadastrar autorização →
            </span>
          </Link>

          <Link
            href="/autorizacoes"
            className="rbk-card rbk-card-hover group p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-600">
                LISTA
              </div>

              <h2 className="text-base font-bold text-gray-900">
                Autorizações cadastradas
              </h2>
            </div>

            <p className="text-sm leading-6 text-gray-500">
              Consulte as autorizações cadastradas e acompanhe a documentação.
            </p>

            <span className="mt-5 inline-block text-sm font-bold text-red-600 transition group-hover:text-red-700">
              Consultar autorizações →
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
