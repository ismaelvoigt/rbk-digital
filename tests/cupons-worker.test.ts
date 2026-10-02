import { it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("../src/lib/cupons/leitura", () => ({ lerCupom: vi.fn() }));
import { origemPermitida, processarProximo } from "../src/lib/cupons/worker";
it("recusa caminhos de outro usuário, autorização e travessia", () => {
  expect(origemPermitida("u/a/cupom.pdf", "u", "a")).toBe(true);
  for (const path of [
    "v/a/cupom.pdf",
    "u/b/cupom.pdf",
    "u/a/../x",
    "u/a/%2e%2e",
    "u/a/..",
    "u/a/",
  ])
    expect(origemPermitida(path, "u", "a")).toBe(false);
});
it("worker de recuperação não acessa Storage quando o caminho não pertence à autorização", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        documento_id: "d",
        autorizacao_id: "a",
        caminho_arquivo: "vitima/a/secreto.pdf",
        versao: "v",
        lease_token: "t",
      },
    })
    .mockResolvedValue({ data: true });
  const storage = { from: vi.fn() };
  const single = vi.fn().mockResolvedValue({ data: { user_id: "atacante" } });
  const client = {
    rpc,
    storage,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  } as unknown as SupabaseClient;
  expect(await processarProximo(client)).toMatchObject({
    estado: "erro",
    aplicado: true,
  });
  expect(storage.from).not.toHaveBeenCalled();
  expect(rpc.mock.calls[1][1]).toMatchObject({
    p_estado: "erro",
    p_resultado: {},
    p_sha: null,
  });
});
