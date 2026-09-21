import { describe, expect, it, vi } from "vitest";
import { validarLinkDeSenha } from "../src/lib/auth/linkDeSenha";

function authSimulada() {
  return {
    setSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  };
}
describe("link de primeiro acesso e recuperação", () => {
  it("aceita convite aberto em outro navegador sem verificador PKCE", async () => {
    const auth = authSimulada();
    expect(await validarLinkDeSenha(auth, "https://rbk-digital.vercel.app/redefinir-senha#type=invite&access_token=teste&refresh_token=renovacao")).toBe(true);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "teste", refresh_token: "renovacao" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("preserva recuperação por código PKCE", async () => {
    const auth = authSimulada();
    expect(await validarLinkDeSenha(auth, "https://rbk-digital.vercel.app/redefinir-senha?code=teste")).toBe(true);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("teste");
  });
  it("rejeita link expirado mesmo com sessão anterior", async () => {
    const auth = authSimulada();
    auth.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    expect(await validarLinkDeSenha(auth, "https://rbk-digital.vercel.app/redefinir-senha#error=access_denied&error_code=otp_expired")).toBe(false);
    expect(auth.getSession).not.toHaveBeenCalled();
  });
  it("rejeita tokens recusados pelo Supabase", async () => {
    const auth = authSimulada();
    auth.setSession.mockResolvedValue({ data: { session: null }, error: new Error("inválido") });
    expect(await validarLinkDeSenha(auth, "https://rbk-digital.vercel.app/redefinir-senha#type=invite&access_token=teste&refresh_token=teste")).toBe(false);
  });
  it("não libera formulário sem link nem sessão", async () => {
    expect(await validarLinkDeSenha(authSimulada(), "https://rbk-digital.vercel.app/redefinir-senha")).toBe(false);
  });
});
