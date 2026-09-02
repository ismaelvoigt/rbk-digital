import { describe, expect, it } from "vitest";
import { resultadoConfirmacao } from "./fluxoConfirmacao";

describe("resultadoConfirmacao", () => {
  it("leva para o início quando nenhum documento foi substituído", () => {
    expect(resultadoConfirmacao(false)).toEqual({
      tipo: "navegar",
      destino: "/farmacia",
    });
  });

  it("permanece na tela e informa atualização quando houve substituição", () => {
    expect(resultadoConfirmacao(true)).toEqual({
      tipo: "atualizada",
      destino: null,
    });
  });
});
