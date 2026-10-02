import { resolveRole } from "./rbac";

export type NavegacaoPerfil = {
  href: "/dashboard" | "/farmacia";
  label: "← Voltar ao Dashboard" | "← Voltar ao início";
};

export function getNavegacaoPerfil(isAdmin: boolean): NavegacaoPerfil {
  if (isAdmin) {
    return {
      href: "/dashboard",
      label: "← Voltar ao Dashboard",
    };
  }

  return {
    href: "/farmacia",
    label: "← Voltar ao início",
  };
}

export function getNavegacaoPorRole(perfil: string | null, legacyAdmin: boolean): NavegacaoPerfil {
  const role = resolveRole(perfil, legacyAdmin);
  return getNavegacaoPerfil(role === "gestor_rbk" || role === "superadmin_rbk");
}
