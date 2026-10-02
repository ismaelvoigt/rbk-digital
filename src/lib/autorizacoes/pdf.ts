import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type AutorizacaoPdf = {
  numero_autorizacao: string; data_autorizacao: string | null;
  cpf_cliente: string | null; farmacia: string | null; observacao: string | null;
};
export type DocumentoPdf = {
  id: string; categoria: string; status: string;
  nome_arquivo: string | null; caminho_arquivo: string | null;
};
export type PdfAssets = { logo: Uint8Array; regular: Uint8Array; bold: Uint8Array };
export type PaginaDocumento = { bytes: Uint8Array; formato: 'png' | 'jpg'; pagina: number; totalPaginas: number; paisagem?: boolean };
export type PdfAnexosOptions = {
  carregarArquivo: (documento: DocumentoPdf) => Promise<Blob>;
  renderizarArquivo: (arquivo: Blob) => AsyncIterable<PaginaDocumento>;
  onProgress?: (mensagem: string) => void;
};
const categorias: Record<string, string> = {
  documento_cliente: 'Documento do cliente', receita_medica: 'Receita Médica',
  cupom_fiscal: 'Cupom Fiscal', cupom_vinculado: 'Cupom Vinculado', outros: 'Outros documentos',
};
const ordem = Object.keys(categorias);
const categoriaEfetiva = (doc: DocumentoPdf) => ordem.includes(doc.categoria) ? doc.categoria : 'outros';

export function ordenarDocumentos(documentos: DocumentoPdf[]) {
  const sorted = documentos.filter(d => Boolean(d.caminho_arquivo)).slice().sort((a, b) =>
    ordem.indexOf(categoriaEfetiva(a)) - ordem.indexOf(categoriaEfetiva(b)) || a.id.localeCompare(b.id));
  const counts = new Map<string, number>();
  const indices = new Map<string, number>();
  for (const d of sorted) counts.set(categoriaEfetiva(d), (counts.get(categoriaEfetiva(d)) ?? 0) + 1);
  return sorted.map(documento => {
    const categoria = categoriaEfetiva(documento);
    const indice = (indices.get(categoria) ?? 0) + 1;
    indices.set(categoria, indice);
    return { documento, titulo: categorias[categoria], indice, total: counts.get(categoria)! };
  });
}

export function nomeArquivoPdf(numero: string) {
  const digits = numero.replace(/\D/g, '').slice(0, 15);
  return digits ? `autorizacao-${digits}.pdf` : 'autorizacao.pdf';
}

