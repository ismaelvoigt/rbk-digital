import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Perfil do gestor — API de farmácias", () => {
  it("deve possuir GET administrativo para consulta de farmácias", async () => {
    const source = await import("../src/app/api/usuarios/route");
    expect(source.GET).toBeTypeOf("function");
  });

  it("deve possuir PATCH administrativo para edição de cadastro", async () => {
    const source = await import("../src/app/api/usuarios/route");
    expect(source.PATCH).toBeTypeOf("function");
  });

  it("o PATCH deve proteger o CNPJ contra alteração", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      "src/app/api/usuarios/route.ts",
      "utf8"
    );

    expect(source).toContain("export async function PATCH");
    expect(source).toContain("cnpj");
    expect(source).toContain("somente leitura");

    const inicioUpdate = source.indexOf("const dadosFarmacia = {");
    const fimUpdate = source.indexOf("};", inicioUpdate);

    expect(inicioUpdate).toBeGreaterThan(-1);
    expect(fimUpdate).toBeGreaterThan(inicioUpdate);

    const blocoDadosFarmacia = source.slice(inicioUpdate, fimUpdate);
    expect(blocoDadosFarmacia).not.toMatch(/\bcnpj\s*:/);
  });

  it("deve permitir consultar uma farmácia específica pelo id do usuário", async () => {
    const source = await readFile(
      "src/app/api/usuarios/route.ts",
      "utf8"
    );

    expect(source).toContain('searchParams.get("id")');
    expect(source).toContain('.eq("id", id)');
  });
});
