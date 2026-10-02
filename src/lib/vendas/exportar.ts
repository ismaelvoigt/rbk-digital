import JSZip from "jszip";
import { analisar, confirmados, type Intervalo } from "./domain";
import type { DadosVendas } from "./consulta";
type Celula = string | number | null;
type Aba = { nome: string; linhas: Celula[][] };
const xml = (s: string) =>
  s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function csv(rows: Celula[][]) {
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map((v) => {
            if (v === null) return '""';
            let text = typeof v === "number" ? String(v).replace(".", ",") : v;
            if (
              typeof v === "string" &&
              (/^[\s\x00-\x1f]*[=+@-]/.test(v) ||
                /^\d+$/.test(v) ||
                /^[\t\r\n]/.test(v))
            )
              text = "'" + v;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
function coluna(n: number) {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export async function xlsx(abas: Aba[]) {
  const zip = new JSZip();
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  for (const [index, a] of abas.entries())
    zip.file(
      `xl/worksheets/sheet${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${a.linhas.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => (c === null ? "" : typeof c === "number" ? `<c r="${coluna(j)}${i + 1}"><v>${c}</v></c>` : `<c r="${coluna(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(c)}</t></is></c>`)).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${coluna((a.linhas[0]?.length || 1) - 1)}${a.linhas.length}"/></worksheet>`,
    );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export function planilhas(dados: DadosVendas, p: Intervalo): Aba[] {
  const auth = new Map(dados.autorizacoes.map((a) => [a.id, a]));
  const resumo = analisar(dados.autorizacoes, dados.itens);
  const itens: Celula[][] = [
    [
      "Produto",
      "EAN / GTIN",
      "Unidade",
      "Quantidade",
      "Valor unitário (BRL)",
      "Valor total (BRL)",
      "Previsto PFPB (BRL)",
      "Autorização",
      "Data da autorização",
      "Data da dispensação (cupom)",
      "Farmácia",
      "Princípio ativo",
      "Indicação",
      "Documento de origem (ID)",
      "Origens por campo",
      "Posição",
      "ID do item",
    ],
  ];
  for (const i of confirmados(dados.itens)) {
    const a = auth.get(i.autorizacao_id);
    if (!a) continue;
    itens.push([
      i.produto,
      i.ean,
      i.unidade,
      i.quantidade,
      i.valor_unitario,
      i.valor_total,
      i.valor_pfpb,
      a.numero_autorizacao,
      a.data_autorizacao,
      i.data_dispensacao,
      a.farmacia,
      i.principio_ativo,
      i.indicacao,
      i.documento_id,
      JSON.stringify(i.origens),
      i.posicao,
      i.id,
    ]);
  }
  const metadata: Celula[][] = [
    ["Indicador / critério", "Valor"],
    ["Início", p.inicio],
    ["Fim", p.fim],
    ["Data de referência", "Data da autorização; America/Sao_Paulo"],
    ["Autorizações", resumo.autorizacoes],
    ["Itens confirmados (linhas)", resumo.itens],
    ["Itens aguardando confirmação", resumo.pendentes],
    ["Quantidade informada", resumo.quantidade],
    ["Valor total informado (BRL)", resumo.total],
    ["Previsto PFPB informado (BRL)", resumo.pfpb],
    ["Ticket médio da base completa (BRL)", resumo.ticket],
    ["Autorizações na base do ticket", resumo.ticketBase],
    ["Autorizações sem itens confirmados", resumo.semItens],
    ["Itens com quantidade", resumo.quantidadeInformada],
    ["Itens com valor total", resumo.totalInformado],
    ["Itens com previsto PFPB", resumo.pfpbInformado],
    [
      "Campos vazios",
      "Não disponíveis; não representam zero. Valores e quantidades podem ser parciais.",
    ],
    ["PFPB", "Soma de valores explícitos nas fontes. Não comprova pagamento."],
    ["Extração", "Somente itens confirmados; pendentes/cancelados excluídos."],
    [
      "CSV",
      "Identificadores numéricos e textos iniciados por caracteres de fórmula recebem apóstrofo de proteção.",
    ],
  ];
  return [
    { nome: "Itens", linhas: itens },
    {
      nome: "Autorizações",
      linhas: [
        [
          "Autorização",
          "Data",
          "Farmácia",
          "CPF beneficiário",
          "Observação",
          "Cadastro em",
          "ID",
        ],
        ...dados.autorizacoes.map((a) => [
          a.numero_autorizacao,
          a.data_autorizacao,
          a.farmacia,
          a.cpf_cliente,
          a.observacao,
          a.created_at,
          a.id,
        ]),
      ],
    },
    { nome: "Resumo e critérios", linhas: metadata },
  ];
}
export async function baixarPlanilha(
  dados: DadosVendas,
  p: Intervalo,
  formato: "xlsx" | "csv",
) {
  const abas = planilhas(dados, p),
    nome = `RBK_Vendas_${p.inicio}_${p.fim}`;
  let blob: Blob, arquivo: string;
  if (formato === "xlsx") {
    blob = new Blob([new Uint8Array(await xlsx(abas))], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    arquivo = nome + ".xlsx";
  } else {
    const zip = new JSZip();
    for (const a of abas) zip.file(a.nome + ".csv", csv(a.linhas));
    blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    arquivo = nome + "_CSV.zip";
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
