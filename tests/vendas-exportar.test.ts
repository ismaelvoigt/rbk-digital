import { it, expect } from "vitest";
import JSZip from "jszip";
import { csv, xlsx } from "../src/lib/vendas/exportar";
it("CSV preserva identificadores como texto seguro e neutraliza fórmulas", () => {
  const data = csv([
    ["Produto", "EAN", "Quantidade"],
    ['=HYPERLINK("x")', "0001234567890", 2],
    ["a;b\nc", null, null],
  ]);
  expect(data.startsWith("\ufeff")).toBe(true);
  expect(data).toContain("'=HYPERLINK");
  expect(data).toContain("'0001234567890");
  expect(data).toContain('"a;b\nc"');
});
it("XLSX contém números, texto literal e células vazias sem fórmulas", async () => {
  const zip = await JSZip.loadAsync(
    await xlsx([
      {
        nome: "Itens",
        linhas: [
          ["EAN", "Produto", "Total"],
          ["0001234567890", "=SUM(A1)", 12.5],
          ["x", null, null],
        ],
      },
    ]),
  );
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  expect(sheet).toContain("0001234567890");
  expect(sheet).toContain("<v>12.5</v>");
  expect(sheet).not.toContain("<f>");
  expect(sheet).toContain("=SUM(A1)");
});
