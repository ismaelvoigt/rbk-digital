import Link from "next/link";
import "../app/processos/auditorias/auditoria.css";

export function ProcessosCard() {
  return (
        <section className="aud-card" aria-labelledby="processos-heading">
          <p className="aud-eyebrow">FARMÁCIA POPULAR</p>
          <h2 id="processos-heading">Processos</h2>
          <p className="aud-lead">Auditorias Farmácia Popular</p>
          <p>Cadastre a farmácia, anexe o ofício e compartilhe o link para receber os documentos. Acompanhe os envios na carteira de auditorias.</p>
          <div className="aud-actions" style={{ marginTop: 24 }}>
            <Link className="aud-primary" href="/processos/auditorias">Acessar processos →</Link>
          </div>
        <div className="aud-actions" style={{marginTop:16}}><Link className="aud-primary" href="/processos/credenciamento/convites">Credenciamento · Gerar convite →</Link></div></section>
  );
}
