import { it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({
  autorizar: vi.fn(),
  rpc: vi.fn(),
  after: vi.fn(),
  processar: vi.fn(),
}));
vi.mock("next/server", () => ({ after: h.after }));
vi.mock("../src/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: h.rpc }),
}));
vi.mock("../src/lib/cupons/worker", () => ({ processarProximo: h.processar }));
vi.mock("../src/lib/cupons/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/cupons/http")>()),
  autorizar: h.autorizar,
}));
import { POST } from "../src/app/api/cupons/processar/route";
import { GET } from "../src/app/api/cupons/worker/route";
import { CupomError } from "../src/lib/cupons/http";
const id = "00000000-0000-0000-0000-000000000001";
const req = (b: unknown) =>
  new Request("https://rbk.test/api/cupons/processar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  });
beforeEach(() => {
  vi.clearAllMocks();
  h.processar.mockResolvedValue({ processado: false });
  vi.stubEnv("CUPONS_EXTRACAO_ENABLED", "true");
  h.autorizar.mockResolvedValue({ user: { id } });
  h.rpc.mockResolvedValue({ data: true, error: null });
});
it("nega acesso antes de chamar serviço ou worker", async () => {
  h.autorizar.mockRejectedValue(new CupomError(404, "Cupom indisponível."));
  const r = await POST(req({ op: "processar", documentoId: id }));
  expect(r.status).toBe(404);
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.after).not.toHaveBeenCalled();
});
it("registra fila e agenda no servidor após resposta", async () => {
  const r = await POST(req({ op: "processar", documentoId: id }));
  expect(r.status).toBe(202);
  expect(h.rpc).toHaveBeenCalledWith("cupom_solicitar", {
    p_documento: id,
    p_retry: false,
  });
  expect(h.after).toHaveBeenCalledTimes(1);
  await h.after.mock.calls[0][0]();
  expect(h.processar).toHaveBeenCalledWith(expect.anything(), id);
});
it("recusa confirmação inválida e usa identidade validada no servidor", async () => {
  const r = await POST(
    req({
      op: "confirmar",
      documentoId: id,
      versao: id,
      substituir: true,
      itens: [],
      actor: "outro",
    }),
  );
  expect(r.status).toBe(400);
  expect(h.rpc).not.toHaveBeenCalled();
});
it("worker exige segredo próprio e não usa a sessão de usuário", async () => {
  vi.stubEnv("CUPONS_WORKER_SECRET", "x".repeat(40));
  expect(
    (await GET(new Request("https://rbk.test/api/cupons/worker"))).status,
  ).toBe(401);
  expect(h.processar).not.toHaveBeenCalled();
  expect(
    (
      await GET(
        new Request("https://rbk.test/api/cupons/worker", {
          headers: { authorization: "Bearer " + "x".repeat(40) },
        }),
      )
    ).status,
  ).toBe(200);
});
it("ambiente não ativado é explícito e não acessa banco", async () => {
  vi.stubEnv("CUPONS_EXTRACAO_ENABLED", "false");
  expect((await POST(req({ op: "processar", documentoId: id }))).status).toBe(
    503,
  );
  expect(h.rpc).not.toHaveBeenCalled();
});
