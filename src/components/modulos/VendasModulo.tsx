"use client";
import {useLayoutEffect} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Evolucao, Ranking } from "../../components/vendas/Graficos";
import TabelaItens from "../../components/vendas/TabelaItens";
import { createClient } from "../../lib/supabase/client";
import { carregarVendas, type DadosVendas } from "../../lib/vendas/consulta";
import {
  analisar,
  agrupar,
  comparar,
  dataBr,
  moeda,
  numero,
  periodo,
  serie,
  type ModoPeriodo,
  type Periodo,
} from "../../lib/vendas/domain";
const modos: [ModoPeriodo, string][] = [
  ["hoje", "Hoje"],
  ["7dias", "7 dias"],
  ["mes", "Mês"],
  ["ano", "Ano"],
  ["personalizado", "Período personalizado"],
];
const vazio: DadosVendas = {
  autorizacoes: [],
  itens: [],
  estruturaDisponivel: true,
};
const erroTexto = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
export default function VendasConteudo({farmId,onBusy}:{farmId:string;onBusy:(value:boolean)=>void}) {
  const [modo, setModo] = useState<ModoPeriodo>("mes"),
    [inicio, setInicio] = useState(""),
    [fim, setFim] = useState("");
  const [resultado, setResultado] = useState<{
    atual: DadosVendas;
    anterior: DadosVendas;
    p: Periodo;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [erro, setErro] = useState(""),
    [mensagem, setMensagem] = useState("");
  const [grupo, setGrupo] = useState<"principio_ativo" | "indicacao">(
      "principio_ativo",
    ),
    [escala, setEscala] = useState<"dia" | "mes">("dia"),
    [formato, setFormato] = useState<"xlsx" | "csv">("xlsx");
  const request = useRef(0),
    exportando = useRef(false);
  const buscar = useCallback(async (m: ModoPeriodo, i = "", f = "") => {
    const id = ++request.current;
    setBusy(true);
    setErro("");
    setResultado(null);
    setMensagem("");
    try {
      const p = periodo(m, new Date(), i, f),
        client = createClient();
      const [atual, anterior] = await Promise.all([
        carregarVendas(client, p, {farmId}),
        carregarVendas(client, p.anterior, {farmId}),
      ]);
      if (id === request.current) {
        setResultado({ atual, anterior, p });
        setEscala(m === "ano" ? "mes" : "dia");
      }
    } catch (e) {
      if (id === request.current) setErro(erroTexto(e));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }, [farmId]);
  useEffect(() => {
    const controle = request;
    const timer = setTimeout(() => void buscar("mes"), 0);
  return () => {
      clearTimeout(timer);
      controle.current++;
    };
  }, [buscar]);
  useLayoutEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
  const dados = resultado?.atual || vazio;
  const resumo = useMemo(
    () => analisar(dados.autorizacoes, dados.itens),
    [dados],
  );
  const antes = useMemo(
    () =>
      analisar(
        resultado?.anterior.autorizacoes || [],
        resultado?.anterior.itens || [],
      ),
    [resultado],
  );
  const pontos = useMemo(
    () =>
      resultado
        ? serie(dados.autorizacoes, dados.itens, resultado.p, escala)
        : [],
    [dados, resultado, escala],
  );
  const ranking = useMemo(() => agrupar(dados.itens, "produto"), [dados.itens]);
  const agrupados = useMemo(
    () => agrupar(dados.itens, grupo),
    [dados.itens, grupo],
  );
  function mudar(m: ModoPeriodo) {
    if (exportando.current) return;
    setModo(m);
    setErro("");
    setMensagem("");
    if (m === "personalizado") {
      request.current++;
      setBusy(false);
      setResultado(null);
    } else void buscar(m);
  }
  async function exportar() {
    if (!resultado || busy || exportando.current) return;
    exportando.current = true;
    setBusy(true);
    setErro("");
    setMensagem("Preparando todos os registros do período...");
    try {
      const { baixarPlanilha } = await import("../../lib/vendas/exportar");
      await baixarPlanilha(dados, resultado.p, formato);
      setMensagem("Arquivo preparado. Confira os downloads do navegador.");
    } catch (e) {
      setErro(erroTexto(e));
      setMensagem("");
    } finally {
      exportando.current = false;
      setBusy(false);
    }
  }
  const cobertura = (n: number) =>
    `${n} de ${resumo.itens} itens com informação`;
  const cards = [
    {
      label: "Autorizações",
      valor: numero(resumo.autorizacoes),
      nota: "Registros cadastrados no período",
    },
    {
      label: "Itens dispensados",
      valor: numero(resumo.quantidade),
      nota: `Quantidade declarada • ${cobertura(resumo.quantidadeInformada)}`,
    },
    {
      label: "Total dispensado / vendido",
      valor: moeda(resumo.total),
      nota: cobertura(resumo.totalInformado),
    },
    {
      label: "Previsto a receber • PFPB",
      valor: moeda(resumo.pfpb),
      nota: cobertura(resumo.pfpbInformado),
    },
    {
      label: "Ticket médio",
      valor: moeda(resumo.ticket),
      nota: `Base: ${resumo.ticketBase} autorizações com todos os valores confirmados informados`,
    },
  ];
  const comparacoes = [
    {
      nome: "Autorizações",
      atual: resumo.autorizacoes,
      anterior: antes.autorizacoes,
      dinheiro: false,
      completa: true,
    },
    {
      nome: "Quantidade declarada",
      atual: resumo.quantidade,
      anterior: antes.quantidade,
      dinheiro: false,
      completa:
        resumo.pendentes === 0 &&
        antes.pendentes === 0 &&
        resumo.semItens === 0 &&
        antes.semItens === 0 &&
        resumo.quantidadeInformada === resumo.itens &&
        antes.quantidadeInformada === antes.itens,
    },
    {
      nome: "Valor dispensado",
      atual: resumo.total,
      anterior: antes.total,
      dinheiro: true,
      completa:
        resumo.pendentes === 0 &&
        antes.pendentes === 0 &&
        resumo.semItens === 0 &&
        antes.semItens === 0 &&
        resumo.totalInformado === resumo.itens &&
        antes.totalInformado === antes.itens,
    },
    {
      nome: "Previsto PFPB",
      atual: resumo.pfpb,
      anterior: antes.pfpb,
      dinheiro: true,
      completa:
        resumo.pendentes === 0 &&
        antes.pendentes === 0 &&
        resumo.semItens === 0 &&
        antes.semItens === 0 &&
        resumo.pfpbInformado === resumo.itens &&
        antes.pfpbInformado === antes.itens,
    },
  ];
  return (
    <div>
      
      <div className="rbk-container py-7 sm:py-9">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              Gestão • Programa Farmácia Popular
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Vendas e Indicadores
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Acompanhe as dispensações, os medicamentos e os valores
              documentados da sua farmácia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Formato da planilha"
              value={formato}
              disabled={busy}
              onChange={(e) => setFormato(e.target.value as "xlsx" | "csv")}
              className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.zip)</option>
            </select>
            <button
              disabled={busy || !resultado}
              onClick={() => void exportar()}
              className="rbk-primary min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-40"
            >
              ↓ Exportar planilha
            </button>
          </div>
        </div>
        <section aria-label="Filtros por período" className="rbk-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            {modos.map(([m, label]) => (
              <button
                key={m}
                disabled={busy}
                aria-pressed={modo === m}
                onClick={() => mudar(m)}
                className={`min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 ${modo === m ? "bg-red-700 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {modo === "personalizado" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const i = String(form.get("inicio") || ""),
                  f = String(form.get("fim") || "");
                setInicio(i);
                setFim(f);
                void buscar(modo, i, f);
              }}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <label className="text-xs font-semibold text-gray-600">
                Data inicial
                <input
                  required
                  name="inicio"
                  type="date"
                  disabled={busy}
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value);
                    setResultado(null);
                  }}
                  className="mt-1 block min-h-11 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Data final
                <input
                  required
                  name="fim"
                  type="date"
                  disabled={busy}
                  value={fim}
                  onChange={(e) => {
                    setFim(e.target.value);
                    setResultado(null);
                  }}
                  className="mt-1 block min-h-11 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <button
                disabled={busy}
                className="min-h-11 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white"
              >
                Aplicar período
              </button>
            </form>
          )}
          <p className="mt-4 text-xs leading-5 text-gray-500">
            {resultado
              ? `${dataBr(resultado.p.inicio)} a ${dataBr(resultado.p.fim)} • `
              : ""}
            Referência: data da autorização. Mês e ano acumulados até hoje;
            calendário de São Paulo.
          </p>
        </section>
        {erro && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {erro}
            <button
              disabled={busy}
              onClick={() => void buscar(modo, inicio, fim)}
              className="ml-3 min-h-10 font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
        <p
          role="status"
          aria-live="polite"
          className={
            busy || mensagem ? "mt-4 text-sm text-gray-600" : "sr-only"
          }
        >
          {mensagem || (busy ? "Carregando indicadores..." : "")}
        </p>
        {!resultado && !busy && !erro && (
          <p className="mt-5 text-sm text-gray-600">
            Selecione as datas e aplique o período para consultar.
          </p>
        )}
        <div className="my-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((c, i) => (
            <section
              key={c.label}
              className={`rbk-card p-5 ${i === 3 ? "border-red-200 bg-red-50/30" : ""}`}
            >
              <p className="text-xs font-semibold text-gray-500">{c.label}</p>
              <p
                className={`mt-3 font-bold tracking-tight ${resultado && c.valor === "Não disponível" ? "text-lg text-gray-400" : "text-2xl text-gray-900"}`}
              >
                {resultado ? c.valor : "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">{c.nota}</p>
            </section>
          ))}
        </div>
        {resultado && (
          <>
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">
                {!dados.estruturaDisponivel
                  ? "A estrutura de itens dos cupons ainda precisa ser ativada neste ambiente."
                  : resumo.semItens > 0
                    ? `${resumo.semItens} de ${resumo.autorizacoes} autorizações sem itens confirmados.`
                    : "Indicadores baseados nos itens confirmados disponíveis."}
              </p>
              <p className="mt-1">
                {dados.itens.filter((i) => i.status === "pendente").length}{" "}
                itens aguardando confirmação. Valores ausentes não são zero.
                Totais podem ser parciais; a previsão PFPB exige valor explícito
                na fonte e não comprova recebimento. Quantidades de unidades
                diferentes não são convertidas.
              </p>
            </div>
            <section className="rbk-card mb-5 p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Evolução do valor dispensado
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Valores documentados em reais, pela data da autorização.
                  </p>
                </div>
                <div className="flex rounded-lg bg-gray-100 p-1">
                  {(["dia", "mes"] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={escala === m}
                      onClick={() => setEscala(m)}
                      className={`min-h-9 rounded-md px-4 text-xs font-bold ${escala === m ? "bg-white text-red-700 shadow-sm" : "text-gray-500"}`}
                    >
                      {m === "dia" ? "Diária" : "Mensal"}
                    </button>
                  ))}
                </div>
              </div>
              <Evolucao pontos={pontos} />
            </section>
            <div className="mb-5 grid gap-5 lg:grid-cols-2">
              <section className="rbk-card p-6">
                <h2 className="mb-5 text-lg font-bold text-gray-900">
                  Medicamentos / produtos mais dispensados
                </h2>
                <Ranking grupos={ranking} />
              </section>
              <section className="rbk-card p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    Quantidade por grupo
                  </h2>
                  <select
                    aria-label="Agrupar quantidades por"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value as typeof grupo)}
                    className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs"
                  >
                    <option value="principio_ativo">Princípio ativo</option>
                    <option value="indicacao">Indicação</option>
                  </select>
                </div>
                <Ranking grupos={agrupados} />
              </section>
            </div>
            <section className="rbk-card mb-5 p-6">
              <h2 className="text-lg font-bold text-gray-900">
                Comparação por período
              </h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Atual: {dataBr(resultado.p.inicio)} a {dataBr(resultado.p.fim)}.
                Anterior: {dataBr(resultado.p.anterior.inicio)} a{" "}
                {dataBr(resultado.p.anterior.fim)} (mesma quantidade de dias).
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {comparacoes.map((c) => {
                  const delta = c.completa
                      ? comparar(c.atual, c.anterior)
                      : null,
                    max = Math.max(c.atual || 0, c.anterior || 0, 1);
                  return (
                    <div key={c.nome}>
                      <h3 className="mb-3 text-sm font-semibold text-gray-700">
                        {c.nome}
                      </h3>
                      {[
                        ["Atual", c.atual, "bg-red-600"],
                        ["Anterior", c.anterior, "bg-gray-400"],
                      ].map(([label, v, cor]) => (
                        <div key={String(label)} className="mb-3">
                          <div className="mb-1 flex justify-between gap-2 text-xs text-gray-600">
                            <span>{label}</span>
                            <strong>
                              {c.dinheiro
                                ? moeda(v as number | null)
                                : numero(v as number | null)}
                            </strong>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full ${cor}`}
                              style={{
                                width:
                                  v === null
                                    ? "0%"
                                    : `${(Number(v) / max) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500">
                        {delta === null
                          ? "Variação indisponível: base ausente, parcial ou zero."
                          : `${delta > 0 ? "+" : ""}${numero(delta)}% em relação ao anterior`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <TabelaItens
              key={resultado.p.inicio + resultado.p.fim}
              itens={dados.itens}
              autorizacoes={dados.autorizacoes}
            />
            <details className="mt-5 text-sm text-gray-600">
              <summary className="cursor-pointer font-semibold">
                Como os indicadores são calculados
              </summary>
              <div className="mt-3 space-y-2 leading-6">
                <p>
                  Autorizações: registros únicos pela data cadastrada. Itens
                  dispensados: soma das quantidades informadas nos itens
                  confirmados, sem converter embalagens. Total vendido e PFPB:
                  soma dos respectivos valores explicitamente armazenados.
                </p>
                <p>
                  Ticket médio: soma do total dos itens confirmados de
                  autorizações com todos esses valores preenchidos, dividida
                  pelo número dessas autorizações. Autorizações com itens
                  pendentes, sem itens ou com valores faltantes ficam fora dessa
                  base.
                </p>
                <p>
                  Princípio ativo e indicação só aparecem quando informados com
                  fonte. A exportação inclui todos os itens confirmados do
                  período, todas as autorizações consultadas e os critérios; não
                  se limita à página da tabela.
                </p>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

