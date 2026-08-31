import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("nova autorização — outros documentos", () => {
  const arquivo = "src/components/documentos/DocumentUploadCard.tsx";

  it("deve explicar claramente quais documentos podem ser enviados em Outros Documentos", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain(
      "Procurações, documentos do procurador ou outros relacionados à autorização."
    );
  });
});
