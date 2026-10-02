import { it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { lerCupom } from "../src/lib/cupons/leitura";
it("lê PDF digital sem enviar o documento a serviços externos", async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage();
  p.drawText("001 PRODUTO TESTE 2 CX X 12,50 25,00", {
    x: 40,
    y: 700,
    font,
    size: 14,
  });
  const r = await lerCupom(Buffer.from(await pdf.save()));
  expect(r[0].metodo).toBe("texto_pdf");
  expect(r[0].texto).toContain("PRODUTO TESTE");
}, 20000);
it("OCR em imagem real reconhece o texto e identifica seu método", async () => {
  const c = createCanvas(1400, 300),
    ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1400, 300);
  ctx.fillStyle = "black";
  ctx.font = "38px sans-serif";
  ctx.fillText("001 PRODUTO TESTE 2 CX X 12,50 25,00", 40, 100);
  const r = await lerCupom(c.toBuffer("image/png"));
  expect(r[0].metodo).toBe("ocr");
  expect(r[0].texto).toContain("PRODUTO");
}, 100000);
it("rejeita formato desconhecido e arquivo acima do limite", async () => {
  await expect(lerCupom(Buffer.from("arquivo falso"))).rejects.toThrow();
  await expect(lerCupom(Buffer.alloc(11 * 1024 * 1024))).rejects.toThrow(
    /10 MB/,
  );
});
