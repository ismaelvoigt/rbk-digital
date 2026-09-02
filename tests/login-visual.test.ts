import { describe, expect, it } from "vitest";
import fs from "node:fs";

const arquivo = "src/app/page.tsx";

describe("tela de acesso RBK Digital", () => {
  it("deve usar o novo layout visual aprovado", () => {
    const conteudo = fs.readFileSync(arquivo, "utf8");

    expect(conteudo).toContain("bg-[#06142b]");
    expect(conteudo).toContain("Acesso seguro");
    expect(conteudo).toContain("Gestão documental inteligente");
    expect(conteudo).toContain("Digite seu e-mail");
    expect(conteudo).toContain("Digite sua senha");
    expect(conteudo).toContain("Entrar no RBK Digital");
    expect(conteudo).toContain("Esqueci minha senha");
    expect(conteudo).toContain("overflow-hidden");
  });
});
