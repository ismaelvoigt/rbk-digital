import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const brandPath = path.join(root, "src/components/RbkBrand.tsx");

describe("RbkBrand — logo original RBK Digital", () => {
  it("usa a logo original sem o fundo escuro reconstruído", () => {
    const source = fs.readFileSync(brandPath, "utf8");

    expect(source).toContain("/rbk-digital-logo-original.png");
    expect(source).not.toContain("/rbk-digital-logo.svg");
    expect(source).not.toContain("/rbk-digital-logo-light.svg");
    expect(source).toContain('className="object-contain object-center"');
  });
});
