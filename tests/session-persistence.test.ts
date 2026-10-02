import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserSessionCookies, setSessionPersistence } from "../src/lib/auth/sessionPersistence";

// A browser cookie jar: a new browser session removes only session cookies.
const jar = new Map<string, { value: string; persistent: boolean }>();
const writes: string[] = [];
const token = "sb-test-auth-token";
beforeEach(() => {
  jar.clear(); writes.length = 0;
  vi.stubGlobal("document", {
    get cookie() { return [...jar].map(([name, c]) => `${name}=${c.value}`).join("; "); },
    set cookie(header: string) {
      writes.push(header);
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index);
      if (/Max-Age=0(?:;|$)/i.test(header)) jar.delete(name);
      else jar.set(name, { value: pair.slice(index + 1), persistent: /Max-Age=\d+/i.test(header) });
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
function save(value = "session") {
  browserSessionCookies.setAll!([{ name: token, value, options: { path: "/", maxAge: 34560000 } }]);
}
function reopen() { for (const [name, cookie] of jar) if (!cookie.persistent) jar.delete(name); }

describe("persistência da autenticação", () => {
  it("mantém farmácia após reabrir e renovar o token", () => {
    save(); setSessionPersistence("farmacia"); reopen();
    expect(browserSessionCookies.getAll!()).toContainEqual({ name: token, value: "session" });
    save("renewed"); reopen();
    expect(browserSessionCookies.getAll!()).toContainEqual({ name: token, value: "renewed" });
  });
  it.each(["gestor_rbk", "admin", "superadmin_rbk", "operador", "unknown", null])("não persiste %s, mas preserva navegação", (perfil) => {
    save(); setSessionPersistence(perfil); save("renewed");
    expect(browserSessionCookies.getAll!()).toContainEqual({ name: token, value: "renewed" });
    reopen();
    expect(browserSessionCookies.getAll!()).not.toContainEqual({ name: token, value: "renewed" });
  });
  it("retira persistência antiga ao trocar de farmácia para gestor, inclusive chunks", () => {
    save(); setSessionPersistence("farmacia");
    browserSessionCookies.setAll!([{ name: `${token}.0`, value: "chunk", options: { maxAge: 34560000 } }]);
    setSessionPersistence("gestor_rbk"); reopen();
    expect(browserSessionCookies.getAll!()).toEqual([]);
  });
  it("Sair apaga cookies e não deixa a próxima autenticação persistente", () => {
    save(); setSessionPersistence("farmacia");
    browserSessionCookies.setAll!([{ name: token, value: "", options: { maxAge: 0 } }]);
    save("next-login"); reopen();
    expect(browserSessionCookies.getAll!()).toEqual([]);
  });
  it("remove Expires e Max-Age de sessões temporárias sem perder atributos ou deleções", () => {
    browserSessionCookies.setAll!([{ name: token, value: "value", options: { maxAge: 34560000, expires: new Date("2030-01-01"), path: "/", sameSite: "lax", secure: true } }]);
    expect(writes[0]).not.toMatch(/Max-Age|Expires/i);
    expect(writes[0]).toMatch(/Secure/);
    expect(writes[0]).toMatch(/SameSite=Lax/);
  });
});
