"use client";

import Link from "next/link";
import { useRetornoFarmacias } from "../../../../lib/usuarios/useRetornoFarmacias";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { RbkBrand } from "../../../../components/RbkBrand";

type Cadastro = {
  id: string;
  farm_id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  farms:
    | {
        razao_social: string;
        nome_fantasia: string | null;
        cnpj: string;
        telefone: string | null;
        cidade: string | null;
        estado: string | null;
        status: string;
      }
    | null;
};

function formatarCnpj(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 14);

  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function EditarCadastroFarmaciaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const retorno = useRetornoFarmacias();

  const supabase = createClient();

  const [cadastro, setCadastro] = useState<Cadastro | null>(null);

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [status, setStatus] = useState("active");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
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

        const response = await fetch(`/api/usuarios?id=${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const resultado = await response.json();

        if (!response.ok) {
          console.error(
            "Erro ao carregar cadastro pela API:",
            resultado?.error
          );

          setErro(
            resultado?.error ??
              "Não foi possível carregar o cadastro."
          );
          setCarregando(false);
          return;
        }

        const usuario = resultado?.usuarios?.[0];

        if (!usuario) {
          setErro("Farmácia não encontrada.");
          setCarregando(false);
          return;
        }

        const farm = Array.isArray(usuario.farms)
          ? usuario.farms[0]
          : usuario.farms;

        if (!farm) {
          setErro("Farmácia não encontrada.");
          setCarregando(false);
          return;
        }

        const registro = {
          ...usuario,
          farms: farm,
        } as Cadastro;

        setCadastro(registro);
        setRazaoSocial(farm.razao_social ?? "");
        setNomeFantasia(farm.nome_fantasia ?? "");
        setCnpj(farm.cnpj ?? "");
        setEmail(usuario.email ?? "");
        setTelefone(farm.telefone ?? "");
        setCidade(farm.cidade ?? "");
        setEstado(farm.estado ?? "");
        setStatus(
          usuario.status ??
            farm.status ??
            "active"
        );
        setCarregando(false);
      } catch (error) {
        console.error(
          "Erro ao carregar cadastro:",
          error
        );

        setErro(
          "Não foi possível carregar o cadastro."
        );
        setCarregando(false);
      }
    }

    carregar();
  }, [id, supabase]);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setSalvando(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = "/";
        return;
      }

      const response = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id,
          /*
           * CNPJ é exibido somente para consulta.
           * O backend deliberadamente ignora qualquer tentativa
           * de alteração.
           */
          cnpj,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          email,
          telefone,
          cidade: cidade,
          estado,
          status,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado?.error ??
            "Não foi possível salvar o cadastro."
        );
      }

      setSucesso(
        resultado?.mensagem ??
          "Cadastro atualizado com sucesso."
      );

      if (resultado.usuario) {
        setCadastro((atual) =>
          atual
            ? {
                ...atual,
                nome: resultado.usuario.nome,
                email: resultado.usuario.email,
                status: resultado.usuario.status,
              }
            : atual
        );
      }
    } catch (error) {
      console.error("Erro ao salvar cadastro:", error);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o cadastro."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
            <RbkBrand />
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-sm text-gray-500">
            Carregando cadastro...
          </p>
        </div>
      </main>
    );
  }

  if (!cadastro) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
            <RbkBrand />
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-700">
              {erro || "Cadastro não encontrado."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const farm = cadastro.farms;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <RbkBrand />

          <nav aria-label="Navegação de farmácias" className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={retorno}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Voltar para farmácias
          </Link>
            <Link href="/dashboard" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">← Voltar ao Dashboard</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--rbk-red)]">
            Perfil do gestor
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Editar cadastro
          </h1>

          <p className="mt-2 text-gray-500">
            Atualize os dados cadastrais da farmácia.
          </p>
        </div>

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {sucesso}
          </div>
        )}

        <form
          onSubmit={salvar}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Identificação
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="cnpj"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  CNPJ
                </label>

                <input
                  id="cnpj"
                  value={formatarCnpj(cnpj)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                />

                <p className="mt-2 text-xs text-gray-400">
                  O CNPJ é somente leitura e não pode ser alterado.
                </p>
              </div>

              <div>
                <label
                  htmlFor="razaoSocial"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Razão Social
                </label>

                <input
                  id="razaoSocial"
                  value={razaoSocial}
                  onChange={(event) =>
                    setRazaoSocial(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="nomeFantasia"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Nome Fantasia
                </label>

                <input
                  id="nomeFantasia"
                  value={nomeFantasia}
                  onChange={(event) =>
                    setNomeFantasia(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Contato e localização
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  E-mail
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                />

                <p className="mt-2 text-xs text-gray-400">
                  O novo e-mail também será sincronizado com o acesso.
                </p>
              </div>

              <div>
                <label
                  htmlFor="telefone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Telefone
                </label>

                <input
                  id="telefone"
                  type="tel"
                  value={telefone}
                  onChange={(event) =>
                    setTelefone(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-[1fr_140px]">
                <div>
                  <label
                    htmlFor="cidade"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Cidade
                  </label>

                  <input
                    id="cidade"
                    value={cidade}
                    onChange={(event) =>
                      setCidade(event.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="estado"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Estado
                  </label>

                  <input
                    id="estado"
                    maxLength={2}
                    value={estado}
                    onChange={(event) =>
                      setEstado(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 uppercase outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
                    placeholder="UF"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Acesso
            </h2>

            <div className="mt-5">
              <label
                htmlFor="status"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[var(--rbk-red)] focus:ring-2 focus:ring-red-600/20"
              >
                <option value="active">
                  Ativo
                </option>
                <option value="inactive">
                  Inativo
                </option>
              </select>

              <p className="mt-2 text-xs text-gray-400">
                Farmácia inativa perde o acesso, mas o histórico de
                autorizações e documentos permanece preservado.
              </p>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href={retorno}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-xl rbk-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
