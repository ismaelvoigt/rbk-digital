import { describe, expect, it } from "vitest";
import { getPendenciasDocumentais } from "../src/lib/documentos/pendencias";

describe("pendências documentais existentes", () => {
  it("sinaliza documentos obrigatórios ausentes ou marcados para atenção", () => {
    expect(getPendenciasDocumentais([
      { categoria: "documento_cliente", status: "recebido" },
      { categoria: "receita_medica", status: "atencao" },
      { categoria: "cupom_fiscal", status: "recebido" },
    ])).toEqual(["Receita Médica", "Cupom Vinculado"]);
  });

  it("não trata Outros documentos como obrigatório", () => {
    expect(getPendenciasDocumentais([
      { categoria: "documento_cliente", status: "recebido" },
      { categoria: "receita_medica", status: "recebido" },
      { categoria: "cupom_fiscal", status: "recebido" },
      { categoria: "cupom_vinculado", status: "recebido" },
    ])).toEqual([]);
  });
});
