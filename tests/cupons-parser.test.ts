import { it, expect } from "vitest";
import { extrairItens, validarRevisao } from "../src/lib/cupons/parser";
it("extrai somente linhas reconhecidas e preserva a origem sem estimar PFPB", () => {
  const r = extrairItens([
    {
      pagina: 1,
      metodo: "texto_pdf",
      texto:
        "001 7891234567895 LOSARTANA 50 MG 2 CX X 12,50 25,00\nTOTAL R$ 25,00\nCPF 12345678901",
    },
  ]);
  expect(r.itens).toHaveLength(1);
  expect(r.itens[0]).toMatchObject({
    produto: "LOSARTANA 50 MG",
    ean: "7891234567895",
    quantidade: 2,
    unidade: "CX",
    valor_unitario: 12.5,
    valor_total: 25,
    valor_pfpb: null,
    principio_ativo: null,
    indicacao: null,
  });
  expect(r.itens[0].fonte).toContain("página 1");
});
it("aceita descrição e quantidade em linhas consecutivas, sem converter códigos em EAN", () => {
  const r = extrairItens([
    {
      pagina: 2,
      metodo: "ocr",
      texto: "002 12345 MEDICAMENTO TESTE\n1 UN X 3,20 3,20",
    },
  ]);
  expect(r.itens[0]).toMatchObject({
    produto: "MEDICAMENTO TESTE",
    ean: null,
    quantidade: 1,
    valor_total: 3.2,
  });
});
it("não cria itens para layout desconhecido e sinaliza revisão de todo o documento", () => {
  const r = extrairItens([
    { pagina: 1, metodo: "ocr", texto: "Texto ilegível\nTOTAL 90,00" },
  ]);
  expect(r.itens).toEqual([]);
  expect(r.aviso).toContain("confer");
});
it("preserva itens iguais em linhas diferentes e mantém total ausente em branco", () => {
  const r = extrairItens([
    {
      pagina: 1,
      metodo: "texto_pdf",
      texto: "001 PRODUTO A 1 UN X 10,00\n002 PRODUTO A 1 UN X 10,00",
    },
  ]);
  expect(r.itens).toHaveLength(2);
  expect(r.itens[0].valor_total).toBeNull();
});
it("valida edição antes de enviar; rejeita valores negativos, extras e infinito", () => {
  const r = extrairItens([
    { pagina: 1, metodo: "ocr", texto: "001 PRODUTO A 1 UN X 10,00 10,00" },
  ]);
  expect(validarRevisao(r.itens)).toHaveLength(1);
  expect(() => validarRevisao([{ ...r.itens[0], valor_total: -1 }])).toThrow();
  expect(() =>
    validarRevisao([{ ...r.itens[0], quantidade: Infinity }]),
  ).toThrow();
  expect(() => validarRevisao([])).toThrow();
});
