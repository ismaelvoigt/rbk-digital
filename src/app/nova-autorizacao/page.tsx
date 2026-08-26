"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DocumentUploadCard from "../../components/documentos/DocumentUploadCard";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";

type Categoria =
  | "documento_cliente"
  | "receita_medica"
  | "cupom_fiscal"
  | "cupom_vinculado"
  | "outros";

type ArquivoSelecionado = {
  file: File | null;
  categoria: Categoria;
};

function formatarCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

function cpfValido(cpf: string) {
  return cpf.replace(/\D/g, "").length === 11;
}

function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function NovaAutorizacao() {
  const router = useRouter();
  const supabase = createClient();

  const [cpf, setCpf] = useState("");
  const [numero, setNumero] = useState("");
  const [arquivos, setArquivos] = useState<
    Record<Categoria, File | null>
  >({
    documento_cliente: null,
    receita_medica: null,
    cupom_fiscal: null,
    cupom_vinculado: null,
    outros: null,
  });

  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function definirArquivo(categoria: Categoria, file: File | null) {
    setArquivos((atual) => ({
      ...atual,
      [categoria]: file,
    }));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMensagem("");
    setErro("");

    if (!cpfValido(cpf)) {
      setErro("Informe um CPF válido.");
      return;
    }

    if (!numero.trim()) {
      setErro("Informe o número da autorização.");
      return;
    }

    if (!arquivos.documento_cliente) {
      setErro("O documento do cliente é obrigatório.");
      return;
    }

    if (!arquivos.receita_medica) {
      setErro("A Receita Médica é obrigatória.");
      return;
    }

    if (!arquivos.cupom_fiscal) {
      setErro("O Cupom Fiscal é obrigatório.");
      return;
    }

    if (!arquivos.cupom_vinculado) {
      setErro("O Cupom Vinculado é obrigatório.");
      return;
    }

    setCarregando(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data: autorizacao, error: erroAutorizacao } =
        await supabase
          .from("autorizacoes")
          .insert({
            numero_autorizacao: numero.trim(),
            cpf_cliente: cpf.replace(/\D/g, ""),
            user_id: user.id,
          })
          .select("id")
          .single();

      if (erroAutorizacao || !autorizacao) {
        throw new Error(
          erroAutorizacao?.message ||
            "Não foi possível criar a autorização."
        );
      }

      const categorias: Categoria[] = [
        "documento_cliente",
        "receita_medica",
        "cupom_fiscal",
        "cupom_vinculado",
        "outros",
      ];

      for (const categoria of categorias) {
        const file = arquivos[categoria];

        if (!file) continue;

        const nome = nomeSeguro(file.name);
        const caminho = `${user.id}/${autorizacao.id}/${categoria}-${Date.now()}-${nome}`;

        const { error: erroUpload } = await supabase.storage
          .from("documentos")
          .upload(caminho, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (erroUpload) {
          throw new Error(
            `Erro ao enviar ${categoria}: ${erroUpload.message}`
          );
        }

        const { error: erroDocumento } = await supabase
          .from("documentos")
          .insert({
            autorizacao_id: autorizacao.id,
            categoria,
            nome_arquivo: file.name,
            caminho_arquivo: caminho,
            status: "recebido",
          });

        if (erroDocumento) {
          await supabase.storage
            .from("documentos")
            .remove([caminho]);

          throw new Error(
            `Erro ao registrar ${categoria}: ${erroDocumento.message}`
          );
        }
      }

      setMensagem("Autorização e documentos salvos com sucesso.");

      setTimeout(() => {
        router.push(`/autorizacoes/${autorizacao.id}/documentos`);
      }, 700);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a autorização."
      );
    } finally {
      setCarregando(false);
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

      <div className="rbk-container max-w-3xl py-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
            Novo registro
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Nova autorização
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Informe o CPF, o número da autorização e anexe os documentos.
          </p>
        </div>

        <section className="rbk-card p-5 sm:p-8">
          <form onSubmit={salvar} className="space-y-7">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                CPF do cliente *
              </label>

              <input
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                required
                className="rbk-input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Nº da autorização *
              </label>

              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: AUT-987654"
                required
                className="rbk-input"
              />
            </div>

            <div className="border-t border-gray-200 pt-7">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">
                  Anexar por tipo de documento
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Os documentos serão salvos junto à autorização.
                </p>
              </div>

              <div className="space-y-4">
                <DocumentUploadCard
                  title="Doc. Cliente (RG/CNH)"
                  accent="red"
                  onFileChange={(file) =>
                    definirArquivo("documento_cliente", file)
                  }
                />

                <DocumentUploadCard
                  title="Receita Médica"
                  accent="orange"
                  onFileChange={(file) =>
                    definirArquivo("receita_medica", file)
                  }
                />

                <DocumentUploadCard
                  title="Cupom Fiscal"
                  accent="green"
                  onFileChange={(file) =>
                    definirArquivo("cupom_fiscal", file)
                  }
                />

                <DocumentUploadCard
                  title="Cupom Vinculado"
                  accent="blue"
                  onFileChange={(file) =>
                    definirArquivo("cupom_vinculado", file)
                  }
                />

                <DocumentUploadCard
                  title="Outros Documentos"
                  accent="purple"
                  optional
                  onFileChange={(file) =>
                    definirArquivo("outros", file)
                  }
                />
              </div>
            </div>

            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {erro}
              </div>
            )}

            {mensagem && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {mensagem}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="rbk-primary w-full rounded-[13px] px-6 py-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando
                ? "Salvando autorização e documentos..."
                : "Salvar autorização"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
