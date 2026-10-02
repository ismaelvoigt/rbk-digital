import { describe, expect, it } from "vitest";
import { mensagemErroAutorizacao } from "../src/lib/documentos/mensagemErroAutorizacao";

describe("duplicidade de autorização", () => {
  it("deve transformar erro 23505 em mensagem amigável", () => {
    expect(
      mensagemErroAutorizacao({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "uq_autorizacoes_numero_normalizado"',
      }),
    ).toBe(
      "Esta autorização já está cadastrada. Revise o número da autorização informado. Se você esperava cadastrar uma nova autorização, confira se o número foi digitado corretamente.",
    );
  });

  it("deve manter mensagem genérica para outros erros", () => {
    expect(
      mensagemErroAutorizacao({
        code: "42P01",
        message: "relation does not exist",
      }),
    ).toBe("Não foi possível salvar a autorização.");
  });
});
