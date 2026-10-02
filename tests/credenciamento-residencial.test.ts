import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { TYPES, analyze, summarize } from '../src/lib/processos/domain';

const html = readFileSync('src/lib/credenciamento/form.html', 'utf8');
const catalog = html.slice(html.indexOf('const DOCS='), html.indexOf('const TEMPLATE='));
const review = html.slice(html.indexOf('function credentialReview('), html.indexOf('async function sendCredentialBundle('));
function receipt(received: object[]) {
  return runInNewContext(`${catalog}\n${review}\ncredentialReview([],false,received,0)`, { received });
}
test('old receipts retain their categories and remain pending until residential is received', () => {
  const old = Array.from({ length: 10 }, (_, kind) => ({ kind, received_at: '2026-09-21' }));
  expect(receipt(old)).toMatchObject({ complete: false, receivedCount: 10, missingKinds: [10] });
  expect(receipt([...old, { kind: 10, received_at: '2026-09-21' }])).toMatchObject({ complete: true, receivedCount: 11, missingKinds: [] });
  expect(receipt([...old, { kind: 10, received_at: null }]).complete).toBe(false);
  expect(receipt([...old, { kind: 11, received_at: '2026-09-21' }]).complete).toBe(false);
});
test('manager cannot complete the checklist without the residential document', () => {
  const versions = TYPES.filter(([kind]) => String(kind) !== 'residencial').map(([kind]) => ({ id: kind, kind }));
  expect(summarize(versions, versions.map(v => ({ version_id: v.id, decision: 'Aprovado' })))).toMatchObject({ pending: 1 });
});
test('residential review does not require company CNPJ or company name', () => {
  const result = analyze([{ id: 'home', kind: 'residencial', pages: [{page: 1, text: 'COMPROVANTE DE RESIDÊNCIA\nENDEREÇO: RUA RESIDENCIAL 100\nConta de energia elétrica residencial para conferência humana.'}], qr: false, qrScanned: true }], { B20: '12345678000190', B21: 'FARMÁCIA' });
  const document = result.documents.find(d => String(d.kind) === 'residencial');
  expect(document).toBeDefined();
  expect(document!.issues.join(' ')).not.toMatch(/CNPJ|Razão social/);
});
test('invitation and manager render residential between representative and technician with stable upload ids', () => {
  const cards: any[] = [];
  const node = (tag: string, text?: string) => ({ tag, text, children: [] as any[], append(...children: any[]) { this.children.push(...children); } });
  const start = html.indexOf('DOC_ORDER.forEach(');
  const render = html.slice(start, html.indexOf('\n', start));
  runInNewContext(`${catalog}\n${render}`, { el: node, $: () => ({ append: (card: any) => cards.push(card) }) });
  expect(cards.slice(7, 11).map(card => card.children[0].children[0].text)).toEqual([
    '08. Documento Representante legal', '09. Documento Residencial', '10. Documento Responsável técnico', '11. Comprovante bancário da matriz',
  ]);
  expect(cards.slice(7, 11).map(card => card.children[2].children[0].id)).toEqual(['file7', 'file10', 'file8', 'file9']);
});
test('consolidated PDF keeps legacy files in their categories and places residential before technician', async () => {
  const library = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  const start = html.indexOf('async function createPdf(');
  const createPdf = html.slice(start, html.indexOf('\n', start));
  const { PDFLib, generate } = runInNewContext(`${library}\n${catalog}\n${createPdf}\n({PDFLib,generate:createPdf})`, {setTimeout,Uint8Array,ArrayBuffer});
  const batches = [];
  for (let i=0;i<11;i++) {
    const pdf = await PDFLib.PDFDocument.create(); pdf.addPage().setSize(100+i,200);
    const bytes = await pdf.save();
    batches.push([{name:`category-${i}.pdf`,arrayBuffer:async()=>bytes}]);
  }
  const result = await PDFLib.PDFDocument.load(await generate(batches));
  expect(result.getPages().map((page: {getWidth():number})=>page.getWidth())).toEqual([100,101,102,103,104,105,106,107,110,108,109]);
});
