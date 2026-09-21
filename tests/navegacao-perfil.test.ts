import { describe, expect, it } from "vitest";

import { getNavegacaoPerfil } from "../src/lib/auth/navegacaoPerfil";

describe("navegação das rotas compartilhadas por perfil", () => {
  it("retorna o dashboard para administrador", () => {
    expect(getNavegacaoPerfil(true)).toEqual({
      href: "/dashboard",
      label: "← Voltar ao Dashboard",
    });
  });

  it("retorna o início da farmácia para usuário de farmácia", () => {
    expect(getNavegacaoPerfil(false)).toEqual({
      href: "/farmacia",
      label: "← Voltar ao início",
    });
  });
});
