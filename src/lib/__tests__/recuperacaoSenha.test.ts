import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("recuperação de senha do RBK Digital", () => {
  it("deve ter o envio do link na tela de login", () => {
    const page = readFileSync(resolve(root, "src/app/page.tsx"), "utf8");

    expect(page).toContain("resetPasswordForEmail");
    expect(page).toContain(
      'redirectTo: `${window.location.origin}/redefinir-senha`'
    );
    expect(page).toContain("onClick={recuperarSenha}");
    expect(page).toContain("Link de recuperação enviado!");
    expect(page).toContain(
      "Informe seu e-mail para receber o link de recuperação."
    );
  });

  it("deve ter a tela de redefinição", () => {
    const resetPath = resolve(root, "src/app/redefinir-senha/page.tsx");
    expect(existsSync(resetPath)).toBe(true);

    const resetPage = readFileSync(resetPath, "utf8");
    expect(resetPage).toContain("updateUser");
    expect(resetPage).toContain("PASSWORD_RECOVERY");
    expect(resetPage).toContain("Nova senha");
    expect(resetPage).toContain("Confirmar nova senha");
  });
});
