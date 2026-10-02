"use client";
import Link from "next/link";
import { useState } from "react";
import {
  confirmados,
  moeda,
  numero,
  dataBr,
  type ItemVenda,
  type AutorizacaoVenda,
} from "../../lib/vendas/domain";
import { Vazio } from "./Graficos";
const campos: Record<string, string> = {
  produto: "Produto",
  ean: "EAN/GTIN",
  unidade: "Unidade",
  quantidade: "Quantidade",
  valor_unitario: "Valor unitário",
  valor_total: "Valor total",
  valor_pfpb: "Previsto PFPB",
  principio_ativo: "Princípio ativo",
  indicacao: "Indicação",
  data_dispensacao: "Data do cupom",
};
export default function TabelaItens({
  itens,
  autorizacoes,
}: {
  itens: ItemVenda[];
  autorizacoes: AutorizacaoVenda[];
}) {
  const [pagina, setPagina] = useState(0),
    [origem, setOrigem] = useState<string | null>(null);
  const rows = confirmados(itens),
    index = new Map(autorizacoes.map((a) => [a.id, a]));
  const selecionado = rows.find((i) => i.id === origem),
    aSelecionada = selecionado ? index.get(selecionado.autorizacao_id) : null;
  const p = Math.min(pagina, Math.max(0, Math.ceil(rows.length / 25) - 1));
  return (
    <section className="rbk-card overflow-hidden">
      <div className="border-b border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900">
          Detalhamento das dispensações
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length.toLocaleString("pt-BR")} itens confirmados. Campos sem
          informação aparecem como “—”.
        </p>
      </div>
      {selecionado && (
        <aside
          aria-label="Origem dos campos"
          className="m-5 rounded-xl border border-red-100 bg-red-50/50 p-5"
        >
          <div className="flex justify-between gap-4">
            <h3 className="font-bold text-gray-900">
              Origem • {selecionado.produto || "Produto não informado"}
            </h3>
            <button
              onClick={() => setOrigem(null)}
              className="min-h-9 px-3 text-sm font-semibold text-red-700"
            >
              Fechar
            </button>
          </div>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            {Object.entries(selecionado.origens).map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold text-gray-700">
                  {campos[key] || key}
                </dt>
                <dd className="break-words text-gray-600">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 break-all text-xs text-gray-600">
            Documento: {selecionado.documento_id} • Posição:{" "}
            {selecionado.posicao}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Data da autorização: cadastro existente. Farmácia e CPF: cadastro da
            autorização.
          </p>
          {aSelecionada && (
            <p className="mt-2 text-xs text-gray-600">
              CPF: {aSelecionada.cpf_cliente || "Não informado"} • Observação:{" "}
              {aSelecionada.observacao || "Não informada"}
            </p>
          )}
          <Link
            href={`/autorizacoes/${selecionado.autorizacao_id}/documentos`}
            className="mt-3 inline-block text-sm font-bold text-red-700"
          >
            Abrir documentos da autorização →
          </Link>
        </aside>
      )}
      {rows.length ? (
        <>
          <div
            className="overflow-x-auto"
            tabIndex={0}
            aria-label="Tabela detalhada; deslize para ver todas as colunas"
          >
            <table className="w-full min-w-[1480px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  {[
                    "Medicamento / produto",
                    "Quantidade",
                    "Valor unitário",
                    "Valor total",
                    "Previsto PFPB",
                    "Autorização",
                    "Data da autorização",
                    "Data no cupom",
                    "Farmácia",
                    "Princípio ativo / indicação",
                    "Fonte",
                  ].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(p * 25, p * 25 + 25).map((i) => {
                  const a = index.get(i.autorizacao_id);
                  return (
                    <tr key={i.id} className="hover:bg-gray-50/70">
                      <td className="min-w-52 px-4 py-4">
                        <p className="font-semibold text-gray-900">
                          {i.produto || "—"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          EAN: {i.ean || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {i.quantidade === null ? "—" : numero(i.quantidade)}
                        <small className="block text-gray-500">
                          {i.unidade || "Unidade não informada"}
                        </small>
                      </td>
                      {[i.valor_unitario, i.valor_total, i.valor_pfpb].map(
                        (n, j) => (
                          <td key={j} className="whitespace-nowrap px-4 py-4">
                            {n === null
                              ? "—"
                              : j === 0
                                ? n.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                    maximumFractionDigits: 4,
                                  })
                                : moeda(n)}
                          </td>
                        ),
                      )}
                      <td className="px-4 py-4 font-mono text-xs">
                        {a?.numero_autorizacao || "—"}
                      </td>
                      <td className="px-4 py-4">
                        {a ? dataBr(a.data_autorizacao) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {i.data_dispensacao ? dataBr(i.data_dispensacao) : "—"}
                      </td>
                      <td className="px-4 py-4">{a?.farmacia || "—"}</td>
                      <td className="px-4 py-4">
                        {i.principio_ativo || "—"}
                        <small className="block text-gray-500">
                          {i.indicacao || "Indicação não informada"}
                        </small>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setOrigem(i.id)}
                          className="min-h-10 whitespace-nowrap font-bold text-red-700"
                        >
                          Ver origem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 p-5 text-sm">
            <span className="text-gray-500">
              {p * 25 + 1}–{Math.min((p + 1) * 25, rows.length)} de{" "}
              {rows.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={p === 0}
                onClick={() => {
                  setPagina(p - 1);
                  setOrigem(null);
                }}
                className="min-h-10 rounded-lg border border-gray-200 px-4 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={(p + 1) * 25 >= rows.length}
                onClick={() => {
                  setPagina(p + 1);
                  setOrigem(null);
                }}
                className="min-h-10 rounded-lg border border-gray-200 px-4 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="p-6">
          <Vazio texto="Ainda não há itens confirmados neste período. As autorizações existentes continuam disponíveis no resumo e na exportação." />
        </div>
      )}
    </section>
  );
}