/** Cópia visual dos anexos. Originais, URLs de acesso e assinaturas digitais não são alterados ou transferidos. */
export async function gerarAutorizacaoPdf(autorizacao: AutorizacaoPdf, documentos: DocumentoPdf[], assets: PdfAssets, options: PdfAnexosOptions) {
  const arquivos = ordenarDocumentos(documentos);
  if (!arquivos.length) throw new Error('Não há arquivos anexados a esta autorização para reunir no PDF.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold, logo] = await Promise.all([
    pdf.embedFont(assets.regular, { subset: true }), pdf.embedFont(assets.bold, { subset: true }), pdf.embedPng(assets.logo),
  ]);
  pdf.setTitle(`Documentos da autorização ${autorizacao.numero_autorizacao}`);
  pdf.setAuthor('RBK Digital'); pdf.setLanguage('pt-BR');
  const ink = rgb(0.12, 0.16, 0.21), muted = rgb(0.38, 0.42, 0.47), red = rgb(0.82, 0.10, 0.16);
  const numero = autorizacao.numero_autorizacao.replace(/(\d{3})(?=\d)/g, '$1.');
  const date = autorizacao.data_autorizacao?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  const data = date ? `${date[3]}/${date[2]}/${date[1]}` : autorizacao.data_autorizacao || 'Não informada';
  const cpf = autorizacao.cpf_cliente?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') || 'Não informado';

  const footerLabels: string[] = [];
  let totalBytes = 0;
  for (const [fileIndex, item] of arquivos.entries()) {
    const { documento, titulo, indice, total } = item;
    const nome = documento.nome_arquivo || titulo;
    try {
      options.onProgress?.(`Carregando documento ${fileIndex + 1} de ${arquivos.length}...`);
      const blob = await options.carregarArquivo(documento);
      totalBytes += blob.size;
      if (!blob.size) throw new Error('O arquivo está vazio.');
      if (blob.size > 50 * 1024 * 1024 || totalBytes > 100 * 1024 * 1024) throw new Error('Os anexos excedem o limite de tamanho para esta exportação (50 MB por arquivo e 100 MB no total).');
      let paginas = 0;
      for await (const source of options.renderizarArquivo(blob)) {
        if (pdf.getPageCount() >= 200) throw new Error('O conjunto excede o limite de 200 páginas por exportação.');
        options.onProgress?.(`Preparando documento ${fileIndex + 1} de ${arquivos.length}, página ${source.pagina} de ${source.totalPaginas}...`);
        const image = source.formato === 'png' ? await pdf.embedPng(source.bytes) : await pdf.embedJpg(source.bytes);
        const landscape = source.paisagem ?? image.width > image.height * 1.2;
        const [width, height] = landscape ? [841.89, 595.28] : [595.28, 841.89];
        const page = pdf.addPage([width, height]);
        const margin = 36, contentWidth = width - margin * 2;
        const logoSize = logo.scaleToFit(82, 23);
        const gap = 9;
        const cells = [
          { value: titulo, font: bold, size: 9, color: red },
          { value: `n° autorização: ${numero}`, font: regular, size: 8.5, color: ink },
          { value: `Data: ${data}`, font: regular, size: 8.5, color: ink },
          { value: `CPF: ${cpf}`, font: regular, size: 8.5, color: ink },
        ];
        const available = contentWidth - logoSize.width - gap * cells.length;
        const desired = cells.reduce((sum, cell) => sum + cell.font.widthOfTextAtSize(cell.value, cell.size), 0);
        const factor = Math.min(1, available / desired);
        page.drawImage(logo, { x: margin, y: height - 35 - logoSize.height / 2, ...logoSize });
        let x = margin + logoSize.width + gap;
        for (const cell of cells) {
          const size = cell.size * factor;
          page.drawText(cell.value, { x, y: height - 38, font: cell.font, size, color: cell.color });
          x += cell.font.widthOfTextAtSize(cell.value, size) + gap;
        }
        footerLabels.push(`Documento ${indice} de ${total} | Página do documento ${source.pagina} de ${source.totalPaginas}`);
        page.drawLine({ start: { x: margin, y: height - 53 }, end: { x: width - margin, y: height - 53 }, color: red, thickness: 1 });
        // Cabeçalho em uma linha; imagem começa logo abaixo, sem sobreposição.
        const areaHeight = height - 63 - 50;
        const size = image.scaleToFit(contentWidth, areaHeight);
        page.drawImage(image, { x: (width - size.width) / 2, y: 50 + (areaHeight - size.height) / 2, ...size });
        paginas++;
      }
      if (!paginas) throw new Error('O arquivo não contém páginas legíveis.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Confira o arquivo e tente novamente.';
      throw new Error(`Não foi possível incluir “${nome}”. ${detail}`);
    }
  }
  const pages = pdf.getPages();
  for (const [index, page] of pages.entries()) {
    const width = page.getWidth();
    page.drawLine({ start: { x: 36, y: 38 }, end: { x: width - 36, y: 38 }, color: rgb(0.88, 0.89, 0.91), thickness: 0.5 });
    page.drawText(footerLabels[index], { x: 36, y: 24, font: regular, size: 8, color: muted });
    page.drawText(`${index + 1} / ${pages.length}`, { x: width - 72, y: 24, font: regular, size: 8, color: muted });
  }
  options.onProgress?.('Finalizando PDF...');
  return pdf.save();
}
