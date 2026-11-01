// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import Dashboard from "../src/app/dashboard/page";
const client = {
  auth: {
    getUser: async () => ({
      data: { user: { id: "rbk", email: "rbk@test.invalid" } },
    }),
    getSession: async () => ({ data: { session: { access_token: "test" } } }),
  },
};
vi.mock("../src/lib/supabase/client", () => ({ createClient: () => client }));
vi.mock("../src/components/RbkBrand", () => ({ RbkBrand: () => null }));
vi.mock("../src/components/GestorNavigation", () => ({
  GestorLogout: () => null,
}));
it("inclui responsáveis em teste e promovidos no resumo do gestor", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        usuarios: [
          { perfil: "operador", tipo_convite: "farmacia", status: "active" },
          {
            perfil: "administrador_farmacia",
            tipo_convite: "farmacia",
            status: "active",
          },
          { perfil: "farmacia", status: "active" },
          { perfil: "operador", tipo_convite: "farmacia", status: "inactive" },
        ],
      }),
    ),
  );
  const host = document.createElement("div"),
    root = createRoot(host);
  try {
    await act(async () => root.render(<Dashboard />));
    const label = [...host.querySelectorAll("p")].find((p) =>
      p.textContent?.startsWith("Responsáveis ativos"),
    );
    expect(label?.previousElementSibling?.textContent?.trim()).toBe("3");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
