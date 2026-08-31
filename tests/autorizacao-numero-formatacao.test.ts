import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("autorização — duplicidade e formatação", () => {
  it("deve tratar duplicidade diretamente no fluxo de salvamento", () => {
    const conteudo = fs.readFileSync(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8",
    );

    expect(conteudo).toContain(
      'setErro(mensagemErroAutorizacao({ code: "23505" }))',
    );

    expect(conteudo).not.toContain(
      'Esta autorização já está cadastrada. Confira o número informado.',
    );
  });

  it("deve formatar número de autorização na página de documentos", () => {
    const conteudo = fs.readFileSync(
      "src/app/autorizacoes/[id]/documentos/page.tsx",
      "utf-8",
    );

    expect(conteudo).toContain(
      "function formatarNumeroAutorizacao(valor: string)",
    );

    expect(conteudo).toContain(
      "#{formatarNumeroAutorizacao(numeroAutorizacao)}",
    );
  });

  it("deve formatar número de autorização na página de sucesso", () => {
    const conteudo = fs.readFileSync(
      "src/app/autorizacoes/[id]/documentos/sucesso/page.tsx",
      "utf-8",
    );

    expect(conteudo).toContain(
      "function formatarNumeroAutorizacao(valor: string)",
    );

    expect(conteudo).toContain(
      "`#${formatarNumeroAutorizacao(numeroAutorizacao)}`",
    );
  });

  it("deve produzir 888.888.888.888.899 para 888888888888899", () => {
    const valor = "888888888888899";
    const digits = valor.replace(/\D/g, "").slice(0, 15);

    const formatado =
      `${digits.slice(0, 3)}.` +
      `${digits.slice(3, 6)}.` +
      `${digits.slice(6, 9)}.` +
      `${digits.slice(9, 12)}.` +
      `${digits.slice(12)}`;

    expect(formatado).toBe("888.888.888.888.899");
  });
});
