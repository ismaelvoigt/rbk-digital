import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function listarTsx(dir: string): string[] {
  const arquivos: string[] = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, item.name);

    if (item.isDirectory()) {
      arquivos.push(...listarTsx(caminho));
    } else if (item.name.endsWith(".tsx")) {
      arquivos.push(caminho);
    }
  }

  return arquivos;
}

describe("RBK Digital — padronização da logo", () => {
  it("não deve permitir que RbkBrand seja envolvida por Link", () => {
    const arquivos = listarTsx("src/app");
    const ocorrencias: string[] = [];

    const regex =
      /<Link\b[\s\S]{0,500}<RbkBrand\b[\s\S]{0,100}\/>[\s\S]{0,500}<\/Link>/g;

    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(arquivo, "utf-8");

      if (regex.test(conteudo)) {
        ocorrencias.push(arquivo);
      }
    }

    expect(
      ocorrencias,
      `A logo ainda está clicável nestas telas:\n${ocorrencias.join("\n")}`
    ).toEqual([]);
  });
});
