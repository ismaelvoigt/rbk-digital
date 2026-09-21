import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";


async function readNovaAutorizacao() {
  return fs.readFile(
    "src/app/nova-autorizacao/page.tsx",
    "utf-8"
  );
}

describe("integração do ambiente da farmácia", () => {
  it("nova autorização deve retornar para o painel da farmácia", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('href="/farmacia"');
    expect(conteudo).not.toContain("Voltar");
  });

  it("nova autorização deve ter o acesso Início no cabeçalho", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('href="/farmacia"');
    expect(conteudo).toContain("Início");
    expect(conteudo).not.toContain("← Autorizações");
  });

  it("consulta de autorizações deve retornar para o painel da farmácia", async () => {
    const conteudo = await fs.readFile(
      "src/app/autorizacoes/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('href="/farmacia"');
    expect(conteudo).toContain("Início");
  });

  it("nova autorização deve armazenar o número somente com dígitos", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain(
      'numero_autorizacao: numero.replace(/\\D/g, "")'
    );
  });

  it("nova autorização deve informar a data da autorização", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain("const dataAutorizacao");
    expect(conteudo).toContain("data_autorizacao: dataAutorizacao");
  });

  it("nova autorização deve manter o vínculo com o usuário autenticado", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain("user_id: user.id");
  });

  it("nova autorização deve enviar a data da autorização", async () => {
    const conteudo = await fs.readFile(
      "src/app/nova-autorizacao/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain("data_autorizacao");
  });

  it("consulta deve filtrar as autorizações pelo usuário autenticado", async () => {
    const conteudo = await fs.readFile(
      "src/app/autorizacoes/page.tsx",
      "utf-8"
    );

    expect(conteudo).toContain('.eq("farm_id", perfilUsuario.farm_id)');
  });
});

it("nova autorização deve apresentar confirmação após salvar", async () => {
  const conteudo = await readNovaAutorizacao();

  expect(conteudo).toContain("Autorização cadastrada com sucesso");
  expect(conteudo).toContain("Ver autorizações");
  expect(conteudo).toContain("Cadastrar nova autorização");
});

it("nova autorização deve tratar número duplicado com mensagem amigável", async () => {
  const conteudo = await readNovaAutorizacao();

  expect(conteudo).toContain("Esta autorização já está cadastrada");
});

it("nova autorização deve exibir resumo após salvar", async () => {
  const conteudo = await readNovaAutorizacao();

  expect(conteudo).toContain("Número da autorização");
  expect(conteudo).toContain("CPF do cliente");
  expect(conteudo).toContain("Data da autorização");
});


it("nova autorização deve apresentar confirmação profissional após salvar", () => {
  const conteudo = fsSync.readFileSync(
    "src/app/nova-autorizacao/page.tsx",
    "utf-8"
  );

  expect(conteudo).toContain("Autorização cadastrada com sucesso");
  expect(conteudo).toContain("Ver autorizações");
  expect(conteudo).toContain("Cadastrar nova autorização");
  expect(conteudo).toContain("Início");
  expect(conteudo).toContain("Número da autorização");
  expect(conteudo).toContain("CPF do cliente");
  expect(conteudo).toContain("Data da autorização");
  expect(conteudo).toContain("Documentação salva com sucesso");
});

it("nova autorização não deve redirecionar automaticamente após salvar", () => {
  const conteudo = fsSync.readFileSync(
    "src/app/nova-autorizacao/page.tsx",
    "utf-8"
  );

  expect(conteudo).not.toContain(
    'router.push(`/autorizacoes/${autorizacao.id}/documentos`)'
  );

  expect(conteudo).not.toContain(
    'router.push("/farmacia")'
  );
});

it("nova autorização deve tratar número duplicado com mensagem amigável", () => {
  const conteudo = fsSync.readFileSync(
    "src/app/nova-autorizacao/page.tsx",
    "utf-8"
  );

  expect(conteudo).toContain("Esta autorização já está cadastrada");
});

it("nova autorização deve armazenar a data da autorização", () => {
  const conteudo = fsSync.readFileSync(
    "src/app/nova-autorizacao/page.tsx",
    "utf-8"
  );

  expect(conteudo).toContain("const dataAutorizacao");
  expect(conteudo).toContain("data_autorizacao: dataAutorizacao");
});



it("nova autorização não deve redirecionar para o painel automaticamente após salvar", async () => {
  const conteudo = await readNovaAutorizacao();

  expect(conteudo).not.toContain('router.push("/farmacia")');
  expect(conteudo).not.toContain("router.push(`/farmacia`)");
});
