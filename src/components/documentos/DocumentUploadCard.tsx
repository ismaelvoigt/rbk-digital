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
numeroAutorizacao?: string;
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

const descricoesCategoria: Record<Categoria, string> = {
  documento_cliente: "RG, CNH ou documento de identificação do cliente.",
  receita_medica: "Receita médica vinculada à dispensação.",
  cupom_fiscal: "Cupom fiscal referente à dispensação realizada.",
  cupom_vinculado: "Cupom vinculado à autorização e à dispensação.",
  outros: "Procurações, documentos do procurador ou outros relacionados à autorização.",
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
numeroAutorizacao,
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

function gerarNomeArquivo(
  numero: string,
  categoria: Categoria,
  arquivoOriginal: string
) {
  const extensao = arquivoOriginal.includes(".")
    ? arquivoOriginal.substring(arquivoOriginal.lastIndexOf("."))
    : "";

  const nomesCategorias: Record<Categoria, string> = {
    documento_cliente: "documento_do_cliente",
    receita_medica: "receita_medica",
    cupom_fiscal: "cupom_fiscal",
    cupom_vinculado: "cupom_vinculado",
    outros: "outros_documentos",
  };

  const hoje = new Date();

  const dia = String(hoje.getDate()).padStart(2, "0");
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();

const numeroFormatado = numero.trim();
  return `${numeroFormatado}_${nomesCategorias[categoria]}_${dia}_${mes}_${ano}${extensao}`;
}

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

      const nomeArquivo = gerarNomeArquivo(
  numeroAutorizacao || "sem_numero",
  categoria,
  selectedFile.name
);

const caminho = `${user.id}/${autorizacaoId}/${categoria}-${Date.now()}-${nomeSeguro(
  nomeArquivo
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
          nome_arquivo: nomeArquivo,
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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Cabeçalho */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${accentClasses[accent]}`}
          >
            DOC
          </div>

          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800 sm:text-lg">
              {title}
            </h3>

            <p className="mt-0.5 text-xs text-gray-400">
              {categoria
                ? descricoesCategoria[categoria]
                : "Documento relacionado à autorização."}
            </p>
          </div>
        </div>

        <span
          className={
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold " +
            (file || status === "recebido"
              ? "bg-green-50 text-green-700"
              : status === "atencao"
                ? "bg-orange-50 text-orange-700"
                : optional
                  ? "bg-gray-100 text-gray-500"
                  : "bg-red-50 text-red-600")
          }
        >
          {enviando
            ? "Enviando..."
            : file
              ? "✓ Anexado"
              : status === "recebido"
                ? "✓ Recebido"
                : optional
                  ? "Opcional"
                  : status === "atencao"
                    ? "Atenção"
                    : "Pendente"}
        </span>
      </div>

      {!file ? (
        /* Estado sem arquivo */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg">📷</span>
            Câmera
          </button>

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={enviando}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
  viewBox="0 0 24 24"
  className="h-5 w-5"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.8"
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden="true"
>
  <rect x="3" y="3" width="18" height="18" rx="3" />
  <circle cx="8.5" cy="8.5" r="1.5" />
  <path d="m21 15-5-5L5 21" />
</svg>
            Galeria
          </button>
        </div>
      ) : (
        /* Estado com arquivo */
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {preview ? (
              <div className="flex min-h-40 items-center justify-center p-3">
                <img
                  src={preview}
                  alt={`Pré-visualização de ${title}`}
                  className="max-h-56 w-full rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-40 items-center justify-center px-4 text-center">
                <div>
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-200 text-sm font-bold text-gray-500">
                    DOC
                  </div>

                  <p className="text-sm font-medium text-gray-700">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Arquivo selecionado
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={enviando}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tirar outra foto
            </button>

            <button
              type="button"
              onClick={removerArquivo}
              disabled={enviando}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Inputs invisíveis */}
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
