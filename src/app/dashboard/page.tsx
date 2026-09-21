import Link from "next/link";
import { ProcessosCard } from "../../components/ProcessosCard";
import { RbkBrand } from "../../components/RbkBrand";
import LegacyDashboard from "./legacy-dashboard";
import "../processos/auditorias/auditoria.css";

export default function Dashboard() {
  if (process.env.AUDIT_STAGING_ONLY !== "true") return <LegacyDashboard />;
  return (
    <main className="aud-shell">
      <header className="aud-top"><div><RbkBrand compact /><div className="gestor-account"><span className="aud-secure">Gestor RBK</span><Link className="aud-secondary" href="https://rbk-digital.vercel.app/dashboard">← Voltar ao dashboard</Link></div></div></header>
      <div className="aud-content">
        <p className="aud-eyebrow">ÁREA DO GESTOR</p>
        <h1>Gestor RBK</h1>
        <p className="aud-lead">Organize os processos e acompanhe os documentos das suas farmácias.</p>
        <p className="aud-muted">Ambiente de homologação</p>
        <ProcessosCard />
      </div>
    </main>
  );
}
