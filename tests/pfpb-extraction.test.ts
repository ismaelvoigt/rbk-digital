import { it, expect } from "vitest";
import { extract, analyze, detectKind } from "../src/lib/processos/domain";
it("usa data após válido até em frase que também contém emissão", () => {
  expect(
    extract([
      { page: 1, text: "LIBERADO EM 12/03/2026, VÁLIDO ATÉ 12/03/2027." },
    ]).expiry.map((x) => x.date),
  ).toEqual(["2027-03-12"]);
});
it("cabeçalho de coluna não é confundido com endereço", () => {
  const e = extract([
    { page: 1, text: "ENDEREÇO CNPJ\nRUA ALFA 139 12.345.678/0001-90" },
  ]).evidence;
  expect(e.find((x) => x.field === "Endereço")?.value).toBe("RUA ALFA 139");
});
it("CNAE com pontuação do CNPJ não gera falso alerta", () => {
  const a = analyze(
    [
      {
        id: "1",
        kind: "cnpj",
        pages: [
          {
            page: 1,
            text: "CADASTRO NACIONAL DA PESSOA JURÍDICA\nCNPJ: 12.345.678/0001-90\n47.71-7-01 — Comércio varejista de produtos farmacêuticos",
          },
        ],
        qr: false,
        qrScanned: true,
      },
    ],
    {},
  );
  expect(a.documents[0].issues.join(" ")).not.toMatch(/CNAE/);
});
it("sugere alvará municipal separado da licença sanitária", () => {
  expect(
    detectKind([
      { page: 1, text: "PREFEITURA MUNICIPAL ALVARÁ DE FUNCIONAMENTO" },
    ]).kind,
  ).toBe("alvara_municipal");
});
it("código de controle literal é detectado sem consultar o valor", () => {
  const a = analyze(
    [
      {
        id: "1",
        kind: "licenca_sanitaria",
        pages: [
          {
            page: 1,
            text: "Código de Controle: 41f4e88d-1234-5678\nLICENÇA SANITÁRIA",
          },
        ],
        qr: false,
        qrScanned: true,
      },
    ],
    {},
  );
  expect(
    a.documents.find((d) => d.kind === "licenca_sanitaria")!.elements.code,
  ).toBe("Detectado");
});
it("avisa quando não consegue comparar responsável técnico", () => {
  const a = analyze(
    [
      {
        id: "1",
        kind: "crt",
        pages: [{ page: 1, text: "CERTIDÃO DE REGULARIDADE TÉCNICA" }],
        qr: false,
        qrScanned: true,
      },
    ],
    { B40: "Maria Exemplo" },
  );
  expect(a.documents.find((d) => d.kind === "crt")!.issues.join(" ")).toMatch(
    /Responsável técnico.*não extraído/,
  );
});
it("mera instrução de consulta não é código verificador detectado", () => {
  const a = analyze(
    [
      {
        id: "1",
        kind: "crt",
        pages: [
          {
            page: 1,
            text: "Use o código de autenticação para consultar o documento.",
          },
        ],
        qr: false,
        qrScanned: true,
      },
    ],
    {},
  );
  expect(a.documents.find((d) => d.kind === "crt")!.elements.code).toBe(
    "Não detectado",
  );
});
