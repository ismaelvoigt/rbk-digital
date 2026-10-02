"use client";
import { moeda, numero, dataBr, type Grupo } from "../../lib/vendas/domain";
export function Evolucao({
  pontos,
}: {
  pontos: { data: string; valor: number | null; parcial: boolean }[];
}) {
  const max = Math.max(1, ...pontos.map((p) => p.valor ?? 0));
  if (!pontos.some((p) => p.valor !== null))
    return (
      <Vazio texto="A evolução aparecerá quando houver valores confirmados dos cupons neste período." />
    );
  const largura = Math.max(650, pontos.length * 26),
    h = 220;
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      aria-label="Evolução dos valores. Deslize para ver todo o período."
    >
      <svg
        role="img"
        aria-label="Gráfico de valores por data da autorização"
        viewBox={`0 0 ${largura} 280`}
        style={{ minWidth: largura }}
        className="h-[280px] w-full"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="80"
              x2={largura - 12}
              y1={20 + (1 - f) * h}
              y2={20 + (1 - f) * h}
              stroke="#e5e7eb"
            />
            <text
              x="72"
              y={24 + (1 - f) * h}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {moeda(max * f)}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const slot = (largura - 100) / pontos.length,
            x = 90 + i * slot,
            bh = p.valor === null ? 0 : (p.valor / max) * h;
          return (
            <g key={p.data}>
              <title>
                {p.data}: {moeda(p.valor)}
                {p.parcial ? " (parcial)" : ""}
              </title>
              {p.valor !== null ? (
                <rect
                  x={x}
                  y={240 - Math.max(2, bh)}
                  width={Math.max(3, slot - 5)}
                  height={Math.max(2, bh)}
                  rx="3"
                  fill={p.parcial ? "#f59e0b" : "#b91c1c"}
                />
              ) : (
                <text
                  x={x + slot / 2}
                  y="236"
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="12"
                >
                  —
                </text>
              )}
              {(pontos.length < 40 ||
                i % Math.ceil(pontos.length / 24) === 0) && (
                <text
                  x={x + slot / 2}
                  y="262"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {p.data.length === 7
                    ? p.data.slice(5) + "/" + p.data.slice(0, 4)
                    : dataBr(p.data).slice(0, 5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-xs leading-5 text-gray-500">
        Vermelho: valores informados completos na base confirmada. Âmbar:
        cobertura parcial. Traço: sem valor disponível.
      </p>
      <details className="mt-3 text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold">
          Ver valores do gráfico
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor</th>
              <th>Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.data}>
                <td>{p.data}</td>
                <td>{moeda(p.valor)}</td>
                <td>
                  {p.valor === null
                    ? "Sem valor"
                    : p.parcial
                      ? "Parcial"
                      : "Informada"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function Ranking({ grupos }: { grupos: Grupo[] }) {
  if (!grupos.length)
    return <Vazio texto="Sem itens confirmados para agrupar neste período." />;
  const top = grupos.slice(0, 8),
    max = Math.max(1, ...top.map((g) => g.quantidade ?? 0));
  return (
    <div className="space-y-4">
      {top.map((g, i) => (
        <div key={g.nome + g.unidade}>
          <div className="mb-1.5 flex items-start justify-between gap-4 text-sm">
            <span className="text-gray-700">
              <span className="mr-2 text-xs text-gray-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              {g.nome}
            </span>
            <span className="shrink-0 text-right font-bold text-gray-900">
              {numero(g.quantidade)}
              <small className="block font-normal text-gray-500">
                {g.unidade}
              </small>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-red-600"
              style={{
                width:
                  g.quantidade === null
                    ? "0%"
                    : `${(g.quantidade / max) * 100}%`,
              }}
            />
          </div>
          {g.informados < g.itens && (
            <p className="mt-1 text-xs text-amber-700">
              Quantidade em {g.informados} de {g.itens} itens.
            </p>
          )}
        </div>
      ))}
      <p className="pt-2 text-xs leading-5 text-gray-500">
        Até 8 grupos. Quantidades por unidade declarada; caixas e unidades não
        são convertidas. Todos os itens estão na exportação.
      </p>
    </div>
  );
}
export function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm leading-6 text-gray-500">
      {texto}
    </div>
  );
}
