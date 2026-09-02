import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "src/app/farmacia/page.tsx");
const source = readFileSync(pagePath, "utf8");

describe("estrutura do logout da farmácia", () => {
  it('deve declarar "use client" antes dos imports', () => {
    const firstMeaningfulLine = source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    expect(firstMeaningfulLine).toBe('"use client";');
  });

  it("deve declarar sairDaConta antes do bloco de carregamento", () => {
    const handlerPosition = source.indexOf("async function sairDaConta");
    const loadingPosition = source.indexOf("if (carregando)");

    expect(handlerPosition).toBeGreaterThanOrEqual(0);
    expect(loadingPosition).toBeGreaterThanOrEqual(0);
    expect(handlerPosition).toBeLessThan(loadingPosition);
  });

  it("deve retornar JSX corretamente durante o carregamento", () => {
    const loadingPosition = source.indexOf("if (carregando)");
    const returnPosition = source.indexOf("return (", loadingPosition);

    expect(loadingPosition).toBeGreaterThanOrEqual(0);
    expect(returnPosition).toBeGreaterThan(loadingPosition);
  });

  it("deve manter exatamente um botão Sair", () => {
    const matches = source.match(/aria-label="Sair"/g) ?? [];

    expect(matches.length).toBe(1);
  });

  it("deve manter o botão Sair dentro do header", () => {
    const headerStart = source.indexOf('<header className="rbk-header">');
    const headerEnd = source.indexOf("</header>", headerStart);
    const buttonPosition = source.indexOf('aria-label="Sair"');

    expect(headerStart).toBeGreaterThanOrEqual(0);
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(buttonPosition).toBeGreaterThan(headerStart);
    expect(buttonPosition).toBeLessThan(headerEnd);
  });

  it("não deve conter o marcador quebrado \\\\1", () => {
    expect(source).not.toContain("\\1");
  });
});
