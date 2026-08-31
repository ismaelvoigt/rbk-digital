import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("nova autorização — confirmação após cadastro", () => {
  const arquivo = "src/app/nova-autorizacao/page.tsx";

  it("deve possuir estado para controlar a confirmação", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain("autorizacaoSalva");
  });

  it("não deve redirecionar automaticamente após salvar", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).not.toContain(
      "router.push(`/autorizacoes/${autorizacao.id}/documentos`)"
    );
  });

  it("deve mostrar a confirmação do cadastro", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain(
      "Autorização cadastrada com sucesso"
    );
  });

  it("deve mostrar a confirmação da documentação", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain(
      "Documentação salva com sucesso"
    );
  });

  it("deve oferecer a opção de consultar autorizações", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain("Ver autorizações");
  });

  it("deve oferecer a opção de cadastrar outra autorização", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain(
      "Cadastrar nova autorização"
    );
  });

  it("deve oferecer o link Início", () => {
    const conteudo = fs.readFileSync(arquivo, "utf-8");

    expect(conteudo).toContain("Início");
  });
});
