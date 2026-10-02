"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { comandoCupom } from "../../lib/cupons/client";
import {
  validarRevisao,
  type ItemExtraido,
  type PaginaCupom,
} from "../../lib/cupons/parser";
type Job = {
  documento_id: string;
  versao: string;
  estado: string;
  erro: string | null;
  tentativas: number;
  resultado: {
    itens?: ItemExtraido[];
    aviso?: string;
    paginas?: PaginaCupom[];
  };
};
type Doc = { id: string; categoria: string; nome_arquivo: string | null };
const estados: Record<string, string> = {
  fila: "Na fila de leitura",
  processando: "Lendo cupom",
  revisao: "Aguardando conferência",
  erro: "Leitura não concluída",
  confirmado: "Itens confirmados",
  substituido: "Outra base foi confirmada",
};
const campos: [keyof ItemExtraido, string, boolean][] = [
  ["produto", "Produto", false],
  ["ean", "EAN/GTIN", false],
  ["unidade", "Unidade", false],
  ["quantidade", "Quantidade", true],
  ["valor_unitario", "Valor unitário", true],
  ["valor_total", "Total do item", true],
  ["valor_pfpb", "Valor PFPB explícito no cupom", true],
  ["principio_ativo", "Princípio ativo (se houver fonte)", false],
  ["indicacao", "Indicação (se houver fonte)", false],
  ["data_dispensacao", "Data no cupom", false],
  ["fonte", "Página/linha ou referência de cada informação", false],
];
const novo = (): ItemExtraido => ({
  produto: "",
  ean: null,
  unidade: null,
  quantidade: null,
  valor_unitario: null,
  valor_total: null,
  valor_pfpb: null,
  principio_ativo: null,
  indicacao: null,
  data_dispensacao: null,
  fonte: "",
});
export default function ConferenciaCupons({
  autorizacaoId,
}: {
  autorizacaoId: string;
}) {
  const [docs, setDocs] = useState<Doc[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [erro, setErro] = useState(""),
    [mensagem, setMensagem] = useState(""),
    [busy, setBusy] = useState(false),
    [aviso, setAviso] = useState("");
  const [editor, setEditor] = useState<{
      job: Job;
      itens: ItemExtraido[];
    } | null>(null),
    [conferido, setConferido] = useState(false);
  const ocupado = useRef(false),
    geracao = useRef(0);
  const carregar = useCallback(async () => {
    const g = ++geracao.current;
    const client = createClient();
    const [d, j] = await Promise.all([
      client
        .from("documentos")
        .select("id,categoria,nome_arquivo")
        .eq("autorizacao_id", autorizacaoId)
        .in("categoria", ["cupom_fiscal", "cupom_vinculado"])
        .eq("status", "recebido")
        .order("id"),
      client
        .from("cupom_extracoes")
        .select("documento_id,versao,estado,erro,tentativas,resultado")
        .eq("autorizacao_id", autorizacaoId)
        .order("documento_id"),
    ]);
    if (g !== geracao.current) return;
    if (d.error) {
      setAviso("Não foi possível consultar os cupons. Use Atualizar.");
      return;
    }
    setDocs(d.data || []);
    if (j.error) {
      setJobs([]);
      setAviso(
        ["42P01", "PGRST205"].includes(j.error.code)
          ? "A extração está preparada, mas ainda precisa ser ativada neste ambiente."
          : "Não foi possível consultar a extração. Use Atualizar.",
      );
      return;
    }
    setJobs((j.data as Job[]) || []);
    setAviso("");
  }, [autorizacaoId]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active && !document.hidden)
        void carregar().catch(() => {
          if (active) setAviso("Não foi possível atualizar as leituras.");
        });
    };
    const timer = setTimeout(refresh, 0),
      poll = setInterval(refresh, 8000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [carregar]);
  async function agir(
    documentoId: string,
    op: "processar" | "repetir" | "confirmar",
  ) {
    if (ocupado.current) return;
    ocupado.current = true;
    setBusy(true);
    setErro("");
    setMensagem("");
    try {
      const payload: Record<string, unknown> = { op, documentoId };
      if (op === "confirmar") {
        if (!editor || !conferido)
          throw new Error("Confira o documento e marque a confirmação.");
        payload.itens = validarRevisao(editor.itens);
        payload.versao = editor.job.versao;
        payload.substituir = true;
      }
      setMensagem(await comandoCupom(createClient(), payload));
      if (op === "confirmar") {
        setEditor(null);
        setConferido(false);
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Operação indisponível.");
    } finally {
      ocupado.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="rbk-card mt-7 p-5 sm:p-6"
      aria-label="Leitura e conferência dos cupons"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Itens dos cupons • Vendas e Indicadores
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            A leitura começa após o envio. Confira os itens antes de incluí-los
            nos indicadores. Cupom fiscal e vinculado representam uma única
            dispensação.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            void carregar().catch(() => setErro("Falha ao atualizar."))
          }
          className="min-h-10 rounded-lg border px-4 text-sm"
        >
          Atualizar
        </button>
      </div>
      {aviso && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {aviso}
        </p>
      )}
      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {erro}
        </p>
      )}
      <p role="status" className="mt-3 text-sm text-gray-600">
        {mensagem}
      </p>
      {!docs.length && (
        <p className="mt-3 text-sm text-gray-500">
          Os cupons recebidos aparecerão aqui.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {docs.map((d) => {
          const j = jobs.find((j) => j.documento_id === d.id);
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4"
            >
              <div>
                <p className="break-all text-sm font-semibold">
                  {d.nome_arquivo || d.categoria}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {j ? estados[j.estado] : "Ainda sem leitura"}
                  {j?.estado === "erro"
                    ? ` • ${j.erro || "Tente novamente com um arquivo legível."}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {(!j || ["fila", "erro"].includes(j.estado)) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void agir(
                        d.id,
                        j?.estado === "erro" ? "repetir" : "processar",
                      )
                    }
                    className="min-h-10 px-3 text-sm font-semibold text-red-700"
                  >
                    {j?.estado === "erro"
                      ? "Tentar novamente"
                      : "Iniciar leitura"}
                  </button>
                )}
                {j?.estado === "processando" && (
                  <button
                    disabled={busy}
                    onClick={() => void agir(d.id, "repetir")}
                    className="min-h-10 px-3 text-xs text-gray-600"
                  >
                    Retomar se interrompida
                  </button>
                )}
                {j?.estado === "revisao" && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditor({
                        job: j,
                        itens: (j.resultado.itens || []).map((i) => ({ ...i })),
                      });
                      setConferido(false);
                      setErro("");
                    }}
                    className="rbk-primary min-h-10 rounded-lg px-4 text-sm font-bold"
                  >
                    Conferir itens
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editor && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50/30 p-4">
          <h3 className="font-bold text-gray-900">Conferir extração</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {editor.job.resultado.aviso ||
              "Confira o cupom inteiro, incluindo linhas não reconhecidas. Deixe campos ausentes em branco."}
          </p>
          <p className="mt-2 text-sm font-semibold text-red-800">
            Valor PFPB não é o preço de venda. Preencha apenas se houver valor
            explícito na fonte.
          </p>
          <details className="my-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Texto lido do cupom
            </summary>
            {editor.job.resultado.paginas?.map((p) => (
              <pre
                key={p.pagina}
                className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs"
              >
                Página {p.pagina} • {p.metodo}
                {"\n"}
                {p.texto}
              </pre>
            ))}
          </details>
          {editor.itens.map((item, index) => (
            <fieldset
              key={index}
              disabled={busy}
              className="mt-4 rounded-xl border border-gray-200 bg-white p-4"
            >
              <legend className="px-2 text-sm font-semibold">
                Item {index + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campos.map(([key, label, numerico]) => (
                  <label
                    key={key}
                    className="text-xs font-semibold text-gray-600"
                  >
                    {label}
                    <input
                      type={
                        numerico
                          ? "number"
                          : key === "data_dispensacao"
                            ? "date"
                            : "text"
                      }
                      min={numerico ? 0 : undefined}
                      step={
                        numerico
                          ? key === "quantidade"
                            ? "0.001"
                            : key === "valor_unitario"
                              ? "0.0001"
                              : "0.01"
                          : undefined
                      }
                      value={item[key] ?? ""}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setConferido(false);
                        setEditor({
                          ...editor,
                          itens: editor.itens.map((r, n) =>
                            n === index
                              ? {
                                  ...r,
                                  [key]:
                                    valor === ""
                                      ? key === "produto" || key === "fonte"
                                        ? ""
                                        : null
                                      : numerico
                                        ? Number(valor)
                                        : valor,
                                }
                              : r,
                          ),
                        });
                      }}
                      className="mt-1 block min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal text-gray-900"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setConferido(false);
                  setEditor({
                    ...editor,
                    itens: editor.itens.filter((_, n) => n !== index),
                  });
                }}
                className="mt-3 min-h-9 text-xs font-semibold text-red-700"
              >
                Remover da lista
              </button>
            </fieldset>
          ))}
          <button
            disabled={busy || editor.itens.length >= 500}
            onClick={() => {
              setConferido(false);
              setEditor({ ...editor, itens: [...editor.itens, novo()] });
            }}
            className="mt-4 min-h-10 rounded-lg border border-gray-300 px-4 text-sm"
          >
            + Adicionar item não reconhecido
          </button>
          <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-gray-700">
            <input
              type="checkbox"
              disabled={busy}
              checked={conferido}
              onChange={(e) => setConferido(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-red-700"
            />
            Conferi o documento inteiro. Esta lista será a única base de itens
            da autorização e substituirá qualquer lista anterior, sem somar os
            dois cupons.
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={busy || !conferido || !editor.itens.length}
              onClick={() => void agir(editor.job.documento_id, "confirmar")}
              className="rbk-primary min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-40"
            >
              Confirmar itens para os indicadores
            </button>
            <button
              disabled={busy}
              onClick={() => setEditor(null)}
              className="min-h-11 px-4 text-sm"
            >
              Fechar sem salvar
            </button>
          </div>
        </div>
      )}
      <Link
        href="/vendas"
        className="mt-5 inline-block text-sm font-bold text-red-700"
      >
        Abrir Vendas e Indicadores →
      </Link>
    </section>
  );
}
