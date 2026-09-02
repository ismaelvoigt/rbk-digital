import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("mensagem visual de recuperação de senha", () => {
  it("deve usar fundo claro e texto vermelho para ficar visível no card branco", () => {
    const loginSource = readFileSync(
      resolve(process.cwd(), "src/app/page.tsx"),
      "utf-8",
    );

    expect(loginSource).toContain(
      'className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm leading-5 text-red-700"',
    );
  });
});
