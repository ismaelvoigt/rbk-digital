import { expect, it, vi } from "vitest";
import {
  normalizarPesquisa,
  pesquisarAutorizacoes,
  listarPesquisaCompleta,
  revalidarSelecao,
  obterEscopoPesquisa,
} from "../src/lib/autorizacoes/pesquisa";
const scope = { actorId: "actor", farmId: "farm" };
function client(rows: any[] = [], count = rows.length) {
  const calls: any[] = [];
  const query: any = {
    then: (resolve: any) =>
      Promise.resolve(resolve({ data: rows, error: null, count })),
  };
  for (const method of ["select", "eq", "gte", "lte", "order", "range", "in"])
    query[method] = (...args: any[]) => {
      calls.push([method, ...args]);
      return query;
    };
  query.maybeSingle = async () => ({
    data: { id: "farm", perfil: "operador", farm_id: "farm", status: "active" },
    error: null,
  });
  const c: any = {
    auth: {
      getUser: async () => ({ data: { user: { id: "actor" } }, error: null }),
    },
    from: (table: string) => {
      calls.push(["from", table]);
      return table === "rbk_admins"
        ? {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }
        : query;
    },
  };
  return { c, calls, query };
}
it("normalizes full month, leap year and rejects invalid dates without timezone conversion", () => {
  expect(normalizarPesquisa({ modo: "mes", mes: "2028-02" })).toMatchObject({
    inicio: "2028-02-01",
    fim: "2028-02-29",
  });
  expect(normalizarPesquisa({ modo: "mes", mes: "2026-12" })).toMatchObject({
    inicio: "2026-12-01",
    fim: "2026-12-31",
  });
  expect(() =>
    normalizarPesquisa({ modo: "dia", dia: "2026-02-30" }),
  ).toThrow();
  expect(() =>
    normalizarPesquisa({
      modo: "periodo",
      inicio: "2026-11-02",
      fim: "2026-11-01",
    }),
  ).toThrow();
  expect(() => normalizarPesquisa({ modo: "livre" })).toThrow();
  expect(normalizarPesquisa({ modo: "livre", cpf: "123.456.789-01" }).cpf).toBe(
    "12345678901",
  );
});
it("requests exactly 20 on the second page, includes farm and count, and keeps both period boundaries inclusive", async () => {
  const { c, calls } = client();
  await pesquisarAutorizacoes(
    c,
    scope,
    { inicio: "2026-11-01", fim: "2026-11-02", cpf: "", numero: "" },
    1,
    "2026-11-02T12:00:00Z",
  );
  expect(calls).toContainEqual(["eq", "farm_id", "farm"]);
  expect(calls).toContainEqual(["range", 20, 39]);
  expect(calls).toContainEqual(["lte", "data_autorizacao", "2026-11-02"]);
  expect(calls).toContainEqual(["lte", "created_at", "2026-11-02T12:00:00Z"]);
});
it("rejects another session or farm before querying authorization records", async () => {
  const { c, calls } = client();
  await expect(
    pesquisarAutorizacoes(
      c,
      { ...scope, actorId: "other" },
      { inicio: "", fim: "", cpf: "12345678901", numero: "" },
      0,
      "x",
    ),
  ).rejects.toThrow();
  expect(calls.some((x) => x[0] === "from" && x[1] === "autorizacoes")).toBe(
    false,
  );
  await expect(obterEscopoPesquisa(c, "other-farm")).rejects.toThrow();
});
it("exports all pages and refuses missing selected records rather than silently omitting them", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    farm_id: "farm",
  }));
  const { c, query } = client(rows, 21);
  let page = 0;
  query.range = () => {
    page++;
    query.then = (resolve: any) =>
      Promise.resolve(
        resolve({
          data: page === 1 ? rows : [{ id: "20", farm_id: "farm" }],
          error: null,
          count: 21,
        }),
      );
    return query;
  };
  expect(
    await listarPesquisaCompleta(
      c,
      scope,
      { inicio: "", fim: "", cpf: "12345678901", numero: "" },
      "2026-11-02T12:00:00Z",
    ),
  ).toHaveLength(21);
  const m = client([{ id: "one" }], 1);
  await expect(
    revalidarSelecao(m.c, scope, ["one", "missing"]),
  ).rejects.toThrow();
});
