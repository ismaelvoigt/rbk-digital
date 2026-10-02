import QRCode from "qrcode";
export function portalQr(link: string): Promise<string> {
  return QRCode.toDataURL(link, { type: "image/png", width: 720, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function portalInvite(link: string, pharmacy: string, purpose = "Auditoria"): Promise<string> {
  const [qr, logo] = await Promise.all([
    portalQr(link).then(loadImage),
    loadImage("/rbk-digital-logo-blue.png"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Imagem indisponível");
  ctx.fillStyle = "#07162e"; ctx.fillRect(0, 0, 1080, 1600);
  const scale = Math.min(600 / logo.width, 140 / logo.height);
  ctx.drawImage(logo, 540 - logo.width * scale / 2, 130 - logo.height * scale / 2, logo.width * scale, logo.height * scale);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 52px Arial";
  ctx.fillText("Envie seus documentos", 540, 285);
  ctx.font = "30px Arial"; ctx.fillStyle = "#c8d6e8";
  ctx.fillText(`${purpose} • Farmácia Popular`, 540, 342);
  ctx.font = "bold 28px Arial"; ctx.fillStyle = "#ffffff";
  const lines: string[] = []; let line = "";
  for (const char of pharmacy.trim().slice(0, 200)) {
    if (ctx.measureText(line + char).width > 900) { lines.push(line.trim()); line = char; }
    else line += char;
  }
  if (line) lines.push(line.trim());
  lines.forEach((text, i) => ctx.fillText(text, 540, 410 + i * 36));
  ctx.drawImage(qr, 180, 560, 720, 720);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 32px Arial";
  ctx.fillText("Aponte a câmera do celular", 540, 1340);
  ctx.font = "28px Arial"; ctx.fillStyle = "#c8d6e8";
  ctx.fillText("ou use o link que acompanha esta imagem", 540, 1385);
  ctx.font = "24px Arial";
  ctx.fillText("Acesso exclusivo da sua farmácia", 540, 1475);
  return canvas.toDataURL("image/png");
}
