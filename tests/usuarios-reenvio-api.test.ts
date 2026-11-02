import { beforeEach, it, expect, vi } from "vitest";
const id = "00000000-0000-4000-8000-000000000001";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  generate: vi.fn(),
  getAuth: vi.fn(),
  prepare: vi.fn(),
  send: vi.fn(),
  active: true,
  rbk: false,
  stampError: false,
  writes: [] as { table: string; data: any }[],
  from: vi.fn(),
}));
vi.mock("../src/lib/usuarios/adminRequest", async (original) => ({
  ...(await original<typeof import("../src/lib/usuarios/adminRequest")>()),
  autorizarGestaoUsuarios: m.auth,
}));
vi.mock("../src/lib/cadastro/invitation", () => ({
  preparePharmacyInvitation: m.prepare,
}));
import { POST } from "../src/app/api/usuarios/convite/route";
const request = (body: unknown = { id, email: "new@example.invalid" }) =>
  new Request("https://rbk.test/api/usuarios/convite", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.writes = [];
  m.active = true;
  m.rbk = false;
  m.stampError = false;
  m.from.mockImplementation((table: string) => {
    let write = false;
    const q = {
      select: () => q,
      eq: () => q,
      update: (data: any) => {
        write = true;
        m.writes.push({ table, data });
        return q;
      },
      insert: (data: any) => {
        write = true;
        m.writes.push({ table, data });
        return q;
      },
      maybeSingle: async () => ({
        data:
          table === "rbk_admins"
            ? m.rbk
              ? { user_id: id }
              : null
            : table === "farms"
              ? { id: "farm", status: "active", nome_fantasia: "Alfa" }
              : write
                ? { id }
                : {
                    id,
                    farm_id: "farm",
                    nome: "Responsável",
                    email: "new@example.invalid",
                    perfil: "operador",
                    tipo_convite: "farmacia",
                    status: m.active ? "active" : "inactive",
                    convite_enviado_em: null,
                  },
        error: write && m.stampError ? { message: "failure" } : null,
      }),
      then: (done: (value: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(done),
    };
    return q;
  });
  m.auth.mockResolvedValue({
    actor: "rbk",
    admin: {
      from: m.from,
      auth: { admin: { getUserById: m.getAuth, generateLink: m.generate } },
    },
  });
  m.getAuth.mockResolvedValue({
    data: { user: { id, email: "new@example.invalid" } },
    error: null,
  });
  m.generate.mockResolvedValue({
    data: {
      user: { id, email: "new@example.invalid" },
      properties: { hashed_token: "private-hash" },
    },
    error: null,
  });
  m.prepare.mockResolvedValue(m.send);
  m.send.mockResolvedValue(undefined);
});
it("reenviamento usa somente e-mail salvo, mesma identidade e recovery sem criar usuário", async () => {
  const r = await POST(
    request({
      id,
      email: "new@example.invalid",
      p_actor: "spoofed",
      perfil: "farmacia",
    }),
  );
  expect(r.status).toBe(200);
  expect(m.generate).toHaveBeenCalledWith({
    type: "recovery",
    email: "new@example.invalid",
    options: { redirectTo: "https://rbk-digital.vercel.app/redefinir-senha" },
  });
  expect(m.send).toHaveBeenCalledWith(
    "new@example.invalid",
    "Alfa",
    "https://rbk-digital.vercel.app/redefinir-senha?type=recovery&token_hash=private-hash",
  );
  expect(m.writes.find((w) => w.table === "users")?.data).toHaveProperty(
    "convite_enviado_em",
  );
  expect(
    m.writes.some((w) => w.data.perfil || w.data.email || w.table === "farms"),
  ).toBe(false);
  expect(JSON.stringify(await r.json())).not.toContain("private-hash");
});
it("rejeita e-mail ainda não salvo ou divergente do Auth antes de gerar/enviar", async () => {
  expect(
    (await POST(request({ id, email: "old@example.invalid" }))).status,
  ).toBe(409);
  m.getAuth.mockResolvedValue({
    data: { user: { id, email: "old@example.invalid" } },
    error: null,
  });
  expect((await POST(request())).status).toBe(409);
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
it("bloqueia permissão inválida, inativo e conta administrativa", async () => {
  m.auth.mockResolvedValueOnce({
    response: Response.json({ error: "restrito" }, { status: 403 }),
  });
  expect((await POST(request())).status).toBe(403);
  m.active = false;
  expect((await POST(request())).status).toBe(409);
  m.active = true;
  m.rbk = true;
  expect((await POST(request())).status).toBe(403);
  expect(m.send).not.toHaveBeenCalled();
});
it("não gera link sem serviço de e-mail e não envia link para outra identidade", async () => {
  m.prepare.mockRejectedValueOnce(Error("secret"));
  expect((await POST(request())).status).toBe(503);
  expect(m.generate).not.toHaveBeenCalled();
  m.generate.mockResolvedValue({
    data: {
      user: { id: "wrong", email: "new@example.invalid" },
      properties: { hashed_token: "private-hash" },
    },
    error: null,
  });
  expect((await POST(request())).status).toBe(409);
  expect(m.send).not.toHaveBeenCalled();
});
it("falha de envio não marca entregue nem revela erro privado", async () => {
  m.send.mockRejectedValue(Error("private SMTP token"));
  const r = await POST(request());
  expect(r.status).toBe(502);
  expect(m.writes).toEqual([]);
  expect(JSON.stringify(await r.json())).not.toContain("private");
});
it("respeita espera de um minuto inclusive após uma tentativa anterior", async () => {
  m.getAuth.mockResolvedValue({
    data: {
      user: {
        id,
        email: "new@example.invalid",
        recovery_sent_at: new Date().toISOString(),
      },
    },
    error: null,
  });
  expect((await POST(request())).status).toBe(429);
  expect(m.generate).not.toHaveBeenCalled();
});
it("aceitação pelo SMTP continua confirmada quando registro posterior falha", async () => {
  m.stampError = true;
  const r = await POST(request());
  expect(r.status).toBe(200);
  expect((await r.json()).success).toBe(true);
  expect(m.send).toHaveBeenCalledTimes(1);
});
