"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GestorLogout } from "../../components/GestorNavigation";
import { RbkBrand } from "../../components/RbkBrand";
import { createClient } from "../../lib/supabase/client";

type Usuario = {
  id: string;
  perfil: string;
  status: string;
};

function ActionRow({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block border-t border-gray-100 py-4 first:border-t-0 first:pt-0 last:pb-0"
    >
      <p className="font-bold text-red-700 transition group-hover:text-red-800">
        {title}
      </p>

      <p className="mt-1 text-sm leading-5 text-gray-500">
        {description} →
      </p>
    </Link>
  );
}

export default function Dashboard() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [usuariosAtivos, setUsuariosAtivos] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/");
        return;
      }

      if (ativo) {
        setEmail(user.email ?? "");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      try {
        const response = await fetch("/api/usuarios", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) return;

        const resultado = await response.json();

        const usuarios = (resultado?.usuarios ?? []) as Usuario[];

        const ativos = usuarios.filter(
          (usuario) =>
            usuario.perfil === "farmacia" &&
            usuario.status === "active"
        ).length;

        if (ativo) {
          setUsuariosAtivos(ativos);
        }
      } catch {
        if (ativo) {
          setUsuariosAtivos(null);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#f6f7f8]">
      <header className="rbk-topbar">
        <div className="mx-auto flex min-h-[96px] max-w-[1320px] items-center justify-between gap-6 px-6 lg:px-8">
          <RbkBrand compact light />

          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-700">
                Gestor RBK
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {email}
              </p>
            </div>

            <GestorLogout />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 py-10 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-600">
            ÁREA DO GESTOR
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Painel de gestão
          </h1>

          <p className="mt-2 text-base text-gray-500">
            Centralize os processos, cadastros, autorizações e o acompanhamento
            das farmácias no RBK Digital.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              FARMÁCIA POPULAR
            </p>

            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <svg
                className="h-6 w-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M9 12h6" />
                <path d="M9 16h6" />
              </svg>
              <span>Processos</span>
            </h2>

            <p className="mt-2 min-h-[40px] text-sm leading-5 text-gray-500">
              Recebimento e acompanhamento das solicitações das farmácias.
            </p>

            <div className="mt-4">
              <ActionRow
                href="/processos/auditorias"
                title="Auditorias · Receber documentos"
                description="Cadastrar farmácia, gerar convite e consultar envios"
              />

              <ActionRow
                href="/processos/credenciamento/convites"
                title="Credenciamentos · Receber documentos"
                description="Gerar convite, acompanhar ficha e consultar documentos"
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              CADASTROS
            </p>

            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <svg
                className="h-6 w-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Farmácias e usuários</span>
            </h2>

            <p className="mt-2 min-h-[40px] text-sm leading-5 text-gray-500">
              Organize os cadastros e os acessos ao RBK Digital.
            </p>

            <div className="mt-4">
              <ActionRow
                href="/usuarios/novo"
                title="Cadastrar farmácia"
                description="Novo cadastro e convite de acesso"
              />

              <ActionRow
                href="/usuarios"
                title="Farmácias e usuários"
                description="Consultar cadastros e gerenciar acessos"
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              OPERAÇÃO
            </p>

            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <svg
                className="h-6 w-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="m9 15 2 2 4-4" />
              </svg>
              <span>Autorizações</span>
            </h2>

            <p className="mt-2 min-h-[40px] text-sm leading-5 text-gray-500">
              Consulte as autorizações e acompanhe seus documentos.
            </p>

            <div className="mt-4">
              <ActionRow
                href="/nova-autorizacao"
                title="Nova autorização"
                description="Cadastrar uma nova autorização"
              />

              <ActionRow
                href="/autorizacoes"
                title="Consultar autorizações"
                description="Pesquisar registros e abrir documentos"
              />
            </div>
          </div>
        </section>

        <Link href="/proximas-dispensacoes" className="rbk-card rbk-card-hover mt-6 block p-6"><h2 className="text-xl font-bold text-gray-900">Próximas Dispensações</h2><p className="mt-2 text-sm text-gray-500">Selecione uma farmácia/CNPJ para acompanhar as retiradas previstas e os avisos.</p><span className="mt-3 inline-block text-sm font-bold text-red-600">Consultar previsões →</span></Link>
        <Link href="/administracao" className="rbk-card rbk-card-hover mt-6 flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">GESTÃO DA FARMÁCIA</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <svg
                className="h-6 w-6 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Administração</span>
            </h2>
            <p className="mt-2 text-sm text-gray-500">Selecione uma farmácia para acessar vendas e indicadores, planejamento de compras, relatórios e PDFs.</p>
          </div>
          <span className="shrink-0 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white">Abrir Administração →</span>
        </Link>

        <section className="mt-6 rounded-[22px] border border-gray-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                MONITORAMENTO
              </p>

              <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <svg
                  className="h-6 w-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <path d="m6 10 3-3 3 6 3-3" />
                </svg>
                <span>Centro de Monitoramento</span>
              </h2>

              <p className="mt-1 text-sm leading-5 text-gray-500">
                Acompanhe as farmácias da sua carteira e acesse as informações
                disponíveis no monitoramento.
              </p>
            </div>

            <Link
              href="/monitoramento"
              className="shrink-0 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800"
            >
              Abrir monitoramento →
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[22px] border border-gray-200 bg-white p-7 shadow-sm">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                ACOMPANHAMENTO
              </p>

              <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <svg
                  className="h-6 w-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
                <span>Resumo da carteira</span>
              </h2>
            </div>

            <span className="rounded-full bg-gray-100 px-4 py-2 text-xs font-medium text-gray-500">
              Situação atual
            </span>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-bold text-gray-900">
                Auditorias
              </h3>

              <p className="mt-4 text-sm text-gray-500">
                Acesse o módulo para acompanhar os processos cadastrados.
              </p>

              <Link
                href="/processos/auditorias"
                className="mt-4 inline-block text-sm font-bold text-red-700"
              >
                Ver auditorias →
              </Link>
            </div>

            <div>
              <h3 className="font-bold text-gray-900">
                Credenciamentos
              </h3>

              <p className="mt-4 text-sm text-gray-500">
                Acesse o módulo para acompanhar os processos de credenciamento.
              </p>

              <Link
                href="/processos/credenciamento"
                className="mt-4 inline-block text-sm font-bold text-red-700"
              >
                Ver credenciamentos →
              </Link>
            </div>

            <div>
              <h3 className="font-bold text-gray-900">
                Usuários da operação
              </h3>

              <p className="mt-4 text-3xl font-bold text-gray-900">
                {usuariosAtivos === null ? "—" : usuariosAtivos}
              </p>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Contas ativas com perfil de farmácia habilitadas no RBK Digital.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="gestao-rbk-title">
          <h2 id="gestao-rbk-title" className="mb-4 text-2xl font-bold text-gray-900">Gestão da RBK</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Link href="/financeiro" className="rbk-card rbk-card-hover block rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">CONTRATOS E MENSALIDADES</p>
              <h3 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <svg
                  className="h-6 w-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                  <path d="M12 6v2m0 8v2" />
                </svg>
                <span>Financeiro</span>
              </h3>
              <p className="mt-2 text-sm leading-5 text-gray-500">Controle serviços, assinaturas do RBK Digital, recebimentos e inadimplência.</p>
              <span className="mt-4 inline-block text-sm font-bold text-red-700">Abrir Financeiro →</span>
            </Link>
            <Link href="/crm" className="rbk-card rbk-card-hover block rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">RELACIONAMENTO COMERCIAL</p>
              <h3 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
                <svg
                  className="h-6 w-6 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <polyline points="16 11 18 13 22 9" />
                </svg>
                <span>CRM</span>
              </h3>
              <p className="mt-2 text-sm leading-5 text-gray-500">Acompanhe leads, clientes, oportunidades e prepare comunicados segmentados.</p>
              <span className="mt-4 inline-block text-sm font-bold text-red-700">Abrir CRM →</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
