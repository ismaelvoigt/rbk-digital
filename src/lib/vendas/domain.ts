export type ModoPeriodo = "hoje" | "7dias" | "mes" | "ano" | "personalizado";
export type Intervalo = { inicio: string; fim: string };
export type Periodo = Intervalo & { anterior: Intervalo };
export type AutorizacaoVenda = {
  id: string;
  numero_autorizacao: string;
  data_autorizacao: string;
  farmacia: string | null;
  cpf_cliente: string | null;
  observacao: string | null;
  created_at: string;
};
export type ItemVenda = {
  id: string;
  autorizacao_id: string;
  documento_id: string;
  posicao: number;
  produto: string | null;
  ean: string | null;
  unidade: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  valor_pfpb: number | null;
  principio_ativo: string | null;
  indicacao: string | null;
  data_dispensacao: string | null;
  status: "pendente" | "confirmado" | "cancelado";
  origens: Record<string, string>;
};
export const moeda = (n: number | null) =>
  n === null
    ? "Não disponível"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const numero = (n: number | null) =>
  n === null
    ? "Não disponível"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const dataBr = (s: string) => s.split("-").reverse().join("/");
const DIA = 86400000;
function validarData(s: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error("Informe datas válidas.");
}
export function deslocar(s: string, dias: number) {
  return new Date(Date.parse(s) + dias * DIA).toISOString().slice(0, 10);
}
export function periodo(
  modo: ModoPeriodo,
  agora = new Date(),
  inicio = "",
  fim = "",
): Periodo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const part = (tipo: string) => parts.find((p) => p.type === tipo)!.value;
  const hoje = `${part("year")}-${part("month")}-${part("day")}`;
  if (modo !== "personalizado") {
    fim = hoje;
    inicio =
      modo === "hoje"
        ? hoje
        : modo === "7dias"
          ? deslocar(hoje, -6)
          : modo === "mes"
            ? hoje.slice(0, 7) + "-01"
            : hoje.slice(0, 4) + "-01-01";
  }
  validarData(inicio);
  validarData(fim);
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / DIA) + 1;
  if (dias < 1)
    throw new Error("A data inicial deve ser anterior ou igual à data final.");
  if (dias > 3660) throw new Error("Selecione um período de até 10 anos.");
  return {
    inicio,
    fim,
    anterior: { inicio: deslocar(inicio, -dias), fim: deslocar(inicio, -1) },
  };
}
export function confirmados(items: ItemVenda[]) {
  return [
    ...new Map(
      items.filter((i) => i.status === "confirmado").map((i) => [i.id, i]),
    ).values(),
  ];
}
function soma(
  items: ItemVenda[],
  campo: "quantidade" | "valor_total" | "valor_pfpb",
) {
  const valores = items.flatMap((i) => (i[campo] === null ? [] : [i[campo]!]));
  if (!valores.length) return null;
  const fator = campo === "quantidade" ? 1000 : 100;
  return valores.reduce((a, b) => a + Math.round(b * fator), 0) / fator;
}
export function analisar(autorizacoes: AutorizacaoVenda[], items: ItemVenda[]) {
  const ids = new Set(autorizacoes.map((a) => a.id)),
    rows = confirmados(items).filter((i) => ids.has(i.autorizacao_id));
  const grupos = new Map<string, ItemVenda[]>();
  for (const row of rows)
    grupos.set(row.autorizacao_id, [
      ...(grupos.get(row.autorizacao_id) || []),
      row,
    ]);
  const pendentes = items.filter(
    (i) => i.status === "pendente" && ids.has(i.autorizacao_id),
  );
  const incompletas = new Set(pendentes.map((i) => i.autorizacao_id));
  const completos = [...grupos.values()].filter(
    (g) =>
      !incompletas.has(g[0].autorizacao_id) &&
      g.every((i) => i.valor_total !== null),
  );
  const ticketTotal = completos.length
    ? soma(completos.flat(), "valor_total")
    : null;
  return {
    pendentes: pendentes.length,
    autorizacoes: ids.size,
    itens: rows.length,
    semItens: ids.size - grupos.size,
    quantidade: soma(rows, "quantidade"),
    total: soma(rows, "valor_total"),
    pfpb: soma(rows, "valor_pfpb"),
    ticket:
      ticketTotal === null
        ? null
        : Math.round((ticketTotal / completos.length) * 100) / 100,
    ticketBase: completos.length,
    quantidadeInformada: rows.filter((i) => i.quantidade !== null).length,
    totalInformado: rows.filter((i) => i.valor_total !== null).length,
    pfpbInformado: rows.filter((i) => i.valor_pfpb !== null).length,
  };
}
export function comparar(atual: number | null, anterior: number | null) {
  return atual === null || anterior === null || anterior === 0
    ? null
    : Math.round(((atual - anterior) / anterior) * 1000) / 10;
}
export type Grupo = {
  nome: string;
  unidade: string;
  quantidade: number | null;
  itens: number;
  informados: number;
};
export function agrupar(
  items: ItemVenda[],
  campo: "produto" | "principio_ativo" | "indicacao",
): Grupo[] {
  const grupos = new Map<
    string,
    { nome: string; unidade: string; rows: ItemVenda[] }
  >();
  for (const i of confirmados(items)) {
    const nome = i[campo] || "Não informado",
      unidade = i.unidade || "unidade não informada";
    const chave = JSON.stringify([
      campo === "produto" ? i.ean || nome : nome,
      unidade,
    ]);
    const g = grupos.get(chave) || {
      nome: campo === "produto" && i.ean ? `${nome} • ${i.ean}` : nome,
      unidade,
      rows: [],
    };
    g.rows.push(i);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      nome: g.nome,
      unidade: g.unidade,
      quantidade: soma(g.rows, "quantidade"),
      itens: g.rows.length,
      informados: g.rows.filter((i) => i.quantidade !== null).length,
    }))
    .sort((a, b) => (b.quantidade ?? -1) - (a.quantidade ?? -1));
}
export function serie(
  autorizacoes: AutorizacaoVenda[],
  items: ItemVenda[],
  p: Intervalo,
  modo: "dia" | "mes",
) {
  const slice = modo === "dia" ? 10 : 7;
  const grupos = new Map<string, AutorizacaoVenda[]>();
  for (let d = p.inicio; d <= p.fim; d = deslocar(d, 1))
    grupos.set(d.slice(0, slice), []);
  for (const a of autorizacoes) {
    const g = grupos.get(a.data_autorizacao.slice(0, slice));
    if (g) g.push(a);
  }
  const index = new Map<string, ItemVenda[]>();
  for (const i of items)
    index.set(i.autorizacao_id, [...(index.get(i.autorizacao_id) || []), i]);
  return [...grupos].map(([data, rows]) => {
    const resumo = analisar(
      rows,
      rows.flatMap((a) => index.get(a.id) || []),
    );
    return {
      data,
      valor: resumo.total,
      parcial:
        resumo.pendentes > 0 ||
        resumo.semItens > 0 ||
        resumo.totalInformado < resumo.itens,
    };
  });
}
