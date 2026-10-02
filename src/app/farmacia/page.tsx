"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";
import ProximasCard from "../../components/proximas/ProximasCard";
import { useEffect, useState } from "react";

import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type AutorizacaoResumo = {
  id: string;
  numero_autorizacao: string;
  cpf_cliente: string;
  created_at: string;
};

type DocumentoResumo = {
  autorizacao_id: string;
  categoria: string;
  created_at: string;
};

const categoriasObrigatorias = [
  "documento_cliente",
  "receita_medica",
  "cupom_fiscal",
  "cupom_vinculado",
];

function formatarNumeroAutorizacao(numero: string) {
  const digits = numero.replace(/\D/g, "").slice(0, 18);

  return digits.match(/.{1,3}/g)?.join(".") ?? digits;
}

function formatarCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "").slice(0, 11);

  if (digits.length !== 11) return cpf;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

export default function FarmaciaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [perfil, setPerfil] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [autorizacoesHoje, setAutorizacoesHoje] = useState(0);
  const [documentosHoje, setDocumentosHoje] = useState(0);
  const [pendencias, setPendencias] = useState(0);
  const [ultimaAutorizacao, setUltimaAutorizacao] =
    useState<AutorizacaoResumo | null>(null);
  const [ultimaCompleta, setUltimaCompleta] = useState(false);

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
      const {data: profile} = await supabase.from("users").select("perfil,farm_id,status").eq("id",user.id).maybeSingle();
      if (!profile?.farm_id || profile.status !== "active") { window.location.href="/"; return; }
      setPerfil(profile.perfil);

      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);

      const { data: autorizacoesData } = await supabase
        .from("autorizacoes")
        .select("id, numero_autorizacao, cpf_cliente, created_at")
        .eq("farm_id", profile.farm_id)
        .order("created_at", { ascending: false });

      const autorizacoes = (autorizacoesData ?? []) as AutorizacaoResumo[];

      const ids = autorizacoes.map((item) => item.id);

      let documentos: DocumentoResumo[] = [];

      if (ids.length > 0) {
        const { data: documentosData } = await supabase
          .from("documentos")
          .select("autorizacao_id, categoria, created_at")
          .in("autorizacao_id", ids);

        documentos = (documentosData ?? []) as DocumentoResumo[];
      }

      const hojeTimestamp = inicioHoje.getTime();

      setAutorizacoesHoje(
        autorizacoes.filter(
          (item) => new Date(item.created_at).getTime() >= hojeTimestamp
        ).length
      );

      setDocumentosHoje(
        documentos.filter(
          (item) => new Date(item.created_at).getTime() >= hojeTimestamp
        ).length
      );

      const documentosPorAutorizacao = new Map<string, Set<string>>();

      for (const documento of documentos) {
        const atual =
          documentosPorAutorizacao.get(documento.autorizacao_id) ??
          new Set<string>();

        atual.add(documento.categoria);
        documentosPorAutorizacao.set(documento.autorizacao_id, atual);
      }

      const quantidadePendencias = autorizacoes.filter((autorizacao) => {
        const categorias =
          documentosPorAutorizacao.get(autorizacao.id) ?? new Set<string>();

        return categoriasObrigatorias.some(
          (categoria) => !categorias.has(categoria)
        );
      }).length;

      setPendencias(quantidadePendencias);

      const ultima = autorizacoes[0] ?? null;
      setUltimaAutorizacao(ultima);

      if (ultima) {
        const categorias =
          documentosPorAutorizacao.get(ultima.id) ?? new Set<string>();

        setUltimaCompleta(
          categoriasObrigatorias.every((categoria) =>
            categorias.has(categoria)
          )
        );
      }

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
          <RbkBrand compact light />

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

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ProximasCard/>
          <Link
            href="/nova-autorizacao"
            className="rbk-card rbk-card-hover group p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl font-bold text-red-600">
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-600">
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
          {perfil !== "operador" && <Link href="/administracao" className="rbk-card rbk-card-hover group hidden p-6 lg:block">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V5m0 14h16M8 15v-4m5 4V7m5 8v-6"/></svg></div>
              <h2 className="text-base font-bold text-gray-900">Administração</h2>
            </div>
            <p className="text-sm leading-6 text-gray-500">Vendas e indicadores, planejamento de compras, relatórios e PDFs da sua farmácia.</p>
            <span className="mt-5 inline-block text-sm font-bold text-red-600">Abrir Administração →</span>
          </Link>}
          {["farmacia","administrador_farmacia"].includes(perfil ?? "") && <Link href="/equipe" className="rbk-card rbk-card-hover group p-6"><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="3"/><path d="M7 21v-2a5 5 0 0 1 10 0v2M18 4.7a2.5 2.5 0 0 1 0 4.6M20 20v-2a4 4 0 0 0-2.5-3.7M6 4.7a2.5 2.5 0 0 0 0 4.6M4 20v-2a4 4 0 0 1 2.5-3.7"/></svg></div><h2 className="text-base font-bold text-gray-900">Equipe</h2></div><p className="text-sm leading-6 text-gray-500">Convide funcionários e gerencie os acessos da sua farmácia.</p><span className="mt-5 inline-block text-sm font-bold text-red-600">Gerenciar equipe →</span></Link>}
          <Link href="/pendencias" className="rbk-card rbk-card-hover group p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl font-bold text-amber-700">!</div>
              <h2 className="text-base font-bold text-gray-900">Pendências</h2>
            </div>
            <p className="text-sm leading-6 text-gray-500">Confira os documentos que precisam de atenção.</p>
            <span className="mt-5 inline-block text-sm font-bold text-red-600">Conferir pendências →</span>
          </Link>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
              Visão rápida
            </p>
          </div>

          <div className="max-w-sm">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold tracking-tight text-gray-900">
                {autorizacoesHoje}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Autorizações hoje
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                  Última autorização
                </p>

                {ultimaAutorizacao ? (
                  <>
                    <p className="mt-3 text-lg font-bold text-gray-900">
                      {formatarNumeroAutorizacao(ultimaAutorizacao.numero_autorizacao)}
                    </p>

                    <p className="mt-1 text-sm font-medium text-gray-600">
                      CPF {formatarCpf(ultimaAutorizacao.cpf_cliente)}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(ultimaAutorizacao.created_at))}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    Nenhuma autorização cadastrada.
                  </p>
                )}
              </div>

              {ultimaAutorizacao && (
                <span
                  className={
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold " +
                    (ultimaCompleta
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700")
                  }
                >
                  {ultimaCompleta ? "✓ Completa" : "Atenção"}
                </span>
              )}
            </div>

            {ultimaAutorizacao && (
              <Link
                href={`/autorizacoes/${ultimaAutorizacao.id}/documentos`}
                className="mt-5 inline-flex text-sm font-bold text-red-600 transition hover:text-red-700"
              >
                Ver autorização →
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
