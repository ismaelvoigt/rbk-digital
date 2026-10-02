import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {getNavegacaoPorRole} from "../src/lib/auth/navegacaoPerfil";

const page = "src/app/autorizacoes/[id]/documentos/page.tsx";
const success = "src/app/autorizacoes/[id]/documentos/sucesso/page.tsx";
const card = "src/components/documentos/DocumentUploadCard.tsx";

describe("fluxo documental do usuário", () => {
  it("remove o Checklist redundante e mantém somente o envio necessário", () => {
    const conteudo = fs.readFileSync(page, "utf-8");

    expect(conteudo).not.toContain("Checklist documental");
    expect(conteudo).toContain("Documentos arquivados");
  });

  it("nenhuma navegação da tela de documentos do usuário aponta para o dashboard do gestor", () => {
    for (const perfil of ['farmacia','administrador_farmacia','gerente_farmacia','operador']) {
      expect(getNavegacaoPorRole(perfil,false).href).toBe('/farmacia');
    }
  });

  it("mantém a explicação de Outros Documentos e não força descrição nos demais", () => {
    const conteudo = fs.readFileSync(card, "utf-8");

    expect(conteudo).toContain("optional");
    expect(conteudo).toContain(
      "Procurações, documentos do procurador ou outros relacionados à autorização."
    );
  });
});
