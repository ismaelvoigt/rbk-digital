import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarArquivoPdf } from "./carregarPdf";
import { gerarAutorizacaoPdf, type PdfAssets, type DocumentoPdf } from "./pdf";
import { renderizarAnexo } from "./renderizarAnexo";
import {
  revalidarSelecao,
  validarGestaoPesquisa,
  type EscopoPesquisa,
  type LinhaAutorizacao,
} from "./pesquisa";
export class DividirParteError extends Error {
  constructor() {
    super("Esta parte precisa ser dividida em partes menores.");
  }
}
export function planejarPartes(rows: LinhaAutorizacao[]) {
  const parts: LinhaAutorizacao[][] = [];
  for (let i = 0; i < rows.length; i += 20) parts.push(rows.slice(i, i + 20));
  return parts;
}
const data = (value: string | null) =>
  value ? value.split("-").reverse().join("/") : "Não informada";
const numero = (value: string) => value.replace(/(\d{3})(?=\d)/g, "$1.");
const cpf = (value: string | null) =>
  value
    ? value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
    : "Não informado";
function texto(font: PDFFont, value: string) {
  return Array.from(value.replace(/[\x00-\x1f]/g, " "))
    .map((c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    })
    .join("");
}
export async function gerarListagemPesquisa(
  rows: LinhaAutorizacao[],
  title: string,
  semDocumentos = new Set<string>(),
  parciais = new Set<string>(),
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("RBK Digital");
  pdf.setLanguage("pt-BR");
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const stamp = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  let page = pdf.addPage([595, 842]),
    y = 0;
  const draw = (
    value: string,
    x: number,
    at: number,
    size = 9,
    strong = false,
  ) =>
    page.drawText(texto(strong ? bold : regular, value), {
      x,
      y: at,
      size,
      font: strong ? bold : regular,
      color: rgb(0.12, 0.16, 0.21),
    });
  function header() {
    draw("RBK Digital · Autorizações", 40, 800, 15, true);
    draw(title.slice(0, 95), 40, 777, 10);
    draw(
      `Gerado em ${stamp} (Brasília) · Total: ${rows.length} autorizações`,
      40,
      758,
    );
    draw("Autorização", 40, 726, 9, true);
    draw("CPF", 205, 726, 9, true);
    draw("Data", 325, 726, 9, true);
    draw("Farmácia", 400, 726, 9, true);
    y = 704;
  }
  header();
  for (const row of rows) {
    if (y < 65) {
      page = pdf.addPage([595, 842]);
      header();
    }
    draw(numero(row.numero_autorizacao), 40, y);
    draw(cpf(row.cpf_cliente), 205, y);
    draw(data(row.data_autorizacao), 325, y);
    draw((row.farmacia || "Não informada").slice(0, 28), 400, y, 8);
    if (semDocumentos.has(row.id))
      draw("Sem documentos anexados", 40, y - 12, 8);
    else if (parciais.has(row.id))
      draw("Há registros de documentos sem arquivo anexado", 40, y - 12, 8);
    y -= 28;
  }
  for (const [index, p] of pdf.getPages().entries())
    p.drawText(`Página ${index + 1} de ${pdf.getPageCount()}`, {
      x: 440,
      y: 28,
      size: 8,
      font: regular,
    });
  return pdf.save();
}
async function layout(): Promise<PdfAssets> {
  const files = await Promise.all(
    [
      "/rbk-digital-logo-original.png",
      "/fonts/Lato-Regular.ttf",
      "/fonts/Lato-Bold.ttf",
    ].map(async (path) => {
      const r = await fetch(path);
      if (!r.ok || r.redirected)
        throw new Error(
          "Não foi possível carregar o layout do PDF. Tente novamente.",
        );
      return new Uint8Array(await r.arrayBuffer());
    }),
  );
  return { logo: files[0], regular: files[1], bold: files[2] };
}
export async function gerarPartePesquisa(
  client: SupabaseClient,
  scope: EscopoPesquisa,
  rows: LinhaAutorizacao[],
  title: string,
  progresso?: (s: string) => void,
  assets?: PdfAssets,
) {
  if (rows.length > 20) throw new DividirParteError();
  if (!rows.length) throw new Error("Nenhuma autorização selecionada.");
  await validarGestaoPesquisa(client, scope);
  const atuais = await revalidarSelecao(
    client,
    scope,
    rows.map((r) => r.id),
  );
  const campos = [
    "numero_autorizacao",
    "cpf_cliente",
    "data_autorizacao",
    "farmacia",
    "observacao",
  ] as const;
  const anteriores = new Map(rows.map((r) => [r.id, r]));
  const conferir = (
    atual: (typeof atuais)[number],
    anterior: (typeof atuais)[number],
  ) => {
    if (
      atual.farm_id !== anterior.farm_id ||
      campos.some((k) => (atual[k] ?? null) !== (anterior[k] ?? null))
    )
      throw new Error(
        "Os dados das autorizações mudaram. Gere o relatório novamente para manter a listagem e os documentos consistentes.",
      );
  };
  for (const atual of atuais) conferir(atual, anteriores.get(atual.id)!);
  const documentosPdf = await PDFDocument.create(),
    semDocumentos = new Set<string>(),
    parciais = new Set<string>();
  let totalBytes = 0;
  for (const [index, row] of atuais.entries()) {
    await validarGestaoPesquisa(client, scope);
    progresso?.(`Preparando autorização ${index + 1} de ${atuais.length}…`);
    // Consulta operacional por farm_id: disponível também no plano Armazenamento.
    const a = await client
      .from("autorizacoes")
      .select(
        "id,farm_id,numero_autorizacao,data_autorizacao,cpf_cliente,farmacia,observacao",
      )
      .eq("id", row.id)
      .eq("farm_id", row.farm_id)
      .single();
    if (a.error || !a.data)
      throw new Error(
        `A autorização ${numero(row.numero_autorizacao)} não está mais acessível.`,
      );
    conferir(
      {
        ...a.data,
        farmacia: a.data.farmacia || scope.farmacia || null,
      } as LinhaAutorizacao,
      row,
    );
    const docs: DocumentoPdf[] = [];
    for (let offset = 0; ; offset += 500) {
      const d = await client
        .from("documentos")
        .select("id,categoria,status,nome_arquivo,caminho_arquivo")
        .eq("autorizacao_id", row.id)
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (d.error || !Array.isArray(d.data))
        throw new Error("Não foi possível ler todos os documentos.");
      docs.push(...d.data);
      if (d.data.length < 500) break;
    }
    if (!docs.some((d) => d.caminho_arquivo)) {
      semDocumentos.add(row.id);
      continue;
    }
    if (docs.some((d) => !d.caminho_arquivo)) parciais.add(row.id);
    assets ??= await layout();
    const bytes = await gerarAutorizacaoPdf(a.data, docs, assets, {
      carregarArquivo: (d) => carregarArquivoPdf(client, d),
      renderizarArquivo: renderizarAnexo,
      onProgress: progresso,
    });
    totalBytes += bytes.byteLength;
    if (totalBytes > 100 * 1024 * 1024) throw new DividirParteError();
    const origem = await PDFDocument.load(bytes);
    if (documentosPdf.getPageCount() + origem.getPageCount() > 180)
      throw new DividirParteError();
    for (const p of await documentosPdf.copyPages(
      origem,
      origem.getPageIndices(),
    ))
      documentosPdf.addPage(p);
  }
  await validarGestaoPesquisa(client, scope);
  const pdf = await PDFDocument.load(
    await gerarListagemPesquisa(atuais, title, semDocumentos, parciais),
  );
  for (const p of await pdf.copyPages(
    documentosPdf,
    documentosPdf.getPageIndices(),
  ))
    pdf.addPage(p);
  return {
    bytes: await pdf.save(),
    semDocumentos: [...semDocumentos],
    parciais: [...parciais],
  };
}
