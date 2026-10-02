import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
const state = vi.hoisted(() => ({ perfil: "farmacia", admin: false }));
vi.mock("@supabase/ssr", async (original) => ({
  ...await original<typeof import("@supabase/ssr")>(),
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: {name: string; value: string; options: CookieOptions}[], headers: Record<string, string>) => void } }) => ({
    auth: { getClaims: async () => {
      options.cookies.setAll([
        { name: "sb-test-auth-token.0", value: "renewed", options: { path: "/", maxAge: 34560000 } },
        { name: "sb-test-auth-token.1", value: "", options: { path: "/", maxAge: 0 } },
      ], { "Cache-Control": "private, no-store" });
      return { data: { claims: { sub: "user-id" } } };
    } },
  }),
}));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({
      data: table === "users" ? { perfil: state.perfil, status: "active" } : state.admin ? { user_id: "user-id" } : null,
      error: null,
    }) }; return query;
  },
}) }));
import { updateSession } from "../src/lib/supabase/proxy";
beforeEach(() => { state.perfil = "farmacia"; state.admin = false; });
it.each(["farmacia", "gestor_rbk"])("renova %s sem perder política ou ressuscitar chunks removidos", async (perfil) => {
  state.perfil = perfil;
  const response = await updateSession(new NextRequest(`https://rbk.test/${perfil === "farmacia" ? "" : "dashboard"}`, {
    headers: { cookie: "sb-test-auth-token.0=old; sb-test-auth-token.1=old-chunk; rbk-session-persistence=farmacia" },
  }));
  expect(response.cookies.get("sb-test-auth-token.0")?.value).toBe("renewed");
  expect(response.cookies.get("sb-test-auth-token.1")?.maxAge).toBe(0);
  expect(response.cookies.get("sb-test-auth-token.0")?.maxAge).toBe(perfil === "farmacia" ? 34560000 : undefined);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("admin prevalece sobre farmacia ao abrir a página de login", async () => {
  state.admin = true;
  const response = await updateSession(new NextRequest("https://rbk.test/", {
    headers: { cookie: "rbk-session-persistence=farmacia; sb-test-auth-token.0=old" },
  }));
  expect(response.headers.get("location")).toBeNull();
  expect(response.cookies.get("sb-test-auth-token.0")?.maxAge).toBeUndefined();
  expect(response.cookies.get("rbk-session-persistence")?.value).toBe("session");
});
