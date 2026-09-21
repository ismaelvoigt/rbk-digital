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
