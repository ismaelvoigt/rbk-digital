import { expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { portalQr } from "../src/lib/auditoria/portal-qr";
it("QR preserva URL completa e token, inclusive quando o link é renovado", async () => {
  for (const token of ["a".repeat(43), "b".repeat(43)]) {
    const link = `https://rbk-auditoria-homologacao.vercel.app/portal/auditoria#${token}`;
    const image = await portalQr(link);
    const png = PNG.sync.read(Buffer.from(image.split(",")[1], "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(link);
  }
});
