// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  scope: vi.fn(),
  search: vi.fn(),
  all: vi.fn(),
  selected: vi.fn(),
  part: vi.fn(),
  list: vi.fn(),
  authCallback: null as any,
  client: {
    auth: {
      onAuthStateChange: (cb: any) => {
        m.authCallback = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));
vi.mock("../src/lib/supabase/client", () => ({ createClient: () => m.client }));
vi.mock("../src/lib/autorizacoes/pesquisa", async (original) => ({
  ...(await original<any>()),
  obterEscopoPesquisa: m.scope,
  pesquisarAutorizacoes: m.search,
  listarPesquisaCompleta: m.all,
  revalidarSelecao: m.selected,
}));
vi.mock("../src/lib/autorizacoes/relatorioPesquisa", () => ({
  gerarListagemPesquisa: m.list,
  gerarPartePesquisa: m.part,
  planejarPartes: (rows: any[]) => {
    const parts = [];
    for (let i = 0; i < rows.length; i += 20) parts.push(rows.slice(i, i + 20));
    return parts;
  },
  DividirParteError: class extends Error {},
}));
import PesquisaAutorizacoes from "../src/components/autorizacoes/PesquisaAutorizacoes";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const row = (id: string) => ({
  id,
  farm_id: "farm",
  numero_autorizacao: id === "a" ? "111111111111111" : "222222222222222",
  cpf_cliente: "12345678901",
  data_autorizacao: "2026-11-02",
  farmacia: "Teste",
  observacao: null,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.scope.mockResolvedValue({ actorId: "actor", farmId: "farm" });
  m.search.mockResolvedValue({ linhas: [row("a")], total: 21 });
  m.all.mockResolvedValue([row("a"), row("b")]);
  m.selected.mockImplementation(async (_c, _s, ids) => ids.map(row));
  m.list.mockResolvedValue(new Uint8Array([1]));
  m.part.mockResolvedValue({
    bytes: new Uint8Array([2]),
    semDocumentos: [],
    parciais: [],
  });
  URL.createObjectURL = vi.fn(() => `blob:test-${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function change(selector: string, value: string) {
  const el = host.querySelector(selector) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      el.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function search() {
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === text)!;
it("keeps a union of selected authorizations through pages, searches and clear filters", async () => {
  await act(async () => root.render(<PesquisaAutorizacoes farmId="farm" />));
  await change('[aria-label="CPF do cliente"]', "12345678901");
  await search();
  await act(async () =>
    host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  m.search.mockResolvedValueOnce({ linhas: [row("b")], total: 21 });
  await act(async () => button("Próxima").click());
  expect(m.search.mock.calls.at(-1)![3]).toBe(1);
  await act(async () =>
    host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  expect(host.textContent).toContain("2 autorizações selecionadas");
  await act(async () => button("Limpar pesquisa").click());
  expect(host.textContent).toContain("2 autorizações selecionadas");
  await change('[aria-label="Número da autorização"]', "111111111111111");
  m.search.mockResolvedValueOnce({ linhas: [row("a")], total: 1 });
  await search();
  expect(host.textContent).toContain("2 autorizações selecionadas");
  expect(
    host.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked,
  ).toBe(true);
});
it("reports all results using the applied filter, not the edited draft or only the visible page", async () => {
  await act(async () => root.render(<PesquisaAutorizacoes />));
  await change('[aria-label="Filtro de data"]', "mes");
  await change('[aria-label="Mês"]', "2026-10");
  await search();
  await change('[aria-label="Mês"]', "2026-11");
  await act(async () => {
    button("Gerar PDF da pesquisa").click();
    await vi.dynamicImportSettled();
  });
  expect(m.all.mock.calls[0][2]).toMatchObject({
    inicio: "2026-10-01",
    fim: "2026-10-31",
  });
  expect(m.list.mock.calls.length, host.textContent || "").toBeGreaterThan(0);
  expect(m.list.mock.calls[0][0]).toHaveLength(2);
  expect(m.part.mock.calls[0][2]).toHaveLength(2);
  expect(host.querySelector("a[download]")).toBeTruthy();
});
it("clears patient results, selection and ready PDFs on session change", async () => {
  await act(async () => root.render(<PesquisaAutorizacoes />));
  await change('[aria-label="CPF do cliente"]', "12345678901");
  await search();
  await act(async () =>
    host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  await act(async () => m.authCallback("SIGNED_OUT", null));
  expect(host.textContent).not.toContain("111.111.111.111.111");
  expect(host.textContent).not.toContain("1 autorizações selecionadas");
});

it('ignores an older response after switching pharmacy and resets selection', async () => {
  m.scope.mockImplementation(async (_client, farmId) => ({actorId:'actor',farmId:farmId||'farm'}));
  let finish!: (value:any)=>void;
  m.search.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>root.render(<PesquisaAutorizacoes farmId="farm"/>));
  await change('[aria-label="CPF do cliente"]','12345678901');
  await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await act(async()=>root.render(<PesquisaAutorizacoes farmId="other"/>));
  await act(async()=>finish({linhas:[row('a')],total:1}));
  expect(host.textContent).not.toContain('111.111.111.111.111');
  expect(host.textContent).toContain('0 autorizações selecionadas');
});

it('keeps the earlier ready PDF available when a later part fails',async()=>{
  m.all.mockResolvedValueOnce(Array.from({length:21},(_,i)=>row(String(i))));
  await act(async()=>root.render(<PesquisaAutorizacoes/>));
  await change('[aria-label="CPF do cliente"]','12345678901');await search();
  await act(async()=>{button('Gerar PDF da pesquisa').click();await vi.dynamicImportSettled();});
  const ready=host.querySelector<HTMLAnchorElement>('a[download^="autorizacoes-parte"]')!.href;
  m.part.mockRejectedValueOnce(new Error('Falha no documento de teste.'));
  const next=[...host.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Gerar PDF parte 2'))!;
  await act(async()=>{next.click();await vi.dynamicImportSettled();});
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Falha no documento');
  expect(host.querySelector<HTMLAnchorElement>('a[download^="autorizacoes-parte"]')!.href).toBe(ready);
});
