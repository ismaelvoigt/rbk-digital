export function getRouteForPerfil(perfil: string): string {
  switch (perfil) {
    case "admin":
      return "/dashboard";

    case "farmacia":
      return "/farmacia";

    default:
      return "/";
  }
}
