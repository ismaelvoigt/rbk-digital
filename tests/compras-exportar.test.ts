import {it,expect} from 'vitest';import JSZip from 'jszip';
import {gerarExportacao} from '../src/lib/compras/exportar';
import {planejar} from '../src/lib/compras/domain';
it('exporta estoque sem consumo como vazio, EAN texto e critérios em XLSX/CSV',async()=>{
 const p={inicio:'2026-09-01',fim:'2026-09-30'};
 const r=planejar([],[],[{ean:'07891234567895',produto:'=PERIGO()',unidade:'CX',quantidade:0}],p);
 const csv=await gerarExportacao(r.produtos,p,30,null,'csv');expect(csv.texto).toContain("'=PERIGO()");expect(csv.texto).toContain("'07891234567895");expect(csv.texto).toContain('"0";""');
 const x=await gerarExportacao(r.produtos,p,30,null,'xlsx');const z=await JSZip.loadAsync(x.bytes!);const sheet=await z.file('xl/worksheets/sheet1.xml')!.async('string');expect(sheet).toContain('07891234567895');expect(sheet).not.toContain('<f>');expect(z.file('xl/worksheets/sheet2.xml')).toBeTruthy();
});
