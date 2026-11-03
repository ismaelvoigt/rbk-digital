"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePerfilAtual } from "../lib/auth/usePerfilAtual";
import type { RbkRole } from "../lib/auth/rbac";
import { createClient } from "../lib/supabase/client";
import { GestorLogout } from "./GestorNavigation";
import { RbkBrand } from "./RbkBrand";

export function RbkHeader({
  email,
  perfil,
  children,
}: {
  email?: string;
  perfil?: RbkRole | null;
  children?: ReactNode;
}) {
  const role = usePerfilAtual(perfil);
  const [emailAtual, setEmailAtual] = useState("");

  useEffect(() => {
    if (email !== undefined) return;
    let ativo = true;

    async function carregarEmail() {
      const { data: { user } } = await createClient().auth.getUser();
      if (ativo) setEmailAtual(user?.email ?? "");
    }

    void carregarEmail().catch(() => {});
    return () => { ativo = false; };
  }, [email]);

  const identificacao = role && role !== "gestor_rbk" && role !== "superadmin_rbk"
    ? "Farmácia"
    : "Gestor RBK";

  return (
    <>
      <header className="rbk-topbar">
        <div className="mx-auto flex min-h-[96px] max-w-[1320px] items-center justify-between gap-6 px-6 lg:px-8">
          <RbkBrand compact light perfil={role} />

          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-700">{identificacao}</p>
              <p className="mt-1 text-sm text-gray-500">{email ?? emailAtual}</p>
            </div>
            <GestorLogout />
          </div>
        </div>
      </header>
      {children && (
        <div className="mx-auto flex max-w-[1320px] justify-end px-6 pt-4 lg:px-8">
          {children}
        </div>
      )}
    </>
  );
}
