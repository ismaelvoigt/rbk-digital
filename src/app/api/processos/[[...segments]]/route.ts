import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import JSZip from "jszip";
import {
  authorize,
  HttpError,
  uuid,
  privateHeaders,
} from "../../../../lib/processos/server";
import {
  analyze,
  TYPES,
  validateFicha,
  type InputDoc,
} from "../../../../lib/processos/domain";
import { generateFicha } from "../../../../lib/processos/workbook";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ segments?: string[] }> };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
async function route(request: Request, ctx: Context) {
  try {
    const { client } = await authorize(request);
    const segments = (await ctx.params).segments ?? [];
    const [rawId, action, rawVersion] = segments;
    const command = async (op: string, pid: string | null, payload: object) => {
      const { data, error } = await client.rpc("pfpb_command", {
        op,
        pid,
        payload,
      });
      if (error)
        throw new HttpError(
          error.code === "42501" ? 403 : 409,
          error.code === "42501"
            ? "Acesso negado."
            : "Operação não concluída. Confira a versão, os campos e as aprovações.",
        );
      return data;
    };
    if (!rawId) {
      if (request.method === "GET") {
        const { data, error } = await client
          .from("pfpb_processes")
          .select("*")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(200);
        if (error)
          throw new HttpError(503, "Schema de homologação não disponível.");
        const ids = (data ?? []).map((p) => p.id);
        const [versions, reviews, analyses] = ids.length
          ? await Promise.all([
              client
                .from("pfpb_versions")
                .select("id,process_id,kind,created_at")
                .in("process_id", ids)
                .order("created_at", { ascending: false }),
              client
                .from("pfpb_reviews")
                .select("version_id,process_id,decision,created_at")
                .in("process_id", ids)
                .order("created_at", { ascending: false }),
              client
                .from("pfpb_analyses")
                .select("process_id,revision,created_at")
                .in("process_id", ids)
                .order("created_at", { ascending: false }),
            ])
          : [{ data: [] }, { data: [] }, { data: [] }];
        if ([versions, reviews, analyses].some((r) => "error" in r && r.error))
          throw new HttpError(503, "Não foi possível carregar os indicadores.");
        return json({
          processes: data,
          versions: versions.data,
          reviews: reviews.data,
          analyses: analyses.data,
        });
      }
      if (request.method === "POST") {
        const body = await request.json();
        return json(
          await command("create", null, { ficha: validateFicha(body.ficha) }),
          201,
        );
      }
    }
    const id = uuid(rawId);
    const { data: record, error: processError } = await client
      .from("pfpb_processes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (processError || !record || record.deleted_at)
      throw new HttpError(404, "Processo não disponível.");
    const load = async () => {
      const results = await Promise.all(
        ["pfpb_versions", "pfpb_reviews", "pfpb_analyses", "pfpb_events"].map(
          (t) =>
            client
              .from(t)
              .select("*")
              .eq("process_id", id)
              .order("created_at", { ascending: false }),
        ),
      );
      if (results.some((r) => r.error))
        throw new HttpError(500, "Não foi possível carregar o processo.");
      return {
        process: record,
        versions: results[0].data ?? [],
        reviews: results[1].data ?? [],
        analyses: results[2].data ?? [],
        events: results[3].data ?? [],
      };
    };
    if (action === "cancel" && request.method === "POST") {
      const b = await request.json();
      return json(await command("cancel", id, {revision:b.revision, confirmed:b.confirmed}));
    }
    if (!action && request.method === "GET") return json(await load());
    if (action === "ficha" && request.method === "PATCH") {
      const b = await request.json();
      return json(
        await command("ficha", id, {
          ficha: validateFicha(b.ficha),
          revision: b.revision,
        }),
      );
    }
    if (action === "upload" && request.method === "POST") {
      if (Number(request.headers.get("content-length")) > 21 * 1024 * 1024)
        throw new HttpError(413, "Limite de 20 MB por PDF.");
      const form = await request.formData();
      const file = form.get("file");
      const kind = String(form.get("kind"));
      if (
        !(file instanceof File) ||
        !TYPES.some((t) => t[0] === kind) ||
        file.size > 20 * 1024 * 1024 ||
        file.size < 5
      )
        throw new HttpError(
          400,
          "Envie um PDF de até 20 MB para uma categoria válida.",
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
        throw new HttpError(400, "O arquivo não é um PDF.");
      const vid = randomUUID(),
        path = `${id}/${vid}.pdf`;
      const { error } = await client.storage
        .from("pfpb-private")
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) throw new HttpError(500, "Upload privado não concluído.");
      await command("upload", id, {
        id: vid,
        path,
        kind,
        filename: file.name.replace(/[\x00-\x1f/\\]/g, "_"),
        size: file.size,
      });
      return json({ id: vid }, 201);
    }
    if (action === "review" && request.method === "POST") {
      const b = await request.json();
      return json(
        await command("review", id, {
          version_id: uuid(b.version_id),
          decision: b.decision,
          observation: b.observation,
        }),
      );
    }
    if (action === "document" && request.method === "GET") {
      const { data: v } = await client
        .from("pfpb_versions")
        .select("*")
        .eq("id", uuid(rawVersion))
        .eq("process_id", id)
        .maybeSingle();
      if (!v) throw new HttpError(404, "Versão não disponível.");
      const { data, error } = await client.storage
        .from("pfpb-private")
        .download(v.storage_path);
      if (error || !data) throw new HttpError(404, "Arquivo não disponível.");
      return new Response(data, {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="documento.pdf"',
          "Content-Security-Policy": "sandbox",
        },
      });
    }
    if (action === "analysis" && request.method === "POST") {
      const state = await load();
      const latest = state.versions.filter(
        (v, i, a) => a.findIndex((x) => x.kind === v.kind) === i,
      );
      const docs: InputDoc[] = [];
      for (const v of latest) {
        const { data, error } = await client.storage
          .from("pfpb-private")
          .download(v.storage_path);
        if (error || !data)
          throw new HttpError(
            500,
            "Não foi possível ler a versão para análise.",
          );
        const dir = await mkdtemp(join(tmpdir(), "pfpb-"));
        try {
          const input = join(dir, "input.pdf"),
            output = join(dir, "result.json");
          await writeFile(input, Buffer.from(await data.arrayBuffer()), {
            mode: 0o600,
          });
          await promisify(execFile)(
            processEnvNode(),
            [join(process.cwd(), "tools/extract-to-file.mjs"), input, output],
            { timeout: 180000, maxBuffer: 1024 * 1024, env: process.env },
          );
          docs.push({
            id: v.id,
            kind: v.kind,
            ...JSON.parse(await readFile(output, "utf8")),
          });
        } catch {
          docs.push({
            id: v.id,
            kind: v.kind,
            pages: [],
            qr: false,
            qrScanned: false,
          });
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
      const result = analyze(docs, record.ficha);
      await command("analysis", id, { revision: record.revision, result });
      return json(result);
    }
    if (action === "form" && request.method === "POST") {
      const b = await request.json();
      return json(
        await command("form", id, {
          revision: b.revision,
          confirmed: b.confirmed,
        }),
      );
    }
    if (
      (action === "xlsx" || action === "package") &&
      request.method === "POST"
    ) {
      const b = await request.json();
      if (b.confirmed !== true || b.revision !== record.revision)
        throw new HttpError(
          409,
          "Confirme a revisão da ficha e das ambiguidades do modelo.",
        );
      const xlsx = await generateFicha(record.ficha);
      if (action === "xlsx")
        return new Response(Buffer.from(xlsx), {
          headers: {
            ...privateHeaders,
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="Ficha-de-Cadastro.xlsx"',
          },
        });
      const state = await load();
      if (record.formed_revision !== record.revision)
        throw new HttpError(
          409,
          "Forme o processo após aprovar as versões atuais.",
        );
      const zip = new JSZip();
      zip.file("Ficha-de-Cadastro.xlsx", xlsx);
      for (const [kind] of TYPES) {
        const v = state.versions.find((x) => x.kind === kind);
        if (!v) throw new HttpError(409, "Documento ausente.");
        const { data, error } = await client.storage
          .from("pfpb-private")
          .download(v.storage_path);
        if (error || !data) throw new HttpError(500, "Documento indisponível.");
        zip.file(`${kind}.pdf`, await data.arrayBuffer());
      }
      const { data: current } = await client
        .from("pfpb_processes")
        .select("revision,formed_revision")
        .eq("id", id)
        .maybeSingle();
      if (
        !current ||
        current.revision !== record.revision ||
        current.formed_revision !== record.revision
      )
        throw new HttpError(
          409,
          "Processo alterado durante a geração. Gere novamente.",
        );
      zip.file(
        "revisao-rbk.json",
        JSON.stringify(
          {
            process_id: id,
            revision: record.revision,
            reviews: state.reviews.filter(
              (r) =>
                state.versions.find(
                  (v) =>
                    v.kind ===
                    state.versions.find((x) => x.id === r.version_id)?.kind,
                )?.id === r.version_id,
            ),
          },
          null,
          2,
        ),
      );
      return new Response(
        Buffer.from(await zip.generateAsync({ type: "uint8array" })),
        {
          headers: {
            ...privateHeaders,
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="Processo-PFPB.zip"',
          },
        },
      );
    }
    throw new HttpError(405, "Operação não disponível.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    return json(
      {
        error: "Não foi possível concluir. Confira os dados e tente novamente.",
      },
      400,
    );
  }
}
function processEnvNode() {
  return globalThis.process.execPath;
}
export { route as GET, route as POST, route as PATCH };
