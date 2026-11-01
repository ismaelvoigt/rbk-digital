import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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

    for (const arquivo of arquivos) {
      const ast=ts.createSourceFile(arquivo,fs.readFileSync(arquivo,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      function visitar(node:ts.Node,dentroLink=false) {
        const abertura=ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
        const tag=abertura?.tagName.getText(ast);
        if (tag==='RbkBrand' && dentroLink) ocorrencias.push(arquivo);
        ts.forEachChild(node,filho=>visitar(filho,dentroLink || tag==='Link'));
      }
      visitar(ast);
    }

    expect(
      ocorrencias,
      `A logo ainda está clicável nestas telas:\n${ocorrencias.join("\n")}`
    ).toEqual([]);
  });
});
