"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  data_autorizacao: string | null;
  farmacia: string | null;
  observacao: string | null;
};

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCPF(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  }
  if (numeros.length <= 9) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  }

  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
}

function formatarNumeroAutorizacao(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 15);

  if (!numeros) return "";

  return numeros.replace(/(\d{3})(?=\d)/g, "$1.");
}


function formatarData(data: string | null) {
  if (!data) return "Data não informada";
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

export default function Autorizacoes() {
  const supabase = createClient();

  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [cpf, setCpf] = useState("");
  const [numero, setNumero] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  const [pesquisou, setPesquisou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function pesquisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setCarregando(true);
    setPesquisou(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErro("Sessão expirada. Faça login novamente.");
        setAutorizacoes([]);
        return;
      }

      const cpfNumeros = somenteNumeros(cpf);
      const numeroNumeros = somenteNumeros(numero);

      if (cpfNumeros && cpfNumeros.length !== 11) {
        setErro("Informe um CPF válido com 11 dígitos.");
        setAutorizacoes([]);
        return;
      }

      if (numeroNumeros && numeroNumeros.length !== 15) {
        setErro("O número da autorização deve conter 15 dígitos.");
        setAutorizacoes([]);
        return;
      }

      if (dataInicial && dataFinal && dataInicial > dataFinal) {
        setErro("A data inicial não pode ser maior que a data final.");
        setAutorizacoes([]);
        return;
      }

      let consulta = supabase
        .from("autorizacoes")
        .select(
          "id, numero_autorizacao, data_autorizacao, farmacia, observacao"
        )
        .eq("user_id", user.id);

      if (cpfNumeros) {
        consulta = consulta.eq("cpf_cliente", cpfNumeros);
      }

      if (numeroNumeros) {
        consulta = consulta.eq("numero_autorizacao", numeroNumeros);
      }

      if (dataInicial) {
        consulta = consulta.gte("data_autorizacao", dataInicial);
      }

      if (dataFinal) {
        const diaSeguinte = new Date(`${dataFinal}T00:00:00`);
        diaSeguinte.setDate(diaSeguinte.getDate() + 1);

        const proximoDia = diaSeguinte.toISOString().slice(0, 10);

        consulta = consulta.lt("data_autorizacao", proximoDia);
      }

      const { data, error } = await consulta.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Erro ao pesquisar autorizações:", error);
        setErro("Não foi possível realizar a pesquisa.");
        setAutorizacoes([]);
        return;
      }

      setAutorizacoes(data || []);
    } catch (error) {
      console.error(error);
      setErro("Ocorreu um erro ao realizar a pesquisa.");
      setAutorizacoes([]);
    } finally {
      setCarregando(false);
    }
  }

  function limparFiltros() {
    setCpf("");
    setNumero("");
    setDataInicial("");
    setDataFinal("");
    setAutorizacoes([]);
    setErro("");
    setPesquisou(false);
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="RBK Digital">
            <RbkBrand compact />
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-bold text-gray-500 transition hover:text-red-600"
          >
            Início
          </Link>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">

          <div className="mt-5">

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Consulta de autorizações
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Consulte as autorizações cadastradas utilizando os filtros abaixo.
            </p>
          </div>
        </div>

        <section className="rbk-card mb-8 p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              Pesquisar autorizações
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Informe um ou mais filtros para localizar uma autorização.
            </p>
          </div>

          <form onSubmit={pesquisar} autoComplete="off">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cpf"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-gray-500"
                >
                  CPF do cliente
                </label>

                <input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(event) =>
                    setCpf(formatarCPF(event.target.value))
                  }
                  maxLength={14}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div>
                <label
                  htmlFor="numero"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-gray-500"
                >
                  Nº da autorização
                </label>

                <input
                  id="numero"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000.000.000"
                  value={numero}
                  onChange={(event) => {
                    const numeros = somenteNumeros(event.target.value)
                      .slice(0, 15);

                    setNumero(formatarNumeroAutorizacao(numeros));
                  }}
                  maxLength={19}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div>
                <label
                  htmlFor="dataInicial"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-gray-500"
                >
                  Data inicial
                </label>

                <input
                  id="dataInicial"
                  type="date"
                  value={dataInicial}
                  onChange={(event) => setDataInicial(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div>
                <label
                  htmlFor="dataFinal"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-gray-500"
                >
                  Data final
                </label>

                <input
                  id="dataFinal"
                  type="date"
                  value={dataFinal}
                  onChange={(event) => setDataFinal(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            {erro && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {erro}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={limparFiltros}
                className="rbk-secondary rounded-xl px-6 py-3 text-sm font-bold"
              >
                Limpar filtros
              </button>

              <button
                type="submit"
                disabled={carregando}
                className="rbk-primary rounded-xl px-7 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? "Pesquisando..." : "Pesquisar"}
              </button>
            </div>
          </form>
        </section>

        {pesquisou && !carregando && !erro && (
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                Resultado da consulta
              </p>

              <p className="mt-1 text-sm font-medium text-gray-600">
                {autorizacoes.length} registro
                {autorizacoes.length === 1 ? "" : "s"} encontrado
                {autorizacoes.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200">
              {autorizacoes.length}
            </div>
          </div>
        )}

        {carregando && (
          <div className="rbk-card p-8 text-sm text-gray-500">
            Pesquisando autorizações...
          </div>
        )}

        {pesquisou &&
          !carregando &&
          !erro &&
          autorizacoes.length === 0 && (
            <div className="rbk-card p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl font-bold text-gray-500">
                ?
              </div>

              <h2 className="mt-5 text-xl font-bold text-gray-900">
                Nenhuma autorização encontrada
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Não encontramos autorizações para os filtros informados.
                Tente alterar os critérios da pesquisa.
              </p>
            </div>
          )}

        {!pesquisou && !carregando && (
          <div className="rbk-card p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl font-bold text-red-600">
              🔎
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Consulte uma autorização
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Utilize o CPF, número da autorização ou período para localizar
              um registro.
            </p>
          </div>
        )}

        {!carregando && !erro && autorizacoes.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {autorizacoes.map((autorizacao) => (
              <Link
                key={autorizacao.id}
                href={`/autorizacoes/${autorizacao.id}/documentos`}
                className="rbk-card rbk-card-hover block p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Autorização
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-gray-900">
                      #{formatarNumeroAutorizacao(
                        autorizacao.numero_autorizacao
                      )}
                    </h2>
                  </div>

                  <span className="rbk-status bg-green-50 text-green-700">
                    ● Ativa
                  </span>
                </div>

                <div className="mt-6 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                      Data
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {formatarData(autorizacao.data_autorizacao)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                      Farmácia
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {autorizacao.farmacia || "Não informada"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="text-sm font-bold text-gray-500">
                    Gerenciar documentos
                  </span>

                  <span className="text-lg font-bold text-red-600">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
