import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { analyze, detectKind } from "../src/lib/processos/domain";
it.runIf(process.env.PFPB_REAL_LOCAL_TEST === "true")(
  "amostra real local — relatório sem publicação",
  () => {
    const ocr = JSON.parse(readFileSync("../marlym-ocr.json", "utf8"));
    const qr = JSON.parse(readFileSync("../marlym-qr.json", "utf8"));
    const groups: [string, number, number][] = [
      ["crt", 1, 1],
      ["cnpj", 2, 2],
      ["alvara_municipal", 3, 3],
      ["afe", 4, 5],
      ["contrato_social", 6, 11],
      ["endereco", 12, 12],
      ["representante", 13, 13],
      ["licenca_sanitaria", 14, 14],
      ["banco", 15, 15],
    ];
    const docs = groups.map(([kind, start, end]) => ({
      id: `amostra-${start}`,
      kind,
      pages: ocr.pages.slice(start - 1, end),
      qr: qr.pages.slice(start - 1, end).some((p: { qr: boolean }) => p.qr),
      qrScanned: true,
    }));
    const result = analyze(
      docs,
      JSON.parse(readFileSync("../real-test-ficha.json", "utf8")),
      "2026-09-18",
    );
    writeFileSync(
      "../real-analysis-private.json",
      JSON.stringify(
        {
          result,
          classification: docs.map((d) => ({
            kind: d.kind,
            suggestion: detectKind(d.pages),
          })),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    expect(result.documents.find((d) => d.kind === "crt")?.elements.qr).toBe(
      "Detectado",
    );
    expect(result.documents.find((d) => d.kind === "cnd")?.issues).toContain(
      "Documento não enviado.",
    );
    expect(result.documents.find((d) => d.kind === "rt")?.issues).toContain(
      "Documento não enviado.",
    );
    expect(
      result.documents.every((d) => String(d.result) !== "Requer substituição"),
    ).toBe(true);
  },
);
