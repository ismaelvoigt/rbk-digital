import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), maybeSingle: vi.fn(), adminSingle: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (table: string) => { const query = { select: () => query, eq: () => query, maybeSingle: table === "rbk_admins" ? mocks.adminSingle : mocks.maybeSingle }; return query; } }) }));
import { updateSession } from "../src/lib/supabase/proxy";
beforeEach(() => {
  mocks.adminSingle.mockResolvedValue({ data: null, error: null });
  mocks.getClaims.mockResolvedValue({ data: { claims: null } });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "teste", perfil: "farmacia", status: "active" }, error: null });
});
describe("proxy do primeiro acesso", () => {
  it("permite abrir a página de senha antes de ter cookies", async () => {
    const res = await updateSession(new NextRequest("https://rbk-digital.vercel.app/redefinir-senha"));
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
