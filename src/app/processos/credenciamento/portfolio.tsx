"use client";
import { formatCnpj } from "../../../lib/processos/cnpj";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RbkBrand } from "../../../components/RbkBrand";
import { fields, summarize, TYPES } from "../../../lib/processos/domain";
import { api, type Portfolio } from "../../../lib/processos/client";
import ProcessDetail from "./process-detail";
const button =
  "rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export default function Credenciamento({ id }: { id: string }) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [cnpj, setCnpj] = useState(""),
    [name, setName] = useState("");
  useEffect(() => {
    api()
      .then(setPortfolio)
      .catch((e) => setError(e.message));
  }, []);
  async function add() {
    setBusy(true);
    setError("");
    try {
      const p = await api("", "POST", {
        ficha: { B20: cnpj.replace(/\D/g, ""), B21: name },
      });
      router.push(`/processos/credenciamento?id=${p.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <RbkBrand compact />
          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Voltar ao Dashboard
          </Link>
        </div>
      </header>
      <div className="rbk-container py-8">
        <div className="mb-6 text-sm text-gray-500">
          <Link href="/processos/credenciamento">Processos</Link> /
          Credenciamento PFPB
        </div>
        {id ? (
          <ProcessDetail key={id} id={id} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                  Gestor RBK · Uso interno
                </p>
                <h1 className="mt-2 text-3xl font-bold">Credenciamento PFPB</h1>
                <p className="mt-2 text-sm text-gray-500">
                  Cadastro, documentos e revisão humana do processo.
                </p>
              </div>
              <button className={button} onClick={() => setCreate(!create)}>
                Novo processo
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="mb-5 rounded-xl bg-red-50 p-4 text-red-800"
              >
                {error}
              </p>
            )}
            {create && (
              <form
                className="rbk-card mb-6 grid gap-4 p-5 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add();
                }}
              >
                <label>
                  CNPJ da farmácia
                  <input
                    aria-label="CNPJ da farmácia"
                    className="mt-1 w-full rounded-lg border p-2"
                    required
                    pattern="[0-9]{2}[.][0-9]{3}[.][0-9]{3}/[0-9]{4}-[0-9]{2}" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  />
                </label>
                <label>
                  Razão social
                  <input
                    aria-label="Razão social"
                    className="mt-1 w-full rounded-lg border p-2"
                    required
                    minLength={2}
                    maxLength={500}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button disabled={busy} className={button}>
                  {busy ? "Criando…" : "Criar processo"}
                </button>
              </form>
            )}
            <div className="rbk-card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    {[
                      "Farmácia",
                      "CNPJ",
                      "Ficha",
                      "Documentos",
                      "Pré-análise",
                      "Pendências",
                      "Status",
                      "Atualização",
                    ].map((x) => (
                      <th key={x} className="p-4">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolio?.processes.map((p) => {
                    const s = summarize(
                      portfolio.versions.filter((v) => v.process_id === p.id),
                      portfolio.reviews.filter((r) => r.process_id === p.id),
                    );
                    const run = portfolio.analyses.find(
                      (a) => a.process_id === p.id,
                    );
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="p-4 font-semibold text-red-700">
                          <Link href={`?id=${p.id}`}>
                            {p.ficha.B22 || p.ficha.B21}
                          </Link>
                        </td>
                        <td className="p-4">{formatCnpj(p.ficha.B20 ?? "")}</td>
                        <td className="p-4">
                          {fields.filter((f) => p.ficha[f.cell]?.trim()).length}
                          /{fields.length} campos
                        </td>
                        <td className="p-4">{s.sent}/{TYPES.length}</td>
                        <td className="p-4">
                          {run
                            ? run.revision === p.revision
                              ? "Executada"
                              : "Desatualizada"
                            : "Não executada"}
                        </td>
                        <td className="p-4">{s.pending}</td>
                        <td className="p-4">
                          {p.formed_revision === p.revision
                            ? "Formado"
                            : "Em preparação"}
                        </td>
                        <td className="p-4">
                          {new Date(p.updated_at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {portfolio?.processes.length === 0 && (
                <p className="p-8 text-gray-500">Nenhum processo cadastrado.</p>
              )}
              {!portfolio && !error && <p className="p-8">Carregando…</p>}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Ficha: campos preenchidos, sem inferir obrigatoriedade dos blocos
              de sócios. A pré-análise auxilia a conferência; a decisão é do
              Gestor.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
