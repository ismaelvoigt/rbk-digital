import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("documentos da autorização — cabeçalho", () => {
  const arquivo = "src/app/autorizacoes/[id]/documentos/page.tsx";

  it("deve mostrar Início no cabeçalho", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain("Início");
    expect(conteudo).not.toContain("← Autorizações");
  });
});
