"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";
import {
  obterEscopoPesquisa,
  normalizarPesquisa,
  pesquisarAutorizacoes,
  listarPesquisaCompleta,
  revalidarSelecao,
  PAGINA_AUTORIZACOES,
  type EscopoPesquisa,
  type FiltrosPesquisa,
  type PesquisaAplicada,
  type LinhaAutorizacao,
} from "../../lib/autorizacoes/pesquisa";
const INITIAL: FiltrosPesquisa = { modo: "livre", cpf: "", numero: "" };
type Aplicada = { filtros: PesquisaAplicada; snapshot: string };
type Parte = { id: string; rows: LinhaAutorizacao[] };
type Relatorio = {
  id: number;
  title: string;
  rows: LinhaAutorizacao[];
  parts: Parte[];
  listUrl: string;
  generated: string[];
  ready?: { id: string; url: string; notice: string };
};
const numero = (v: string) => v.replace(/(\d{3})(?=\d)/g, "$1.");
const cpf = (v: string | null) =>
  v
    ? v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
    : "Não informado";
const data = (v: string | null) =>
  v ? v.split("-").reverse().join("/") : "Não informada";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
function descricao(f: PesquisaAplicada) {
  return [
    f.inicio &&
      (f.inicio === f.fim
        ? `Dia ${data(f.inicio)}`
        : `Período: ${data(f.inicio)} a ${data(f.fim)}`),
    f.cpf && `CPF ${cpf(f.cpf)}`,
    f.numero && `Autorização ${numero(f.numero)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
const button =
  "min-h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 disabled:opacity-50";
function urlPdf(bytes: Uint8Array) {
  return URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
}
export default function PesquisaAutorizacoes(props: {
  farmId?: string;
  nomeFarmacia?: string;
}) {
  return (
    <ConsultaAutorizacoes key={props.farmId || "farmacia-atual"} {...props} />
  );
}
function ConsultaAutorizacoes({
  farmId,
  nomeFarmacia,
}: {
  farmId?: string;
  nomeFarmacia?: string;
}) {
  const client = useMemo(() => createClient(), []),
    epoch = useRef(0),
    lock = useRef(false),
    scopeRef = useRef<EscopoPesquisa | null>(null),
    reportRef = useRef<Relatorio | null>(null),
    reportId = useRef(0);
  const [scope, setScope] = useState<EscopoPesquisa | null>(null),
    [initializing, setInitializing] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [draft, setDraft] = useState<FiltrosPesquisa>(INITIAL),
    [applied, setApplied] = useState<Aplicada | null>(null),
    [rows, setRows] = useState<LinhaAutorizacao[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Record<string, LinhaAutorizacao>>({}),
    [report, setReport] = useState<Relatorio | null>(null);
  function clearReport() {
    const r = reportRef.current;
    if (r) {
      URL.revokeObjectURL(r.listUrl);
      if (r.ready) URL.revokeObjectURL(r.ready.url);
    }
    reportRef.current = null;
    setReport(null);
  }
  useEffect(() => {
    const turn = ++epoch.current;
    let current = true;
    scopeRef.current = null;
    lock.current = false;
    const revoke = () => {
      const r = reportRef.current;
      if (r) {
        URL.revokeObjectURL(r.listUrl);
        if (r.ready) URL.revokeObjectURL(r.ready.url);
      }
      reportRef.current = null;
    };
    revoke();
    void obterEscopoPesquisa(client, farmId)
      .then((s) => {
        if (current && epoch.current === turn) {
          scopeRef.current = s;
          setScope(s);
        }
      })
      .catch((e) => {
        if (current && epoch.current === turn) setError(message(e));
      })
      .finally(() => {
        if (current && epoch.current === turn) setInitializing(false);
      });
    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (
          !current ||
          !scopeRef.current ||
          session?.user.id === scopeRef.current.actorId
        )
          return;
        ++epoch.current;
        scopeRef.current = null;
        setScope(null);
        setRows([]);
        setSelected({});
        setApplied(null);
        setTotal(0);
        setDraft(INITIAL);
        revoke();
        setReport(null);
        setStatus("");
        lock.current = false;
        setBusy(false);
        setError("A sessão mudou. Atualize a página para continuar.");
      },
    );
    const invalidate = () => {
      ++epoch.current;
      scopeRef.current = null;
    };
    return () => {
      current = false;
      invalidate();
      subscription.subscription.unsubscribe();
      revoke();
    };
  }, [client, farmId]);
  function current(turn: number) {
    return epoch.current === turn && Boolean(scopeRef.current);
  }
  async function load(p: number, newSearch: boolean) {
    if (lock.current || !scopeRef.current) return;
    const turn = epoch.current,
      s = scopeRef.current;
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const search = newSearch
        ? {
            filtros: normalizarPesquisa(draft),
            snapshot: new Date().toISOString(),
          }
        : applied;
      if (!search) throw new Error("Realize uma pesquisa primeiro.");
      const result = await pesquisarAutorizacoes(
        client,
        s,
        search.filtros,
        p,
        search.snapshot,
      );
      if (!current(turn)) return;
      clearReport();
      setRows(result.linhas);
      setTotal(result.total);
      setPage(p);
      setApplied(search);
    } catch (e) {
      if (current(turn)) setError(message(e));
    } finally {
      if (current(turn)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void load(0, true);
  }
  function clearSearch() {
    if (lock.current) return;
    setDraft(INITIAL);
    setRows([]);
    setTotal(0);
    setPage(0);
    setApplied(null);
    setError("");
    setStatus("");
    clearReport();
  }
  function toggle(row: LinhaAutorizacao) {
    if (lock.current) return;
    setSelected((previous) => {
      const next = { ...previous };
      if (next[row.id]) delete next[row.id];
      else next[row.id] = row;
      return next;
    });
  }
  function updateReport(r: Relatorio) {
    reportRef.current = r;
    setReport(r);
  }
  async function part(base: Relatorio, p: Parte, turn: number): Promise<void> {
    if (!scopeRef.current || !current(turn)) return;
    const service = await import("../../lib/autorizacoes/relatorioPesquisa");
    try {
      const result = await service.gerarPartePesquisa(
        client,
        scopeRef.current,
        p.rows,
        `${base.title} · Parte ${p.id}`,
        (s) => {
          if (current(turn)) setStatus(s);
        },
      );
      if (!current(turn) || reportRef.current?.id !== base.id) return;
      const old = reportRef.current;
      if (old.ready) URL.revokeObjectURL(old.ready.url);
      const notice = [
        result.semDocumentos.length &&
          `${result.semDocumentos.length} autorização(ões) sem anexos, identificadas na listagem.`,
        result.parciais.length &&
          `${result.parciais.length} autorização(ões) com registro de documento sem arquivo.`,
      ]
        .filter(Boolean)
        .join(" ");
      updateReport({
        ...old,
        generated: [...new Set([...old.generated, p.id])],
        ready: { id: p.id, url: urlPdf(result.bytes), notice },
      });
      setStatus(`PDF da parte ${p.id} pronto para baixar. ${notice}`);
    } catch (e) {
      if (!current(turn) || reportRef.current?.id !== base.id) return;
      if (e instanceof service.DividirParteError && p.rows.length > 1) {
        const middle = Math.ceil(p.rows.length / 2),
          a = { id: `${p.id}.1`, rows: p.rows.slice(0, middle) },
          b = { id: `${p.id}.2`, rows: p.rows.slice(middle) };
        const next = {
          ...reportRef.current,
          parts: reportRef.current.parts.flatMap((old) =>
            old.id === p.id ? [a, b] : [old],
          ),
        };
        updateReport(next);
        await part(next, a, turn);
        return;
      }
      throw new Error(
        e instanceof service.DividirParteError
          ? "Os documentos desta autorização excedem o limite de um PDF. Confira e baixe seus anexos na página de documentos."
          : message(e),
      );
    }
  }
  async function prepareReport(kind: "pesquisa" | "selecao") {
    if (lock.current || !scopeRef.current) return;
    const turn = epoch.current,
      s = scopeRef.current;
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("Lendo autorizações para o relatório…");
    try {
      const result =
        kind === "pesquisa" && applied
          ? await listarPesquisaCompleta(
              client,
              s,
              applied.filtros,
              applied.snapshot,
              (m) => {
                if (current(turn)) setStatus(m);
              },
            )
          : await revalidarSelecao(client, s, Object.keys(selected));
      if (!current(turn)) return;
      if (!result.length)
        throw new Error("Não há autorizações para gerar o relatório.");
      const title =
        kind === "pesquisa" && applied
          ? descricao(applied.filtros)
          : "Autorizações selecionadas";
      const service = await import("../../lib/autorizacoes/relatorioPesquisa");
      const list = await service.gerarListagemPesquisa(result, title);
      if (!current(turn)) return;
      clearReport();
      const r: Relatorio = {
        id: ++reportId.current,
        title,
        rows: result,
        parts: service
          .planejarPartes(result)
          .map((items, i) => ({ id: String(i + 1), rows: items })),
        generated: [],
        listUrl: urlPdf(list),
      };
      updateReport(r);
      await part(r, r.parts[0], turn);
    } catch (e) {
      if (current(turn)) {
        setError(message(e));
        setStatus(
          "A preparação não foi concluída. As partes já disponíveis continuam abaixo.",
        );
      }
    } finally {
      if (current(turn)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function preparePart(p: Parte) {
    if (lock.current || !reportRef.current || !scopeRef.current) return;
    const turn = epoch.current,
      r = reportRef.current;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await part(r, p, turn);
    } catch (e) {
      if (current(turn)) {
        setError(message(e));
        setStatus(
          "Esta parte não foi concluída. A listagem e a última parte pronta continuam disponíveis.",
        );
      }
    } finally {
      if (current(turn)) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const count = Object.keys(selected).length;
  function pagination() {
    return (
      <nav
        aria-label="Páginas de autorizações"
        className="my-4 flex flex-wrap items-center gap-3"
      >
        <button
          className={button}
          type="button"
          disabled={busy || page === 0}
          onClick={() => void load(page - 1, false)}
        >
          Anterior
        </button>
        <span className="text-sm">
          Página {page + 1} de{" "}
          {Math.max(1, Math.ceil(total / PAGINA_AUTORIZACOES))}
        </span>
        <button
          className={button}
          type="button"
          disabled={busy || (page + 1) * PAGINA_AUTORIZACOES >= total}
          onClick={() => void load(page + 1, false)}
        >
          Próxima
        </button>
      </nav>
    );
  }
  if (initializing) return <p role="status">Conferindo acesso à farmácia…</p>;
  if (!scope)
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
        {error || "Atualize a página para conferir seu acesso."}
      </p>
    );
  return (
    <section>
      <form onSubmit={submit} className="rbk-card mb-5 p-5 sm:p-7">
        <h2 className="mb-4 text-xl font-semibold">Pesquisar autorizações</h2>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            CPF do cliente
            <input
              aria-label="CPF do cliente"
              className={field}
              inputMode="numeric"
              maxLength={14}
              value={draft.cpf || ""}
              onChange={(e) => setDraft({ ...draft, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </label>
          <label className="text-sm">
            Número da autorização
            <input
              aria-label="Número da autorização"
              className={field}
              inputMode="numeric"
              maxLength={19}
              value={draft.numero || ""}
              onChange={(e) => setDraft({ ...draft, numero: e.target.value })}
              placeholder="000.000.000.000.000"
            />
          </label>
          <label className="text-sm">
            Filtro de data
            <select
              aria-label="Filtro de data"
              className={field}
              value={draft.modo}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  modo: e.target.value as FiltrosPesquisa["modo"],
                })
              }
            >
              <option value="livre">Sem filtro de data</option>
              <option value="dia">Dia</option>
              <option value="periodo">Período</option>
              <option value="mes">Mês</option>
            </select>
          </label>
          {draft.modo === "dia" && (
            <label className="text-sm">
              Dia
              <input
                aria-label="Dia"
                className={field}
                type="date"
                value={draft.dia || ""}
                onChange={(e) => setDraft({ ...draft, dia: e.target.value })}
              />
            </label>
          )}
          {draft.modo === "mes" && (
            <label className="text-sm">
              Mês
              <input
                aria-label="Mês"
                className={field}
                type="month"
                value={draft.mes || ""}
                onChange={(e) => setDraft({ ...draft, mes: e.target.value })}
              />
            </label>
          )}
          {draft.modo === "periodo" && (
            <>
              <label className="text-sm">
                Data inicial
                <input
                  aria-label="Data inicial"
                  className={field}
                  type="date"
                  value={draft.inicio || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, inicio: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Data final
                <input
                  aria-label="Data final"
                  className={field}
                  type="date"
                  value={draft.fim || ""}
                  onChange={(e) => setDraft({ ...draft, fim: e.target.value })}
                />
              </label>
            </>
          )}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="rbk-primary min-h-11 rounded-xl px-5 py-2 text-sm"
              type="submit"
            >
              {busy ? "Aguarde…" : "Pesquisar autorizações"}
            </button>
            <button className={button} type="button" onClick={clearSearch}>
              Limpar pesquisa
            </button>
          </div>
        </fieldset>
        <p className="mt-3 text-sm text-gray-500">
          Informe pelo menos um filtro. A seleção é mantida ao pesquisar outros
          CPFs, autorizações ou datas.
        </p>
        {applied && (
          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
            Pesquisa aplicada: {descricao(applied.filtros)}
          </p>
        )}
      </form>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        className={
          status ? "mb-4 rounded-xl bg-blue-50 p-4 text-sm" : "sr-only"
        }
      >
        {status}
      </p>
      <section className="rbk-card mb-5 p-5" aria-label="Seleção acumulada">
        <h2 className="font-semibold">{count} autorizações selecionadas</h2>
        <p className="mt-1 text-sm text-gray-500">
          Você pode reunir autorizações de dias e meses diferentes.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            className={button}
            disabled={busy || !count}
            onClick={() => void prepareReport("selecao")}
          >
            Gerar PDF das selecionadas
          </button>
          <button
            type="button"
            className={button}
            disabled={busy || !count}
            onClick={() => setSelected({})}
          >
            Limpar seleção
          </button>
        </div>
        {count > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm">
              Conferir seleção
            </summary>
            <ul className="mt-2 space-y-2">
              {Object.values(selected).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 text-sm"
                >
                  <span>
                    {numero(r.numero_autorizacao)} · {data(r.data_autorizacao)}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-red-700"
                    aria-label={`Remover autorização ${numero(r.numero_autorizacao)} da seleção`}
                    onClick={() => toggle(r)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {report && (
        <section className="rbk-card mb-5 p-5" aria-label="Relatório em PDF">
          <h2 className="text-lg font-semibold">
            Relatório: {report.rows.length} autorizações
          </h2>
          <p className="mt-1 text-sm">{report.title}</p>
          <a
            className="mt-3 inline-block text-red-700 underline"
            href={report.listUrl}
            download="autorizacoes-listagem.pdf"
          >
            Baixar listagem geral (PDF)
          </a>
          <p className="mt-3 text-sm text-gray-500">
            Documentos em partes: gere e baixe uma parte de cada vez. Partes
            anteriores podem ser geradas novamente.
          </p>
          {report.ready && (
            <div className="mt-3 rounded-xl bg-green-50 p-3">
              <a
                className="text-green-900 underline"
                href={report.ready.url}
                download={`autorizacoes-parte-${report.ready.id.replaceAll(".", "-")}.pdf`}
              >
                Baixar PDF com documentos — parte {report.ready.id}
              </a>
              {report.ready.notice && (
                <p className="mt-2 text-sm">{report.ready.notice}</p>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            {report.parts.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                className={button}
                onClick={() => void preparePart(p)}
              >
                {report.generated.includes(p.id)
                  ? "Gerar novamente"
                  : "Gerar PDF"}{" "}
                parte {p.id} ({p.rows.length} autorizações)
              </button>
            ))}
          </div>
        </section>
      )}
      {applied && (
        <section aria-label="Resultados da pesquisa">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                Autorizações encontradas
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {total} autorização(ões) encontrada(s).{" "}
                {total > 0 &&
                  `Exibindo ${page * 20 + 1} a ${Math.min(page * 20 + rows.length, total)}.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={button}
                disabled={busy || !rows.length}
                onClick={() =>
                  setSelected((previous) => ({
                    ...previous,
                    ...Object.fromEntries(rows.map((r) => [r.id, r])),
                  }))
                }
              >
                Selecionar página
              </button>
              <button
                type="button"
                className={button}
                disabled={busy || !total}
                onClick={() => void prepareReport("pesquisa")}
              >
                Gerar PDF da pesquisa
              </button>
            </div>
          </div>
          {pagination()}
          {!rows.length && (
            <p className="rbk-card p-6 text-gray-500">
              Nenhuma autorização encontrada para os filtros informados.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <article className="rbk-card p-5" key={r.id}>
                <label className="flex items-start gap-3">
                  <input
                    className="mt-1 h-5 w-5"
                    type="checkbox"
                    checked={Boolean(selected[r.id])}
                    disabled={busy}
                    onChange={() => toggle(r)}
                    aria-label={`Selecionar autorização ${numero(r.numero_autorizacao)}`}
                  />
                  <span>
                    <span className="block text-xs uppercase text-gray-500">
                      Autorização
                    </span>
                    <span className="mt-1 block text-lg font-semibold">
                      {numero(r.numero_autorizacao)}
                    </span>
                  </span>
                </label>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">CPF do cliente</dt>
                    <dd>{cpf(r.cpf_cliente)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Data</dt>
                    <dd>{data(r.data_autorizacao)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">Farmácia</dt>
                    <dd>{nomeFarmacia || r.farmacia || "Não informada"}</dd>
                  </div>
                  {r.observacao && <div className="sm:col-span-2"><dt className="text-gray-500">Observação</dt><dd className="break-words">{r.observacao}</dd></div>}
                </dl>
                <Link
                  className="mt-5 inline-block text-sm text-red-700 underline"
                  href={`/autorizacoes/${r.id}/documentos`}
                >
                  Conferir documentação →
                </Link>
              </article>
            ))}
          </div>
          {total > 20 && pagination()}
        </section>
      )}
    </section>
  );
}
