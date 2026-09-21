import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { BUCKET, MAX_FILE, MIME, OFFICE_MIME, type ManifestFile } from "./domain";
export class PortalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertStaging(
  env: Record<string, string | undefined> = process.env,
) {
  const ref = env.AUDIT_STAGING_PROJECT_REF;
  let url: URL;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
  } catch {
    throw new PortalError(503, "Homologação ainda não configurada.");
  }
  if (
    env.AUDIT_PORTAL_ENABLED !== "true" ||
    env.VERCEL_ENV === "production" ||
    !ref ||
    ref === "sqamrlckyuesfmibxizy" ||
    url.origin !== `https://${ref}.supabase.co`
  )
    throw new PortalError(
      503,
      "Portal restrito ao ambiente de homologação validado.",
    );
  return ref;
}
export const newToken = () => randomBytes(32).toString("base64url");
export function tokenHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new PortalError(
      401,
      "Link indisponível. Solicite um novo link à RBK.",
    );
  return createHash("sha256").update(token).digest("hex");
}
export function validateOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new PortalError(403, "Origem não permitida.");
}
export function validateFiles(input: unknown, office = false): ManifestFile[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100)
    throw new PortalError(400, "Envie entre 1 e 100 arquivos.");
  const accepted = office ? OFFICE_MIME : MIME;
  const ids = new Set<string>(),
    hashes = new Set<string>();
  let total = 0;
  for (const f of input) {
    const ext =
      typeof f?.name === "string" ? f.name.split(".").pop()?.toLowerCase() : "";
    if (
      !f ||
      typeof f.name !== "string" ||
      f.name.length > 180 ||
      /[\x00-\x1f/\\]/.test(f.name) ||
      !ext ||
      !accepted[ext] ||
      accepted[ext] !== f.mime ||
      !Number.isSafeInteger(f.size) ||
      f.size < 1 ||
      f.size > MAX_FILE ||
      !validUuid(f.id) ||
      !/^[a-f0-9]{64}$/.test(f.fingerprint) ||
      ids.has(f.id) ||
      hashes.has(f.fingerprint)
    )
      throw new PortalError(
        400,
        `Arquivo inválido, repetido ou acima de 100 MB. Aceitos PDF, ${office ? "HTML, " : ""}JPG, PNG e TIFF.`,
      );
    ids.add(f.id);
    hashes.add(f.fingerprint);
    total += f.size;
  }
  if (total > 1024 ** 3) throw new PortalError(400, "Limite de 1 GB por lote.");
  return input;
}
export const validUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new PortalError(415, "Use JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new PortalError(400, "Corpo inválido.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new PortalError(413, "Manifesto acima do limite.");
    }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("object");
    return data;
  } catch {
    throw new PortalError(400, "JSON inválido.");
  }
}
export const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};
export function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}
export function failure(e: unknown) {
  return response(
    {
      error:
        e instanceof PortalError
          ? e.message
          : "Não foi possível concluir. Atualize e tente novamente.",
    },
    e instanceof PortalError ? e.status : 500,
  );
}
export async function managerClient(req: Request) {
  assertStaging();
  validateOrigin(req);
  const bearer = req.headers.get("authorization");
  if (!bearer?.startsWith("Bearer "))
    throw new PortalError(401, "Entre no RBK Digital.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser(bearer.slice(7));
  if (error || !data.user) throw new PortalError(401, "Sessão inválida.");
  return client; // RPC checks fresh RBAC + farm assignment in PostgreSQL.
}
export async function signedTicket(hash: string, fileId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("aud_portal", {
    h: hash,
    op: "ticket",
    payload: { file_id: fileId },
  });
  if (error)
    throw new PortalError(
      409,
      "Envio indisponível. Confira o link e a situação da coleta.",
    );
  return signUpload(data);
}
export async function signUpload(data: {
  path: string;
  mime: string;
  exists: boolean;
}) {
  if (data.exists) return { exists: true };
  const admin = createAdminClient();
  const signed = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(data.path, { upsert: false });
  if (signed.error || !signed.data)
    throw new PortalError(503, "Não foi possível iniciar o envio.");
  return {
    token: signed.data.token,
    path: data.path,
    mime: data.mime,
    endpoint: `https://${assertStaging()}.storage.supabase.co/storage/v1/upload/resumable/sign`,
  };
}
