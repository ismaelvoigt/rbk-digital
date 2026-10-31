"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { dispararExtracao } from "../../lib/cupons/client";
import DocumentUploadCard from "../../components/documentos/DocumentUploadCard";
import { createClient } from "../../lib/supabase/client";
import { RbkBrand } from "../../components/RbkBrand";
import { enviarLote, type EnvioDocumento, type EstadoEnvio } from "../../lib/documentos/envio";
import { mensagemErroAutorizacao } from "../../lib/documentos/mensagemErroAutorizacao";
import CamposCrm from "../../components/relatorios/CamposCrm";
import { normalizarCrm } from "../../lib/relatorios/filtros";
const QrCodeScanner = dynamic(() => import('../../components/qrcode/QrCodeScanner'), {
  ssr:false,
  loading:()=> <p role="status" className="p-4 text-sm text-gray-600">Abrindo leitor de QR Code...</p>,
});

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
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("");
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
  const [iniciada, setIniciada] = useState(false);
  const [estados, setEstados] = useState<Record<string, EstadoEnvio>>({});
  const [itensEnvio,setItensEnvio] = useState<{id:string;categoria:string}[]>([]);
  const emEnvio = useRef(false);
  const tentativa = useRef<{id:string;userId:string;data:string;criada:boolean;envios:EnvioDocumento[]} | null>(null);

  const temPendentes = !autorizacaoSalva && (iniciada || Object.values(arquivos).some(Boolean) || outrosArquivos.length > 0);
  useEffect(() => {
    if (!temPendentes) return;
    const avisar = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',avisar);
    return () => window.removeEventListener('beforeunload',avisar);
  },[temPendentes]);

  function estadoCategoria(categoria:Categoria): EstadoEnvio | undefined {
    const itens = itensEnvio.filter(e=>e.categoria===categoria);
    if (!itens.length) return undefined;
    if (itens.every(e=>estados[e.id]==='salvo')) return 'salvo';
    if (itens.some(e=>estados[e.id]==='enviando')) return 'enviando';
    if (itens.some(e=>estados[e.id]==='falhou')) return 'falhou';
    return 'selecionado';
  }

  function definirArquivo(categoria: Categoria, file: File | null) {
    setArquivos((atual) => ({
      ...atual,
      [categoria]: file,
    }));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emEnvio.current) return;

    setMensagem("");
    setErro("");

    try { normalizarCrm(crm, crmUf); } catch (error) {
      setErro(error instanceof Error ? error.message : "CRM inválido.");
      return;
    }

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

    emEnvio.current = true;
    setCarregando(true);
    let duplicidadeConfirmada = false;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErro("Sessão expirada. Faça login novamente.");
        return;
      }

      if (!tentativa.current) {
        const id = crypto.randomUUID();
        const data = new Date().toISOString().slice(0,10);
        const envios:EnvioDocumento[] = [];
        for (const categoria of ["documento_cliente","receita_medica","cupom_fiscal","cupom_vinculado","outros"] as Categoria[]) {
          const selecionados = categoria === 'outros' ? outrosArquivos : arquivos[categoria] ? [arquivos[categoria]!] : [];
          for (const file of selecionados) {
            const documentoId = crypto.randomUUID();
            const extensao = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g,'') || 'bin';
            envios.push({id:documentoId,autorizacaoId:id,categoria,file,nome:file.name,
              caminho:`${user.id}/${id}/${categoria}-${documentoId}.${extensao}`});
          }
        }
        tentativa.current = {id,userId:user.id,data,criada:false,envios};
        setItensEnvio(envios.map(({id,categoria})=>({id,categoria})));
        setIniciada(true);
      }
      const atual = tentativa.current;
      if (atual.userId !== user.id) throw new Error('A sessão mudou. Entre com o usuário que iniciou o envio.');
      const dataAutorizacao = atual.data;
      if (!atual.criada) {
        // A stable id also recovers an authorization whose response was lost.
        try {
          const {data:autorizacao,error} = await supabase.from('autorizacoes').insert({
            id:atual.id,
            numero_autorizacao: numero.replace(/\D/g, ""),
            data_autorizacao: dataAutorizacao,
            cpf_cliente:cpf.replace(/\D/g,''),
            ...(crm.trim() ? normalizarCrm(crm,crmUf) : {}),
            user_id: user.id,
          }).select('id').single();
          if (error || autorizacao?.id !== atual.id) throw error || new Error('Não foi possível confirmar a autorização.');
        } catch (error) {
          const {data:existente,error:consultaErro} = await supabase.from('autorizacoes')
            .select('id,numero_autorizacao,cpf_cliente,user_id').eq('id',atual.id).maybeSingle();
          if (consultaErro) throw new Error('A confirmação da autorização está indisponível. Tente novamente.');
          if (!existente) {
            // Reset only a confirmed conflict with another authorization, never a failed readback.
            duplicidadeConfirmada = Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
            throw error;
          }
          if (existente.user_id !== user.id || existente.numero_autorizacao !== numero.replace(/\D/g,'') || existente.cpf_cliente !== cpf.replace(/\D/g,'')) {
            throw new Error('A autorização retornada não corresponde ao envio.');
          }
        }
        atual.criada = true;
      }
      const completo = await enviarLote(supabase,atual.envios,(envio,estado)=>{
        setEstados(anteriores=>({...anteriores,[envio.id]:estado}));
      });
      if (!completo) {
        setErro('Há documentos sem confirmação. Os já salvos foram preservados. Mantenha esta tela aberta e clique em Tentar novamente para enviar apenas os pendentes.');
        return;
      }

      setAutorizacaoSalva({
        numero: numero.trim(),
        cpf,
        data: dataAutorizacao,
      });

      setMensagem("Autorização cadastrada com sucesso.");
      // Extraction is independent of storage confirmation; its endpoint queues work server-side.
      void Promise.allSettled(atual.envios.filter(e=>e.categoria.startsWith('cupom')).map(e=>dispararExtracao(supabase,e.id,e.categoria)));
    } catch {
      if (duplicidadeConfirmada) {
        tentativa.current = null;
        setIniciada(false);
        setItensEnvio([]);
        setEstados({});
        setErro(mensagemErroAutorizacao({ code: "23505" }));
      } else {
        setErro('Não foi possível concluir. Mantenha esta tela aberta e tente novamente. Os arquivos confirmados serão preservados.');
      }
    } finally {
      emEnvio.current = false;
      setCarregando(false);
    }
  }

  if (autorizacaoSalva) {
    return (
      <main className="rbk-shell min-h-screen">
        <header className="rbk-header">
          <div className="rbk-container flex min-h-[76px] items-center justify-between">
            <RbkBrand compact light />

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
                    Os documentos enviados foram vinculados à autorização. A leitura dos cupons é separada; acompanhe o resultado na autorização.
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
                    tentativa.current = null;
                    setIniciada(false);
                    setEstados({});
                    setItensEnvio([]);
                    setAutorizacaoSalva(null);
                    setMensagem("");
                    setErro("");
                    setCpf("");
                    setNumero("");
                    setCrm(""); setCrmUf("");
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
          <RbkBrand compact light />
          <Link
            href="/farmacia"
            onClick={(event) => { if (temPendentes && !window.confirm('Há arquivos pendentes nesta tela. Sair perde a seleção desses arquivos. Deseja sair?')) event.preventDefault(); }}
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

          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
            <svg
              className="h-8 w-8 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m9 15 2 2 4-4" />
            </svg>
            <span>Nova autorização</span>
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Informe o CPF, o número da autorização e anexe os documentos.
          </p>
        </div>

        <section className="rbk-card p-5 sm:p-8">

        <form onSubmit={salvar} className="space-y-7">
            <fieldset disabled={iniciada || carregando} className="space-y-7">
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

            <div>
              <CamposCrm prefixo="cadastro-crm" crm={crm} uf={crmUf} onChange={(numero, uf) => { setCrm(numero); setCrmUf(uf); }} />
              <p className="mt-2 text-xs text-gray-500">Informe o CRM e a UF conforme a receita para localizar esta autorização nos relatórios.</p>
            </div>

            <div className="border-t border-gray-200 pt-7">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">
                  Anexar por tipo de documento
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  As fotos ficam selecionadas nesta tela até você clicar em Salvar autorização. Aguarde a confirmação de cada arquivo antes de sair.
                </p>
              </div>

              <div className="space-y-4">
                <DocumentUploadCard
                  title="Doc. Cliente (RG/CNH)"
                  disabled={iniciada || carregando}
                  estadoEnvio={estadoCategoria("documento_cliente")}
                  accent="red"
                  onFileChange={(file) =>
                    definirArquivo("documento_cliente", file)
                  }
                />

                <DocumentUploadCard
                  title="Receita Médica"
                  disabled={iniciada || carregando}
                  estadoEnvio={estadoCategoria("receita_medica")}
                  accent="orange"
                  onFileChange={(file) =>
                    definirArquivo("receita_medica", file)
                  }
                  onQrCodeClick={() => setLeitorQrAberto(true)}
                />

                <DocumentUploadCard
                  title="Cupom Fiscal"
                  disabled={iniciada || carregando}
                  estadoEnvio={estadoCategoria("cupom_fiscal")}
                  accent="green"
                  onFileChange={(file) =>
                    definirArquivo("cupom_fiscal", file)
                  }
                />

                <DocumentUploadCard
                  title="Cupom Vinculado"
                  disabled={iniciada || carregando}
                  estadoEnvio={estadoCategoria("cupom_vinculado")}
                  accent="blue"
                  onFileChange={(file) =>
                    definirArquivo("cupom_vinculado", file)
                  }
                />

                <DocumentUploadCard
                  title="Outros Documentos"
                  disabled={iniciada || carregando}
                  estadoEnvio={estadoCategoria("outros")}
                  accent="purple"
                  optional
                  multiple
                  onFilesChange={setOutrosArquivos}
                />
              </div>
            </div>

            </fieldset>

            {iniciada && <p role="status" className="text-sm text-gray-600">{Object.values(estados).filter(e=>e==='salvo').length} de {itensEnvio.length} arquivos confirmados. Não feche esta tela enquanto houver pendentes.</p>}

            {erro && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
                : iniciada ? "Tentar novamente" : "Salvar autorização"}
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
