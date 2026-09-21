import { describe, expect, it } from "vitest";
import { canAccessFarm, resolveRole } from "../src/lib/auth/rbac";

describe("RBAC RBK", () => {
  it("mantém os perfis legados sem promover uma farmácia à RBK", () => {
    expect(resolveRole("farmacia", false)).toBe("administrador_farmacia");
    expect(resolveRole("farmacia", true)).toBe("superadmin_rbk");
    expect(resolveRole("admin", false)).toBeNull();
    expect(resolveRole("superadmin_rbk", false)).toBeNull();
  });

  it("restringe operador e administrador ao farm_id explícito", () => {
    for (const role of ["operador", "administrador_farmacia"] as const) {
      expect(canAccessFarm(role, "farm-a", "farm-a")).toBe(true);
      expect(canAccessFarm(role, "farm-a", "farm-b")).toBe(false);
      expect(canAccessFarm(role, null, "farm-a")).toBe(false);
    }
  });

  it("limita gestor à carteira atribuída e superadmin à RBK", () => {
    expect(canAccessFarm("gestor_rbk", null, "farm-b", ["farm-b"])).toBe(true);
    expect(canAccessFarm("gestor_rbk", null, "farm-c", ["farm-b"])).toBe(false);
    expect(canAccessFarm("superadmin_rbk", null, "farm-b")).toBe(true);
    expect(canAccessFarm(null, "farm-a", "farm-a")).toBe(false);
  });
});
