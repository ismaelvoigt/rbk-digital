"use client";
import { formatCnpj, isCnpjCell } from "../../../lib/processos/cnpj";
import { useCallback, useEffect, useState } from "react";
import {
  fields,
  TYPES,
  NOTICE,
  summarize,
  type Ficha,
} from "../../../lib/processos/domain";
import {
  api,
  download,
  type Detail,
  type Version,
} from "../../../lib/processos/client";
const btn =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50";
const primary =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const tabs = [
  "Visão Geral",
  "Ficha de Cadastro",
  "Documentos",
  "Pré-análise",
  "Histórico",
];
export default function ProcessDetail({ id }: { id: string }) {
  const [state, setState] = useState<Detail | null>(null),
    [tab, setTab] = useState(tabs[0]),
    [ficha, setFicha] = useState<Ficha>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [dirty, setDirty] = useState(false);
  const refresh = useCallback(async () => {
    const d: Detail = await api(`/${id}`);
    setState(d);
    setFicha(d.process.ficha);
    setDirty(false);
    setConfirmed(false);
  }, [id]);
  useEffect(() => {
    let active = true;
    api(`/${id}`)
      .then((d: Detail) => {
        if (active) {
          setState(d);
          setFicha(d.process.ficha);
          setDirty(false);
          setConfirmed(false);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function action(
    label: string,
    work: () => Promise<unknown>,
    reload = true,
  ) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await work();
      if (reload) await refresh();
      setMessage("Operação concluída.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!state)
    return (
      <p role={error ? "alert" : undefined}>
        {error || "Carregando processo…"}
      </p>
    );
  const { process: p, versions, reviews, analyses, events } = state;
  const s = summarize(versions, reviews);
  const latest = analyses[0];
  const revisionBody = { confirmed, revision: p.revision };
  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-red-600">
          Credenciamento PFPB
        </p>
        <button type="button" className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={!!busy} onClick={() => {
 if (!window.confirm(`Excluir o processo de ${p.ficha.B22 || p.ficha.B21}? Ele sairá da carteira. Os documentos e o histórico serão preservados. Alterações não salvas serão descartadas.`)) return;
 void action('Excluindo processo', async () => { await api(`/${id}/cancel`, 'POST', {revision:p.revision, confirmed:true}); window.location.href='/processos/credenciamento'; }, false);
}}>Excluir processo</button><h1 className="mt-2 text-3xl font-bold">
          {p.ficha.B22 || p.ficha.B21}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          CNPJ {formatCnpj(p.ficha.B20 ?? "")} ·{" "}
          {p.formed_revision === p.revision
            ? "Processo formado"
            : "Em preparação"}
        </p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Áreas do processo">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? primary : btn}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-green-50 p-4 text-green-800"
        >
          {message}
        </p>
      )}
      {busy && (
        <p role="status" className="mb-4 text-gray-600">
          {busy}…
        </p>
      )}
      {tab === "Visão Geral" && (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [`${s.sent}/${TYPES.length}`, "Categorias enviadas"],
              [`${s.approved}/${TYPES.length}`, "Documentos aprovados"],
              [`${s.pending}`, "Pendências de revisão"],
            ].map(([n, l]) => (
              <div key={l} className="rbk-card p-5">
                <p className="text-3xl font-bold">{n}</p>
                <p className="text-sm text-gray-500">{l}</p>
              </div>
            ))}
          </div>
          <div className="rbk-card space-y-4 p-5">
            <h2 className="text-lg font-bold">Formação do processo</h2>
            <p className="text-sm text-gray-600">
              A formação exige aprovação humana das onze categorias na versão
              atual. Confira também a ficha, a integralidade dos documentos e as
              regras do checklist fornecido.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Conferi a ficha, os sócios aplicáveis e o preenchimento de
              número/vencimento de autorização ou licença. B37 será mantida
              vazia, sem interpretação automática.
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={primary}
                disabled={!!busy || !confirmed || s.approved !== TYPES.length || dirty}
                onClick={() =>
                  void action("Formando processo", () =>
                    api(`/${id}/form`, "POST", revisionBody),
                  )
                }
              >
                Formar processo
              </button>
              <button
                className={btn}
                disabled={
                  !!busy ||
                  !confirmed ||
                  p.formed_revision !== p.revision ||
                  dirty
                }
                onClick={() =>
                  void action(
                    "Gerando pacote",
                    () =>
                      download(
                        `/${id}/package`,
                        "Processo-PFPB.zip",
                        "POST",
                        revisionBody,
                      ),
                    false,
                  )
                }
              >
                Baixar processo formado
              </button>
            </div>
          </div>
        </section>
      )}
      {tab === "Ficha de Cadastro" && (
        <section className="space-y-5">
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Campos transcritos da ficha oficial. Asteriscos e quatro blocos de
            sócios foram preservados. O rótulo de autorização/licença é ambíguo:
            confira B38/B39 manualmente. Dados do anexo original não são
            reaproveitados.
          </div>
          {[...new Set(fields.map((f) => f.group))].map((group) => (
            <fieldset key={group} className="rbk-card p-5">
              <legend className="px-2 font-bold">{group}</legend>
              {group === "Regularidade e licença" && (
                <p className="mb-4 text-sm text-gray-600">
                  * AUTORIZAÇÃO DE FUNCIONAMENTO (ANVISA) OU ALVARÁ/LICENÇA
                  SANITÁRIA (SES/SMS)
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {fields
                  .filter((f) => f.group === group)
                  .map((f) => (
                    <label
                      key={f.cell}
                      className="text-xs font-semibold text-gray-600"
                    >
                      {f.label}
                      <input
                        type={f.type}
                        aria-label={`${f.group} — ${f.label}`}
                        maxLength={isCnpjCell(f.cell) ? 18 : 500} inputMode={isCnpjCell(f.cell) ? "numeric" : undefined} placeholder={isCnpjCell(f.cell) ? "00.000.000/0000-00" : undefined}
                        value={isCnpjCell(f.cell) ? formatCnpj(ficha[f.cell] ?? "") : ficha[f.cell] ?? ""}
                        onChange={(e) => {
                          setFicha({ ...ficha, [f.cell]: isCnpjCell(f.cell) ? formatCnpj(e.target.value) : e.target.value });
                          setDirty(true);
                          setConfirmed(false);
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm font-normal text-gray-900"
                      />
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          <p className="text-sm text-gray-600">
            O e-mail informado será usado para comunicação formal da CPFP com a
            empresa, conforme instrução da ficha.
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Conferi os campos e ambiguidades do modelo, inclusive sócios e
            autorização/licença.
          </label>
          <div className="flex gap-2">
            <button
              className={primary}
              disabled={!!busy || !dirty}
              onClick={() =>
                void action("Salvando ficha", () =>
                  api(`/${id}/ficha`, "PATCH", { ficha, revision: p.revision }),
                )
              }
            >
              Salvar ficha
            </button>
            <button
              className={btn}
              disabled={!!busy || dirty || !confirmed}
              onClick={() =>
                void action(
                  "Gerando ficha",
                  () =>
                    download(
                      `/${id}/xlsx`,
                      "Ficha-de-Cadastro.xlsx",
                      "POST",
                      revisionBody,
                    ),
                  false,
                )
              }
            >
              Gerar Ficha de Cadastro
            </button>
          </div>
          {dirty && (
            <p className="text-sm text-amber-800">Há alterações não salvas.</p>
          )}
        </section>
      )}
      {tab === "Documentos" && (
        <section className="space-y-4">
          <p className="text-sm text-gray-600">
            PDFs de até 20 MB, separados por categoria. Um PDF pode conter
            identidade e prova de representação. Substituições preservam o
            arquivo anterior e exigem nova revisão.
          </p>
          {TYPES.map(([kind, label]) => {
            const v = versions.find((x) => x.kind === kind);
            const review = v
              ? reviews.find((r) => r.version_id === v.id)
              : undefined;
            return (
              <DocumentCard
                key={kind}
                label={label}
                kind={kind}
                version={v}
                status={review?.decision ?? (v ? "Enviado" : "Pendente")}
                observation={review?.observation}
                versions={versions.filter((x) => x.kind === kind)}
                disabled={!!busy}
                run={action}
                id={id}
              />
            );
          })}
          <p className="text-xs text-gray-500">
            Fonte: checklist fornecido “Documentos para Credenciamento -
            PFPB.pdf”. Ele exige autenticação cartorial quando não há validação
            eletrônica. A verificação dessa condição permanece humana.
          </p>
        </section>
      )}
      {tab === "Pré-análise" && (
        <section className="space-y-4">
          <div className="rbk-card p-5">
            <h2 className="font-bold">Motor de Conferência Cadastral RBK</h2>
            <p className="my-3 text-sm text-gray-600">
              Leitura local por OCR e regras de comparação. Documentos ruins,
              abreviações e identificação de emissores podem causar
              divergências. A análise não aprova nem solicita substituição.
            </p>
            <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {NOTICE}
            </p>
            <button
              className={primary}
              disabled={!!busy || dirty}
              onClick={() =>
                void action(
                  "Executando pré-análise local — pode levar alguns minutos",
                  () => api(`/${id}/analysis`, "POST", {}),
                )
              }
            >
              Executar pré-análise
            </button>
          </div>
          {latest && (
            <>
              <p className="text-sm">
                {new Date(latest.created_at).toLocaleString("pt-BR")} ·{" "}
                {latest.result.result}
                {latest.revision !== p.revision && (
                  <strong className="ml-2 text-amber-800">
                    Desatualizada — ficha ou documentos alterados
                  </strong>
                )}
              </p>
              {latest.result.documents.map((d) => (
                <div key={d.kind} className="rbk-card space-y-3 p-5">
                  <h3 className="font-bold">{d.label}</h3>
                  <p className="text-sm font-semibold text-amber-800">
                    {d.result}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {d.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p>QR Code: {d.elements.qr}</p>
                    <p>Código verificador: {d.elements.code}</p>
                    <p>
                      Indício de autenticação cartorial: {d.elements.notary}
                    </p>
                    <p>
                      Assinatura eletrônica/digital:{" "}
                      {d.elements.signature === "Detectado"
                        ? "Detectada"
                        : "Não detectada"}
                    </p>
                  </div>
                  {d.evidence.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold">
                        Evidências extraídas ({d.evidence.length})
                      </summary>
                      <table className="mt-3 w-full text-left text-xs">
                        <thead>
                          <tr>
                            <th>Campo</th>
                            <th>Texto extraído</th>
                            <th>Página</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.evidence.map((e, i) => (
                            <tr key={i} className="border-t">
                              <td className="py-2">{e.field}</td>
                              <td className="break-words py-2">{e.value}</td>
                              <td>{e.page}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              ))}
            </>
          )}
          {!latest && (
            <p className="text-sm text-gray-500">
              Nenhuma pré-análise executada.
            </p>
          )}
        </section>
      )}
      {tab === "Histórico" && (
        <section className="rbk-card divide-y p-5">
          {events.map((e) => (
            <div key={e.id} className="py-4">
              <p className="font-semibold">{e.action}</p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(e.created_at).toLocaleString("pt-BR")} · Usuário{" "}
                {e.actor_id}
              </p>
              {typeof e.detail.decision === "string" && (
                <p className="text-sm">{e.detail.decision}</p>
              )}
            </div>
          ))}
          <h2 className="pt-4 font-semibold">Decisões e observações</h2>
          {reviews.map((r) => (
            <div key={r.id} className="py-3 text-sm">
              <p>
                {r.decision} · Versão {r.version_id}
              </p>
              <p className="whitespace-pre-wrap">{r.observation}</p>
              <p className="text-xs text-gray-500">
                {r.decided_by} ·{" "}
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function DocumentCard({
  label,
  kind,
  version,
  status,
  observation,
  versions,
  disabled,
  run,
  id,
}: {
  label: string;
  kind: string;
  version?: Version;
  status: string;
  observation?: string;
  versions: Version[];
  disabled: boolean;
  run: (
    label: string,
    fn: () => Promise<unknown>,
    reload?: boolean,
  ) => Promise<void>;
  id: string;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="rbk-card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{label}</h2>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
          {status === "Substituir"
            ? "Requer substituição — decisão do Gestor"
            : status}
        </span>
      </div>
      {version && (
        <p className="text-sm text-gray-600">
          {version.filename} ·{" "}
          {new Date(version.created_at).toLocaleString("pt-BR")}
        </p>
      )}
      {observation && (
        <p className="text-sm">Última observação: {observation}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={btn}>
          {version ? "Substituir PDF" : "Enviar PDF"}
          <input
            aria-label={`${version ? "Substituir" : "Enviar"} ${label}`}
            type="file"
            accept="application/pdf"
            className="mt-2 block max-w-full text-xs"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const form = new FormData();
                form.set("kind", kind);
                form.set("file", file);
                void run("Enviando documento", () =>
                  api(`/${id}/upload`, "POST", form),
                );
              }
              e.target.value = "";
            }}
          />
        </label>
        {version && (
          <button
            className={btn}
            disabled={disabled}
            onClick={() =>
              void run(
                "Abrindo documento",
                async () => {
                  const blob = await api(
                    `/${id}/document/${version.id}`,
                    "GET",
                    undefined,
                    true,
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                },
                false,
              )
            }
          >
            Visualizar PDF
          </button>
        )}
      </div>
      {version && (
        <>
          <label className="block text-sm">
            Observação da revisão
            <textarea
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["Aprovado", "Aprovar"],
              ["Substituir", "Solicitar substituição"],
              ["Em análise", "Marcar para conferência"],
            ].map(([decision, text]) => (
              <button
                key={decision}
                className={decision === "Aprovado" ? primary : btn}
                disabled={
                  disabled ||
                  (decision !== "Aprovado" && note.trim().length < 3)
                }
                onClick={() =>
                  void run("Registrando revisão", () =>
                    api(`/${id}/review`, "POST", {
                      version_id: version.id,
                      decision,
                      observation: note,
                    }),
                  )
                }
              >
                {text}
              </button>
            ))}
          </div>
        </>
      )}
      {versions.length > 1 && (
        <details>
          <summary className="text-sm">
            Versões anteriores ({versions.length - 1})
          </summary>
          {versions.slice(1).map((v) => (
            <button
              key={v.id}
              className="mr-3 mt-2 text-xs text-red-700 underline"
              onClick={() =>
                void run(
                  "Baixando versão",
                  () => download(`/${id}/document/${v.id}`, v.filename),
                  false,
                )
              }
            >
              {new Date(v.created_at).toLocaleString("pt-BR")}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}
