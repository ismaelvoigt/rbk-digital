import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("nova autorização — cabeçalho da tela de registro", () => {
  const arquivo = "src/app/nova-autorizacao/page.tsx";

  it("deve manter apenas o link Início no cabeçalho da tela de registro", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    const marcador =
      '<div className="rbk-container flex min-h-[76px] items-center justify-between">';

    const primeiro = conteudo.indexOf(marcador);
    const segundo = conteudo.indexOf(marcador, primeiro + marcador.length);

    expect(segundo).toBeGreaterThan(-1);

    const fimCabecalho = conteudo.indexOf("</header>", segundo);

    const cabecalhoCadastro = conteudo.slice(segundo, fimCabecalho);

    expect(cabecalhoCadastro).toContain("Início");
    expect(cabecalhoCadastro).not.toContain("Voltar");
  });
});
