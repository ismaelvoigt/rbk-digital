import { it, expect } from "vitest";
import { carregarVendas } from "../src/lib/vendas/consulta";
import type { SupabaseClient } from "@supabase/supabase-js";
function client(mode = "normal") {
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i).padStart(5, "0"),
    data_autorizacao: "2026-09-26",
  }));
  const calls: string[] = [];
  return {
    calls,
    db: {
      auth: {
        getUser: async () => ({
          data: { user: mode === "expired" ? null : { id: "u" } },
          error: null,
        }),
      },
      rpc: (procedure: string, args: {p_farm:string}) => {
        expect(args.p_farm).toBe("farm-a");
        const table=procedure==="modulos_autorizacoes"?"autorizacoes":"dispensacao_itens";
        calls.push(table);
        let offset = 0,
          end = 499,
          after = "";
        const q = {
          select: () => q,
          eq: () => q,
          gte: () => q,
          lte: () => q,
          in: () => q,
          gt: (_field: string, id: string) => {
            after = id;
            return q;
          },
          order: () => q,
          range: (a: number, b: number) => {
            offset = a;
            end = b;
            return q;
          },
          then: (resolve: (x: unknown) => unknown) => {
            const data = rows
              .filter((r) => !after || r.id > after)
              .slice(offset, end + 1);
            const result =
              table === "autorizacoes"
                ? {
                    data,
                    count: 1001,
                    error:
                      (mode === "error" && (offset > 0 || after)) || mode === "expired"
                        ? { code: "500" }
                        : null,
                  }
                : {
                    data: [],
                    error: mode === "missing" ? { code: "PGRST205" } : null,
                  };
            if (
              table === "autorizacoes" &&
              mode === "deletion" &&
              calls.filter((t) => t === "autorizacoes").length === 1
            )
              rows.shift();
            return resolve(result);
          },
        };
        return q;
      },
    } as unknown as SupabaseClient,
  };
}
it("carrega todas as páginas e mantém autorizações quando ainda não há estrutura de itens", async () => {
  const { db, calls } = client("missing");
  const r = await carregarVendas(db, {
    inicio: "2026-09-01",
    fim: "2026-09-26",
  }, {farmId:"farm-a"});
  expect(r.autorizacoes).toHaveLength(1001);
  expect(r.estruturaDisponivel).toBe(false);
  expect(calls.filter((t) => t === "autorizacoes")).toHaveLength(3);
});
it("falha sem mostrar agregação parcial se uma página falhar", async () => {
  await expect(
    carregarVendas(client("error").db, {
      inicio: "2026-09-01",
      fim: "2026-09-26",
    }, {farmId:"farm-a"}),
  ).rejects.toThrow();
});
it("não mostra dados quando o backend recusa sessão expirada", async () => {
  const { db, calls } = client("expired");
  await expect(
    carregarVendas(db, { inicio: "2026-09-01", fim: "2026-09-26" }, {farmId:"farm-a"}),
  ).rejects.toThrow(/Não foi possível/);
  expect(calls).toEqual(["autorizacoes"]);
});

it("não perde registros não lidos quando há exclusão entre páginas", async () => {
  const r = await carregarVendas(client("deletion").db, {
    inicio: "2026-09-01",
    fim: "2026-09-26",
  }, {farmId:"farm-a"});
  expect(r.autorizacoes).toHaveLength(1001);
  expect(r.autorizacoes.some((a) => a.id === "00500")).toBe(true);
});
