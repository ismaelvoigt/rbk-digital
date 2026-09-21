import fields from "./fields.json";
export { fields };
export const NOTICE =
  "A detecção desses elementos não representa validação de autenticidade do documento.";
export const TYPES = [
  ["cnpj", "CNPJ e CNAE"],
  ["contrato_social", "Contrato social / Junta Comercial"],
  ["endereco", "Comprovante de endereço"],
  ["licenca_sanitaria", "Licença Sanitária"],
  ["afe", "AFE Anvisa"],
  ["cnd", "Regularidade fiscal — Fazenda Nacional"],
  ["crt", "CRT / CRF"],
  ["representante", "Identidade / CPF e representação legal"],
  ["rt", "Identidade / CPF do responsável técnico"],
  ["banco", "Comprovante bancário da matriz"],
  ["rta", "RTA — Requerimento de Termo de Adesão"],
] as const;
export type Kind = (typeof TYPES)[number][0];
export type Page = { page: number; text: string };
export type Evidence = { field: string; value: string; page: number };
export type InputDoc = {
  id: string;
  kind: string;
  pages: Page[];
  qr: boolean;
  qrScanned: boolean;
};
export type Ficha = Record<string, string>;
export function canUseProcessos(
  perfil: string,
  status: string,
  legacyAdmin: boolean,
) {
  return status === "active" && (legacyAdmin || perfil === "gestor_rbk");
}
export function validateFicha(input: unknown): Ficha {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Ficha inválida.");
  const allowed = new Set(fields.map((f) => f.cell));
  const result: Ficha = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key) || typeof value !== "string" || value.length > 500)
      throw new Error("Campo não previsto ou valor inválido na ficha.");
    result[key] = value.trim();
  }
  return result;
}
const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const digits = (v: string) => v.replace(/\D/g, "");
export function extract(pages: Page[]) {
  const evidence: Evidence[] = [];
  const expiry: { date: string; page: number; value: string }[] = [];
  for (const p of pages) {
    const lines = p.text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(
        /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
      ))
        evidence.push({ field: "CNPJ", value: m[0], page: p.page });
      const labels: [string, RegExp][] = [
        [
          "Razão social",
          /^(?:NOME EMPRESARIAL|RAZ[ÃA]O SOCIAL)\s*[:\-]?\s*(.*)$/i,
        ],
        [
          "Endereço",
          /^(?:ENDERE[ÇC]O(?: COMPLETO)?|LOGRADOURO)\s*[:\-]?\s*(.*)$/i,
        ],
        [
          "Representante legal",
          /^(?:REPRESENTANTE LEGAL|S[ÓO]CIO ADMINISTRADOR|ADMINISTRADOR)\s*[:\-]?\s*(.*)$/i,
        ],
        [
          "Responsável técnico",
          /^(?:RESPONS[ÁA]VEL T[ÉE]CNICO|FARMAC[ÊE]UTICO RESPONS[ÁA]VEL)\s*[:\-]?\s*(.*)$/i,
        ],
        ["Nome", /^(?:NOME|NOME E SOBRENOME)\s*[:\-]?\s*(.*)$/i],
      ];
      for (const [field, rx] of labels) {
        const m = line.match(rx);
        if (m) {
          let v = m[1];
          if (!v || /^(CNPJ|COMPLEMENTO|CIDADE\/UF)$/i.test(v))
            v = lines[i + 1] ?? "";
          v = v
            .replace(/\s+\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}.*$/, "")
            .trim();
          if (v && v.length > 2 && v.length < 250)
            evidence.push({ field, value: v, page: p.page });
        }
      }
      if (/VALIDADE|V[ÁA]LID[AO] AT[ÉE]|VENCIMENTO/i.test(line)) {
        const marker = line.match(/V[ÁA]LID[AO] AT[ÉE]|VALIDADE|VENCIMENTO/i)!;
        const nearby =
          line.slice(marker.index! + marker[0].length) +
          " " +
          (lines[i + 1] ?? "");
        for (const m of [
          ...nearby.matchAll(/\b(\d{2})[/.\-](\d{2})[/.\-](\d{4})\b/g),
        ].slice(0, 1)) {
          const date = `${m[3]}-${m[2]}-${m[1]}`;
          const dt = new Date(date + "T12:00:00Z");
          if (!isNaN(dt.valueOf()) && dt.toISOString().slice(0, 10) === date) {
            expiry.push({ date, page: p.page, value: m[0] });
            evidence.push({
              field: "Possível validade",
              value: m[0],
              page: p.page,
            });
          }
        }
      }
    }
  }
  return { evidence, expiry };
}
export function analyze(
  docs: InputDoc[],
  ficha: Ficha,
  today = new Date().toISOString().slice(0, 10),
) {
  const extracted = docs.map((d) => ({ ...d, ...extract(d.pages) }));
  const reference = extracted.find((d) => d.kind === "cnpj");
  const documentValue = (kind: string, field: string) =>
    extracted
      .find((d) => d.kind === kind)
      ?.evidence.find((e) => e.field === field)?.value;
  const documents = TYPES.map(([kind, label]) => {
    const d = extracted.find((x) => x.kind === kind);
    const issues: string[] = [];
    if (!d) issues.push("Documento não enviado.");
    const text = d?.pages.map((x) => x.text).join("\n") ?? "";
    if (d && text.trim().length < 80)
      issues.push("Extração insuficiente; leitura visual/OCR necessária.");
    const detectedType = d
      ? detectKind(d.pages)
      : { kind: "não enviado", confidence: "requer conferência" };
    if (d && detectedType.kind === "não identificado")
      issues.push("Tipo documental não reconhecido automaticamente.");
    if (
      d &&
      detectedType.kind !== "não identificado" &&
      detectedType.kind !== kind &&
      !(
        detectedType.kind === "identidade" &&
        ["rt", "representante"].includes(kind)
      )
    )
      issues.push(
        `Tipo sugerido pelo texto: ${detectedType.kind}; confira a categoria enviada.`,
      );
    const expectedCnpj = digits(
      kind === "banco" ? ficha.B19 || ficha.B20 || "" : ficha.B20 || "",
    );
    const cnpjs = [
      ...new Set(
        d?.evidence
          .filter((e) => e.field === "CNPJ")
          .map((e) => digits(e.value)) ?? [],
      ),
    ];
    if (d && expectedCnpj && cnpjs.length && !cnpjs.includes(expectedCnpj))
      issues.push(
        "CNPJ extraído diverge da ficha; pode pertencer ao emissor. Conferir evidências.",
      );
    if (d && !["representante", "rt"].includes(kind) && !cnpjs.length)
      issues.push("CNPJ não extraído com segurança.");
    const compare = (field: string, expected: string | undefined) => {
      const values = d?.evidence.filter((e) => e.field === field) ?? [];
      if (expected && !values.length && d)
        issues.push(`${field} não extraído; comparação requer conferência.`);
      if (
        expected &&
        values.length &&
        !values.some((e) => normalize(e.value) === normalize(expected))
      )
        issues.push(
          `${field} extraído difere da referência; abreviações/OCR podem explicar a diferença.`,
        );
    };
    compare("Razão social", ficha.B21);
    if (["contrato_social", "afe", "licenca_sanitaria", "crt"].includes(kind)) {
      const ref = reference?.evidence.find((e) => e.field === "Endereço");
      compare("Endereço", ref?.value);
      if (!ref || !d?.evidence.some((e) => e.field === "Endereço"))
        issues.push("Comparação de endereço incompleta; conferir visualmente.");
    }
    if (kind === "crt")
      compare("Responsável técnico", documentValue("rt", "Nome") || ficha.B40);
    if (kind === "contrato_social")
      compare(
        "Representante legal",
        documentValue("representante", "Nome") || ficha.B52,
      );
    if (kind === "rt")
      compare("Nome", documentValue("crt", "Responsável técnico") || ficha.B40);
    if (kind === "representante")
      compare(
        "Nome",
        documentValue("contrato_social", "Representante legal") || ficha.B52,
      );
    const dates = [...new Set(d?.expiry.map((e) => e.date) ?? [])];
    if (["licenca_sanitaria", "crt", "cnd"].includes(kind)) {
      if (dates.length === 1 && dates[0] < today)
        issues.push(
          `Data de possível vencimento ${dates[0]} anterior à análise. Conferir contexto.`,
        );
      if (dates.length !== 1)
        issues.push("Validade não identificada de forma inequívoca.");
    }
    if (kind === "cnpj" && !/47[.\s]?71\s*[-.]?\s*7\s*[-/]?\s*0[12]/.test(text))
      issues.push("CNAE do checklist não identificado; conferir documento.");
    if (kind === "endereco")
      issues.push(
        "Conferir titularidade, água/luz e competência do mês corrente ou anterior.",
      );
    if (kind === "contrato_social")
      issues.push(
        "Conferir integralidade, atualização e representação na Junta Comercial.",
      );
    if (kind === "banco")
      issues.push(
        "Conferir titularidade da matriz e todos os dados bancários do checklist.",
      );
    if (["rt", "representante"].includes(kind))
      issues.push(
        "Conferir identidade, CPF e vínculo; coincidência de nome não comprova representação.",
      );
    const detected = (yes: boolean) => (yes ? "Detectado" : "Não detectado");
    const elements = {
      qr: detected(Boolean(d?.qr)),
      code: detected(
        [
          ...text.matchAll(
            /(?:C[ÓO]DIGO (?:DE )?(?:VERIFICA[ÇC][ÃA]O|VERIFICADOR|AUTENTICIDADE|CONTROLE|AUTENTICA[ÇC][ÃA]O)|CHAVE DE AUTENTICIDADE)\s*[:\-]?\s*([A-Z0-9][A-Z0-9.\-]{3,})/gi,
          ),
        ].some((m) => /\d/.test(m[1])),
      ),
      notary: detected(
        /(?:AUTENTIC[OA] (?:A|ESTA|QUE)|SELO (?:DIGITAL|DE FISCALIZA[ÇC][ÃA]O)|AUTENTICA[ÇC][ÃA]O CARTORIAL)/i.test(
          text,
        ),
      ),
      signature: detected(
        /ASSINAD[OA] (?:DIGITALMENTE|ELETRONICAMENTE)|ASSINATURA (?:DIGITAL|ELETR[ÔO]NICA)/i.test(
          text,
        ),
      ),
    };
    if (d && !d.qrScanned)
      issues.push(
        "Detecção visual de QR não executada; “Não detectado” não significa ausência.",
      );
    if (d && Object.values(elements).every((v) => v === "Não detectado"))
      issues.push(
        "Elementos de verificação não detectados; conferir exigência do checklist fornecido.",
      );
    return {
      kind,
      label,
      detectedType,
      version_id: d?.id ?? null,
      result: (issues.length
        ? "Requer conferência"
        : "Sem ocorrência identificada") as
        | "Requer conferência"
        | "Sem ocorrência identificada",
      issues,
      evidence: (d?.evidence ?? []).filter(e=>e.field!=="Possível validade" || ["licenca_sanitaria","crt","cnd"].includes(kind)),
      elements,
      qrScanned: d?.qrScanned ?? false,
    };
  });
  return {
    engine: "rbk-local-rules-1",
    at: today,
    notice: NOTICE,
    result: documents.some((d) => d.issues.length)
      ? "Requer conferência"
      : "Sem ocorrência identificada",
    documents,
  };
}
export type Analysis = ReturnType<typeof analyze>;
export function summarize(
  versions: { id: string; kind: string }[],
  reviews: { version_id: string; decision: string }[],
) {
  const latest = new Map<string, { id: string; kind: string }>();
  for (const v of versions) if (!latest.has(v.kind)) latest.set(v.kind, v);
  const decisions = new Map<string, string>();
  for (const r of reviews)
    if (!decisions.has(r.version_id)) decisions.set(r.version_id, r.decision);
  return {
    sent: latest.size,
    approved: [...latest.values()].filter(
      (v) => decisions.get(v.id) === "Aprovado",
    ).length,
    pending:
      TYPES.length -
      [...latest.values()].filter((v) => decisions.get(v.id) === "Aprovado")
        .length,
  };
}
export function detectKind(pages: Page[]): {
  kind: string;
  confidence: string;
} {
  const text = pages
    .map((p) => p.text)
    .join("\n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const rules: [string, RegExp][] = [
    ["crt", /CONSELHO REGIONAL DE FARMACIA|CERTIDAO DE REGULARIDADE TECNICA/],
    ["cnpj", /CADASTRO NACIONAL DA PESSOA JURIDICA/],
    ["licenca_sanitaria", /ALVARA SANITARIO|LICENCA SANITARIA/],
    [
      "afe",
      /AGENCIA NACIONAL DE VIGILANCIA SANITARIA|AUTORIZACAO DE FUNCIONAMENTO/,
    ],
    ["contrato_social", /ALTERACAO CONTRATUAL|CONTRATO SOCIAL/],
    ["endereco", /ENERGIA ELETRICA|NOTA FISCAL.*ENERGIA|FATURA DE AGUA/],
    [
      "cnd",
      /CERTIDAO.*DEBITOS.*TRIBUTOS FEDERAIS|REGULARIDADE FISCAL.*FAZENDA/,
    ],
    ["banco", /COMPROVANTE.*CONTA|SISTEMA DE COOPERATIVAS DE CREDITO/],
    [
      "identidade",
      /CARTEIRA NACIONAL DE HABILITACAO|REGISTRO GERAL|REPUBLICA FEDERATIVA.*BRASIL/,
    ],
    ["alvara_municipal", /ALVARA.*FUNCIONAMENTO|PREFEITURA MUNICIPAL/],
  ];
  const matches = rules.filter(([, rx]) => rx.test(text));
  return {
    kind: matches[0]?.[0] ?? "não identificado",
    confidence:
      matches.length === 1 ? "heurística única" : "requer conferência",
  };
}
