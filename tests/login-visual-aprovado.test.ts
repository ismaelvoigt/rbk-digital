import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("RBK Digital — tela de login aprovada", () => {
  it("deve usar a composição escura aprovada e a marca própria do login", () => {
    const conteudo = fs.readFileSync("src/app/page.tsx", "utf-8");

    expect(conteudo).toContain('bg-[#06142b]');
    expect(conteudo).toContain('rbk-login-brand');
    expect(conteudo).toContain('/rbk-login-brand.png');
    expect(conteudo).toContain('mix-blend-screen');
    expect(conteudo).toContain('Gestão documental inteligente');
    expect(conteudo).toContain('Acesso seguro');
    expect(conteudo).toContain('Entrar no RBK Digital');
    expect(conteudo).toContain('Esqueci minha senha');
    expect(conteudo).toContain('onSubmit={entrar}');
    expect(conteudo).toContain('supabase.auth.signInWithPassword');
  });
});
