import { resolveRole } from "./rbac";

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

  // O proxy entrega superadmin_rbk somente após confirmar rbk_admins.
  const role = perfil === "admin" || perfil === "superadmin_rbk"
    ? "superadmin_rbk" : resolveRole(perfil, false);
  if (!role) {
    return {
      allowed: false,
      redirectTo: "/",
    };
  }

  const isRbk = role === "gestor_rbk" || role === "superadmin_rbk";
  const home = isRbk ? "/dashboard" : "/farmacia";

  if (isRota(pathname, "/monitoramento") || isRota(pathname, "/processos")) {
    return isRbk ? { allowed: true } : { allowed: false, redirectTo: home };
  }

  /*
   * Nova autorização pertence ao fluxo operacional da farmácia.
   * Administrador não utiliza essa rota.
   */
  if (isRota(pathname, ROTA_NOVA_AUTORIZACAO)) {
    if (!isRbk) {
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
   * O isolamento dos dados é aplicado pelas políticas RLS por farm_id.
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
    const gestorDetalheAutorizacoes = /^\/usuarios\/[^/]+\/autorizacoes(?:\/|$)/.test(pathname);
    if (role === "superadmin_rbk" || (role === "gestor_rbk" &&
      (!isRota(pathname, "/usuarios") || gestorDetalheAutorizacoes))) {
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
    if (!isRbk) {
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
