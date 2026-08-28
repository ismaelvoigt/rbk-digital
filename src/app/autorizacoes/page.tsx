"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  cpf_cliente: string | null;
  data_autorizacao: string | null;
  created_at: string;
  farmacia: string;
  observacao: string | null;
};

function formatarDataInput(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return numeros.replace(/(\d{2})(\d{1,2})/, "$1/$2");

  return numeros.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
}

export default function Autorizacoes() {
  const supabase = createClient();
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [buscaNumero, setBuscaNumero] = useState("");
  const [buscaCpf, setBuscaCpf] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  useEffect(() => {
    setDataInicial("");
    setDataFinal("");
  }, []);

  async function pesquisarAutorizacoes() {
    setErro("");
    setCarregando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Sessão expirada. Faça login novamente.");
      setCarregando(false);
      return;
    }

    let query = supabase
      .from("autorizacoes")
      .select(
        "id, numero_autorizacao, cpf_cliente, data_autorizacao, farmacia, observacao, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const numero = buscaNumero.replace(/\D/g, "");
    const cpf = buscaCpf.replace(/\D/g, "");

  const converterDataParaSupabase = (valor: string) => {
    const partes = valor.split("/");
    if (partes.length !== 3) return "";
    const [dia, mes, ano] = partes;
    if (dia.length !== 2 || mes.length !== 2 || ano.length !== 4) return "";
    return `${ano}-${mes}-${dia}`;
  };

  const dataInicialSupabase = converterDataParaSupabase(dataInicial);
  const dataFinalSupabase = converterDataParaSupabase(dataFinal);

    if (numero) {
      const numeroFormatado = numero
        .padStart(15, "0")
        .replace(/(\d{3})(?=\d)/g, "$1.");

      query = query.eq("numero_autorizacao", numeroFormatado);
    }

    if (cpf) {
      query = query.eq("cpf_cliente", cpf);
    }

    if (dataInicial) {
      query = query.gte("data_autorizacao", dataInicialSupabase);
    }

    if (dataFinal) {
      query = query.lte("data_autorizacao", dataFinalSupabase);
    }

    const { data, error } = await query;

    if (error) {
      setErro(error.message);
      setAutorizacoes([]);
      setCarregando(false);
      return;
    }

    setAutorizacoes(data || []);
    setCarregando(false);
  }

  function formatarData(data: string | null) {
    if (!data) return "Data não informada";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function limparPesquisa() {
    setBuscaNumero("");
    setBuscaCpf("");
    setDataInicial("");
    setDataFinal("");
    setErro("");
  }

  const autorizacoesFiltradas = autorizacoes.filter((autorizacao) => {
    const numero = buscaNumero.replace(/\D/g, "");
    const cpf = buscaCpf.replace(/\D/g, "");

    const correspondeNumero =
      !numero ||
      autorizacao.numero_autorizacao.replace(/\D/g, "").includes(numero);

    const correspondeCpf =
      !cpf ||
      (autorizacao.cpf_cliente ?? "").replace(/\D/g, "").includes(cpf);

    const dataAutorizacao = (
      autorizacao.data_autorizacao ?? autorizacao.created_at
    ).slice(0, 10);

    const dataInicialFiltro = dataInicial
    ? dataInicial.split("/").reverse().join("-")
    : "";

  const dataFinalFiltro = dataFinal
    ? dataFinal.split("/").reverse().join("-")
    : "";

  const correspondeDataInicial =
    !dataInicial || dataAutorizacao >= dataInicialFiltro;

  const correspondeDataFinal =
    !dataFinal || dataAutorizacao <= dataFinalFiltro;

    return correspondeNumero && correspondeCpf && correspondeDataInicial && correspondeDataFinal;
  });

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-4">
          <Link href="/dashboard">
            <RbkBrand compact />
          </Link>
          <Link
            href="/nova-autorizacao"
            className="rbk-primary rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            + Nova autorização
          </Link>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-500 hover:text-red-600"
          >
            ← Voltar ao dashboard
          </Link>
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                Gestão
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Autorizações
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Consulte e gerencie as autorizações cadastradas.
              </p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200">
              {autorizacoesFiltradas.length} registro
              {autorizacoesFiltradas.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="rbk-card mb-6 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Pesquisar autorizações
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Filtre por número ou período.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                Número da autorização
              </label>
              <input
                type="text"
                value={buscaNumero}
                onChange={(e) => setBuscaNumero(e.target.value.replace(/\D/g, "").slice(0, 15).replace(/(\d{3})(?=\d)/g, "$1."))}
                placeholder="Digite o número"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                CPF do cliente
              </label>
              <input
                type="text"
                value={buscaCpf}
                onChange={(e) =>
  setBuscaCpf(
    e.target.value
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  )
}
                placeholder="Digite o CPF"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                Data inicial
              </label>
              <input
                type="text"
            name="consulta-data-inicial"
            autoComplete="off"
                value={dataInicial}
                onChange={(e) => setDataInicial(formatarDataInput(e.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                Data final
              </label>
              <input
                type="text"
            name="consulta-data-final"
            autoComplete="off"
                value={dataFinal}
                onChange={(e) => setDataFinal(formatarDataInput(e.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={limparPesquisa}
            disabled={
              carregando ||
              (!buscaNumero && !buscaCpf && !dataInicial && !dataFinal)
            }
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpar pesquisa
          </button>

          <button
            type="button"
            onClick={pesquisarAutorizacoes}
            disabled={carregando}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Pesquisando..." : "Pesquisar"}
          </button>
        </div>
          </div>

        {carregando && (
          <div className="rbk-card p-8 text-sm text-gray-500">
            Carregando autorizações...
          </div>
        )}
        {erro && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {erro}
          </div>
        )}


        {!carregando && !erro && autorizacoesFiltradas.length > 0 && (
        <div className="mt-6 space-y-3">
          {autorizacoesFiltradas.map((autorizacao) => (
            <div
              key={autorizacao.id}
              className="rbk-card rbk-card-hover px-5 py-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                    Autorização
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    Nº {autorizacao.numero_autorizacao}
                  </h2>

                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Cadastrada em {formatarData(autorizacao.created_at.slice(0, 10))}
                  </p>
                </div>

                <Link
                  href={`/autorizacoes/${autorizacao.id}/documentos`}
                  className="rbk-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold whitespace-nowrap"
                >
                  Gerenciar documentos
                  <span className="ml-2 text-base">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>
    </main>
  );
}
