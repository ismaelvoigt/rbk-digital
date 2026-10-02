import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Perfil do gestor — autorizações da farmácia", () => {
  it("aceita gestor RBK com carteira delimitada pelo RLS", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/autorizacoes/page.tsx", "utf8"
    );
    expect(source).toContain('"gestor_rbk"');
    expect(source).toContain('"superadmin_rbk"');
  });
  it("deve possuir a tela ativa de autorizações", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/autorizacoes/page.tsx",
      "utf8"
    );

    expect(source).toContain("Autorizações da farmácia");
    expect(source).toContain("Pesquisar autorizações");
  });

  it("deve usar o farm_id para consultar as autorizações", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/autorizacoes/page.tsx",
      "utf8"
    );

    expect(source).toContain("farm_id");
    expect(source).toContain('.eq("farm_id", farmId)');
    expect(source).not.toContain('.eq("user_id", usuarioId)');
  });

  it("deve tratar farms como objeto, não como array", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/autorizacoes/page.tsx",
      "utf8"
    );

    expect(source).not.toContain("farms?.[0]");
    expect(source).toContain("usuario.farms");
  });
});
