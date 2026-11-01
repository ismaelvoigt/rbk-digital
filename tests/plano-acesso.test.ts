import { expect, it } from "vitest";
import { getAccessDecision } from "../src/lib/auth/accessPolicy";
import { nomeInicialFarmacia } from "../src/lib/usuarios/nomeInicial";
it("plano armazenamento permite equipe e cadastro, mas impede módulos avançados mesmo após promoção", () => {
  for (const pathname of [
    "/administracao",
    "/vendas",
    "/compras",
    "/relatorios",
    "/proximas-dispensacoes",
    "/pendencias",
  ])
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "administrador_farmacia",
        pathname,
        plano: "armazenamento",
      }).allowed,
    ).toBe(false);
  for (const pathname of ["/equipe", "/nova-autorizacao", "/autorizacoes"])
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "administrador_farmacia",
        pathname,
        plano: "armazenamento",
      }).allowed,
    ).toBe(true);
  expect(
    getAccessDecision({
      authenticated: true,
      perfil: "superadmin_rbk",
      pathname: "/vendas",
      plano: "armazenamento",
    }).allowed,
  ).toBe(true);
});
it("título usa nome fantasia, razão social ou nome neutro enquanto carrega", () => {
  expect(
    nomeInicialFarmacia({
      nome_fantasia: "  Farmácia Alfa  ",
      razao_social: "Empresa Ltda",
    }),
  ).toBe("Farmácia Alfa");
  expect(
    nomeInicialFarmacia({ nome_fantasia: " ", razao_social: "Empresa Ltda" }),
  ).toBe("Empresa Ltda");
  expect(nomeInicialFarmacia(null)).toBe("Sua farmácia");
});
