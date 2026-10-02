import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { fields, validateFicha, type Ficha } from "./domain";
const escapeXml = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export async function fillWorkbook(template: Uint8Array, ficha: Ficha) {
  validateFicha(ficha);
  const zip = await JSZip.loadAsync(template);
  const sheet = zip.file("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("Modelo incompatível.");
  let xml = await sheet.async("string");
  for (const f of fields) {
    const rx = new RegExp(
      `<c\\b([^>]*\\br="${f.cell}"[^>]*)(?:\\/>|>[\\s\\S]*?<\\/c>)`,
    );
    if (!rx.test(xml)) throw new Error(`Célula ausente: ${f.cell}`);
    const value = ficha[f.cell] ?? "";
    xml = xml.replace(rx, (_all, attrs: string) => {
      const clean = attrs.replace(/\s+t="[^"]*"/g, "");
      if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = new Date(value + "T00:00:00Z");
        if (date.toISOString().slice(0, 10) !== value)
          throw new Error("Data inválida");
        return `<c${clean}><v>${Math.round((date.valueOf() - Date.UTC(1899, 11, 30)) / 86400000)}</v></c>`;
      }
      return `<c${clean} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    });
  }
  zip.file("xl/worksheets/sheet1.xml", xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export async function generateFicha(ficha: Ficha) {
  const path = process.env.PFPB_TEMPLATE_PATH;
  if (!path) throw new Error("Modelo sanitizado não configurado.");
  return fillWorkbook(await readFile(path), ficha);
}
