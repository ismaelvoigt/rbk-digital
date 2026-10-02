import { describe, expect, it } from "vitest";
import { getRouteForPerfil } from "../src/lib/auth/routeForPerfil";

// Perfis novos usam a mesma entrada operacional/gerencial aprovada.
it("encaminha os quatro perfis", () => {
  expect(getRouteForPerfil("operador")).toBe("/farmacia");
  expect(getRouteForPerfil("administrador_farmacia")).toBe("/farmacia");
  expect(getRouteForPerfil("gestor_rbk")).toBe("/dashboard");
  expect(getRouteForPerfil("superadmin_rbk")).toBe("/dashboard");
});

describe("roteamento por perfil", () => {
  it("direciona administrador para o dashboard administrativo", () => {
    expect(getRouteForPerfil("admin")).toBe("/dashboard");
  });

  it("direciona farmácia para o ambiente da farmácia", () => {
    expect(getRouteForPerfil("farmacia")).toBe("/farmacia");
  });

  it("não permite acesso administrativo para perfil desconhecido", () => {
    expect(getRouteForPerfil("desconhecido")).toBe("/");
  });
});
