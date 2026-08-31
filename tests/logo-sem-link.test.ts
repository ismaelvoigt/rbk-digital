import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function listarArquivos(dir: string): string[] {
  const arquivos: string[] = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, item.name);

    if (item.isDirectory()) {
      arquivos.push(...listarArquivos(caminho));
    } else if (item.name.endsWith(".tsx")) {
      arquivos.push(caminho);
    }
  }

  return arquivos;
}

describe("RBK Digital — logo sem navegação", () => {
  it("não deve existir RbkBrand dentro de Link nas telas do sistema", () => {
    const arquivos = listarArquivos("src");

    const ocorrencias: string[] = [];

    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(arquivo, "utf-8");

      const regex =
        /<Link\b[^>]*>\s*<RbkBrand\b[^>]*\/>\s*<\/Link>/g;

      if (regex.test(conteudo)) {
        ocorrencias.push(arquivo);
      }
    }

    expect(
      ocorrencias,
      `A logo ainda está dentro de Link nestes arquivos:\n${ocorrencias.join("\n")}`
    ).toEqual([]);
  });
});
