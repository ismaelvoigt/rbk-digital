import { ProcessosCard } from "../../components/ProcessosCard";
import { RbkBrand } from "../../components/RbkBrand";
import "../processos/auditorias/auditoria.css";

export default function Dashboard() {
  return (
    <main className="aud-shell">
      <header className="aud-top"><div><RbkBrand compact /><div className="gestor-account"><span className="aud-secure">Gestor RBK</span></div></div></header>
      <div className="aud-content">
        <p className="aud-eyebrow">ÁREA DO GESTOR</p>
        <h1>Gestor RBK</h1>
        <p className="aud-lead">Organize os processos e acompanhe os documentos das suas farmácias.</p>
        <ProcessosCard />
      </div>
    </main>
  );
}
