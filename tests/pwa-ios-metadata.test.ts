import { describe, expect, it } from "vitest";
import { metadata } from "../src/app/layout";

describe("PWA — metadados para experiência móvel", () => {
  it("deve identificar o ícone do RBK Digital", () => {
    expect(metadata.icons).toBeDefined();
  });

  it("deve configurar a experiência como aplicativo web", () => {
    expect(metadata.appleWebApp).toBeDefined();
  });
});
