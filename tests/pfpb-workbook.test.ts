import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { fillWorkbook } from "../src/lib/processos/workbook";
import { fields } from "../src/lib/processos/domain";
it("preenche todas as posições preservando partes de layout e impedindo fórmulas", async () => {
  const source = readFileSync("private/ficha-template.xlsx");
  const output = await fillWorkbook(source, {
    B20: "00123456000199",
    B21: '=HYPERLINK("https://invalid")',
    B35: "2026-09-18",
  });
  const original = await JSZip.loadAsync(source),
    result = await JSZip.loadAsync(output);
  for (const path of Object.keys(original.files).filter(
    (p) => !original.files[p].dir && p !== "xl/worksheets/sheet1.xml",
  ))
    expect(await result.file(path)!.async("uint8array")).toEqual(
      await original.file(path)!.async("uint8array"),
    );
  const xml = await result.file("xl/worksheets/sheet1.xml")!.async("string");
  expect(xml).not.toContain("<f>");
  expect(xml).toContain("00123456000199");
  expect(xml).toContain("&quot;https://invalid&quot;");
  expect(xml).toContain("<v>46283</v>");
  expect(fields).toHaveLength(45);
});
it("modelo sanitizado não retém respostas antigas nos shared strings ou hyperlinks", async () => {
  const zip = await JSZip.loadAsync(
    readFileSync("private/ficha-template.xlsx"),
  );
  expect(await zip.file("xl/sharedStrings.xml")!.async("string")).not.toContain(
    "<si>",
  );
  expect(
    await zip.file("xl/worksheets/sheet1.xml")!.async("string"),
  ).not.toContain("<hyperlinks>");
});
it('modelo não contém referências a strings removidas',async()=>{const zip=await JSZip.loadAsync(readFileSync('private/ficha-template.xlsx'));const xml=await zip.file('xl/worksheets/sheet1.xml')!.async('string');expect(xml).not.toMatch(/<c\b[^>]*t="s"/);});
