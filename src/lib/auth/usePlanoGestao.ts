"use client";
import { useEffect, useState } from "react";
import { createClient } from "../supabase/client";
import type { RbkRole } from "./rbac";
/** Unknown/error stays closed; backend permissions remain authoritative. */
export function usePlanoGestao(role: RbkRole | null) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    if (
      !role ||
      role === "operador" ||
      role === "gestor_rbk" ||
      role === "superadmin_rbk"
    )
      return;
    async function load() {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) return;
      const profile = await client
        .from("users")
        .select("farm_id,status")
        .eq("id", user.id)
        .maybeSingle();
      if (
        profile.error ||
        profile.data?.status !== "active" ||
        !profile.data.farm_id
      )
        return;
      const farm = await client
        .from("farms")
        .select("plano")
        .eq("id", profile.data.farm_id)
        .maybeSingle();
      if (active && !farm.error) setAllowed(farm.data?.plano === "completo");
    }
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, [role]);
  if (role === "gestor_rbk" || role === "superadmin_rbk") return true;
  return Boolean(role && role !== "operador" && allowed);
}
