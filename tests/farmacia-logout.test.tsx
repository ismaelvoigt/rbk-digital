// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RbkHeader } from "../src/components/RbkHeader";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));
vi.mock("../src/components/RbkBrand", () => ({ RbkBrand: () => null }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

it.each([false, true])("logout compartilhado: falha=%s", async (falha) => {
  signOut.mockReset().mockResolvedValue({ error: falha ? new Error("offline") : null });
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<RbkHeader email="conta@example.invalid" perfil="operador" />));
    const buttons = host.querySelectorAll<HTMLButtonElement>('header button[aria-label="Sair"]');
    expect(buttons).toHaveLength(1);
    await act(async () => buttons[0].click());
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    if (falha) {
      expect(replace).not.toHaveBeenCalled();
      expect(host.querySelector('[role="alert"]')?.textContent).toContain("Tente novamente");
      expect(buttons[0].disabled).toBe(false);
    } else {
      expect(replace).toHaveBeenCalledWith("/");
    }
  } finally {
    await act(async () => root.unmount());
    replace.mockRestore();
  }
});
