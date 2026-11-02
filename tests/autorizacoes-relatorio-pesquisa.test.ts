import { writeFileSync } from "node:fs";
import { expect, it, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
const m = vi.hoisted(() => ({
  validate: vi.fn(),
  dados: vi.fn(),
  gerar: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("../src/lib/autorizacoes/pesquisa", async (original) => ({
  ...(await original<any>()),
  validarGestaoPesquisa: m.validate,
  revalidarSelecao: m.revalidate,
}));
vi.mock("../src/lib/autorizacoes/pdf", () => ({
  gerarAutorizacaoPdf: m.gerar,
}));
vi.mock("../src/lib/autorizacoes/renderizarAnexo", () => ({
  renderizarAnexo: vi.fn(),
}));
import {
  gerarListagemPesquisa,
  gerarPartePesquisa,
  planejarPartes,
  DividirParteError,
} from "../src/lib/autorizacoes/relatorioPesquisa";
const rows = Array.from({ length: 21 }, (_, i) => ({
  id: String(i),
  farm_id: "farm",
  numero_autorizacao: "123456789012345",
  cpf_cliente: "12345678901",
  data_autorizacao: "2026-11-02",
  farmacia: "Farmácia",
  observacao: null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.revalidate.mockImplementation(async (_c, _s, ids: string[]) =>
    ids.map((id) => rows.find((r) => r.id === id)!),
  );
});
it("plans numbered parts up to 20 and makes a complete list PDF, including dates and total", async () => {
  expect(planejarPartes(rows).map((p) => p.length)).toEqual([20, 1]);
  const bytes = await gerarListagemPesquisa(rows, "Pesquisa completa");
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  expect(pdf.getTitle()).toBe("Pesquisa completa");
});
it("includes documents, keeps authorizations without attachments in the list, and validates scope", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = await doc.save();
  m.gerar.mockResolvedValue(bytes);
  const mock: any = {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        range: async () => ({
          data:
            table === "documentos"
              ? [{ id: "doc", categoria: "outros", caminho_arquivo: "path" }]
              : [],
          error: null,
        }),
        single: async () => ({ data: rows[0], error: null }),
      };
      return q;
    },
  };
  const result = await gerarPartePesquisa(
    mock,
    { actorId: "actor", farmId: "farm", role: "gerente_farmacia" },
    rows.slice(0, 1),
    "Parte 1",
    undefined,
    {
      logo: new Uint8Array(),
      regular: new Uint8Array(),
      bold: new Uint8Array(),
    },
  );
  expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
  expect(m.validate).toHaveBeenCalled();
  expect(m.gerar).toHaveBeenCalled();
});
it("splits oversized selections before generating a misleading partial report", async () => {
  await expect(
    gerarPartePesquisa(
      {} as any,
      { actorId: "actor", farmId: "farm", role: "gerente_farmacia" },
      rows,
      "Parte 1",
    ),
  ).rejects.toBeInstanceOf(DividirParteError);
});

it("refuses metadata changes between the general listing and a later document part", async () => {
  m.revalidate.mockResolvedValueOnce([
    { ...rows[0], cpf_cliente: "99999999999" },
  ]);
  const from = vi.fn();
  await expect(
    gerarPartePesquisa(
      { from } as any,
      { actorId: "actor", farmId: "farm", role: "gerente_farmacia" },
      rows.slice(0, 1),
      "Parte 1",
    ),
  ).rejects.toThrow("mudaram");
  expect(from).not.toHaveBeenCalled();
});
it("refuses a metadata change between selection validation and the document header query", async () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    single: async () => ({
      data: { ...rows[0], data_autorizacao: "2026-10-01" },
      error: null,
    }),
  };
  await expect(
    gerarPartePesquisa(
      { from: () => q } as any,
      { actorId: "actor", farmId: "farm", role: "gerente_farmacia" },
      rows.slice(0, 1),
      "Parte 1",
    ),
  ).rejects.toThrow("mudaram");
  expect(m.gerar).not.toHaveBeenCalled();
});

it("includes every row of a multi-page listing", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    ...rows[0],
    id: String(i),
    numero_autorizacao: String(970000000000001 + i),
  }));
  const bytes = await gerarListagemPesquisa(
    many,
    "TESTE FICTÍCIO - Período: 31/10/2026 a 02/11/2026",
  );
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  if (process.env.RBK_PDF_QA === "1")
    writeFileSync("/private/tmp/rbk-pesquisa-listagem-qa.pdf", bytes);
});

it("keeps an authorization with no attachments in the PDF list without pretending documents were included", async () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    order: () => q,
    range: async () => ({ data: [], error: null }),
    single: async () => ({ data: rows[0], error: null }),
  };
  const r = await gerarPartePesquisa(
    { from: () => q } as any,
    { actorId: "actor", farmId: "farm", role: "gerente_farmacia" },
    rows.slice(0, 1),
    "Sem anexos",
  );
  expect((await PDFDocument.load(r.bytes)).getPageCount()).toBe(1);
  expect(r.semDocumentos).toEqual(["0"]);
  expect(m.gerar).not.toHaveBeenCalled();
});
