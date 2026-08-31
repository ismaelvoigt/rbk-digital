import { describe, expect, it } from "vitest";
import { getRouteForPerfil } from "../src/lib/auth/routeForPerfil";

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
