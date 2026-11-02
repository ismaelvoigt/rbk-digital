// Explicitly development-only. No service key, password persistence or production fallback.
import { loadEnvFile } from "node:process";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
loadEnvFile(".env.local");
const REF = "ympeqcycjadvvumanmwm",
  FARM = "fd54d028-ebf4-447a-8c06-357760e76f09";
const MARKER = "RBK-DEMO-PESQUISA-20261102";
if (
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
  `${REF}.supabase.co`
)
  throw Error("Este script só aceita o projeto de desenvolvimento.");
if (!process.env.RBK_DEMO_PASSWORD)
  throw Error("Informe a senha de teste por RBK_DEMO_PASSWORD.");
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const uuid = (value) => {
  const h = createHash("sha256")
    .update(MARKER + ":" + value)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
let logged = false;
try {
  const login = await client.auth.signInWithPassword({
    email: process.env.RBK_DEMO_EMAIL || "rbkdigital@rbkdigital.com.br",
    password: process.env.RBK_DEMO_PASSWORD,
  });
  if (login.error || !login.data.user)
    throw Error(
      "Não foi possível entrar na conta fictícia do desenvolvimento.",
    );
  logged = true;
  const actor = login.data.user.id,
    profile = await client
      .from("users")
      .select("id,farm_id,status")
      .eq("id", actor)
      .single();
  if (
    profile.error ||
    profile.data.farm_id !== FARM ||
    profile.data.status !== "active"
  )
    throw Error("Conta de teste fora da farmácia fictícia esperada.");
  let created = 0,
    documents = 0;
  for (let i = 1; i <= 45; i++) {
    const id = uuid("aut:" + i),
      number = (970000000000000n + BigInt(i)).toString(),
      date = i <= 25 ? "2026-11-02" : i <= 35 ? "2026-11-01" : "2026-10-31",
      cpf = i <= 25 ? "00000000000" : i <= 35 ? "11111111111" : "22222222222";
    const existing = await client
      .from("autorizacoes")
      .select("id,farm_id,user_id,observacao,numero_autorizacao")
      .eq("id", id)
      .maybeSingle();
    if (existing.error) throw Error("Falha ao conferir autorização fictícia.");
    if (existing.data) {
      if (
        existing.data.farm_id !== FARM ||
        existing.data.user_id !== actor ||
        !existing.data.observacao?.startsWith(MARKER) ||
        existing.data.numero_autorizacao !== number
      )
        throw Error("Colisão com registro fora do conjunto fictício.");
    } else {
      const r = await client
        .from("autorizacoes")
        .insert({
          id,
          user_id: actor,
          farm_id: FARM,
          numero_autorizacao: number,
          data_autorizacao: date,
          cpf_cliente: cpf,
          farmacia: "Farmácia Fictícia - Balcão",
          observacao: `${MARKER} | AUTORIZACAO FICTICIA - SEM VALIDADE | Cenario ${i}`,
        });
      if (r.error)
        throw Error(
          `Falha ao criar autorização fictícia ${i}: ${r.error.code}`,
        );
      created++;
    }
    // Three authorizations intentionally have no attachment, to verify report notices.
    if (i % 13 === 0) continue;
    const docId = uuid("doc:" + i),
      path = `${actor}/${id}/teste-ficticio-${i}.pdf`;
    const metadata = await client
      .from("documentos")
      .select("id,autorizacao_id,caminho_arquivo")
      .eq("id", docId)
      .maybeSingle();
    if (metadata.error) throw Error("Falha ao conferir documento fictício.");
    if (
      metadata.data &&
      (metadata.data.autorizacao_id !== id ||
        metadata.data.caminho_arquivo !== path)
    )
      throw Error("Colisão com documento fora do conjunto fictício.");
    let info = await client.storage.from("documentos").info(path);
    if (info.error || !info.data) {
      const pdf = await PDFDocument.create(),
        font = await pdf.embedFont(StandardFonts.Helvetica);
      for (let p = 1; p <= (i === 1 ? 2 : 1); p++) {
        const page = pdf.addPage([595, 842]);
        for (const [text, y, size] of [
          ["DOCUMENTO FICTICIO", 730, 28],
          ["SEM VALIDADE - USO EXCLUSIVO NO DESENVOLVIMENTO", 690, 14],
          [`Autorizacao: ${number}`, 610, 16],
          [`CPF ficticio: ${cpf}`, 575, 14],
          [`Data: ${date}`, 540, 14],
          [`Pagina ${p} - Cenario ${i}`, 500, 14],
          [
            "Este arquivo nao representa pessoa, compra ou dispensacao real.",
            420,
            12,
          ],
        ])
          page.drawText(text, {
            x: 40,
            y,
            size,
            font,
            color: rgb(0.65, 0.05, 0.1),
          });
      }
      const bytes = await pdf.save();
      const upload = await client.storage
        .from("documentos")
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw Error(`Falha no armazenamento fictício ${i}.`);
      info = await client.storage.from("documentos").info(path);
      if (info.error || info.data?.size !== bytes.byteLength)
        throw Error(
          "O armazenamento não confirmou o tamanho do arquivo fictício.",
        );
    }
    if (!metadata.data) {
      const r = await client
        .from("documentos")
        .insert({
          id: docId,
          autorizacao_id: id,
          categoria: "outros",
          nome_arquivo: `DOCUMENTO-FICTICIO-${i}.pdf`,
          caminho_arquivo: path,
          status: "recebido",
        });
      if (r.error)
        throw Error(
          `Falha ao registrar o documento fictício ${i}: ${r.error.code}`,
        );
      documents++;
    }
  }
  console.log(
    JSON.stringify({
      environment: "development",
      createdAuthorizations: created,
      createdDocuments: documents,
      totalScenario: 45,
      dates: { "2026-11-02": 25, "2026-11-01": 10, "2026-10-31": 10 },
      withoutAttachments: 3,
    }),
  );
} finally {
  if (logged) await client.auth.signOut({ scope: "local" });
}
