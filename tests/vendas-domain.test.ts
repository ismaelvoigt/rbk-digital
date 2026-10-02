import { describe, it, expect } from "vitest";
import {
  periodo,
  analisar,
  comparar,
  agrupar,
  serie,
  type ItemVenda,
  type AutorizacaoVenda,
} from "../src/lib/vendas/domain";
const a: AutorizacaoVenda = {
  id: "a",
  numero_autorizacao: "000123456789012",
  data_autorizacao: "2026-09-26",
  farmacia: null,
  cpf_cliente: null,
  observacao: null,
  created_at: "2026-09-26T12:00:00Z",
};
const item = (over: Partial<ItemVenda> = {}): ItemVenda => ({
  id: "i",
  autorizacao_id: "a",
  documento_id: "d",
  posicao: 1,
  produto: "Produto",
  ean: null,
  unidade: "cx",
  quantidade: 2,
  valor_unitario: 10,
  valor_total: 20,
  valor_pfpb: null,
  principio_ativo: null,
  indicacao: null,
  data_dispensacao: null,
  status: "confirmado",
  origens: {
    produto: "cupom fiscal, linha 1",
    quantidade: "cupom fiscal, linha 1",
    valor_total: "cupom fiscal, linha 1",
  },
  ...over,
});
describe("datas gerenciais", () => {
  it("usa dia de São Paulo e comparação com mesma duração", () => {
    expect(periodo("hoje", new Date("2026-09-27T01:00:00Z"))).toMatchObject({
      inicio: "2026-09-26",
      fim: "2026-09-26",
      anterior: { inicio: "2026-09-25", fim: "2026-09-25" },
    });
    expect(periodo("7dias", new Date("2026-01-03T12:00:00Z"))).toMatchObject({
      inicio: "2025-12-28",
      fim: "2026-01-03",
      anterior: { inicio: "2025-12-21", fim: "2025-12-27" },
    });
  });
  it("mês e ano começam no calendário e terminam hoje", () => {
    expect(periodo("mes", new Date("2026-09-26T12:00Z")).inicio).toBe(
      "2026-09-01",
    );
    expect(periodo("ano", new Date("2026-09-26T12:00Z")).inicio).toBe(
      "2026-01-01",
    );
  });
  it("rejeita datas impossíveis, invertidas e intervalos excessivos", () => {
    for (const [i, f] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-09-26", "2026-09-01"],
      ["2000-01-01", "2026-01-01"],
    ])
      expect(() => periodo("personalizado", new Date(), i, f)).toThrow();
  });
});
describe("indicadores honestos", () => {
  it("não converte falta de extração ou valor PFPB em zero", () => {
    expect(analisar([a], [])).toMatchObject({
      autorizacoes: 1,
      semItens: 1,
      quantidade: null,
      total: null,
      pfpb: null,
      ticket: null,
    });
    expect(analisar([a], [item()])).toMatchObject({
      quantidade: 2,
      total: 20,
      pfpb: null,
      ticket: 20,
    });
  });
  it("exclui pendentes/cancelados, deduplica IDs e não inventa valores ausentes", () => {
    expect(
      analisar(
        [a],
        [
          item(),
          item(),
          item({ id: "p", status: "pendente" }),
          item({ id: "c", status: "cancelado" }),
        ],
      ),
    ).toMatchObject({ quantidade: 2, total: 20, itens: 1 });
    expect(analisar([a], [item({ valor_total: null })])).toMatchObject({
      total: null,
      ticket: null,
    });
  });
  it("sinaliza cobertura parcial e ticket usa só autorizações completas", () => {
    const b = { ...a, id: "b" };
    expect(
      analisar(
        [a, b],
        [
          item(),
          item({
            id: "b1",
            autorizacao_id: "b",
            valor_total: null,
            quantidade: null,
          }),
        ],
      ),
    ).toMatchObject({
      total: 20,
      quantidade: 2,
      ticket: 20,
      ticketBase: 1,
      totalInformado: 1,
      quantidadeInformada: 1,
      semItens: 0,
    });
  });
  it("pendentes tornam a autorização incompleta sem entrar nas somas", () => {
    const rows = [
      item(),
      item({ id: "p", status: "pendente", valor_total: 80 }),
    ];
    expect(analisar([a], rows)).toMatchObject({
      total: 20,
      ticket: null,
      ticketBase: 0,
      pendentes: 1,
    });
    expect(
      serie([a], rows, { inicio: "2026-09-26", fim: "2026-09-26" }, "dia")[0]
        .parcial,
    ).toBe(true);
  });
  it("soma centavos sem erro binário e reconhece zero explícito", () => {
    expect(
      analisar(
        [a],
        [
          item({ valor_total: 0.1, valor_pfpb: 0 }),
          item({ id: "i2", valor_total: 0.2, valor_pfpb: 0 }),
        ],
      ),
    ).toMatchObject({ total: 0.3, pfpb: 0, ticket: 0.3 });
  });
  it("não calcula percentual com base zero ou incompleta", () => {
    expect(comparar(12, 0)).toBeNull();
    expect(comparar(null, 3)).toBeNull();
    expect(comparar(12, 10)).toBe(20);
  });
  it("agrupa produtos por EAN e unidade, não mistura apresentações nem unidades", () => {
    const rows = [
      item({ ean: "123", unidade: "cx" }),
      item({ id: "2", ean: "123", unidade: "un" }),
      item({ id: "3", ean: "456", unidade: "cx" }),
    ];
    expect(agrupar(rows, "produto")).toHaveLength(3);
    expect(agrupar(rows, "principio_ativo")[0].nome).toContain("Não informado");
  });
  it("evolução usa data da autorização e não preenche lacunas com vendas zero", () => {
    const s = serie(
      [a],
      [item()],
      { inicio: "2026-09-25", fim: "2026-09-26" },
      "dia",
    );
    expect(s.map((x) => x.valor)).toEqual([null, 20]);
  });
});
