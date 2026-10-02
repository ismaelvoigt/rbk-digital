import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("mensagem visual de recuperação de senha", () => {
  it("deve usar fundo claro e texto vermelho para ficar visível no card branco", () => {
    const loginSource = readFileSync(
      resolve(process.cwd(), "src/components/auth/SenhaCampos.tsx"),
      "utf-8",
    );

    expect(loginSource).toContain(
      'role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"',
    );
  });
});
