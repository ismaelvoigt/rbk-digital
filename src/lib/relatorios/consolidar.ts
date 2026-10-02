import { PDFDocument } from 'pdf-lib';
export const LIMITE_SELECAO = 20;

export async function consolidarPdfs(ids: string[], gerar: (id: string) => Promise<Uint8Array>, progresso?: (message: string) => void) {
  const unicos = [...new Set(ids)];
  if (!unicos.length) throw new Error('Selecione pelo menos uma autorização.');
  if (unicos.length > LIMITE_SELECAO) throw new Error('Selecione no máximo 20 autorizações por PDF.');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Autorizações — RBK Digital'); pdf.setAuthor('RBK Digital'); pdf.setLanguage('pt-BR');
  let totalBytes = 0;
  for (const [index,id] of unicos.entries()) {
    progresso?.(`Preparando autorização ${index + 1} de ${unicos.length}...`);
    const bytes = await gerar(id);
    totalBytes += bytes.byteLength;
    if (totalBytes > 100 * 1024 * 1024) throw new Error('O conjunto excede 100 MB. Selecione menos autorizações.');
    const origem = await PDFDocument.load(bytes);
    if (pdf.getPageCount() + origem.getPageCount() > 200) throw new Error('O conjunto excede 200 páginas. Selecione menos autorizações.');
    for (const pagina of await pdf.copyPages(origem, origem.getPageIndices())) pdf.addPage(pagina);
  }
  return pdf.save();
}
