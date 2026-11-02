// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ReenviarConvite } from "../src/components/ReenviarConvite";
vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test" } } }),
    },
  }),
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("exige salvar e-mail alterado e não dispara envio automático", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await act(async () =>
    root.render(
      <ReenviarConvite
        id="u"
        emailSalvo="old@example.invalid"
        emailAtual="new@example.invalid"
      />,
    ),
  );
  expect(host.querySelector("button")?.disabled).toBe(true);
  expect(host.textContent).toContain("Salve o novo e-mail");
  expect(f).not.toHaveBeenCalled();
});
it("reenvia só ao clicar, usando endereço salvo e mostrando confirmação apenas após resposta", async () => {
  const f = vi.fn<typeof fetch>(async () =>
    Response.json({ success: true, mensagem: "Convite reenviado." }),
  );
  vi.stubGlobal("fetch", f);
  await act(async () =>
    root.render(
      <ReenviarConvite
        id="u"
        emailSalvo="new@example.invalid"
        emailAtual="new@example.invalid"
      />,
    ),
  );
  await act(async () => host.querySelector("button")!.click());
  expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({
    id: "u",
    email: "new@example.invalid",
  });
  expect(host.querySelector("[role=status]")?.textContent).toContain(
    "Convite reenviado",
  );
});
it("falha de envio aparece sem confirmação de sucesso", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "Não foi possível enviar." }, { status: 502 }),
    ),
  );
  await act(async () =>
    root.render(
      <ReenviarConvite
        id="u"
        emailSalvo="x@example.invalid"
        emailAtual="x@example.invalid"
      />,
    ),
  );
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "Não foi possível enviar",
  );
  expect(host.querySelector("[role=status]")).toBeNull();
});
