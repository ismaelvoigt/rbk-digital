import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Exclusão lógica de farmácia", () => {
  it("deve disponibilizar a ação Excluir farmácia", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain("Excluir farmácia");
  });

  it("deve exigir confirmação antes da exclusão", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain("window.confirm");
    expect(source).toContain("if (!confirmado) return");
  });

  it("deve realizar exclusão lógica por PATCH", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('status: "inactive"');
  });

  it("deve enviar o token da sessão para o PATCH administrativo", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain("supabase.auth.getSession()");
    expect(source).toContain("session?.access_token");
    expect(source).toContain(
      "Authorization: `Bearer ${session.access_token}`"
    );
  });

  it("não deve executar DELETE físico", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).not.toContain('method: "DELETE"');
  });

  it("deve bloquear clique duplicado durante a operação", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain("excluindoId");
    expect(source).toContain('"Excluindo..."');
    expect(source).toContain("disabled={excluindoId === usuario.id}");
  });
});


describe("API — inativação lógica da farmácia", () => {
  it("PATCH deve aceitar alteração exclusiva de status", async () => {
    const source = await readFile(
      "src/app/api/usuarios/route.ts",
      "utf8"
    );

    expect(source).toContain("alteracaoSomenteStatus");
    expect(source).toContain('["id", "status"]');
    expect(source).toContain("exclusao_logica");
  });

  it("alteração exclusiva de status não deve exigir razão social", async () => {
    const source = await readFile(
      "src/app/api/usuarios/route.ts",
      "utf8"
    );

    const inicioStatus = source.indexOf(
      "if (alteracaoSomenteStatus)"
    );

    const validacaoRazao = source.indexOf(
      'if (!razaoSocial)'
    );

    expect(inicioStatus).toBeGreaterThan(-1);
    expect(validacaoRazao).toBeGreaterThan(inicioStatus);
  });

  it("proxy deve bloquear qualquer usuário que não esteja active", async () => {
    const source = await readFile(
      "src/lib/supabase/proxy.ts",
      "utf8"
    );

    expect(source).toContain(
      'usuario.status !== "active"'
    );

    expect(source).not.toContain(
      'usuario.status === "inativo"'
    );
  });
});
