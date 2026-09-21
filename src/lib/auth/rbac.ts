export type RbkRole =
  | "operador"
  | "administrador_farmacia"
  | "gestor_rbk"
  | "superadmin_rbk";

const ROLES: readonly string[] = [
  "operador",
  "administrador_farmacia",
  "gestor_rbk",
  "superadmin_rbk",
];

export function resolveRole(perfil: string | null, legacyRbkAdmin: boolean): RbkRole | null {
  if (legacyRbkAdmin) return "superadmin_rbk";
  if (perfil === "superadmin_rbk") return null;
  if (perfil === "farmacia") return "administrador_farmacia";
  return perfil && ROLES.includes(perfil) ? (perfil as RbkRole) : null;
}

export function canAccessFarm(
  role: RbkRole | null,
  actorFarmId: string | null,
  targetFarmId: string,
  assignedFarmIds: readonly string[] = [],
): boolean {
  if (!role || !targetFarmId) return false;
  if (role === "superadmin_rbk") return true;
  if (role === "gestor_rbk") return assignedFarmIds.includes(targetFarmId);
  return Boolean(actorFarmId && actorFarmId === targetFarmId);
}
