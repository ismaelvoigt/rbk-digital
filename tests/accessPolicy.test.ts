import { describe, expect, it } from "vitest";
import { getAccessDecision } from "../src/lib/auth/accessPolicy";

describe("política de acesso do RBK Digital", () => {
  it("bloqueia usuário não autenticado", () => {
    expect(
      getAccessDecision({
        authenticated: false,
        perfil: null,
        pathname: "/dashboard",
      })
    ).toEqual({
      allowed: false,
      redirectTo: "/",
    });
  });

  it("permite administrador no dashboard", () => {
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "admin",
        pathname: "/dashboard",
      })
    ).toEqual({
      allowed: true,
    });
  });

  it("permite administrador nas rotas administrativas", () => {
    const rotasAdministrativas = [
      "/dashboard",
      "/usuarios",
      "/usuarios/123",
      "/autorizacoes",
      "/autorizacoes/123",
      "/autorizacoes/123/documentos",
    ];

    for (const pathname of rotasAdministrativas) {
      expect(
        getAccessDecision({
          authenticated: true,
          perfil: "admin",
          pathname,
        })
      ).toEqual({
        allowed: true,
      });
    }
  });

  it("bloqueia administrador na criação de nova autorização", () => {
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "admin",
        pathname: "/nova-autorizacao",
      })
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
    });
  });

  it("permite farmácia no próprio ambiente", () => {
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "farmacia",
        pathname: "/farmacia",
      })
    ).toEqual({
      allowed: true,
    });
  });

  it("permite farmácia cadastrar nova autorização", () => {
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "farmacia",
        pathname: "/nova-autorizacao",
      })
    ).toEqual({
      allowed: true,
    });
  });

  it("permite farmácia consultar autorizações", () => {
    const rotas = [
      "/autorizacoes",
      "/autorizacoes/123",
      "/autorizacoes/123/documentos",
    ];

    for (const pathname of rotas) {
      expect(
        getAccessDecision({
          authenticated: true,
          perfil: "farmacia",
          pathname,
        })
      ).toEqual({
        allowed: true,
      });
    }
  });

  it("bloqueia farmácia no dashboard administrativo", () => {
    expect(
      getAccessDecision({
        authenticated: true,
        perfil: "farmacia",
        pathname: "/dashboard",
      })
    ).toEqual({
      allowed: false,
      redirectTo: "/farmacia",
    });
  });

  it("bloqueia farmácia no gerenciamento de usuários", () => {
    const rotas = [
      "/usuarios",
      "/usuarios/123",
      "/usuarios/novo",
    ];

    for (const pathname of rotas) {
      expect(
        getAccessDecision({
          authenticated: true,
          perfil: "farmacia",
          pathname,
        })
      ).toEqual({
        allowed: false,
        redirectTo: "/farmacia",
      });
    }
  });

  it("bloqueia perfil desconhecido", () => {
    const rotas = [
      "/dashboard",
      "/usuarios",
      "/autorizacoes",
      "/nova-autorizacao",
      "/farmacia",
    ];

    for (const pathname of rotas) {
      expect(
        getAccessDecision({
          authenticated: true,
          perfil: "outro",
          pathname,
        })
      ).toEqual({
        allowed: false,
        redirectTo: "/",
      });
    }
  });
});
