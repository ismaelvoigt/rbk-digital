"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { RbkBrand } from "../../../../components/RbkBrand";
import DocumentUploadCard from "../../../../components/documentos/DocumentUploadCard";

type Documento = {
  id: string;
  categoria: string;
  status: string;
  nome_arquivo: string | null;
  caminho_arquivo: string | null;
  url: string | null;
};

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
  const substituirInputRef = useRef<HTMLInputElement>(null);
  const [arquivoSubstituicao, setArquivoSubstituicao] = useState<File | null>(
    null,
  );
  const [documentoEmEdicao, setDocumentoEmEdicao] = useState<Documento | null>(
    null,
  );

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: autorizacao } = await supabase
        .from("autorizacoes")
        .select("numero_autorizacao")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (!autorizacao) {
        setCarregando(false);
        return;
      }
      setNumeroAutorizacao(autorizacao.numero_autorizacao);

      const { data: documentosSalvos, error: documentosError } = await supabase
        .from("documentos")
        .select("id, categoria, status, nome_arquivo, caminho_arquivo")
        .eq("autorizacao_id", id);

      if (documentosError) {
        console.error("Erro ao carregar documentos:", documentosError);
        setDocumentos([]);
      } else {
        const documentosComUrl = await Promise.all(
          (documentosSalvos ?? []).map(async (documento) => {
            if (!documento.caminho_arquivo) {
              return {
                ...documento,
                url: null,
              };
            }

            const { data: urlData } = await supabase.storage
              .from("documentos")
              .createSignedUrl(documento.caminho_arquivo, 3600);

            return {
              ...documento,
              url: urlData?.signedUrl ?? null,
            };
          }),
        );

        setDocumentos(documentosComUrl);
      }
      setCarregando(false);
    }
    carregarDados();
  }, [id, supabase]);

  const categoriasRecebidas = categorias.filter((c) =>
    documentos.some((d) => d.categoria === c.id && d.status === "recebido"),
  ).length;
  const percentual = Math.round(
    (categoriasRecebidas / categorias.length) * 100,
  );

  function statusCategoria(categoriaId: string) {
    const documento = documentos.find((item) => item.categoria === categoriaId);

    if (!documento) return "pendente";
    if (documento.status === "recebido") return "recebido";
    if (documento.status === "atencao") return "atencao";

    return "pendente";
  }

  if (carregando)
    return (
      <main className="rbk-shell min-h-screen p-8 text-sm text-gray-500">
        Carregando documentos...
      </main>
    );

  async function substituirDocumento(arquivo: File) {
    if (!documentoEmEdicao || !arquivoSubstituicao) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const extensao = arquivo.name.includes(".")
        ? arquivo.name.substring(arquivo.name.lastIndexOf("."))
        : "";

      const novoCaminho = `${user.id}/${id}/${documentoEmEdicao.categoria}-${Date.now()}${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(novoCaminho, arquivo, {
          upsert: false,
          contentType: arquivo.type || "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: updateError } = await supabase
        .from("documentos")
        .update({
          nome_arquivo: arquivo.name,
          caminho_arquivo: novoCaminho,
          status: "recebido",
        })
        .eq("id", documentoEmEdicao.id);

      if (updateError) {
        await supabase.storage.from("documentos").remove([novoCaminho]);

        throw new Error(updateError.message);
      }

      if (documentoEmEdicao.caminho_arquivo) {
        await supabase.storage
          .from("documentos")
          .remove([documentoEmEdicao.caminho_arquivo]);
      }

      setDocumentos((documentosAtuais) =>
        documentosAtuais.map((documento) =>
          documento.id === documentoEmEdicao.id
            ? {
                ...documento,
                nome_arquivo: arquivo.name,
                caminho_arquivo: novoCaminho,
                status: "recebido",
              }
            : documento,
        ),
      );

      setArquivoSubstituicao(null);
      setDocumentoEmEdicao(null);
    } catch (error) {
      console.error("Erro ao substituir documento:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível substituir o documento.",
      );
    }
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <Link href="/dashboard">
            <RbkBrand compact />
          </Link>
          <Link
            href="/autorizacoes"
            className="text-sm font-bold text-gray-500 hover:text-red-600"
          >
            ← Autorizações
          </Link>
        </div>
      </header>

      <div className="rbk-container max-w-4xl py-8 sm:py-10">
        <div className="mb-7">
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Documentos da autorização
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Autorização{" "}
            <span className="font-bold text-gray-800">
              #{numeroAutorizacao}
            </span>
          </p>
        </div>

        <section className="rbk-card p-6 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                Situação documental
              </p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {categoriasRecebidas} de {categorias.length} categorias
                recebidas
              </p>
            </div>
            <p className="text-3xl font-bold text-red-600">{percentual}%</p>
          </div>
          <div className="rbk-progress mt-5">
            <span style={{ width: `${percentual}%` }} />
          </div>
        </section>

        <input
          ref={substituirInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];

            if (arquivo) {
              setArquivoSubstituicao(arquivo);
            }

            e.currentTarget.value = "";
          }}
        />



        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Checklist documental
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Acompanhe cada categoria de documento vinculada à autorização.
            </p>
          </div>

          <div className="space-y-4">
            <DocumentUploadCard
              autorizacaoId={id}
              numeroAutorizacao={numeroAutorizacao}
              categoria="documento_cliente"
              title="Doc. Cliente (RG/CNH)"
              accent="red"
              status={statusCategoria("documento_cliente")}
            />

            <DocumentUploadCard
              autorizacaoId={id}
              numeroAutorizacao={numeroAutorizacao}
              categoria="receita_medica"
              title="Receita Médica"
              accent="orange"
              status={statusCategoria("receita_medica")}
            />

            <DocumentUploadCard
              autorizacaoId={id}
              numeroAutorizacao={numeroAutorizacao}
              categoria="cupom_fiscal"
              title="Cupom Fiscal"
              accent="green"
              status={statusCategoria("cupom_fiscal")}
            />

            <DocumentUploadCard
              autorizacaoId={id}
              numeroAutorizacao={numeroAutorizacao}
              categoria="cupom_vinculado"
              title="Cupom Vinculado"
              accent="blue"
              status={statusCategoria("cupom_vinculado")}
            />

            <DocumentUploadCard
              autorizacaoId={id}
              numeroAutorizacao={numeroAutorizacao}
              categoria="outros"
              title="Outros Documentos"
              accent="purple"
              status={statusCategoria("outros")}
              optional
            />
          </div>
        </section>

        {documentos.length > 0 && (
          <section className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Documentos arquivados
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Documentos vinculados a esta autorização e armazenados com
                segurança.
              </p>
            </div>

            <div className="space-y-4">
              {documentos.map((documento) => {
                const categoria = categorias.find(
                  (c) => c.id === documento.categoria,
                );

                return (
                  <div
                    key={documento.id}
                    className="rbk-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 font-bold">
                          DOC
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                            {categoria?.titulo ?? "Documento"}
                          </p>

                          <p className="mt-1 truncate text-sm font-semibold text-gray-800">
                            {documento.nome_arquivo ?? "Arquivo sem nome"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-green-50 px-3 py-1 font-semibold text-green-700">
                          ✓ Arquivado
                        </span>

                        <span className="text-gray-400">
                          {documento.status === "recebido"
                            ? "Recebido"
                            : documento.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {documento.url && (
                        <a
                          href={documento.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rbk-primary inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
                        >
                          Visualizar
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setDocumentoEmEdicao(documento);
                          substituirInputRef.current?.click();
                        }}
                        className="rbk-primary inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
                      >
                        Substituir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <input
          ref={substituirInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];

            if (arquivo) {
              setArquivoSubstituicao(arquivo);
            }
            e.currentTarget.value = "";
          }}
        />

        <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={async () => {
            if (arquivoSubstituicao && documentoEmEdicao) {
              await substituirDocumento(arquivoSubstituicao);
              setArquivoSubstituicao(null);
              setDocumentoEmEdicao(null);
            }

            router.push(`/autorizacoes/${id}`);
          }}
          className="rbk-primary w-full rounded-[13px] px-6 py-4 text-sm font-bold"
        >
          Confirmar
        </button>

        <Link
          href="/autorizacoes"
          className="flex w-full items-center justify-center rounded-[13px] border border-gray-200 bg-white px-6 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50"
        >
          ← Voltar para autorizações
        </Link>
      </div>
      </div>
    </main>
  );
}
