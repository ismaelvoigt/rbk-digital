"use client";

import Link from "next/link";
import { useRetornoFarmacias } from "../../../../lib/usuarios/useRetornoFarmacias";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { resolveRole } from "../../../../lib/auth/rbac";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  data_autorizacao: string | null;
  farmacia: string;
  observacao: string | null;
  cpf_cliente: string | null;
};

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  farm_id: string | null;
  farms:
    | {
        razao_social: string | null;
        nome_fantasia: string | null;
        cnpj: string | null;
      }
    | null;
};

const supabase = createClient();

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  return numeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarNumeroAutorizacao(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 15);

  return numeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2");
}

function formatarDataInput(valor: string) {
  const numeros = somenteNumeros(valor).slice(0, 8);

  if (numeros.length <= 2) {
    return numeros;
  }

  if (numeros.length <= 4) {
    return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  }

  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

function dataParaISO(valor: string) {
  const numeros = somenteNumeros(valor);

  if (numeros.length !== 8) {
    return "";
  }

  const dia = numeros.slice(0, 2);
  const mes = numeros.slice(2, 4);
  const ano = numeros.slice(4, 8);

  const data = new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia)
  );

  if (
    data.getFullYear() !== Number(ano) ||
    data.getMonth() !== Number(mes) - 1 ||
    data.getDate() !== Number(dia)
  ) {
    return "";
  }

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string | null | undefined) {
  if (!data) {
    return "Data não informada";
  }

  const valor = data.slice(0, 10);
  const partes = valor.split("-");

  if (partes.length !== 3) {
    return "Data não informada";
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function AutorizacoesUsuario() {
  const params = useParams();
  const router = useRouter();
  const retorno = useRetornoFarmacias();

  const usuarioId = params.id as string;

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);

  const [carregandoUsuario, setCarregandoUsuario] = useState(true);
  const [pesquisando, setPesquisando] = useState(false);

  const [pesquisaRealizada, setPesquisaRealizada] = useState(false);
  const [erro, setErro] = useState("");

  const [buscaCpf, setBuscaCpf] = useState("");
  const [numeroAutorizacao, setNumeroAutorizacao] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  useEffect(() => {
    async function carregarUsuario() {
      setCarregandoUsuario(true);
      setErro("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data: administrador } = await supabase
        .from("rbk_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: perfilAtual } = await supabase
        .from("users")
        .select("perfil, status")
        .eq("id", user.id)
        .single();
      const role = perfilAtual?.status === "active"
        ? resolveRole(perfilAtual.perfil, Boolean(administrador))
        : null;
      if (role !== "gestor_rbk" && role !== "superadmin_rbk") {
        router.push("/dashboard");
        return;
      }

      const { data: usuarioSelecionado, error: erroUsuario } =
        await supabase
          .from("users")
          .select(`
            id,
            nome,
            email,
            perfil,
            status,
            farm_id,
            farms (
              razao_social,
              nome_fantasia,
              cnpj
            )
          `)
          .eq("id", usuarioId)
          .in("perfil", ["farmacia", "operador", "administrador_farmacia"])
          .single();

      if (erroUsuario || !usuarioSelecionado) {
        console.error(erroUsuario);
        setErro("Não foi possível localizar o usuário.");
        setCarregandoUsuario(false);
        return;
      }

      const usuarioNormalizado = {
        ...usuarioSelecionado,
        farms: Array.isArray(usuarioSelecionado.farms)
          ? usuarioSelecionado.farms[0] ?? null
          : usuarioSelecionado.farms,
      };

      setUsuario(usuarioNormalizado as Usuario);

      /*
       * IMPORTANTE:
       * Não carregamos as autorizações automaticamente.
       * Elas só serão buscadas depois que o administrador
       * informar pelo menos um filtro e clicar em pesquisar.
       */
      setAutorizacoes([]);
      setPesquisaRealizada(false);
      setCarregandoUsuario(false);
    }

    carregarUsuario();
  }, [router, usuarioId]);

  const farmacia = usuario ? usuario.farms : null;

  const nomeFarmacia =
    farmacia?.nome_fantasia ||
    farmacia?.razao_social ||
    "Farmácia não informada";

  async function pesquisarAutorizacoes() {
    setErro("");

    const cpf = somenteNumeros(buscaCpf);
    const numero = somenteNumeros(numeroAutorizacao);

    const isoInicial = dataInicial ? dataParaISO(dataInicial) : "";
    const isoFinal = dataFinal ? dataParaISO(dataFinal) : "";

    if (!cpf && !numero && !dataInicial && !dataFinal) {
      setErro("Informe pelo menos um filtro para realizar a pesquisa.");
      setAutorizacoes([]);
      setPesquisaRealizada(false);
      return;
    }

    if (dataInicial && !isoInicial) {
      setErro("A data inicial informada é inválida.");
      setAutorizacoes([]);
      return;
    }

    if (dataFinal && !isoFinal) {
      setErro("A data final informada é inválida.");
      setAutorizacoes([]);
      return;
    }

    if (isoInicial && isoFinal && isoInicial > isoFinal) {
      setErro("A data inicial não pode ser posterior à data final.");
      setAutorizacoes([]);
      return;
    }

    if (cpf && cpf.length !== 11) {
      setErro("Informe um CPF completo com 11 dígitos.");
      setAutorizacoes([]);
      return;
    }

    if (numero && numero.length !== 15) {
      setErro(
        "Informe o número completo da autorização com 15 dígitos."
      );
      setAutorizacoes([]);
      return;
    }

    const farmId = usuario?.farm_id;

    if (!farmId) {
      setErro("A farmácia deste usuário não está vinculada a um cadastro.");
      setAutorizacoes([]);
      setPesquisaRealizada(false);
      return;
    }

    setPesquisando(true);
    setPesquisaRealizada(false);

    let consulta = supabase
      .from("autorizacoes")
      .select(
        "id, numero_autorizacao, data_autorizacao, farmacia, observacao, cpf_cliente"
      )
      .eq("farm_id", farmId)
      .order("data_autorizacao", { ascending: false })
      .order("created_at", { ascending: false });

    if (cpf) {
      consulta = consulta.eq("cpf_cliente", cpf);
    }

    if (numero) {
      consulta = consulta.eq("numero_autorizacao", numero);
    }

    if (isoInicial) {
      consulta = consulta.gte("data_autorizacao", isoInicial);
    }

    if (isoFinal) {
      consulta = consulta.lte("data_autorizacao", isoFinal);
    }

    const { data, error } = await consulta;

    if (error) {
      console.error(error);
      setErro("Não foi possível realizar a pesquisa.");
      setAutorizacoes([]);
    } else {
      setAutorizacoes((data as Autorizacao[]) || []);
    }

    setPesquisaRealizada(true);
    setPesquisando(false);
  }

  function limparPesquisa() {
    setBuscaCpf("");
    setNumeroAutorizacao("");
    setDataInicial("");
    setDataFinal("");

    setAutorizacoes([]);
    setPesquisaRealizada(false);
    setErro("");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-10">

        <nav aria-label="Navegação de farmácias" className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={retorno}
            className="text-sm font-bold text-gray-500 hover:text-red-600"
          >
            ← Voltar para farmácias
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">← Voltar ao Dashboard</Link>
        </nav>

        <div className="mb-10">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-red-600">
            Administração
          </div>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
            Autorizações da farmácia
          </h1>

          <p className="mt-3 text-lg text-gray-500">
            Consulte as autorizações vinculadas à farmácia selecionada.
          </p>
        </div>

        {usuario && (
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <div className="flex items-start gap-5">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg font-bold text-red-600">
                US
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {usuario.nome}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {usuario.email}
                </p>

                <div className="mt-5 grid gap-5 md:grid-cols-3">

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                      Farmácia
                    </div>

                    <div className="mt-1 font-semibold text-gray-800">
                      {nomeFarmacia}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                      CNPJ
                    </div>

                    <div className="mt-1 text-gray-600">
                      {farmacia?.cnpj || "Não informado"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                      Resultado da pesquisa
                    </div>

                    <div className="mt-1 text-xl font-bold text-gray-900">
                      {pesquisaRealizada ? autorizacoes.length : "—"}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {erro && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {erro}
          </div>
        )}

        {usuario && (
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Pesquisar autorizações
              </h2>

              <p className="mt-2 text-gray-500">
                Consulte por CPF, número da autorização, período ou
                combine os filtros.
              </p>

              <p className="mt-1 text-sm font-medium text-gray-400">
                Informe pelo menos um filtro para realizar a pesquisa.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label
                  htmlFor="buscaCpf"
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500"
                >
                  CPF do cliente
                </label>

                <input
                  id="buscaCpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={buscaCpf}
                  onChange={(e) =>
                    setBuscaCpf(formatarCpf(e.target.value))
                  }
                  placeholder="000.000.000-00"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-5 py-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label
                  htmlFor="numeroAutorizacao"
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500"
                >
                  Número da autorização
                </label>

                <input
                  id="numeroAutorizacao"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={numeroAutorizacao}
                  onChange={(e) =>
                    setNumeroAutorizacao(
                      formatarNumeroAutorizacao(e.target.value)
                    )
                  }
                  placeholder="000.000.000.000.000"
                  maxLength={19}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-5 py-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label
                  htmlFor="dataInicial"
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500"
                >
                  Data inicial
                </label>

                <input
                  id="dataInicial"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={dataInicial}
                  onChange={(e) =>
                    setDataInicial(
                      formatarDataInput(e.target.value)
                    )
                  }
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-5 py-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label
                  htmlFor="dataFinal"
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500"
                >
                  Data final
                </label>

                <input
                  id="dataFinal"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={dataFinal}
                  onChange={(e) =>
                    setDataFinal(
                      formatarDataInput(e.target.value)
                    )
                  }
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-5 py-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-4">

              <button
                type="button"
                onClick={pesquisarAutorizacoes}
                disabled={pesquisando || carregandoUsuario}
                className="rounded-xl bg-red-600 px-6 py-4 text-base font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pesquisando
                  ? "Pesquisando..."
                  : "Pesquisar autorizações →"}
              </button>

              <button
                type="button"
                onClick={limparPesquisa}
                disabled={pesquisando}
                className="rounded-xl border border-gray-300 bg-white px-6 py-4 text-base font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Limpar pesquisa
              </button>

            </div>

            {pesquisaRealizada && !pesquisando && !erro && (
              <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Pesquisa realizada.

                {buscaCpf && (
                  <span className="ml-1 font-semibold">
                    CPF: {buscaCpf}.
                  </span>
                )}

                {numeroAutorizacao && (
                  <span className="ml-1 font-semibold">
                    Autorização: {numeroAutorizacao}.
                  </span>
                )}

                {(dataInicial || dataFinal) && (
                  <span className="ml-1 font-semibold">
                    Período: {dataInicial || "início não informado"} até{" "}
                    {dataFinal || "fim não informado"}.
                  </span>
                )}
              </div>
            )}

          </div>
        )}

        {!carregandoUsuario &&
          !pesquisando &&
          pesquisaRealizada &&
          !erro &&
          autorizacoes.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <h2 className="text-lg font-bold text-gray-900">
                Nenhuma autorização encontrada
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Nenhuma autorização corresponde aos filtros informados.
              </p>
            </div>
          )}

        {!pesquisando &&
          pesquisaRealizada &&
          !erro &&
          autorizacoes.length > 0 && (
            <div>

              <div className="mb-5">
                <h2 className="text-2xl font-bold text-gray-900">
                  Autorizações encontradas
                </h2>

                <p className="mt-1 text-gray-500">
                  {autorizacoes.length} autorização(ões) encontrada(s).
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">

                {autorizacoes.map((autorizacao) => (
                  <div
                    key={autorizacao.id}
                    className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                          Autorização
                        </div>

                        <h3 className="mt-2 text-xl font-bold text-gray-900">
                          {formatarNumeroAutorizacao(
                            autorizacao.numero_autorizacao
                          )}
                        </h3>
                      </div>

                      <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                        DOCUMENTOS
                      </div>

                    </div>

                    <div className="mt-6 space-y-3">

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                          CPF do cliente
                        </div>

                        <div className="mt-1 text-sm font-semibold text-gray-800">
                          {autorizacao.cpf_cliente
                            ? formatarCpf(autorizacao.cpf_cliente)
                            : "Não informado"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                          Data
                        </div>

                        <div className="mt-1 text-sm font-semibold text-gray-800">
                          {formatarData(
                            autorizacao.data_autorizacao
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                          Farmácia
                        </div>

                        <div className="mt-1 text-sm font-semibold text-gray-800">
                          {autorizacao.farmacia}
                        </div>
                      </div>

                      {autorizacao.observacao && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                            Observação
                          </div>

                          <div className="mt-1 text-sm text-gray-600">
                            {autorizacao.observacao}
                          </div>
                        </div>
                      )}

                    </div>

                    <Link
                      href={`/autorizacoes/${autorizacao.id}/documentos`}
                      className="mt-7 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      Conferir documentação →
                    </Link>

                  </div>
                ))}

              </div>
            </div>
          )}

      </div>
    </main>
  );
}
