type AccessInput = {
  authenticated: boolean;
  perfil: string | null;
  pathname: string;
};

type AccessDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      redirectTo: string;
    };

const ROTAS_ADMINISTRATIVAS = [
  "/dashboard",
  "/usuarios",
];

const ROTAS_COMPARTILHADAS = [
  "/autorizacoes",
];

const ROTA_NOVA_AUTORIZACAO = "/nova-autorizacao";

function isRota(pathname: string, rota: string): boolean {
  return pathname === rota || pathname.startsWith(`${rota}/`);
}

function isRotaAdministrativa(pathname: string): boolean {
  return ROTAS_ADMINISTRATIVAS.some((rota) =>
    isRota(pathname, rota)
  );
}

function isRotaCompartilhada(pathname: string): boolean {
  return ROTAS_COMPARTILHADAS.some((rota) =>
    isRota(pathname, rota)
  );
}

export function getAccessDecision({
  authenticated,
  perfil,
  pathname,
}: AccessInput): AccessDecision {
  if (!authenticated) {
    return {
      allowed: false,
      redirectTo: "/",
    };
  }

  if (perfil !== "admin" && perfil !== "farmacia") {
    return {
      allowed: false,
      redirectTo: "/",
    };
  }

  /*
   * Nova autorização pertence ao fluxo operacional da farmácia.
   * Administrador não utiliza essa rota.
   */
  if (isRota(pathname, ROTA_NOVA_AUTORIZACAO)) {
    if (perfil === "farmacia") {
      return {
        allowed: true,
      };
    }

    return {
      allowed: false,
      redirectTo: "/dashboard",
    };
  }

  /*
   * Autorizações são compartilhadas entre os dois ambientes.
   * A segurança dos dados continua sendo garantida pelo user_id/RLS.
   */
  if (isRotaCompartilhada(pathname)) {
    return {
      allowed: true,
    };
  }

  /*
   * Rotas administrativas pertencem exclusivamente ao administrador.
   */
  if (isRotaAdministrativa(pathname)) {
    if (perfil === "admin") {
      return {
        allowed: true,
      };
    }

    return {
      allowed: false,
      redirectTo: "/farmacia",
    };
  }

  /*
   * Ambiente próprio da farmácia.
   */
  if (isRota(pathname, "/farmacia")) {
    if (perfil === "farmacia") {
      return {
        allowed: true,
      };
    }

    return {
      allowed: false,
      redirectTo: "/dashboard",
    };
  }

  /*
   * Demais rotas autenticadas permanecem acessíveis
   * somente para perfis reconhecidos.
   */
  return {
    allowed: true,
  };
}
