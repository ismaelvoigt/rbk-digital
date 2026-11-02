// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import Usuarios from "../src/app/usuarios/page";
const client = {
  auth: {
    getUser: async () => ({ data: { user: { id: "rbk" } } }),
    getSession: async () => ({ data: { session: { access_token: "test" } } }),
  },
};
vi.mock("../src/lib/supabase/client", () => ({ createClient: () => client }));
vi.mock("../src/components/RbkBrand", () => ({ RbkBrand: () => null }));
it("mostra apenas a exclusão definitiva da farmácia, sem exclusão por e-mail", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        usuarios: [
          {
            id: "u",
            farm_id: "f",
            nome: "Alfa",
            email: "test@example.invalid",
            perfil: "farmacia",
            status: "active",
            created_at: "2026-11-01T12:00:00Z",
            last_access_at: null,
            farms: {
              razao_social: "Alfa",
              nome_fantasia: "Alfa",
              cnpj: "11222333000181",
              status: "active",
            },
          },
        ],
      }),
    ),
  );
  const host = document.createElement("div"),
    root = createRoot(host);
  try {
    await act(async () => root.render(<Usuarios />));
    const show = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Ver todas as farmácias",
    )!;
    await act(async () => show.click());
    expect(
      [...host.querySelectorAll("button")].filter(
        (b) => b.textContent === "Excluir definitivamente",
      ),
    ).toHaveLength(1);
    expect(host.textContent).not.toContain("Excluir usuário");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
