"use client";
import { useEffect, useRef, useState } from "react";
import { RbkBrand } from "../../../components/RbkBrand";
import { portalApi } from "../../../lib/auditoria/client";
import { contentHash, sendFile } from "../../../lib/auditoria/upload";
import {
  bytes,
  date,
  MIME,
  MAX_FILE,
  type ManifestFile,
  type Summary,
} from "../../../lib/auditoria/domain";
import "../../processos/auditorias/auditoria.css";
type Draft = {
  key: string;
  files: ManifestFile[];
  batch?: { id: string; number: number };
};
export default function Portal() {
  const [token, setToken] = useState(""),
    [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<File[]>([]),
    [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<Record<string, number>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null),
    storageKey = useRef("");
  useEffect(() => {
    let alive = true;
    const changedLink = () => window.location.reload();
    window.addEventListener("hashchange", changedLink);
    void Promise.resolve().then(async () => {
      if (!alive) return;
      const t = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(t)) {
        setError("Link inválido. Solicite seu link de envio à RBK.");
        return;
      }
      setToken(t);
      storageKey.current =
        "rbk-aud-draft:" + (await contentHash(new Blob([t])));
      try {
        const cached = localStorage.getItem(storageKey.current);
        if (cached) setDraft(JSON.parse(cached));
      } catch {}
      try {
        setSummary(await portalApi(t, "summary"));
      } catch (e) {
        setError((e as Error).message);
      }
    });
    return () => {
      alive = false;
      window.removeEventListener("hashchange", changedLink);
      abort.current?.abort();
    };
  }, []);
  function save(d: Draft | null) {
    setDraft(d);
    try {
      if (d) localStorage.setItem(storageKey.current, JSON.stringify(d));
      else localStorage.removeItem(storageKey.current);
    } catch {
      setNotice(
        "Armazenamento local indisponível: mantenha esta página aberta para retomar.",
      );
    }
  }
  async function refresh() {
    setSummary(await portalApi(token, "summary"));
  }
  async function finish(d: Draft) {
    await portalApi(token, "complete", { batch_id: d.batch!.id });
    save(null);
    setSelected([]);
    if (fileInput.current) fileInput.current.value = "";
    setProgress({});
    setNotice(
      "Documentos recebidos. Seu comprovante está no histórico abaixo.",
    );
    await refresh();
  }
  async function submit() {
    setBusy(true);
    setError("");
    setNotice("");
    abort.current = new AbortController();
    let active = draft;
    try {
      if (!selected.length)
        throw new Error("Selecione os arquivos que deseja enviar ou retomar.");
      if (selected.length > 100)
        throw new Error("Selecione até 100 arquivos por lote.");
      const manifest: ManifestFile[] = [];
      for (const file of selected) {
        const mime = MIME[file.name.split(".").pop()?.toLowerCase() || ""];
        if (!mime || file.size < 1 || file.size > MAX_FILE)
          throw new Error(
            "Aceitos PDF, JPG, PNG e TIFF de até 100 MB cada. ZIP não é aceito.",
          );
        manifest.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          mime,
          fingerprint: await contentHash(file),
        });
      }
      if (active) {
        if (
          active.files.length !== manifest.length ||
          active.files.some(
            (f) =>
              !manifest.some(
                (m) => m.fingerprint === f.fingerprint && m.name === f.name,
              ),
          )
        )
          throw new Error(
            "Para retomar, selecione os mesmos arquivos do lote pendente.",
          );
      } else {
        active = { key: crypto.randomUUID(), files: manifest };
        save(active);
      }
      if (!active.batch) {
        const b = await portalApi(token, "begin", {
          key: active.key,
          files: active.files,
        });
        active = { ...active, batch: { id: b.id, number: b.number } };
        save(active);
      }
      for (const f of active.files) {
        if (abort.current.signal.aborted) throw new Error("Envio pausado.");
        const file =
          selected[manifest.findIndex((m) => m.fingerprint === f.fingerprint)]!;
        try {
          const ticket = await portalApi(token, "ticket", { file_id: f.id });
          if (ticket.exists) {
            setProgress((p) => ({ ...p, [f.id]: f.size }));
            continue;
          }
          await sendFile(
            file,
            ticket,
            (n) => setProgress((p) => ({ ...p, [f.id]: n })),
            abort.current.signal,
          );
        } catch (e) {
          void portalApi(token, "failure", { file_id: f.id }).catch(() => {});
          throw e;
        }
      }
      await finish(active);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const total =
      draft?.files.reduce((n, f) => n + f.size, 0) ||
      selected.reduce((n, f) => n + f.size, 0),
    sent = Object.values(progress).reduce((a, b) => a + b, 0);
  const closed = summary?.audit.collection === "closed";
  return (
    <main className="aud-shell">
      <header className="aud-top">
        <div>
          <div className="aud-brand">
            <RbkBrand compact />
          </div>
          <span className="aud-secure">Portal de documentos</span>
        </div>
      </header>
      <div className="aud-content aud-public">
        <p className="aud-eyebrow">AUDITORIA • FARMÁCIA POPULAR</p>
        <h1 className="aud-portal-title">Seus documentos em um só lugar</h1>
        <p className="aud-lead">
          Envie aos poucos e volte a este mesmo link quando precisar.
        </p>
        {error && (
          <div role="alert" className="aud-alert">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="aud-notice">
            {notice}
          </div>
        )}
        {summary && (
          <>
            <section className="aud-card">
              <div className="aud-row">
                <div>
                  <h2>{summary.audit.pharmacy}</h2>
                  <p>
                    CNPJ {summary.audit.cnpj} · {summary.audit.reference}
                  </p>
                </div>
                <span className={`aud-badge ${closed ? "" : "green"}`}>
                  {closed ? "Coleta encerrada" : "Recebendo documentos"}
                </span>
              </div>
              <div className="aud-metrics">
                <div>
                  <strong>{summary.total_files}</strong>
                  <span>Arquivos recebidos</span>
                </div>
                <div>
                  <strong>{bytes(summary.total_bytes)}</strong>
                  <span>Total acumulado</span>
                </div>
                <div>
                  <strong className="aud-date">
                    {date(summary.last_received)}
                  </strong>
                  <span>Último envio</span>
                </div>
              </div>
            </section>
            {!closed ? (
              <section className="aud-card">
                <h2>
                  {draft?.batch
                    ? `Continuar lote ${draft.batch.number}`
                    : "+ Adicionar documentos"}
                </h2>
                <p>
                  PDF, JPG, PNG ou TIFF. Até 100 MB por arquivo e 100 arquivos
                  por lote. Se estiverem em ZIP, descompacte antes de selecionar
                  os arquivos.
                </p>
                {draft && (
                  <p className="aud-notice">
                    Há um envio pendente. Selecione novamente os mesmos{" "}
                    {draft.files.length} arquivos para retomar.
                    {draft.batch
                      ? ""
                      : " Se nenhum arquivo foi reservado, você pode revisar a seleção."}
                  </p>
                )}
                <label className="aud-drop">
                  <strong>1. Selecione os documentos para conferência</strong>
                  <span className="aud-upload-help">Clique no botão abaixo. Você pode escolher vários arquivos de uma vez.</span>
                  <input
                    ref={fileInput}
                    aria-label="Selecionar documentos"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                    multiple
                    disabled={busy}
                    onChange={(e) => {
                      setSelected(Array.from(e.target.files || []));
                      setError("");
                    }}
                  />
                </label>
                <p>
                  {selected.length} arquivo(s) selecionado(s) · {bytes(total)}
                </p>
                {!draft && selected.length > 0 && <ul className="aud-selected-files" aria-label="Arquivos selecionados">{selected.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} · {bytes(file.size)}</li>)}</ul>}
                {draft && (
                  <div className="aud-file-list">
                    {draft.files.map((f) => (
                      <div key={f.id}>
                        <div className="aud-row">
                          <span>{f.name}</span>
                          <span>
                            {Math.round(((progress[f.id] || 0) / f.size) * 100)}
                            %
                          </span>
                        </div>
                        <progress
                          aria-label={`Progresso ${f.name}`}
                          max={f.size}
                          value={progress[f.id] || 0}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {total > 0 && (
                  <>
                    <progress
                      aria-label="Progresso geral"
                      max={total}
                      value={sent}
                    />
                    <p>
                      {bytes(sent)} de {bytes(total)}
                    </p>
                  </>
                )}
                <div className="aud-actions">
                  <button
                    className="aud-primary"
                    onClick={() => void submit()}
                    disabled={busy || !selected.length}
                  >
                    {busy
                      ? "Enviando…"
                      : draft
                        ? "Retomar envio"
                        : "Enviar documentos"}
                  </button>
                  {busy && (
                    <button onClick={() => abort.current?.abort()}>
                      Pausar envio
                    </button>
                  )}
                  {draft?.batch && !busy && (
                    <button
                      onClick={() => {
                        setBusy(true);
                        void finish(draft)
                          .catch((e) => setError(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Verificar recebimento
                    </button>
                  )}
                  {draft && !draft.batch && !busy && (
                    <button
                      onClick={() => {
                        save(null);
                        setError("");
                      }}
                    >
                      Revisar seleção
                    </button>
                  )}
                </div>
                <small>
                  Mantenha os arquivos originais até ver o comprovante. Se
                  fechar esta página durante o envio, reabra o link neste
                  navegador e selecione os mesmos arquivos.
                </small>
              </section>
            ) : (
              <section className="aud-card">
                <h2>Recebimento encerrado</h2>
                <p>
                  Seu histórico continua disponível. Para enviar mais
                  documentos, peça à RBK a reabertura da coleta.
                </p>
              </section>
            )}
            <section className="aud-card">
              <div className="aud-row">
                <h2>Histórico de recebimento</h2>
                <button
                  onClick={() =>
                    void refresh().catch((e) => setError(e.message))
                  }
                >
                  Atualizar
                </button>
              </div>
              {!summary.batches.length ? (
                <p>
                  Nenhum lote concluído ainda. O comprovante aparece após o
                  recebimento de todos os arquivos do lote.
                </p>
              ) : (
                summary.batches.map((b) => (
                  <article className="aud-batch" key={b.id}>
                    <div className="aud-row">
                      <h3>Lote {String(b.number).padStart(2, "0")}</h3>
                      <span className="aud-badge green">Recebido</span>
                    </div>
                    <p>
                      {date(b.completed_at)} · {b.files.length} arquivos ·{" "}
                      {bytes(b.files.reduce((n, f) => n + f.size, 0))}
                    </p>
                    <details>
                      <summary>Arquivos e comprovante</summary>
                      <ul>
                        {b.files.map((f) => (
                          <li key={f.id}>
                            {f.filename} <span>{bytes(f.size)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="aud-protocol">{b.protocol}</p>
                      <p>
                        Comprovante interno RBK de recebimento. Não é protocolo
                        oficial do Ministério da Saúde e não confirma análise ou
                        autenticidade.
                      </p>
                      <button onClick={() => window.print()}>
                        Imprimir / Salvar comprovante
                      </button>
                    </details>
                  </article>
                ))
              )}
            </section>
          </>
        )}
        <footer>
          WhatsApp para conversar. RBK Digital para enviar documentos.
          <br />
          <small>
            Guarde este link com cuidado. Ele dá acesso ao histórico desta
            auditoria.
          </small>
        </footer>
      </div>
    </main>
  );
}
