// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { ExcluirUsuario } from "../src/components/ExcluirUsuario";
vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test" } } }),
    },
  }),
}));
let host: HTMLDivElement, root: Root;
const removed = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  removed.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("mostra o motivo e não oferece confirmação quando há documentos", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        eligible: false,
        reason: "Possui documentos vinculados.",
      }),
    ),
  );
  await act(async () =>
    root.render(
      <ExcluirUsuario id="u" email="u@test.invalid" onDeleted={removed} />,
    ),
  );
  await act(async () => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Possui documentos vinculados.");
  expect(host.querySelector("input")).toBeNull();
  expect(removed).not.toHaveBeenCalled();
});
it("não mostra sucesso se o servidor recusar a exclusão na segunda conferência", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ eligible: true }))
    .mockResolvedValueOnce(
      Response.json(
        { error: "Documento recebido durante a confirmação." },
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", f);
  await act(async () =>
    root.render(
      <ExcluirUsuario id="u" email="u@test.invalid" onDeleted={removed} />,
    ),
  );
  await act(async () => host.querySelector("button")!.click());
  const input = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "u@test.invalid");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(host.textContent).toContain("Documento recebido");
  expect(removed).not.toHaveBeenCalled();
  expect(f.mock.calls[1][1].method).toBe("DELETE");
});
