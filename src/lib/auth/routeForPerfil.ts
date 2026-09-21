export function getRouteForPerfil(perfil: string): string {
  switch (perfil) {
    case "admin":
    case "gestor_rbk":
    case "superadmin_rbk":
      return "/dashboard";

    case "farmacia":
    case "operador":
    case "administrador_farmacia":
      return "/farmacia";

    default:
      return "/";
  }
}
