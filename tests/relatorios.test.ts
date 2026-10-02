import { describe, it, expect } from 'vitest';
import { normalizarCrm, normalizarFiltros } from '../src/lib/relatorios/filtros';
import { consolidarPdfs } from '../src/lib/relatorios/consolidar';
import { PDFDocument } from 'pdf-lib';

describe('filtros de relatórios', () => {
  it('normaliza documentos formatados e mantém intervalo inclusivo sem conversão de fuso', () => {
    expect(normalizarFiltros({ modoData:'periodo', inicio:'2026-09-01', fim:'2026-09-26', numero:'123.456.789.012.345', cpf:'123.456.789-01', crm:'001234', uf:'SP' })).toEqual({ inicio:'2026-09-01', fim:'2026-09-26', numero:'123456789012345', cpf:'12345678901', crm:'1234', uf:'SP' });
  });
  it('usa somente o dia quando o modo é data específica', () => {
    expect(normalizarFiltros({ modoData:'dia', dia:'2026-09-26', inicio:'2026-08-01', fim:'2026-08-31' })).toMatchObject({inicio:'2026-09-26',fim:'2026-09-26'});
  });
  it.each([
    {modoData:'periodo',inicio:'2026-10-01',fim:'2026-09-01'},
    {modoData:'dia',dia:'2026-02-30'}, {modoData:'dia'},
    {cpf:'123'}, {numero:'123'}, {crm:'123a'}, {uf:'XX'},
  ])('recusa filtros inválidos sem executar consulta (%j)', filters => {
    expect(() => normalizarFiltros(filters)).toThrow();
  });
  it('aceita CRM vazio, exige UF no cadastro e não confunde registros de estados distintos', () => {
    expect(normalizarCrm('', '')).toEqual({crm:null,crm_uf:null});
    expect(normalizarCrm('001234', 'sp')).toEqual({crm:'1234',crm_uf:'SP'});
    expect(() => normalizarCrm('1234','')).toThrow('UF');
    expect(() => normalizarCrm('','SP')).toThrow('CRM');
    expect(() => normalizarCrm('0','SP')).toThrow('CRM');
  });
});

describe('PDF consolidado', () => {
  async function pdf(width: number) { const doc=await PDFDocument.create(); doc.addPage([width,200]); return doc.save(); }
  it('mantém todas as páginas na ordem selecionada, sem duplicar autorizações', async () => {
    const bytes=await consolidarPdfs(['a','b','a'], async id => pdf(id==='a'?100:150));
    expect((await PDFDocument.load(bytes)).getPages().map(p=>p.getWidth())).toEqual([100,150]);
  });
  it('aborta o conjunto ao falhar uma autorização, em vez de entregar um PDF incompleto', async () => {
    await expect(consolidarPdfs(['a','b'],async id => {if(id==='b') throw new Error('Sem acesso');return pdf(100);})).rejects.toThrow('Sem acesso');
  });
  it('recusa seleção vazia e lotes grandes antes de carregar documentos', async () => {
    await expect(consolidarPdfs([],async()=>pdf(100))).rejects.toThrow('Selecione');
    await expect(consolidarPdfs(Array.from({length:21},(_,i)=>String(i)),async()=>{throw new Error('não deve carregar');})).rejects.toThrow('20');
  });
});
