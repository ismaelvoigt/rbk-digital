import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

const html = readFileSync('src/lib/credenciamento/form.html', 'utf8');
function line(prefix: string) {
  return html.split('\n').find(s => s.startsWith(prefix))!;
}
function node() {
  return { textContent: '', classList: { remove: vi.fn(), contains: () => false } };
}

test('failure to create appears beside the submit button, not only above the long form', () => {
  const managererror = node();
  const topStatus = node();
  runInNewContext(`${line('function report(')}\nreport(Error('Ambiente indisponível'));`, {
    topStatus, manager: node(), $: () => managererror,
  });
  expect(managererror.textContent).toBe('Ambiente indisponível');
});

test('failed list is visibly unavailable instead of an empty unlabeled card', async () => {
  const rows = { replaceChildren: vi.fn(), append: vi.fn() };
  const report = vi.fn();
  const api = vi.fn().mockRejectedValue(Error('Ambiente indisponível'));
  await runInNewContext(`${line('async function loadList(')}\nloadList()`, {
    api, rows, report, $: () => node(), topStatus: node(), el: (_tag: string, text: string) => ({ textContent: text }),
  });
  expect(rows.replaceChildren).toHaveBeenCalled();
  expect(rows.append.mock.calls.flat().map(x => x.textContent).join(' ')).toContain('Não foi possível carregar');
});

test('existing records render and open their saved form', async () => {
  const buttons: any[] = [];
  const saved = { id: 'existing', ficha: { B21: 'Teste existente', B20: '11222333000181' } };
  const api = vi.fn().mockResolvedValueOnce([saved]).mockResolvedValueOnce(saved);
  const renderRecord = vi.fn();
  const showTab = vi.fn();
  const context = {
    api, $: () => node(), rows: { replaceChildren() {}, append: (b: unknown) => buttons.push(b) },
    el: (_tag: string, text: string) => ({ textContent: text, style: {} }),
    topStatus: node(), report: vi.fn(), invite: { classList: { add() {} } }, renderRecord, showTab, processId: '',
  };
  await runInNewContext(`${line('async function loadList(')}\nloadList()`, context);
  expect(buttons[0].textContent).toContain('Teste existente');
  await buttons[0].onclick();
  expect(context.processId).toBe('existing');
  expect(renderRecord).toHaveBeenCalledWith(saved);
  expect(showTab).toHaveBeenCalledWith('ficha');
});

test('successful creation opens the saved ficha and presents its invitation', async () => {
  const elements: Record<string, any> = {
    managerform: {}, managererror: node(), mcnpj: { value: '11.222.333/0001-81' },
    mname: { value: 'Teste' }, memail: { value: 'teste@example.invalid' }, mphone: { value: '(00) 90000-0000' },
  };
  const record = { id: 'created', ficha: { B21: 'Teste' }, files: [] };
  const delivery = { email: { status: 'failed', recorded: true }, whatsapp: { status: 'manual', recorded: true } };
  const api = vi.fn().mockResolvedValueOnce({ id: 'created', link: 'https://example.test/portal/credenciamento#test', delivery }).mockResolvedValueOnce(record);
  const renderRecord = vi.fn(), invitation = vi.fn(), showTab = vi.fn();
  const context = { $: (id: string) => elements[id], api, renderRecord, invitation, showTab,
    select: { value: 'no' }, branchInput: { value: '' }, processId: '', report: vi.fn() };
  runInNewContext(`${line('function resolveCnpjs(')}\n${line("$('managerform').onsubmit=async")}`, context);
  const submitter = { disabled: false };
  await elements.managerform.onsubmit({ preventDefault() {}, submitter });
  expect(context.processId).toBe('created');
  expect(renderRecord).toHaveBeenCalledWith(record);
  expect(invitation).toHaveBeenCalledWith('https://example.test/portal/credenciamento#test', delivery);
  expect(showTab).toHaveBeenCalledWith('ficha');
  expect(submitter.disabled).toBe(false);
});

test.each([true,false])('duplicate credential confirmation %s preserves the choice and creates only after acceptance',async accept=>{
 const elements:Record<string,any>={managerform:{},managererror:node(),mcnpj:{value:'11222333000181'},mname:{value:'Teste'},memail:{value:'x@example.com'},mphone:{value:'11999999999'}};
 const requests:any[]=[];let selected='';
 const api=async(op:string,payload:any)=>{requests.push({op,payload});if(op==='get')return {id:'second',files:[],ficha:{}};return payload.confirm_duplicate?{id:'second',link:'new-link'}:{confirmation_required:true,message:'Já existe um credenciamento em andamento. Deseja criar outro?'};};
 const confirm=vi.fn(()=>accept);
 const context={$:(id:string)=>elements[id],api,window:{confirm},renderRecord:(r:any)=>{selected=r.id},invitation:()=>{},showTab:()=>{},select:{value:'no'},branchInput:{value:''},processId:'',report:vi.fn()};
 runInNewContext(`${line('function resolveCnpjs(')}\n${line("$('managerform').onsubmit=async")}`,context);
 const submitter={disabled:false};await elements.managerform.onsubmit({preventDefault(){},submitter});
 expect(confirm).toHaveBeenCalledOnce();expect(selected).toBe(accept?'second':'');
 expect(requests.filter(r=>r.op==='create')).toHaveLength(accept?2:1);expect(submitter.disabled).toBe(false);
});
