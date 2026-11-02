// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import Farmacia from "../src/app/farmacia/page";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("../src/components/RbkBrand", () => ({ RbkBrand: () => null }));
vi.mock("../src/components/proximas/ProximasCard", () => ({
  default: () => null,
}));
vi.mock("../src/lib/supabase/client", () => {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user", email: "test@example.invalid" } },
      }),
    },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        in: () => q,
        maybeSingle: async () => ({
          data:
            table === "users"
              ? { perfil: "operador", status: "active", farm_id: "farm" }
              : { nome_fantasia: "Alfa", plano: "armazenamento" },
          error: null,
        }),
        range: async () => ({
          data:
            table === "autorizacoes"
              ? [
                  {
                    id: "one",
                    numero_autorizacao: "1",
                    cpf_cliente: "12345678901",
                    created_at: "2026-11-02T01:25:21Z",
                  },
                  {
                    id: "two",
                    numero_autorizacao: "2",
                    cpf_cliente: "12345678901",
                    created_at: "2026-11-01T23:25:21Z",
                  },
                ]
              : [],
          error: null,
        }),
      };
      return q;
    },
  };
  return { createClient: () => client };
});
it("conta hoje e mostra horário de Brasília mesmo com dispositivo em UTC", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("TZ", "UTC");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T01:30:00Z"));
  const host = document.createElement("div"),
    root = createRoot(host);
  try {
    await act(async () => root.render(<Farmacia />));
    const label = [...host.querySelectorAll("p")].find(
      (p) => p.textContent === "Autorizações hoje",
    );
    expect(label?.previousElementSibling?.textContent).toBe("2");
    expect(host.textContent).toContain("22:25");
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
