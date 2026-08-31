"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Usuario = {
  id: string;
  farm_id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  created_at: string;
  last_access_at: string | null;
  farms?: {
    razao_social: string;
  }[] | null;
};

export default function UsuariosPage() {
  const supabase = createClient();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarUsuarios() {
      setCarregando(true);
      setErro("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          farm_id,
          nome,
          email,
          perfil,
          status,
          created_at,
          last_access_at,
          farms (
            razao_social
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar usuários:", error);
        setErro("Não foi possível carregar os usuários.");
        setUsuarios([]);
        setCarregando(false);
        return;
      }

      setUsuarios((data ?? []) as Usuario[]);
      setCarregando(false);
    }

    carregarUsuarios();
  }, [supabase]);

  function formatarData(data: string | null) {
    if (!data) return "Nunca acessou";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(data));
  }

  function formatarStatus(status: string) {
    return status === "active" ? "Ativo" : "Inativo";
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <RbkBrand compact />

          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-500 transition hover:text-red-600"
          >
            ← Voltar ao dashboard
          </Link>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
              Administração
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Usuários
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Gerencie os usuários com acesso ao RBK Digital.
            </p>
          </div>

          <Link
            href="/usuarios/novo"
            className="rbk-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            + Novo usuário
          </Link>
        </div>

        {erro && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <section className="rbk-card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Usuários cadastrados
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {carregando
                    ? "Carregando..."
                    : `${usuarios.length} usuário${usuarios.length === 1 ? "" : "s"} cadastrado${usuarios.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          </div>

          {carregando ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              Carregando usuários...
            </div>
          ) : usuarios.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
                👤
              </div>

              <h3 className="mt-4 text-base font-bold text-gray-900">
                Nenhum usuário encontrado
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Ainda não existem usuários disponíveis para gerenciamento.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {usuarios.map((usuario) => (
                <div
                  key={usuario.id}
                  className="px-5 py-5 transition hover:bg-gray-50 sm:px-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="truncate text-base font-bold text-gray-900">
                          {usuario.nome}
                        </h3>

                        <span
                          className={
                            usuario.status === "active"
                              ? "rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700"
                              : "rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500"
                          }
                        >
                          {formatarStatus(usuario.status)}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-600">
                        {usuario.email}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {usuario.farms?.[0]?.razao_social ?? "Razão Social não informada"}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                          Perfil
                        </p>
                        <p className="mt-1 font-medium text-gray-700">
                          Usuário
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                          Criado em
                        </p>
                        <p className="mt-1 font-medium text-gray-700">
                          {formatarData(usuario.created_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                          Último acesso
                        </p>
                        <p className="mt-1 font-medium text-gray-700">
                          {formatarData(usuario.last_access_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="break-all text-xs text-gray-400">
                      ID: {usuario.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
