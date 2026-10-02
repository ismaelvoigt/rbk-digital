import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("recuperação de senha do RBK Digital", () => {
  it("oferece recuperação a partir do login com envio na página própria", () => {
    const login = readFileSync(resolve(root, "src/app/page.tsx"), "utf8");
    expect(login).toContain('href="/esqueci-minha-senha"');
    const page = readFileSync(resolve(root, "src/app/esqueci-minha-senha/page.tsx"), "utf8");

    expect(page).toContain("resetPasswordForEmail");
    expect(page).toContain(
      'redirectTo:`${window.location.origin}/redefinir-senha`'
    );
    expect(page).toContain("onSubmit={enviar}");
    expect(page).toContain("Se houver uma conta com esse e-mail");
    expect(page).toContain("Informe o e-mail da sua conta");
  });

  it("deve ter a tela de redefinição", () => {
    const resetPath = resolve(root, "src/app/redefinir-senha/page.tsx");
    expect(existsSync(resetPath)).toBe(true);

    const resetPage = readFileSync(resetPath, "utf8");
    expect(resetPage).toContain("useLinkDeSenha('recovery')");
    const fluxo = readFileSync(resolve(root, "src/lib/auth/useLinkDeSenha.ts"), "utf8");
    const campos = readFileSync(resolve(root, "src/components/auth/SenhaCampos.tsx"), "utf8");
    expect(fluxo).toContain("updateUser");
    expect(fluxo).toContain("validarLinkDeSenha");
    expect(campos).toContain("Nova senha");
    expect(campos).toContain("Confirmar nova senha");
  });
});
