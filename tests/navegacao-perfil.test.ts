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

import { getNavegacaoPorRole } from '../src/lib/auth/navegacaoPerfil';
it.each(['gestor_rbk', 'superadmin_rbk'])('shared screens return %s to dashboard', perfil => {
  expect(getNavegacaoPorRole(perfil, perfil === 'superadmin_rbk').href).toBe('/dashboard');
});
it.each(['farmacia', 'operador', 'administrador_farmacia'])('keeps %s in the pharmacy area', perfil => {
  expect(getNavegacaoPorRole(perfil, false).href).toBe('/farmacia');
});
