import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { gerarAutorizacaoPdf, nomeArquivoPdf, ordenarDocumentos, type DocumentoPdf } from '../src/lib/autorizacoes/pdf';

const assets = {
  logo: readFileSync('public/rbk-digital-logo-original.png'),
  regular: readFileSync('public/fonts/Lato-Regular.ttf'),
  bold: readFileSync('public/fonts/Lato-Bold.ttf'),
};
const authorization = {
  numero_autorizacao: '123456789012345', data_autorizacao: '2026-09-26',
  cpf_cliente: '00000000000', farmacia: 'Farmácia Demonstração', observacao: null,
};
const doc = (id: string, categoria = 'receita_medica'): DocumentoPdf => ({ id, categoria, status:'recebido',nome_arquivo:`${id}.pdf`,caminho_arquivo:`private/${id}.pdf` });
function options(pages = 1) {
  return {
    carregarArquivo: vi.fn(async () => new Blob(['test'])),
    renderizarArquivo: async function* () {
      for (let i = 1; i <= pages; i++) yield { bytes: assets.logo, formato: 'png' as const, pagina: i, totalPaginas: pages };
    },
  };
}
describe('PDF reunindo documentos da autorização', () => {
  it('incorpora uma imagem por página, todas as páginas e sem capa extra', async () => {
    const bytes = await gerarAutorizacaoPdf(authorization, [doc('a'),doc('b')], assets, options(2));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(4);
    for (const page of pdf.getPages()) {
      // Logo + conteúdo original incorporados; não apenas uma lista de nomes.
      const resources = page.node.Resources()!;
      expect(resources.lookup(PDFName.of('XObject'))!.toString()).toMatch(/Image/);
    }
  });
  it('ordena as categorias e identifica arquivos repetidos sem alterar a entrada', () => {
    const input=[doc('z','outros'),doc('b'),doc('c','documento_cliente'),doc('a'),doc('f','cupom_fiscal'),doc('v','cupom_vinculado')];
    const result=ordenarDocumentos(input);
    expect(result.map(d=>d.documento.id)).toEqual(['c','a','b','f','v','z']);
    expect(result[1]).toMatchObject({ indice:1,total:2,titulo:'Receita Médica' });
    expect(result[2]).toMatchObject({ indice:2,total:2 });
    expect(input[0].id).toBe('z');
  });
  it('não gera arquivo vazio ou finge incorporar registros sem anexo', async () => {
    await expect(gerarAutorizacaoPdf(authorization, [], assets, options())).rejects.toThrow('Não há arquivos anexados');
    const io=options();
    await expect(gerarAutorizacaoPdf(authorization,[{...doc('a'),caminho_arquivo:null}],assets,io)).rejects.toThrow('Não há arquivos anexados');
    expect(io.carregarArquivo).not.toHaveBeenCalled();
  });
  it('interrompe todo o download se um anexo falhar e informa seu nome', async () => {
    const io=options();io.carregarArquivo.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(gerarAutorizacaoPdf(authorization,[doc('a')],assets,io)).rejects.toThrow('a.pdf');
  });
  it('recusa anexo sem páginas e evita PDF parcial', async () => {
    await expect(gerarAutorizacaoPdf(authorization,[doc('vazio')],assets,options(0))).rejects.toThrow('vazio.pdf');
  });
  it('mantém todas as partes de um cupom na orientação do original', async () => {
    const io=options();
    const bytes=await gerarAutorizacaoPdf(authorization,[doc('cupom','cupom_fiscal')],assets,{
      ...io, renderizarArquivo: async function* () {
        yield {bytes:assets.logo,formato:'png' as const,pagina:1,totalPaginas:1,paisagem:false};
      },
    });
    const page=(await PDFDocument.load(bytes)).getPage(0);
    expect(page.getWidth()).toBeLessThan(page.getHeight());
  });
  it('usa nome de download seguro sem CPF', () => {
    expect(nomeArquivoPdf('123.456.789.012.345')).toBe('autorizacao-123456789012345.pdf');
    expect(nomeArquivoPdf('../../')).toBe('autorizacao.pdf');
  });
});
