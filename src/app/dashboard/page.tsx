"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Autorizacao = {
  id: string;
  numero_autorizacao: string;
  created_at: string;
};

type Documento = {
  id: string;
  autorizacao_id: string;
  categoria: string;
  status: string;
};

const categoriasObrigatorias = [
  "documento_cliente",
  "receita_medica",
  "cupom_fiscal",
  "cupom_vinculado",
];

export default function Dashboard() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarDashboard() {
      try {
        setCarregando(true);
        setErro("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/";
          return;
        }

        setEmail(user.email ?? "");

        const { data: autorizacoesData, error: autorizacoesError } =
          await supabase
            .from("autorizacoes")
            .select("id, numero_autorizacao, created_at")
            .eq("user_id", user.id);

        if (autorizacoesError) {
          throw new Error(autorizacoesError.message);
        }

        const listaAutorizacoes = autorizacoesData ?? [];
        setAutorizacoes(listaAutorizacoes);

        if (listaAutorizacoes.length === 0) {
          setDocumentos([]);
          return;
        }

        const idsAutorizacoes = listaAutorizacoes.map(
          (autorizacao) => autorizacao.id,
        );

        const { data: documentosData, error: documentosError } =
          await supabase
            .from("documentos")
            .select("id, autorizacao_id, categoria, status")
            .in("autorizacao_id", idsAutorizacoes);

        if (documentosError) {
          throw new Error(documentosError.message);
        }

        setDocumentos(documentosData ?? []);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o dashboard.",
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarDashboard();
  }, [supabase]);

  const totalAutorizacoes = autorizacoes.length;

  const totalDocumentos = documentos.filter(
    (documento) => documento.status === "recebido",
  ).length;

  const autorizacoesConcluidas = autorizacoes.filter((autorizacao) =>
    categoriasObrigatorias.every((categoria) =>
      documentos.some(
        (documento) =>
          documento.autorizacao_id === autorizacao.id &&
          documento.categoria === categoria &&
          documento.status === "recebido",
      ),
    ),
  ).length;

  const autorizacoesPendentes =
    totalAutorizacoes - autorizacoesConcluidas;

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between gap-5">
          <RbkBrand compact />

          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
              Administrador
            </p>

            <p className="mt-1 max-w-[280px] truncate text-sm font-medium text-gray-700">
              {email}
            </p>
          </div>
        </div>
      </header>

      <div className="rbk-container py-8 sm:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
              Visão geral
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Central de controle das farmácias, usuários, autorizações e
              documentos do RBK Digital.
            </p>
          </div>
        </div>

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Não foi possível carregar todos os dados do dashboard.

            <div className="mt-1 text-xs opacity-80">{erro}</div>
          </div>
        )}

        {carregando ? (
          <div className="rbk-card p-8 text-sm text-gray-500">
            Carregando dashboard...
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rbk-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Autorizações
                    </p>

                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {totalAutorizacoes}
                      </p>

                      <p className="text-sm text-gray-500">
                        Registros cadastrados
                      </p>
                    </div>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-600">
                    AUT
                  </div>
                </div>
              </div>

              <div className="rbk-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Documentos
                    </p>

                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {totalDocumentos}
                      </p>

                      <p className="text-sm text-gray-500">
                        Arquivos recebidos
                      </p>
                    </div>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                    DOC
                  </div>
                </div>
              </div>

              <div className="rbk-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Pendências
                    </p>

                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {autorizacoesPendentes}
                      </p>

                      <p className="text-sm text-gray-500">
                        Autorizações incompletas
                      </p>
                    </div>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-bold text-orange-600">
                    !
                  </div>
                </div>
              </div>

              <div className="rbk-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Concluídas
                    </p>

                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {autorizacoesConcluidas}
                      </p>

                      <p className="text-sm text-gray-500">
                        Com documentação completa
                      </p>
                    </div>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-sm font-bold text-green-600">
                    ✓
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
                  Administração
                </p>

                <h2 className="mt-2 text-xl font-bold text-gray-900">
                  Farmácias e usuários
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Gerencie as farmácias cadastradas e os acessos ao RBK
                  Digital.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/usuarios/novo"
                  className="rbk-card rbk-card-hover group p-6"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg font-bold text-red-600">
                      +
                    </div>

                    <h3 className="text-base font-bold text-gray-900">
                      Nova farmácia
                    </h3>
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    Cadastre uma nova farmácia e envie o convite de acesso ao
                    responsável.
                  </p>

                  <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">
                    Cadastrar farmácia →
                  </span>
                </Link>

                <Link
                  href="/usuarios"
                  className="rbk-card rbk-card-hover group p-6"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-600">
                      LISTA
                    </div>

                    <h3 className="text-base font-bold text-gray-900">
                      Farmácias cadastradas
                    </h3>
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    Consulte as farmácias cadastradas e seus respectivos
                    acessos ao RBK Digital.
                  </p>

                  <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">
                    Consultar farmácias →
                  </span>
                </Link>
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
                  Operação
                </p>

                <h2 className="mt-2 text-xl font-bold text-gray-900">
                  Autorizações
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Cadastre e consulte as autorizações e sua documentação.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/nova-autorizacao"
                  className="rbk-card rbk-card-hover group p-6"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg font-bold text-red-600">
                      +
                    </div>

                    <h3 className="text-base font-bold text-gray-900">
                      Nova autorização
                    </h3>
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    Cadastre uma nova autorização para acompanhamento
                    documental.
                  </p>

                  <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">
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

                    <h3 className="text-base font-bold text-gray-900">
                      Autorizações cadastradas
                    </h3>
                  </div>

                  <p className="text-sm leading-5 text-gray-500">
                    Consulte registros, pesquise autorizações e acesse a
                    documentação.
                  </p>

                  <span className="mt-5 inline-block text-sm font-bold text-red-600 group-hover:text-red-700">
                    Consultar autorizações →
                  </span>
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
