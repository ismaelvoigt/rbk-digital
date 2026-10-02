import { it, expect, vi, afterEach } from "vitest";
import { getAccessDecision } from "../src/lib/auth/accessPolicy";
import { GET, POST } from "../src/app/api/processos/[[...segments]]/route";
const ctx = { params: Promise.resolve({ segments: [] }) };
afterEach(() => vi.unstubAllEnvs());
it("tela bloqueia perfis de farmácia inclusive rotas filhas", () => {
  for (const perfil of ["farmacia", "operador", "administrador_farmacia"])
    expect(
      getAccessDecision({
        authenticated: true,
        perfil,
        pathname: "/processos/credenciamento",
      }).allowed,
    ).toBe(false);
  for (const perfil of ["gestor_rbk", "superadmin_rbk"])
    expect(
      getAccessDecision({
        authenticated: true,
        perfil,
        pathname: "/processos/credenciamento",
      }).allowed,
    ).toBe(true);
});
it("API desabilitada por padrão não lê banco ou arquivos", async () => {
  vi.stubEnv("PFPB_ENABLED", "");
  const r = await GET(new Request("http://localhost/api/processos"), ctx);
  expect(r.status).toBe(503);
  expect(r.headers.get("cache-control")).toContain("no-store");
});
it("bloqueia banco real de produção mesmo com feature habilitada", async () => {
  vi.stubEnv("PFPB_ENABLED", "true");
  vi.stubEnv("PFPB_STAGING_PROJECT_REF", "sqamrlckyuesfmibxizy");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://sqamrlckyuesfmibxizy.supabase.co",
  );
  const r = await POST(
    new Request("http://localhost/api/processos", { method: "POST" }),
    ctx,
  );
  expect(r.status).toBe(503);
});
it("requisição sem token é recusada no staging", async () => {
  vi.stubEnv("PFPB_ENABLED", "true");
  vi.stubEnv("PFPB_STAGING_PROJECT_REF", "staging");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.supabase.co");
  const r = await GET(new Request("http://localhost/api/processos"), ctx);
  expect(r.status).toBe(401);
});
