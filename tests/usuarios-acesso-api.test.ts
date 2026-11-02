import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  active: true,
  rbk: true,
  token: true,
  rpc: vi.fn(),
}));
vi.mock("../src/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: m.token ? { id: "actor-validated" } : null },
        error: null,
      }),
    },
    rpc: m.rpc,
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data:
            table === "rbk_admins"
              ? m.rbk
                ? { user_id: "actor-validated" }
                : null
              : { status: m.active ? "active" : "inactive" },
          error: null,
        }),
      };
      return q;
    },
  }),
}));
import { PATCH } from "../src/app/api/usuarios/acesso/route";
import { GET, DELETE } from "../src/app/api/usuarios/remover/route";
const id = "00000000-0000-4000-8000-000000000001";
function req(method: string, body: unknown = {}, token = true) {
  return new Request("https://rbk.test/api/usuarios/remover?id=" + id, {
    method,
    headers: token ? { authorization: "Bearer test" } : {},
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.active = true;
  m.rbk = true;
  m.token = true;
  m.rpc.mockResolvedValue({ data: { completed: true }, error: null });
});
it("recusa alteração de perfil sem sessão, sem RBK ou com RBK inativo", async () => {
  expect(
    (await PATCH(req("PATCH", { id, acao: "promover" }, false))).status,
  ).toBe(401);
  m.rbk = false;
  expect((await PATCH(req("PATCH", { id, acao: "promover" }))).status).toBe(
    403,
  );
  m.rbk = true;
  m.active = false;
  expect((await PATCH(req("PATCH", { id, acao: "promover" }))).status).toBe(
    403,
  );
  expect(m.rpc).not.toHaveBeenCalled();
});
it("desativa a exclusão individual antiga e exige o fluxo com CNPJ", async () => {
  expect((await GET()).status).toBe(410);
  const r = await DELETE();
  expect(r.status).toBe(410);
  expect((await r.json()).error).toContain("CNPJ");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("promoção não envia plano, e ações/planos inválidos são recusados", async () => {
  expect(
    (await PATCH(req("PATCH", { id, acao: "promover", plano: "completo" })))
      .status,
  ).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("farmacia_acesso_alterar", {
    p_actor: "actor-validated",
    p_id: id,
    p_acao: "promover",
    p_plano: null,
  });
  m.rpc.mockClear();
  expect(
    (
      await PATCH(
        req("PATCH", { id, acao: "plano", plano: "free-unrestricted" }),
      )
    ).status,
  ).toBe(400);
  expect(m.rpc).not.toHaveBeenCalled();
});
