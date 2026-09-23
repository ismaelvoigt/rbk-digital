"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import DocumentUploadCard from "../../components/documentos/DocumentUploadCard";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";
import { mensagemErroAutorizacao } from "../../lib/documentos/mensagemErroAutorizacao";
import QrCodeScanner from "../../components/qrcode/QrCodeScanner";

type Categoria =
  | "documento_cliente"
  | "receita_medica"
  | "cupom_fiscal"
  | "cupom_vinculado"
  | "outros";

type AutorizacaoSalva = {
  numero: string;
  cpf: string;
  data: string;
};

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

function formatarNumeroAutorizacao(valor: string) {
  const digits = valor.replace(/\D/g, "").slice(0, 15);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}.${digits.slice(9, 12)}.${digits.slice(12)}`;
}

export default function NovaAutorizacao() {
  const supabase = createClient();

  const [leitorQrAberto, setLeitorQrAberto] = useState(false);
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

  const [outrosArquivos, setOutrosArquivos] = useState<File[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [autorizacaoSalva, setAutorizacaoSalva] =
    useState<AutorizacaoSalva | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [resumo, setResumo] = useState<{
    numero: string;
    cpf: string;
    data: string;
  } | null>(null);

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

      const dataAutorizacao = new Date().toISOString().slice(0, 10);

      const { data: autorizacao, error: erroAutorizacao } =
        await supabase
          .from("autorizacoes")
          .insert({
            numero_autorizacao: numero.replace(/\D/g, ""),
            data_autorizacao: dataAutorizacao,
            cpf_cliente: cpf.replace(/\D/g, ""),
            user_id: user.id,
          })
          .select("id")
          .single();

      if (erroAutorizacao || !autorizacao) {
        const codigoErro = erroAutorizacao?.code;
        const mensagemErro = erroAutorizacao?.message ?? "";

        if (
          codigoErro === "23505" ||
          /duplicate|unique|already exists/i.test(mensagemErro)
        ) {
          // Mensagem ao usuário: Esta autorização já está cadastrada.
          setErro(mensagemErroAutorizacao({ code: "23505" }));
          return;
        }

        throw new Error(
          mensagemErro ||
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
        const arquivosDaCategoria =
          categoria === "outros"
            ? outrosArquivos
            : arquivos[categoria]
              ? [arquivos[categoria] as File]
              : [];

        for (const file of arquivosDaCategoria) {

     const extensao = file.name.includes(".")
  ? file.name.substring(file.name.lastIndexOf("."))
  : "";

const hoje = new Date();
const dia = String(hoje.getDate()).padStart(2, "0");
const mes = String(hoje.getMonth() + 1).padStart(2, "0");
const ano = hoje.getFullYear();

const nomeArquivo = `${numero.replace(/\D/g, "")}_${categoria}_${dia}_${mes}_${ano}${extensao}`;

const caminho = `${user.id}/${autorizacao.id}/${categoria}-${Date.now()}-${nomeArquivo}`;

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
            nome_arquivo: nomeArquivo,
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
      }

      setAutorizacaoSalva({
        numero: numero.trim(),
        cpf,
        data: dataAutorizacao,
      });

      setMensagem("Autorização cadastrada com sucesso.");
    } catch (error) {
      const erroSupabase =
        error && typeof error === "object"
          ? (error as { code?: string; message?: string })
          : {};

      setErro(mensagemErroAutorizacao(erroSupabase));
    } finally {
      setCarregando(false);
    }
  }

  if (autorizacaoSalva) {
    return (
      <main className="rbk-shell min-h-screen">
        <header className="rbk-header">
          <div className="rbk-container flex min-h-[76px] items-center justify-between">
            <RbkBrand compact />

            <Link
              href="/farmacia"
              className="text-sm font-bold text-gray-500 hover:text-red-600"
            >
              Início
            </Link>
          </div>
        </header>

        <div className="rbk-container py-10 sm:py-14">
          <section className="mx-auto max-w-2xl">
            <div className="rbk-card overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-8 text-center sm:px-10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl">
                  ✓
                </div>

                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-green-600">
                  Operação concluída
                </p>

                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  Autorização cadastrada com sucesso
                </h1>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-500">
                  A autorização e toda a documentação selecionada foram
                  armazenadas com sucesso no RBK Digital.
                </p>
              </div>

              <div className="grid gap-4 px-6 py-7 sm:grid-cols-3 sm:px-10">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Número da autorização
                  </p>
                  <p className="mt-2 break-all text-sm font-bold text-gray-900">
                    {autorizacaoSalva.numero}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    CPF do cliente
                  </p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    {autorizacaoSalva.cpf}
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Data da autorização
                  </p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    {new Date(
                      `${autorizacaoSalva.data}T00:00:00`
                    ).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              <div className="mx-6 mb-7 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 sm:mx-10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-green-600">
                  ✓
                </span>

                <div>
                  <p className="text-sm font-bold text-green-800">
                    Documentação salva com sucesso
                  </p>
                  <p className="mt-1 text-xs leading-5 text-green-700">
                    Os documentos enviados foram vinculados à autorização.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-6 sm:flex-row sm:px-10">
                <Link
                  href="/autorizacoes"
                  className="rbk-primary flex-1 rounded-[13px] px-6 py-4 text-center text-sm font-bold transition"
                >
                  Ver autorizações
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setAutorizacaoSalva(null);
                    setMensagem("");
                    setErro("");
                    setCpf("");
                    setNumero("");
                    setArquivos({
                      documento_cliente: null,
                      receita_medica: null,
                      cupom_fiscal: null,
                      cupom_vinculado: null,
                      outros: null,
                    });
                    setOutrosArquivos([]);
                  }}
                  className="flex-1 rounded-[13px] border border-gray-200 bg-white px-6 py-4 text-center text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Cadastrar nova autorização
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="rbk-shell min-h-screen">
      <header className="rbk-header">
        <div className="rbk-container flex min-h-[76px] items-center justify-between">
          <RbkBrand compact />
          <Link
            href="/farmacia"
            className="text-sm font-bold text-gray-500 hover:text-red-600"
          >
            Início
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
          {mensagem && resumo && (
          <section className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-green-800">
                  Autorização cadastrada com sucesso
                </h2>

                <p className="mt-1 text-sm text-green-700">
                  O cadastro foi realizado e os documentos foram recebidos.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-green-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                      Número da autorização
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {resumo.numero}
                    </p>
                  </div>

                  <div className="rounded-xl border border-green-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                      CPF do cliente
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {resumo.cpf}
                    </p>
                  </div>

                  <div className="rounded-xl border border-green-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">
                      Data da autorização
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {resumo.data.split("-").reverse().join("/")}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/autorizacoes"
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                  >
                    Ver autorizações
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMensagem("");
                      setResumo(null);
                      setCpf("");
                      setNumero("");
                      setArquivos({
                        documento_cliente: null,
                        receita_medica: null,
                        cupom_fiscal: null,
                        cupom_vinculado: null,
                        outros: null,
                      });
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    Cadastrar nova autorização
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

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
                onChange={(e) => setNumero(formatarNumeroAutorizacao(e.target.value))}
                placeholder="Ex.: 000.000.000.000.000"
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
                  onQrCodeClick={() => setLeitorQrAberto(true)}
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
                  multiple
                  onFilesChange={setOutrosArquivos}
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
      {leitorQrAberto && (
        <QrCodeScanner onClose={() => setLeitorQrAberto(false)} />
      )}
    </main>
  );
}
