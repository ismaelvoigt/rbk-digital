import { describe, expect, it } from "vitest";
import manifest from "../src/app/manifest";

describe("PWA — manifest do RBK Digital", () => {
  it("deve definir o RBK Digital como aplicativo instalável", () => {
    const resultado = manifest();

    expect(resultado.name).toBe("RBK Digital");
    expect(resultado.short_name).toBe("RBK Digital");
    expect(resultado.start_url).toBe("/");
    expect(resultado.display).toBe("standalone");
  });
});
