// Executado em worker Node isolado, com prazo imposto pelo chamador.
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");
const {
  createCanvas,
  loadImage,
  DOMMatrix,
  ImageData,
  Path2D,
} = require("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
let ocr;
async function reconhecer(bytes) {
  if (!ocr) {
    const { createWorker } = require("tesseract.js");
    ocr = await createWorker("por", 1, {
      langPath: path.join(
        path.dirname(require.resolve("@tesseract.js-data/por/package.json")),
        "4.0.0",
      ),
      cacheMethod: "none",
      gzip: true,
      logger: () => {},
    });
  }
  const { data } = await ocr.recognize(bytes);
  return data.text;
}
function linhas(items) {
  const linhas = [];
  for (const i of items) {
    if (!("str" in i) || !i.str.trim()) continue;
    const y = Math.round(i.transform[5] / 3) * 3;
    let row = linhas.find((r) => Math.abs(r.y - y) <= 3);
    if (!row) {
      row = { y, items: [] };
      linhas.push(row);
    }
    row.items.push({ x: i.transform[4], str: i.str });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(" "),
    )
    .join("\n");
}
(async () => {
  const bytes = Buffer.from(workerData),
    paginas = [];
  let total = 0;
  const adicionar = (pagina, metodo, texto) => {
    total += texto.length;
    if (total > 120000) throw new Error("Texto acima do limite.");
    paginas.push({ pagina, metodo, texto });
  };
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
    const loading = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      stopAtErrors: true,
      useSystemFonts: true,
      standardFontDataUrl: path.join(root, "standard_fonts") + "/",
      cMapUrl: path.join(root, "cmaps") + "/",
      cMapPacked: true,
      wasmUrl: path.join(root, "wasm") + "/",
    });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 10) throw new Error("Use cupons com até 10 páginas.");
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        let texto = linhas((await page.getTextContent()).items),
          metodo = "texto_pdf";
        if (texto.trim().length < 20) {
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({
            scale: Math.min(3, Math.sqrt(8000000 / (base.width * base.height))),
          });
          const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
          await page.render({ canvasContext: c.getContext("2d"), viewport: vp })
            .promise;
          texto = await reconhecer(c.toBuffer("image/png"));
          metodo = "ocr";
        }
        adicionar(i, metodo, texto);
        page.cleanup();
      }
    } finally {
      await loading.destroy();
    }
  } else {
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = bytes[0] === 255 && bytes[1] === 216;
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
    if (!png && !jpg && !webp) throw new Error("Use PDF, JPG, PNG ou WebP.");
    if (
      png &&
      (bytes.length < 24 ||
        bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 40000000)
    )
      throw new Error("Imagem acima de 40 megapixels.");
    const img = await loadImage(bytes);
    if (img.width * img.height > 40000000)
      throw new Error("Imagem acima de 40 megapixels.");
    const scale = Math.min(1, Math.sqrt(8000000 / (img.width * img.height)));
    const c = createCanvas(
      Math.max(1, Math.round(img.width * scale)),
      Math.max(1, Math.round(img.height * scale)),
    );
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    adicionar(1, "ocr", await reconhecer(c.toBuffer("image/png")));
  }
  parentPort.postMessage({ paginas });
})()
  .catch((e) =>
    parentPort.postMessage({
      erro:
        e.name === "PasswordException"
          ? "PDF protegido por senha."
          : String(e.message || "Falha na leitura.").slice(0, 200),
    }),
  )
  .finally(async () => {
    if (ocr) await ocr.terminate();
  });
