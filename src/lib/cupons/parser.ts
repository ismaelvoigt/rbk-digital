export type PaginaCupom = {
  pagina: number;
  metodo: "texto_pdf" | "ocr";
  texto: string;
};
export type ItemExtraido = {
  produto: string;
  ean: string | null;
  unidade: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  valor_pfpb: number | null;
  principio_ativo: string | null;
  indicacao: string | null;
  data_dispensacao: string | null;
  fonte: string;
};
const decimal = (s: string) => Number(s.replaceAll(".", "").replace(",", "."));
const valor = "(?:\\d{1,3}(?:\\.\\d{3})*|\\d+),\\d{2,4}";
// Formatos conservadores: DESCRIÇÃO QTD UN X UNITÁRIO [TOTAL], mesma linha
// ou descrição numerada imediatamente antes. Layout desconhecido exige revisão.
const valores = new RegExp(
  `^(.*?)\\s*(\\d+(?:,\\d{1,3})?)\\s+(UN|UND|CX|CP|FR|AMP|ML|G|KG|PCT)\\s*(?:[xX*]\\s*)?(?:R\\$\\s*)?(${valor})(?:\\s+(?:R\\$\\s*)?(${valor}))?$`,
  "i",
);
export function extrairItens(paginas: PaginaCupom[]) {
  const itens: ItemExtraido[] = [];
  for (const p of paginas) {
    const linhas = p.texto
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\s+/g, " "));
    for (let n = 0; n < linhas.length; n++) {
      const match = linhas[n].match(valores);
      if (!match) continue;
      let descricao = match[1].trim(),
        fonteLinha = linhas[n];
      if (!descricao && n > 0 && /^\d{1,4}\s+/.test(linhas[n - 1])) {
        descricao = linhas[n - 1];
        fonteLinha = descricao + " | " + fonteLinha;
      }
      if (
        !descricao ||
        /^(TOTAL|SUBTOTAL|DESCONTO|TROCO|TRIBUTO|PAGAMENTO|CNPJ|CPF)\b/i.test(
          descricao,
        )
      )
        continue;
      descricao = descricao.replace(/^\d{1,4}\s+/, "");
      const codigo = descricao.match(/^(\d+)\s+/)?.[1] || null;
      const ean = codigo && /^(\d{8}|\d{12,14})$/.test(codigo) ? codigo : null;
      if (codigo) descricao = descricao.slice(codigo.length).trim();
      if (!/[a-zÀ-ÿ]/i.test(descricao)) continue;
      itens.push({
        produto: descricao.slice(0, 300),
        ean,
        unidade: match[3].toUpperCase(),
        quantidade: decimal(match[2]),
        valor_unitario: decimal(match[4]),
        valor_total: match[5] ? decimal(match[5]) : null,
        valor_pfpb: null,
        principio_ativo: null,
        indicacao: null,
        data_dispensacao: null,
        fonte:
          `${p.metodo} • página ${p.pagina} • linha ${n + 1}: ${fonteLinha}`.slice(
            0,
            1000,
          ),
      });
      if (itens.length > 500)
        throw new Error("Cupom com mais de 500 itens. Divida o documento.");
    }
  }
  return {
    itens,
    aviso:
      "Confira o documento inteiro: linhas não reconhecidas podem faltar. Quantidades, preços, descontos e valores do PFPB exigem conferência. A leitura não confirma dispensações automaticamente.",
  };
}
export function validarRevisao(input: unknown): ItemExtraido[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 500)
    throw new Error("Informe entre 1 e 500 itens conferidos.");
  return input.map((i) => {
    if (
      !i ||
      typeof i !== "object" ||
      typeof i.produto !== "string" ||
      !i.produto.trim() ||
      i.produto.length > 300 ||
      typeof i.fonte !== "string" ||
      !i.fonte.trim() ||
      i.fonte.length > 1000
    )
      throw new Error(
        "Informe o produto e a referência no cupom para cada item.",
      );
    const result: Record<string, unknown> = {
      produto: i.produto.trim(),
      fonte: i.fonte.trim(),
    };
    for (const key of [
      "quantidade",
      "valor_unitario",
      "valor_total",
      "valor_pfpb",
    ] as const) {
      const v = i[key];
      const escala =
        key === "quantidade" ? 1000 : key === "valor_unitario" ? 10000 : 100;
      if (
        v !== null &&
        (typeof v !== "number" ||
          !Number.isFinite(v) ||
          v < 0 ||
          v > 1e9 ||
          Math.abs(v * escala - Math.round(v * escala)) > 0.00001)
      )
        throw new Error(
          "Confira quantidades e valores. Use valores positivos ou deixe em branco.",
        );
      result[key] = v;
    }
    for (const key of [
      "ean",
      "unidade",
      "principio_ativo",
      "indicacao",
      "data_dispensacao",
    ] as const) {
      const v = i[key];
      if (v !== null && (typeof v !== "string" || !v.trim() || v.length > 300))
        throw new Error("Campo textual inválido.");
      result[key] = v;
    }
    if (i.ean && !/^(\d{8}|\d{12,14})$/.test(i.ean))
      throw new Error("EAN inválido.");
    if (
      i.data_dispensacao &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(i.data_dispensacao) ||
        !Number.isFinite(Date.parse(i.data_dispensacao)) ||
        new Date(i.data_dispensacao).toISOString().slice(0, 10) !==
          i.data_dispensacao)
    )
      throw new Error("Data do cupom inválida.");
    return result as ItemExtraido;
  });
}
