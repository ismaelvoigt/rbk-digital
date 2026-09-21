import { it, expect } from "vitest";
import {
  validateFiles,
  assertStaging,
  newToken,
  tokenHash,
  validateOrigin,
} from "../src/lib/auditoria/server";
it("tokens imprevisíveis de 256 bits, hash e limite de entrada", () => {
  const a = newToken(),
    b = newToken();
  expect(a).toHaveLength(43);
  expect(a).not.toBe(b);
  expect(tokenHash(a)).toMatch(/^[a-f0-9]{64}$/);
  expect(() => tokenHash("curto")).toThrow();
});
it("rejeita produção e URL disfarçada, exige habilitação explícita", () => {
  for (const env of [
    {},
    {
      AUDIT_PORTAL_ENABLED: "true",
      AUDIT_STAGING_PROJECT_REF: "sqamrlckyuesfmibxizy",
      NEXT_PUBLIC_SUPABASE_URL: "https://sqamrlckyuesfmibxizy.supabase.co",
    },
    {
      AUDIT_PORTAL_ENABLED: "true",
      AUDIT_STAGING_PROJECT_REF: "stage",
      NEXT_PUBLIC_SUPABASE_URL: "https://stage.supabase.co.evil.org",
    },
    {
      AUDIT_PORTAL_ENABLED: "true",
      AUDIT_STAGING_PROJECT_REF: "stage",
      NEXT_PUBLIC_SUPABASE_URL: "https://stage.supabase.co",
      VERCEL_ENV: "production",
    },
  ])
    expect(() => assertStaging(env)).toThrow();
  expect(() =>
    assertStaging({
      AUDIT_PORTAL_ENABLED: "true",
      AUDIT_STAGING_PROJECT_REF: "stage",
      NEXT_PUBLIC_SUPABASE_URL: "https://stage.supabase.co",
    }),
  ).not.toThrow();
});
it("MIME/extensão, tamanho e quantidade têm validação", () => {
  const file = {
    id: crypto.randomUUID(),
    name: "a.pdf",
    size: 1,
    mime: "application/pdf",
    fingerprint: "a".repeat(64),
  };
  expect(validateFiles([file])).toHaveLength(1);
  for (const files of [
    [],
    [{ ...file, name: "a.exe" }],
    [{ ...file, size: 0 }],
    [{ ...file, size: 104857601 }],
    Array(101).fill(file),
    [{ ...file, name: "../a.pdf" }],
    [{ ...file, mime: "image/png" }],
  ])
    expect(() => validateFiles(files)).toThrow();
});
it("bloqueia requisições de outra origem", () => {
  expect(() =>
    validateOrigin(
      new Request("https://rbk.test/api", {
        headers: { origin: "https://evil.test" },
      }),
    ),
  ).toThrow();
  expect(() =>
    validateOrigin(
      new Request("https://rbk.test/api", {
        headers: { origin: "https://rbk.test" },
      }),
    ),
  ).not.toThrow();
});
it("JSON precisa ser objeto e o corpo é limitado antes de processar", async () => {
  const { body } = await import("../src/lib/auditoria/server");
  const make = (s: string) =>
    new Request("https://rbk.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: s,
    });
  await expect(body(make("null"))).rejects.toMatchObject({ status: 400 });
  await expect(body(make("[]"))).rejects.toMatchObject({ status: 400 });
  await expect(
    body(make(JSON.stringify({ a: "a".repeat(65536) }))),
  ).rejects.toMatchObject({ status: 413 });
});

it("HTML/HTM é permitido exclusivamente para ofício", () => {
 for (const name of ["oficio.html", "oficio.HTM"]) {
 const f = { id: crypto.randomUUID(), name, size: 120, mime: "text/html", fingerprint: "b".repeat(64) };
 expect(() => validateFiles([f])).toThrow();
 expect(validateFiles([f], true)).toHaveLength(1);
 expect(() => validateFiles([{...f, mime: "application/pdf"}], true)).toThrow();
 }
});
