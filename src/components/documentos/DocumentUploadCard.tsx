"use client";

import { useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Categoria =
  | "documento_cliente"
  | "receita_medica"
  | "cupom_fiscal"
  | "cupom_vinculado"
  | "outros";

type DocumentUploadCardProps = {
  title: string;
  optional?: boolean;
  accent?: "red" | "orange" | "green" | "blue" | "purple";
  status?: "pendente" | "recebido" | "atencao";


  // Compatibilidade com a tela antiga
  autorizacaoId?: string;
  categoria?: Categoria;

  // Usado pela nova tela
  onFileChange?: (file: File | null) => void;
};

const accentClasses = {
  red: "text-red-600 bg-red-50",
  orange: "text-orange-600 bg-orange-50",
  green: "text-green-600 bg-green-50",
  blue: "text-blue-600 bg-blue-50",
  purple: "text-purple-600 bg-purple-50",
};

function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function DocumentUploadCard({
  title,
  optional = false,
  accent = "red",
status = "pendente",
  autorizacaoId,
  categoria,
  onFileChange,
}: DocumentUploadCardProps) {
  const supabase = createClient();

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function selecionarArquivo(selectedFile?: File) {
    if (!selectedFile) return;

    setErro("");

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(selectedFile);

    if (selectedFile.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }

    onFileChange?.(selectedFile);

    /*
     * Compatibilidade com a tela antiga:
     * quando autorizacaoId + categoria existem,
     * o componente salva imediatamente no Supabase.
     */
    if (autorizacaoId && categoria) {
      await enviarParaSupabase(selectedFile);
    }
  }

  async function enviarParaSupabase(selectedFile: File) {
    setEnviando(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      if (!autorizacaoId || !categoria) {
        return;
      }

      const caminho = `${user.id}/${autorizacaoId}/${categoria}-${Date.now()}-${nomeSeguro(
        selectedFile.name
      )}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(caminho, selectedFile, {
          upsert: false,
          contentType:
            selectedFile.type || "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: documentoError } = await supabase
        .from("documentos")
        .insert({
          autorizacao_id: autorizacaoId,
          categoria,
          nome_arquivo: selectedFile.name,
          caminho_arquivo: caminho,
          status: "recebido",
        });

      if (documentoError) {
        await supabase.storage
          .from("documentos")
          .remove([caminho]);

        throw new Error(documentoError.message);
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o documento."
      );
      setFile(null);
      setPreview(null);
      onFileChange?.(null);
    } finally {
      setEnviando(false);
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      void selecionarArquivo(selectedFile);
    }

    event.target.value = "";
  }

  function removerArquivo() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(null);
    setPreview(null);
    setErro("");
    onFileChange?.(null);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${accentClasses[accent]}`}
          >
            DOC
          </div>

          <h3 className="text-base font-bold text-gray-700 sm:text-lg">
            {title}
          </h3>
        </div>

        <span
           className={`shrink-0 text-sm font-semibold ${
  file || status === "recebido"
    ? "text-green-600"
    : status === "atencao"
      ? "text-orange-600"
      : optional
        ? "text-gray-400"
        : "text-red-600"
}`}
        >
          {file
  ? enviando
    ? "Enviando..."
    : "✓ Anexado"
  : status === "recebido"
    ? "✓ Recebido"
    : optional
      ? "Opcional"
      : "Pendente"}
        </span>
      </div>

      {!file ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={enviando}
            className="flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-base font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="text-xl">📷</span>
            Câmera
          </button>

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={enviando}
            className="flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-base font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="text-xl">🖼️</span>
            Galeria
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-white p-3">
          <div className="mb-3 overflow-hidden rounded-lg bg-gray-100">
            {preview ? (
              <img
                src={preview}
                alt={`Pré-visualização de ${title}`}
                className="max-h-80 w-full object-contain"
              />
            ) : (
              <div className="flex min-h-24 items-center justify-center px-4 text-sm text-gray-600">
                Arquivo selecionado: {file.name}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={enviando}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Tirar outra foto
            </button>

            <button
              type="button"
              onClick={removerArquivo}
              disabled={enviando}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
