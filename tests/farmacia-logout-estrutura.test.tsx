// @vitest-environment happy-dom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RbkHeader } from "../src/components/RbkHeader";

vi.mock("../src/components/RbkBrand", () => ({ RbkBrand: () => null }));
Object.assign(globalThis, { React });

it.each(["gestor_rbk", "superadmin_rbk", "operador", "administrador_farmacia"] as const)(
  "mantém o cabeçalho compartilhado para %s",
  (perfil) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <RbkHeader email="conta@example.invalid" perfil={perfil}>
        <a href="/farmacia">Início</a>
      </RbkHeader>,
    );
    expect(host.querySelectorAll("header")).toHaveLength(1);
    expect(host.querySelectorAll('header button[aria-label="Sair"]')).toHaveLength(1);
    expect(host.querySelector("header")?.textContent).toContain("conta@example.invalid");
    expect(host.querySelector("header")?.textContent).toContain(
      perfil === "gestor_rbk" || perfil === "superadmin_rbk" ? "Gestor RBK" : "Farmácia",
    );
    expect(host.querySelector('a[href="/farmacia"]')).not.toBeNull();
  },
);
