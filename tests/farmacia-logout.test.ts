import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const page = path.resolve(process.cwd(), "src/app/farmacia/page.tsx");

describe("logout do ambiente da farmácia", () => {
  it("deve oferecer o botão Sair e usar o Supabase Auth", () => {
    const source = fs.readFileSync(page, "utf8");

    expect(source).toContain("supabase.auth.signOut()");
    expect(source).toMatch(/>Sair<|aria-label=["']Sair["']/);
  });

  it("deve voltar para o login depois do logout", () => {
    const source = fs.readFileSync(page, "utf8");

    expect(source).toMatch(
      /signOut\(\)[\s\S]{0,1000}(router\.push|window\.location)[\s\S]{0,300}["']\/["']/
    );
  });
});
