import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), maybeSingle: vi.fn(), adminSingle: vi.fn() }));
vi.mock("@supabase/ssr", async (importOriginal) => ({ ...await importOriginal<typeof import("@supabase/ssr")>(), createServerClient: () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => { const query = { select: () => query, eq: () => query, maybeSingle: table === "rbk_admins" ? mocks.adminSingle : mocks.maybeSingle }; return query; } }) }));
import { updateSession } from "../src/lib/supabase/proxy";
beforeEach(() => {
  mocks.adminSingle.mockResolvedValue({ data: null, error: null });
  mocks.getClaims.mockResolvedValue({ data: { claims: null } });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "teste", perfil: "farmacia", status: "active" }, error: null });
});
describe("proxy do primeiro acesso", () => {
  it.each(["/primeiro-acesso", "/redefinir-senha", "/esqueci-minha-senha"])("permite abrir %s antes de ter cookies", async (path) => {
    const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app" + path));
    expect(res.headers.get("location")).toBeNull();
  });
  it("mantém a área da farmácia protegida sem sessão", async () => {
    const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/farmacia"));
    expect(res.headers.get("location")).toBe("https://rbk-digital.vercel.app/");
  });
  it.each(["inactive", "inativo", null])("bloqueia acesso interno com status %s", async (status) => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "teste" } } });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "teste", perfil: "farmacia", status }, error: null });
    const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/farmacia"));
    expect(res.headers.get("location")).toBe("https://rbk-digital.vercel.app/");
  });
});

it("preserva o administrador reconhecido pelo login após validar status active", async () => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "teste" } } });
  mocks.adminSingle.mockResolvedValue({ data: { user_id: "teste" }, error: null });
  const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/dashboard"));
  expect(res.headers.get("location")).toBeNull();
});

it("permite consultar o manifesto do PWA sem sessão", async () => {
  const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/manifest.webmanifest"));
  expect(res.headers.get("location")).toBeNull();
});

it("reabre o PWA diretamente na farmácia com sessão ativa", async () => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "teste" } } });
  const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/"));
  expect(res.headers.get("location")).toBe("https://rbk-digital.vercel.app/farmacia");
});
it("não redireciona a página de login em ciclo com acesso inativo", async () => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "teste" } } });
  mocks.maybeSingle.mockResolvedValue({ data: { perfil: "farmacia", status: "inactive" }, error: null });
  const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/"));
  expect(res.headers.get("location")).toBeNull();
});
it.each([false, true])("corrige cookies de sessão no servidor (admin: %s)", async (isAdmin) => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "teste" } } });
  mocks.adminSingle.mockResolvedValue({ data: isAdmin ? { user_id: "teste" } : null, error: null });
  const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/farmacia", {
    headers: { cookie: "sb-test-auth-token.0=chunk0; sb-test-auth-token.1=chunk1" },
  }));
  const cookies = res.cookies.getAll().filter(c => c.name.startsWith("sb-test-auth-token"));
  expect(cookies).toHaveLength(2);
  for (const cookie of cookies) {
    if (isAdmin) { expect(cookie.maxAge).toBeUndefined(); expect(cookie.expires).toBeUndefined(); }
    else expect(cookie.maxAge).toBeGreaterThan(0);
  }
});
