import { describe, expect, it } from "vitest";

describe("painel da farmácia", () => {
  it("deve possuir a rota própria da farmácia", async () => {
    const fs = await import("node:fs/promises");

    await expect(
      fs.access("src/app/farmacia/page.tsx")
    ).resolves.toBeUndefined();
  });

  it("deve conter o acesso para nova autorização", async () => {
    const fs = await import("node:fs/promises");

    const conteudo = await fs.readFile(
      "src/app/farmacia/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('href="/nova-autorizacao"');
    expect(conteudo).toContain("Nova autorização");
  });

  it("deve conter o acesso para consultar autorizações cadastradas", async () => {
    const fs = await import("node:fs/promises");

    const conteudo = await fs.readFile(
      "src/app/farmacia/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('href="/autorizacoes"');
    expect(conteudo).toContain("Autorizações cadastradas");
  });

  it("não deve apresentar opções administrativas no painel da farmácia", async () => {
    const fs = await import("node:fs/promises");

    const conteudo = await fs.readFile(
      "src/app/farmacia/page.tsx",
      "utf-8"
    );

    expect(conteudo).not.toContain('href="/usuarios"');
    expect(conteudo).not.toContain('href="/usuarios/novo"');
    expect(conteudo).not.toContain("Nova farmácia");
    expect(conteudo).not.toContain("Administração");
  });
});
