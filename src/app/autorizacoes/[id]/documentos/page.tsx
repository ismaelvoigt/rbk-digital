"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { RbkBrand } from "../../../../components/RbkBrand";

type Documento = { id: string; categoria: string; status: string };

const categorias = [
  { id: "documento_cliente", titulo: "Documento do Cliente", sigla: "CLI" },
  { id: "receita_medica", titulo: "Receita Médica", sigla: "REC" },
  { id: "cupom_fiscal", titulo: "Cupom Fiscal", sigla: "CF" },
  { id: "cupom_vinculado", titulo: "Cupom Vinculado", sigla: "CV" },
  { id: "outros", titulo: "Outros documentos", sigla: "OUT" },
];

export default function DocumentosAutorizacao() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [numeroAutorizacao, setNumeroAutorizacao] = useState("");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/"; return; }

      const { data: autorizacao } = await supabase.from("autorizacoes")
        .select("numero_autorizacao").eq("id", id).eq("user_id", user.id).single();
      if (!autorizacao) { setCarregando(false); return; }
      setNumeroAutorizacao(autorizacao.numero_autorizacao);

      const { data: documentosSalvos } = await supabase.from("documentos")
        .select("id, categoria, status").eq("autorizacao_id", id);
      setDocumentos(documentosSalvos ?? []);
      setCarregando(false);
    }
    carregarDados();
  }, [id, supabase]);

  const categoriasRecebidas = categorias.filter((c) => documentos.some((d) => d.categoria === c.id && d.status === "recebido")).length;
  const percentual = Math.round((categoriasRecebidas / categorias.length) * 100);

  function statusCategoria(categoriaId: string) {
    const documento = documentos.find((item) => item.categoria === categoriaId);
    if (!documento) return "Adicionar";
    if (documento.status === "recebido") return "Recebido";
    if (documento.status === "atencao") return "Atenção";
    return "Pendente";
  }

  if (carregando) return <main className="rbk-shell min-h-screen p-8 text-sm text-gray-500">Carregando documentos...</main>;

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <Link href="/dashboard"><RbkBrand compact /></Link>
          <Link href="/autorizacoes" className="text-sm font-bold text-gray-500 hover:text-red-600">← Autorizações</Link>
        </div>
      </header>

      <div className="rbk-container max-w-4xl py-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Documentação</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Documentos da autorização</h1>
          <p className="mt-2 text-sm text-gray-500">Autorização <span className="font-bold text-gray-800">#{numeroAutorizacao}</span></p>
        </div>

        <section className="rbk-card p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Situação documental</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{categoriasRecebidas} de {categorias.length} categorias recebidas</p>
            </div>
            <p className="text-3xl font-bold text-red-600">{percentual}%</p>
          </div>
          <div className="rbk-progress mt-5"><span style={{ width: `${percentual}%` }} /></div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">Checklist documental</h2>
            <p className="mt-1 text-sm text-gray-500">Acompanhe cada categoria de documento vinculada à autorização.</p>
          </div>

          <div className="space-y-3">
            {categorias.map((categoria) => {
              const status = statusCategoria(categoria.id);
              const recebido = status === "Recebido";
              const atencao = status === "Atenção";
              return (
                <div key={categoria.id} className="rbk-card rbk-card-hover p-5">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${
                      recebido ? "bg-green-50 text-green-700" : atencao ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
                    }`}>{categoria.sigla}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900">{categoria.titulo}</h3>
                      <button type="button" className="mt-1 text-xs font-semibold text-gray-500 hover:text-red-600">
                        {recebido ? "Ver documento" : "Adicionar documento"}
                      </button>
                    </div>
                    <span className={`rbk-status ${recebido ? "bg-green-50 text-green-700" : atencao ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      <span>●</span>{status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button type="button" onClick={() => router.push(`/autorizacoes/${id}/documentos/sucesso`)}
          className="rbk-primary mt-6 w-full rounded-[13px] px-6 py-4 text-sm font-bold">
          Salvar documentos
        </button>
      </div>
    </main>
  );
}
