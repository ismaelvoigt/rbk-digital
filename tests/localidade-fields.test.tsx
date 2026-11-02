// @vitest-environment happy-dom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { LocalidadeFields } from "../src/components/LocalidadeFields";
let host: HTMLDivElement, root: Root;
function Form({ uf = "", city = "" }: { uf?: string; city?: string }) {
  const [estado, setEstado] = useState(uf),
    [cidade, setCidade] = useState(city);
  return (
    <LocalidadeFields
      estado={estado}
      cidade={cidade}
      onEstadoChange={setEstado}
      onCidadeChange={setCidade}
    />
  );
}
const select = async (id: string, value: string) =>
  act(async () => {
    const el = host.querySelector<HTMLSelectElement>("#" + id)!;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
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
it("oferece 27 UFs primeiro e cidade abaixo desabilitada até escolher UF", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(<Form />));
  expect([...host.querySelectorAll("select")].map((s) => s.id)).toEqual([
    "estado",
    "cidade",
  ]);
  expect(
    host.querySelector("#estado")?.querySelectorAll("option"),
  ).toHaveLength(28);
  expect(host.querySelector<HTMLSelectElement>("#cidade")?.disabled).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});
it("carrega cidades da UF e limpa a cidade quando a UF muda", async () => {
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith("SC.json")
        ? ["Florianópolis", "São José"]
        : ["Porto Alegre"],
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(<Form />));
  await select("estado", "SC");
  expect(fetcher.mock.calls[0][0]).toContain("/SC.json");
  await select("cidade", "São José");
  expect(host.querySelector<HTMLSelectElement>("#cidade")?.value).toBe(
    "São José",
  );
  await select("estado", "RS");
  expect(host.querySelector<HTMLSelectElement>("#cidade")?.value).toBe("");
  expect(host.querySelector("#cidade")?.textContent).toContain("Porto Alegre");
  expect(host.querySelector("#cidade")?.textContent).not.toContain("São José");
});
it("ignora resposta atrasada da UF anterior", async () => {
  let finish!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("SC.json")
        ? new Promise<Response>((r) => {
            finish = r;
          })
        : Promise.resolve(Response.json(["Porto Alegre"])),
    ),
  );
  await act(async () => root.render(<Form />));
  await select("estado", "SC");
  await select("estado", "RS");
  await act(async () => finish(Response.json(["Florianópolis"])));
  expect(host.querySelector("#cidade")?.textContent).toContain("Porto Alegre");
  expect(host.querySelector("#cidade")?.textContent).not.toContain(
    "Florianópolis",
  );
});
it("preserva cidade já cadastrada durante carga e indisponibilidade e permite tentar novamente", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValueOnce(Response.json(["Florianópolis", "São José"]));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(<Form uf="SC" city="São José" />));
  expect(host.querySelector<HTMLSelectElement>("#cidade")?.value).toBe(
    "São José",
  );
  expect(host.querySelector("[role=alert]")).not.toBeNull();
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector("[role=alert]")).toBeNull();
  expect(host.querySelector<HTMLSelectElement>("#cidade")?.value).toBe(
    "São José",
  );
});
