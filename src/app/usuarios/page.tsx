"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { filtroFarmacias, queryFarmacias } from "../../lib/usuarios/navegacao";
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
    nome_fantasia: string | null;
    cnpj: string;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    status: string;
  } | null;
};

function formatarCnpj(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 14);

  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarData(data: string | null) {
  if (!data) return "Nunca acessou";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

export default function UsuariosPage() {
  const supabase = createClient();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [buscaCnpj, setBuscaCnpj] = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);


  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    setErro("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/";
      return;
    }

    const response = await fetch("/api/usuarios", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const resultado = await response.json();

    if (!response.ok) {
      console.error(
        "Erro ao carregar farmácias:",
        resultado?.error
      );
      setErro(
        resultado?.error ??
          "Não foi possível carregar as farmácias."
      );
      setUsuarios([]);
      setCarregando(false);
      return;
    }

    setUsuarios(
      (resultado?.usuarios ?? []) as Usuario[]
    );
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function restaurar() {
      await Promise.resolve();
      if (!active) return;
      const filtro = filtroFarmacias(window.location.search);
      setBuscaCnpj(filtro.cnpj);
      setMostrarTodas(filtro.todas);
      if (filtro.cnpj || filtro.todas) {
        try {
          await carregarUsuarios();
        } catch {
          if (active) {
            setErro("Não foi possível carregar as farmácias.");
            setCarregando(false);
          }
        }
      } else {
        setUsuarios([]);
      }
    }
    void restaurar();
    window.addEventListener("popstate", restaurar);
    return () => {
      active = false;
      window.removeEventListener("popstate", restaurar);
    };
  }, [carregarUsuarios]);

  function registrarFiltro(cnpj: string, todas: boolean) {
    window.history.replaceState(null, "", `/usuarios${queryFarmacias(cnpj, todas)}`);
  }

  const consulta = queryFarmacias(buscaCnpj, mostrarTodas);

  const usuariosFiltrados = useMemo(() => {
    const somenteNumeros = buscaCnpj.replace(/\D/g, "");

    if (!somenteNumeros) {
      return mostrarTodas ? usuarios : [];
    }

    return usuarios.filter((usuario) => {
      const farm = usuario.farms;

      return (
        farm?.cnpj?.replace(/\D/g, "").includes(somenteNumeros) ??
        false
      );
    });
  }, [buscaCnpj, mostrarTodas, usuarios]);

  async function pesquisar() {
    registrarFiltro(buscaCnpj, false);
    if (!buscaCnpj.replace(/\D/g, "")) {
      setMostrarTodas(false);
      setUsuarios([]);
      return;
    }

    await carregarUsuarios();
    setMostrarTodas(false);
  }

  async function verTodas() {
    registrarFiltro("", true);
    setBuscaCnpj("");
    await carregarUsuarios();
    setMostrarTodas(true);
  }

  async function excluirFarmacia(
    usuarioId: string,
    nomeFarmacia: string
  ) {
    const confirmado = window.confirm(
      `Excluir a farmácia "${nomeFarmacia}"?\n\n` +
        "O acesso será bloqueado, mas o histórico de autorizações e documentos será preservado."
    );

    if (!confirmado) return;

    setErro("");
    setExcluindoId(usuarioId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Sessão expirada. Faça login novamente."
        );
      }

      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: usuarioId,
          status: "inactive",
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado?.error ?? "Não foi possível excluir a farmácia."
        );
      }

      setUsuarios((atuais) =>
        atuais.map((usuario) =>
          usuario.id === usuarioId
            ? {
                ...usuario,
                status: "inactive",
                farms: usuario.farms
                  ? {
                      ...usuario.farms,
                      status: "inactive",
                    }
                  : usuario.farms,
              }
            : usuario
        )
      );
    } catch (error) {
      console.error("Erro ao excluir farmácia:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a farmácia."
      );
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <RbkBrand />

          <nav aria-label="Navegação de farmácias" className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/dashboard" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              ← Voltar ao Dashboard
            </Link>
          <Link
            href="/usuarios/novo"
            className="rounded-xl rbk-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Nova farmácia
          </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--rbk-red)]">
            Perfil do gestor
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Farmácias cadastradas
          </h1>

          <p className="mt-2 max-w-2xl text-gray-500">
            Consulte uma farmácia pelo CNPJ ou visualize todas as
            farmácias cadastradas no RBK Digital.
          </p>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label
                htmlFor="busca-cnpj"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Buscar por CNPJ
              </label>

              <input
                id="busca-cnpj"
                value={formatarCnpj(buscaCnpj)}
                onChange={(event) =>
                  setBuscaCnpj(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    pesquisar();
                  }
                }}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <button
              type="button"
              onClick={pesquisar}
              className="rounded-xl rbk-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Buscar CNPJ
            </button>

            <button
              type="button"
              onClick={verTodas}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Ver todas as farmácias
            </button>
          </div>
        </section>

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
            Carregando farmácias...
          </div>
        ) : !mostrarTodas && !buscaCnpj ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Informe um CNPJ ou clique em “Ver todas as farmácias”.
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <p className="font-medium text-gray-700">
              Nenhuma farmácia encontrada.
            </p>

            <button
              type="button"
              onClick={verTodas}
              className="mt-3 text-sm font-semibold text-[var(--rbk-red)] hover:underline"
            >
              Ver todas as farmácias
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {usuariosFiltrados.map((usuario) => {
              const farm = usuario.farms;

              if (!farm) return null;

              const ativo =
                usuario.status === "active" &&
                farm.status !== "inactive";

              return (
                <article
                  key={usuario.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-900">
                          {farm.nome_fantasia ||
                            farm.razao_social}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            ativo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ativo ? "Ativa" : "Inativa"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {farm.razao_social}
                      </p>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                            CNPJ
                          </p>
                          <p className="mt-1 font-medium text-gray-700">
                            {formatarCnpj(farm.cnpj)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                            E-mail
                          </p>
                          <p className="mt-1 break-all font-medium text-gray-700">
                            {usuario.email}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                            Telefone
                          </p>
                          <p className="mt-1 font-medium text-gray-700">
                            {farm.telefone || "Não informado"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                            Cidade / Estado
                          </p>
                          <p className="mt-1 font-medium text-gray-700">
                            {farm.cidade || "Não informada"}
                            {farm.estado
                              ? ` / ${farm.estado}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
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

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                      <Link
                        href={`/usuarios/${usuario.id}/editar${consulta}`}
                        className="rounded-xl rbk-primary px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Editar cadastro
                      </Link>

                      <Link
                        href={`/usuarios/${usuario.id}/autorizacoes${consulta}`}
                        className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Ver autorizações
                      </Link>

                      {ativo && (
                        <button
                          type="button"
                          onClick={() =>
                            excluirFarmacia(
                              usuario.id,
                              farm.nome_fantasia || farm.razao_social
                            )
                          }
                          disabled={excluindoId === usuario.id}
                          className="rounded-xl border border-red-200 bg-white px-5 py-3 text-center text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {excluindoId === usuario.id
                            ? "Excluindo..."
                            : "Excluir farmácia"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
