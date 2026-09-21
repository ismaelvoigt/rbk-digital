"use client";
import { GestorNavigation } from "../../../components/GestorNavigation";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { RbkBrand } from "../../../components/RbkBrand";
import { formatCnpj, normalizeCnpj } from "../../../lib/auditoria/cnpj";
import { useSearchParams, useRouter } from "next/navigation";
import { managerApi } from "../../../lib/auditoria/client";
import { bytes, date, type Summary } from "../../../lib/auditoria/domain";
import "./auditoria.css";
import ContactMessages from "./contact-messages";
import OfficeAttachment from "./office-attachment";
import PortalQr from "./portal-qr";
import { uploadOffice, validateOffice } from "../../../lib/auditoria/office";
import ReceiptReport, { Occurrences } from "./receipt-report";
const tabs = [
  "Visão geral",
  "Autorizações",
  "Ocorrências",
  "Relatório",
];
const events: Record<string, string> = {
  audit_confirmed: "Cadastro confirmado e link gerado",
  contact_updated: "Contato de envio atualizado",
  pharmacy_registered: "Farmácia cadastrada e vinculada ao Gestor",
  audit_created: "Auditoria criada",
  office_begin: "Envio de ofício iniciado",
  office_complete: "Ofício recebido",
  link: "Link gerado / renovado",
  revoke: "Link revogado",
  close: "Coleta encerrada",
  reopen: "Coleta reaberta",
  portal_access: "Acesso ao portal",
  batch_started: "Lote iniciado",
  batch_completed: "Lote concluído",
  file_received: "Arquivo recebido",
  upload_failure: "Falha no envio",
  upload_ticket: "Envio autorizado",
  download: "Download solicitado",
  scan_clean: "Verificação de segurança concluída",
  scan_infected: "Arquivo bloqueado",
  scan_error: "Verificação pendente",
};
export default function Audits() {
  const params = useSearchParams(),
    router = useRouter(),
    id = params.get("id");
  const [items, setItems] = useState<Summary[]>([]),
    [detail, setDetail] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [tab, setTab] = useState(tabs[0]),
    [link, setLink] = useState(""),
    [page, setPage] = useState(0);
  const [report, setReport] = useState<{detail:Summary; generatedAt:string}|null>(null);
  async function generateReport() {
    setBusy(true); setError("");
    try {
      const fresh:Summary = await managerApi(`/${id}`);
      setDetail(fresh); setReport({detail:fresh,generatedAt:new Date().toISOString()}); setTab("Relatório");
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const createdLink = useRef<{ id: string; url: string } | null>(null);
  const [officeNotice, setOfficeNotice] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchCnpj, setSearchCnpj] = useState("");
  const [removeCandidate, setRemoveCandidate] = useState<Summary | null>(null);
  const [removedNotice, setRemovedNotice] = useState("");
  const [officeProgress, setOfficeProgress] = useState(0);
  const [usage, setUsage] = useState<
    { pharmacy: string; period: string; bytes: number; files: number }[]
  >([]);
  const load = useCallback(async () => {
    setError("");
    try {
      if (id) setDetail(await managerApi(`/${id}`));
      else {
        const [list, u] = await Promise.all([
          managerApi(`?page=${page}&cnpj=${encodeURIComponent(searchCnpj)}`),
          managerApi("/usage"),
        ]);
        setItems(list);
        setUsage(u);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, page, searchCnpj]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setDetail(null);
      setLink(createdLink.current?.id === id ? createdLink.current.url : "");
      void load();
    });
    return () => {
      alive = false;
    };
  }, [load, id]);
  async function act(action: string, payload: object = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await managerApi(`/${id}/${action}`, "POST", payload);
      if (result.url) {
        if (action === "link" || action === "confirm") setLink(result.url);
        else window.location.assign(result.url);
      }
      if (action === "revoke") setLink("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createAudit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(normalizeCnpj(cnpj))) throw new Error("Informe o CNPJ completo: 14 caracteres, no formato 00.000.000/0000-00.");
      const office = form.get("office");
      if (!(office instanceof File) || !office.size) throw new Error("Anexe o ofício para criar a auditoria.");
      validateOffice(office);
      const a = await managerApi("", "POST", {
        new_farm: { name: form.get("pharmacy_name"), cnpj: form.get("cnpj") },
        contact: { email: form.get("email"), phone: form.get("phone") },
        reference: "Auditoria PFPB",
        requested: null,
        deadline: null,
        notes: "",
      });
      if (office instanceof File && office.size) {
        try {
          await uploadOffice(a.id, office, (n) =>
            setOfficeProgress(Math.round((n / office.size) * 100)),
          );
          const confirmed = await managerApi(`/${a.id}/confirm`, "POST", {});
          if (confirmed.url) createdLink.current = { id: a.id, url: confirmed.url };
          setOfficeNotice("Auditoria confirmada e link gerado. E-mail e WhatsApp não enviados: envio automático ainda não ativado neste portal.");
        } catch (e) {
          setOfficeNotice(
            "Cadastro salvo, mas a confirmação não foi concluída: " +
              (e as Error).message,
          );
        }
      }
      setCreate(false);
      router.push(`/processos/auditorias?id=${a.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeEmptyAudit() {
    if (!removeCandidate || busy) return;
    setBusy(true);
    setError("");
    try {
      await managerApi(`/${removeCandidate.audit.id}/delete_empty`, "POST", {});
      setRemoveCandidate(null);
      setRemovedNotice("Auditoria excluída da carteira. O link de envio foi invalidado.");
      if (items.length === 1 && page > 0) setPage(page - 1);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="aud-shell">
      <header className="aud-top">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <div>
            <div className="aud-brand">
              <RbkBrand compact />
            </div>
            <span className="aud-secure">Gestor RBK · Processos</span>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ← Voltar ao Dashboard
          </Link>
        </div>
      </header>
      <GestorNavigation home="https://rbk-digital.vercel.app/dashboard" />
      <div className="aud-content">
        <p className="aud-eyebrow">
          <Link href="/dashboard">GESTOR RBK</Link> /{" "}
          <Link href="/processos/auditorias">AUDITORIAS PFPB</Link>
        </p>
        <div className="aud-row">
          <div>
            <h1>
              {id
                ? detail?.audit.pharmacy || "Auditoria"
                : "Auditorias recebidas"}
            </h1>
            <p className="aud-lead">
              {id
                ? "Documentos organizados por envio, com histórico preservado."
                : "Acompanhe a coleta de documentos das suas farmácias."}
            </p>
          </div>
          {!id && (
            <button className="aud-primary" onClick={() => setCreate(!create)}>
              + Nova auditoria
            </button>
          )}
        </div>
        <small>
          Homologação · Conferência automática das autorizações ainda não está ativa.
        </small>
        {error && (
          <div role="alert" className="aud-alert">
            {error}
          </div>
        )}
        {officeNotice && (
          <div className="aud-alert" role="status">
            {officeNotice}
          </div>
        )}
        {!id && (
          <>
            {create && (
              <form className="aud-card" onSubmit={createAudit}>
                <h2>Nova auditoria</h2>
                <div className="aud-grid">
                  <label>
                    Razão social
                    <input name="pharmacy_name" required minLength={3} maxLength={200} disabled={busy} />
                  </label>
                  <label>
                    CNPJ
                    <input name="cnpj" required maxLength={18} minLength={18} placeholder="00.000.000/0000-00" autoCapitalize="characters" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} disabled={busy} aria-describedby="cnpj-hint" />
                    <small id="cnpj-hint">14 caracteres; pontos, barra e hífen são preenchidos automaticamente.</small>
                  </label>
                </div>
                <div className="aud-grid">
                  <label>E-mail do cliente<input name="email" type="email" required maxLength={254} disabled={busy} autoComplete="email" /></label>
                  <label>Celular / WhatsApp<input name="phone" type="tel" required maxLength={40} placeholder="(DDD) 99999-9999" disabled={busy} autoComplete="tel" /></label>
                </div>
                <small>Ao confirmar, o link será gerado com validade de 40 dias. Em homologação, e-mail e WhatsApp ainda não são enviados: envio automático ainda não ativado neste portal.</small>
                <label className="aud-drop">
                  <strong>Anexar ofício (obrigatório)</strong>
                  <span className="aud-upload-help">Selecione o ofício recebido do Farmácia Popular no botão abaixo.</span>
                  <input
                    name="office"
                    required
                    type="file"
                    accept=".pdf,.html,.htm,.jpg,.jpeg,.png,.tif,.tiff"
                    disabled={busy}
                  />
                  <small>
                    PDF, HTML ou imagem, até 100 MB.
                  </small>
                </label>
                {busy && (
                  <p role="status">
                    Salvando auditoria e anexo…{" "}
                    {officeProgress > 0 ? `${officeProgress}%` : ""}
                  </p>
                )}
                <div className="aud-actions">
                  <button className="aud-primary" disabled={busy}>
                    Criar auditoria
                  </button>
                  <button type="button" onClick={() => setCreate(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            <section className="aud-card">
              <div className="aud-row">
                <h2>Carteira de auditorias</h2>
                <button onClick={() => void load()}>Atualizar</button>
              </div>
              {removedNotice && <p role="status">{removedNotice}</p>}
              <form className="aud-actions aud-search" onSubmit={(e) => { e.preventDefault(); setPage(0); setSearchCnpj(normalizeCnpj(searchDraft)); setRemoveCandidate(null); }}>
                <label>Pesquisar por CNPJ
                  <input value={searchDraft} maxLength={18} placeholder="00.000.000/0000-00" autoCapitalize="characters" onChange={(e) => setSearchDraft(formatCnpj(e.target.value))} />
                </label>
                <button type="submit">Pesquisar</button>
                {(searchDraft || searchCnpj) && <button type="button" onClick={() => { setSearchDraft(""); setSearchCnpj(""); setPage(0); setRemoveCandidate(null); }}>Limpar</button>}
              </form>
              {removeCandidate && (
                <div className="aud-card aud-delete-warning" role="region" aria-label="Confirmar exclusão">
                  <h3>Excluir auditoria de {removeCandidate.audit.pharmacy}?</h3>
                  <p>Ela sairá da carteira e seu link será invalidado. O cadastro da farmácia, o ofício e o histórico serão preservados. Só é possível excluir se a farmácia não iniciou nenhum envio.</p>
                  <div className="aud-actions">
                    <button className="aud-delete-confirm" disabled={busy} onClick={() => void removeEmptyAudit()}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button>
                    <button disabled={busy} onClick={() => setRemoveCandidate(null)}>Cancelar</button>
                  </div>
                </div>
              )}
              <div className="aud-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Farmácia",
                        "Referência",
                        "Arquivos",
                        "Tamanho",
                        "Último envio",
                        "Coleta",
                        "Processamento",
                        "Status",
                        "Ações",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.audit.id}>
                        <td>
                          <Link href={`/processos/auditorias?id=${s.audit.id}`}>
                            {s.audit.pharmacy}
                          </Link>
                          <small>{formatCnpj(s.audit.cnpj)}</small>
                        </td>
                        <td>{s.audit.reference}</td>
                        <td>{s.total_files}</td>
                        <td>{bytes(s.total_bytes)}</td>
                        <td>{date(s.last_received)}</td>
                        <td>
                          <span
                            className={`aud-badge ${s.audit.collection === "open" ? "green" : ""}`}
                          >
                            {s.audit.collection === "open"
                              ? "Recebendo"
                              : "Encerrada"}
                          </span>
                        </td>
                        <td>Não iniciado</td>
                        <td>
                          {s.total_files
                            ? "Aguardando conferência"
                            : "Aguardando envio"}
                        </td>
                        <td>
                          {s.can_delete === true ? (
                            <button disabled={busy} aria-label={`Excluir auditoria de ${s.audit.pharmacy}`} onClick={() => { setRemovedNotice(""); setRemoveCandidate(s); }}>Excluir</button>
                          ) : <small>Exclusão bloqueada: envio iniciado</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!items.length && (
                <div className="aud-empty">
                  {searchCnpj ? "Nenhuma auditoria encontrada para este CNPJ." : "Nenhuma auditoria nesta página. Crie uma auditoria para gerar o link de envio."}
                </div>
              )}
              <div className="aud-actions">
                <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </button>
                <span>Página {page + 1}</span>
                <button
                  disabled={items.length < 50}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
            </section>
            {!!usage.length && (
              <section className="aud-card">
                <h2>Armazenamento recebido por farmácia e mês</h2>
                <small>
                  Inclui lotes concluídos e ofícios recebidos. Objetos parciais e tráfego
                  devem ser conferidos também no painel do Storage.
                </small>
                <div className="aud-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Farmácia</th>
                        <th>Mês</th>
                        <th>Arquivos</th>
                        <th>Tamanho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.map((u, i) => (
                        <tr key={i}>
                          <td>{u.pharmacy}</td>
                          <td>{u.period}</td>
                          <td>{u.files}</td>
                          <td>{bytes(u.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
        {detail && (
          <>
            <section className="aud-card">
              <div className="aud-row">
                <div>
                  <h2>{detail.audit.reference}</h2>
                  <p>CNPJ {formatCnpj(detail.audit.cnpj)}</p>
                </div>
                <span
                  className={`aud-badge ${detail.audit.collection === "open" ? "green" : ""}`}
                >
                  {detail.audit.collection === "open"
                    ? "Recebendo documentos"
                    : "Coleta encerrada / Em análise"}
                </span>
              </div>
              <div className="aud-metrics">
                <div>
                  <strong>{detail.total_files}</strong>
                  <span>Arquivos recebidos</span>
                </div>
                <div>
                  <strong>{bytes(detail.total_bytes)}</strong>
                  <span>Armazenamento recebido</span>
                </div>
                <div>
                  <strong className="aud-date">
                    {date(detail.last_received)}
                  </strong>
                  <span>Último envio</span>
                </div>
              </div>
            </section>
            <nav className="aud-tabs" aria-label="Áreas da auditoria">
              {tabs.map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            {tab === "Visão geral" && (
              <>
                <OfficeAttachment
                  id={detail.audit.id}
                  files={detail.offices || []}
                  onRefresh={load}
                  onDownload={(file_id) => void act("download", { file_id })}
                />
                <section className="aud-link-panel" aria-label="Link de envio da farmácia">
                  <div className="aud-row">
                    <div>
                      <strong>Link de envio da farmácia</strong>
                      <small className="aud-link-status">
                        {detail.link
                          ? detail.link.revoked_at
                            ? "Revogado"
                            : `Validade: ${date(detail.link.expires_at)}`
                          : "Ainda não gerado"}
                        {" · Novos links: 40 dias"}
                      </small>
                    </div>
                  <div className="aud-actions">
                    <button
                      className="aud-primary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !detail.link ||
                          confirm(
                            "Renovar o link? O anterior deixará de funcionar.",
                          )
                        )
                          void act("link");
                      }}
                    >
                      {detail.link ? "Renovar link" : "Gerar link seguro"}
                    </button>
                    <button
                      className="aud-danger"
                      disabled={
                        busy || !detail.link || !!detail.link.revoked_at
                      }
                      onClick={() => {
                        if (confirm("Revogar o acesso por este link?"))
                          void act("revoke");
                      }}
                    >
                      Revogar link
                    </button>
                  </div>
                  </div>
                  {link && (
                    <div className="aud-link">
                      <PortalQr key={link + detail.audit.pharmacy} link={link} pharmacy={detail.audit.pharmacy} />
                    </div>
                  )}
                </section>
                {!detail.audit.confirmed_at && !detail.link && <button disabled={busy} onClick={() => void act("confirm")}>Concluir cadastro e gerar link</button>}
                <ContactMessages key={detail.audit.id} audit={detail.audit} link={link} expires={detail.link?.expires_at} onSave={(contact) => act("contact", contact)} />
                <section className="aud-card">
                  <h2>Histórico operacional</h2>
                  <ul>
                    {detail.events
                      ?.slice(-100)
                      .reverse()
                      .map((e) => (
                        <li key={e.id}>
                          {date(e.created_at)} — {events[e.event] || e.event}
                        </li>
                      ))}
                  </ul>
                </section>
              </>
            )}
            {tab === "Autorizações" && (
              <section className="aud-card">
                <div className="aud-row">
                  <h2>Autorizações · Documentos recebidos</h2>
                  <div className="aud-actions"><button disabled={busy} onClick={() => void load()}>Atualizar</button><button className="aud-primary" disabled={busy} onClick={() => void generateReport()}>{busy ? "Aguarde…" : "Gerar relatório"}</button></div>
                </div>
                {!detail.batches.length && <p>Aguardando o primeiro envio.</p>}
                {detail.batches.map((b) => (
                  <article className="aud-batch" key={b.id}>
                    <div className="aud-row">
                      <h3>Lote {b.number}</h3>
                      <span
                        className={`aud-badge ${b.completed_at ? "green" : ""}`}
                      >
                        {b.completed_at ? "Recebido" : "Em andamento"}
                      </span>
                    </div>
                    <p>
                      {date(b.completed_at || b.started_at)} · {b.files.length}{" "}
                      arquivos ·{" "}
                      {bytes(b.files.reduce((n, f) => n + f.size, 0))}
                    </p>
                    {b.protocol && <p className="aud-protocol">{b.protocol}</p>}
                    <div className="aud-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Arquivo</th>
                            <th>Tamanho</th>
                            <th>Segurança</th>
                            <th>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.files.map((f) => (
                            <tr key={f.id}>
                              <td>{f.filename}</td>
                              <td>{bytes(f.size)}</td>
                              <td>
                                {f.scan === "clean"
                                  ? "Verificado"
                                  : ["infected", "rejected"].includes(
                                        f.scan || "",
                                      )
                                    ? "Bloqueado"
                                    : "Quarentena"}
                              </td>
                              <td>
                                <button
                                  disabled={
                                    busy ||
                                    f.scan !== "clean" ||
                                    !b.completed_at
                                  }
                                  onClick={() =>
                                    void act("download", { file_id: f.id })
                                  }
                                >
                                  Download seguro
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
                <small>
                  Recebimento não significa autenticidade. Downloads são
                  liberados somente após verificação de segurança.
                </small>
              </section>
            )}
            {tab === "Ocorrências" && <Occurrences detail={detail} />}
            {tab === "Relatório" && (report?.detail.audit.id === detail.audit.id
              ? <ReceiptReport detail={report.detail} generatedAt={report.generatedAt} />
              : <section className="aud-card"><h2>Relatório</h2><p>Gere o relatório de recebimento na aba Autorizações. Ele reunirá os documentos recebidos e as pendências de recebimento identificadas.</p><button onClick={() => setTab("Autorizações")}>Ir para Autorizações</button></section>)}
          </>
        )}
        <footer>
          RBK Digital · Gestão documental com histórico de recebimento
        </footer>
      </div>
    </main>
  );
}
