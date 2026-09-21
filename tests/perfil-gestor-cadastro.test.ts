import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Perfil do gestor — cadastro de farmácias", () => {

  it("deve tratar farms retornado pela API como objeto", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).not.toContain("farms?.[0]");
    expect(source).toContain("usuario.farms");
  });

  it("deve permitir os campos cadastrais aprovados", async () => {
    const source = await readFile(
      "src/app/usuarios/novo/page.tsx",
      "utf8"
    );

    for (const campo of ["telefone", "cidade", "estado"]) {
      const inputs = [...source.matchAll(/<input\b[\s\S]*?\/>/g)];
      const input = inputs.find(([texto]) => texto.includes(`id="${campo}"`));
      expect(input, campo).toBeDefined();
      expect(input?.[0]).toContain(`value={${campo}}`);
      expect(source).toContain(`htmlFor="${campo}"`);
    }
  });

  it("deve possuir tela de edição", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/editar/page.tsx",
      "utf8"
    );

    expect(source).toContain("Editar cadastro");
    expect(source).toContain("CNPJ");
    expect(source).toContain("readOnly");
    expect(source).toContain("Ativo");
    expect(source).toContain("Inativo");
  });

  it("deve permitir busca por CNPJ e ver todas as farmácias", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain("CNPJ");
    expect(source).toContain("Ver todas as farmácias");
    expect(source).toContain("Editar cadastro");
    expect(source).toContain("Ver autorizações");
  });

  it("não deve carregar todas as farmácias automaticamente ao entrar na tela", async () => {
    const source = await readFile(
      "src/app/usuarios/page.tsx",
      "utf8"
    );

    expect(source).toContain(
      "const [mostrarTodas, setMostrarTodas] = useState(false);"
    );

    expect(source).not.toContain("    carregarUsuarios();");
  });

  it("deve tratar farms da tela de edição como objeto", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/editar/page.tsx",
      "utf8"
    );

    expect(source).not.toContain("farms?.[0]");
    expect(source).toContain("usuario.farms");
    expect(source).toContain("Array.isArray(usuario.farms)");
  });

  it("deve carregar a edição pela API administrativa usando o id do usuário", async () => {
    const source = await readFile(
      "src/app/usuarios/[id]/editar/page.tsx",
      "utf8"
    );

    expect(source).toContain('fetch(`/api/usuarios?id=${id}`');
    expect(source).not.toContain('.from("users")');
  });

});
