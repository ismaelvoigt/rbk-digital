import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  obterEscopoPesquisa,
  normalizarPesquisa,
  pesquisarAutorizacoes,
  listarPesquisaCompleta,
  revalidarSelecao,
} from "../src/lib/autorizacoes/pesquisa";
it.runIf(process.env.RBK_TEST_DEV_PESQUISA === "1")(
  "checks real demo pagination, multi-search selection and document metadata using the attendant RLS session",
  async () => {
    process.loadEnvFile(".env.local");
    expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe(
      "ympeqcycjadvvumanmwm.supabase.co",
    );
    const c = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const auth = await c.auth.signInWithPassword({
      email: "rbkdigital@rbkdigital.com.br",
      password: process.env.RBK_DEMO_PASSWORD!,
    });
    expect(auth.error).toBeNull();
    try {
      const scope = await obterEscopoPesquisa(c);
      expect(scope.farmId).toBe("fd54d028-ebf4-447a-8c06-357760e76f09");
      const snapshot = new Date().toISOString(),
        f = normalizarPesquisa({ modo: "dia", dia: "2026-11-02" });
      const a = await pesquisarAutorizacoes(c, scope, f, 0, snapshot),
        b = await pesquisarAutorizacoes(c, scope, f, 1, snapshot);
      expect(a.linhas).toHaveLength(20);
      expect(a.total).toBeGreaterThanOrEqual(25);
      expect(b.linhas.length).toBeGreaterThan(0);
      expect(a.linhas.some((r) => b.linhas.some((x) => x.id === r.id))).toBe(
        false,
      );
      const all = await listarPesquisaCompleta(
        c,
        scope,
        normalizarPesquisa({
          modo: "periodo",
          inicio: "2026-10-31",
          fim: "2026-11-02",
        }),
        snapshot,
      );
      const demo = all.filter((r) =>
        r.observacao?.startsWith("RBK-DEMO-PESQUISA-20261102"),
      );
      expect(demo).toHaveLength(45);
      const older = demo.find((r) => r.data_autorizacao === "2026-10-31")!,
        newer = demo.find((r) => r.data_autorizacao === "2026-11-02")!;
      expect(
        await revalidarSelecao(c, scope, [newer.id, older.id, newer.id]),
      ).toHaveLength(2);
      const d = await c
        .from("documentos")
        .select("id")
        .eq("autorizacao_id", newer.id);
      expect(d.error).toBeNull();
    } finally {
      await c.auth.signOut({ scope: "local" });
    }
  },
  120000,
);
