import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Executa o PATCH salvo com autenticação e banco inteiramente simulados.
function carregarPatch() {
  const updates: Array<{ tabela: string; dados: unknown }> = [];
  const admin = {
    from(tabela: string) {
      const query = {
        select() { return query; },
        eq() { return query; },
        update(dados: unknown) { updates.push({ tabela, dados }); return query; },
        async maybeSingle() {
          return { data: tabela === "rbk_admins" ? { user_id: "admin-teste" } :
            { id: "usuario-teste", farm_id: "farm-teste", perfil: "farmacia", status: "active" }, error: null };
        },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
      };
      return query;
    },
  };
  const exports: Record<string, any> = {};
  const source = readFileSync("src/app/api/usuarios/route.ts", "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(js, {
    exports, process: { env: {} }, console,
    require(name: string) {
      if (name === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
      if (name === "@supabase/supabase-js") return { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "admin-teste" } }, error: null }) } }) };
      if (name.endsWith("/supabase/admin")) return { createAdminClient: () => admin };
      throw new Error(`Dependência inesperada: ${name}`);
    },
  });
  return { patch: exports.PATCH, updates };
}

describe("PATCH de status — execução isolada sem banco real", () => {
  it.each(["inactive", "inativo", "active", "ativo"])("aceita id + %s sem cadastro completo", async (status) => {
    const { patch, updates } = carregarPatch();
    const response = await patch(new Request("http://localhost/api/usuarios", {
      method: "PATCH", headers: { Authorization: "Bearer token-simulado", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "usuario-teste", status }),
    }));
    expect(response.status).toBe(200);
    const normalizado = ["inactive", "inativo"].includes(status) ? "inactive" : "active";
    expect(updates).toEqual([{ tabela: "farms", dados: { status: normalizado } }, { tabela: "users", dados: { status: normalizado } }]);
  });
  it("recusa requisição sem Bearer antes de alterar dados", async () => {
    const { patch, updates } = carregarPatch();
    const response = await patch(new Request("http://localhost/api/usuarios", { method: "PATCH", body: JSON.stringify({ id: "usuario-teste", status: "inactive" }) }));
    expect(response.status).toBe(401);
    expect(updates).toEqual([]);
  });
  it("mantém a validação de razão social no cadastro completo", async () => {
    const { patch, updates } = carregarPatch();
    const response = await patch(new Request("http://localhost/api/usuarios", {
      method: "PATCH", headers: { Authorization: "Bearer token-simulado" },
      body: JSON.stringify({ id: "usuario-teste", status: "inactive", email: "teste@example.invalid" }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "A Razão Social é obrigatória." });
    expect(updates).toEqual([]);
  });
});
