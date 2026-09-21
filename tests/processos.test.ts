import { describe, it, expect } from "vitest";
import {
  analyze,
  extract,
  canUseProcessos,
  summarize,
  validateFicha,
} from "../src/lib/processos/domain";
describe("PFPB — regras conservadoras", () => {
  it("bloqueia perfis externos e inativos", () => {
    expect(canUseProcessos("farmacia", "active", false)).toBe(false);
    expect(canUseProcessos("gestor_rbk", "inactive", false)).toBe(false);
    expect(canUseProcessos("superadmin_rbk", "active", false)).toBe(false);
    expect(canUseProcessos("gestor_rbk", "active", false)).toBe(true);
    expect(canUseProcessos("farmacia", "active", true)).toBe(true);
  });
  it("ausência nunca solicita substituição automaticamente", () => {
    const a = analyze([], {}, "2026-09-18");
    expect(a.documents).toHaveLength(11);
    expect(a.documents.every((x) => x.result === "Requer conferência")).toBe(
      true,
    );
  });
  it("PDF sem extração nunca fica sem ocorrência", () => {
    const a = analyze(
      [{ id: "1", kind: "cnpj", pages: [], qr: false, qrScanned: false }],
      {},
      "2026-09-18",
    );
    expect(a.documents[0].issues.join(" ")).toMatch(/extração/i);
  });
  it("compara CNPJ e validade explícita com evidência", () => {
    const a = analyze(
      [
        {
          id: "1",
          kind: "licenca_sanitaria",
          pages: [
            {
              page: 2,
              text: "CNPJ: 12.345.678/0001-90\nVALIDADE: 31/08/2026\nENDEREÇO: RUA ALFA, 80",
            },
          ],
          qr: false,
          qrScanned: true,
        },
      ],
      { B20: "98.765.432/0001-10" },
      "2026-09-18",
    );
    const d = a.documents.find((x) => x.kind === "licenca_sanitaria")!;
    expect(d.issues.join(" ")).toMatch(/CNPJ/);
    expect(d.issues.join(" ")).toMatch(/vencimento/);
    expect(d.evidence.some((e) => e.page === 2)).toBe(true);
  });
  it("data de emissão não vira vencimento", () => {
    expect(
      extract([{ page: 1, text: "EMISSÃO: 01/01/2020" }]).expiry,
    ).toHaveLength(0);
  });
  it("data impossível não vira validade objetiva", () => {
    expect(
      extract([{ page: 1, text: "VALIDADE: 31/02/2026" }]).expiry,
    ).toHaveLength(0);
  });
  it("menção de QR no texto não é QR detectado", () => {
    const a = analyze(
      [
        {
          id: "x",
          kind: "cnpj",
          pages: [{ page: 1, text: "Consulte o QR Code" }],
          qr: false,
          qrScanned: true,
        },
      ],
      {},
      "2026-09-18",
    );
    expect(a.documents[0].elements.qr).toBe("Não detectado");
  });
  it("troca de versão invalida aprovação anterior", () => {
    expect(
      summarize(
        [{ id: "new", kind: "cnpj" }],
        [{ version_id: "old", decision: "Aprovado" }],
      ).approved,
    ).toBe(0);
  });
  it("rejeita campos que não existem no modelo", () => {
    expect(() => validateFicha({ inventado: "x" })).toThrow();
  });
  it("aceita rascunho parcial sem inventar obrigatoriedade oficial", () => {
    expect(validateFicha({ B20: "12345678000190" })).toEqual({
      B20: "12345678000190",
    });
  });
});
