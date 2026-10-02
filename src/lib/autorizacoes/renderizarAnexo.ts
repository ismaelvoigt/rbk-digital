import type { PaginaDocumento } from './pdf';

/** Divide apenas imagens muito compridas (ex.: cupom) com sobreposição para não perder linhas. */
export function segmentosImagem(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Imagem com dimensões inválidas.');
  if (height / width <= 2.5) return [{ y: 0, height }];
  const sliceHeight = Math.max(1, Math.floor(width * (633.89 / 523.28)));
  const overlap = Math.min(sliceHeight - 1, Math.ceil(width * 0.025));
  const result: { y: number; height: number }[] = [];
  for (let y = 0; y < height; y += sliceHeight - overlap) {
    result.push({ y, height: Math.min(sliceHeight, height - y) });
    if (y + sliceHeight >= height) break;
    if (result.length > 200) throw new Error('A imagem é muito comprida para esta exportação.');
  }
  return result;
}

async function canvasBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem.')), 'image/jpeg', 0.95));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function* renderizarAnexo(arquivo: Blob): AsyncGenerator<PaginaDocumento> {
  const prefix = new Uint8Array(await arquivo.slice(0, 1024).arrayBuffer());
  const isPdf = new TextDecoder('latin1').decode(prefix).includes('%PDF-');
  if (isPdf) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf-viewer/pdf.worker.mjs';
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await arquivo.arrayBuffer()), isEvalSupported: false, stopAtErrors: true,
      cMapUrl: '/pdf-viewer/cmaps/', cMapPacked: true,
      standardFontDataUrl: '/pdf-viewer/standard_fonts/', wasmUrl: '/pdf-viewer/wasm/',
    });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 200) throw new Error('O PDF excede 200 páginas.');
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        // 180 dpi, com teto de 4 milhões de pixels por página para celulares.
        const scale = Math.min(2.5, Math.sqrt(4_000_000 / (base.width * base.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvas, viewport, background: 'white', annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
          yield { bytes: await canvasBytes(canvas), formato: 'jpg', pagina: number, totalPaginas: pdf.numPages, paisagem: viewport.width > viewport.height * 1.2 };
        } finally {
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException') throw new Error('Este PDF está protegido por senha. Anexe uma cópia sem senha.');
      throw new Error(error instanceof Error && error.message.includes('200 páginas') ? error.message : 'Este PDF não pôde ser aberto. Confira se o arquivo está íntegro e tente novamente.');
    } finally {
      await loading.destroy();
    }
    return;
  }
  const url = URL.createObjectURL(arquivo);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Formato de imagem não compatível ou arquivo danificado. Use JPG, PNG, WebP ou PDF.'));
      image.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('A imagem é muito grande. Reduza para até 40 megapixels e tente novamente.');
    const segments = segmentosImagem(image.naturalWidth, image.naturalHeight);
    for (const [index, segment] of segments.entries()) {
      const scale = Math.min(1, 2000 / image.naturalWidth, Math.sqrt(4_000_000 / (image.naturalWidth * segment.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(segment.height * scale));
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, segment.y, image.naturalWidth, segment.height, 0, 0, canvas.width, canvas.height);
        yield { bytes: await canvasBytes(canvas), formato: 'jpg', pagina: index + 1, totalPaginas: segments.length, paisagem: image.naturalWidth > image.naturalHeight * 1.2 };
      } finally { canvas.width = canvas.height = 0; }
    }
  } finally {
    image.src = ''; URL.revokeObjectURL(url);
  }
}
