import { createHash } from "node:crypto";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  assertStaging,
  body,
  failure,
  PortalError,
  response,
  signedTicket,
  tokenHash,
  validateFiles,
  validateOrigin,
  validUuid,
} from "../../../lib/auditoria/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertStaging();
    validateOrigin(req);
    const admin = createAdminClient();
    // Global budget also bounds random-token attacks without trusting spoofable forwarding headers.
    const gate = await admin.rpc("aud_rate", { k: "portal:global", lim: 600 });
    if (gate.error || !gate.data)
      throw new PortalError(429, "Muitas solicitações. Aguarde um minuto.");
    const hash = tokenHash(req.headers.get("x-audit-token") || "");
    const throttle = await admin.rpc("aud_rate", {
      k: `token:${createHash("sha256").update(hash).digest("hex")}`,
      lim: 120,
    });
    if (throttle.error || !throttle.data)
      throw new PortalError(429, "Muitas solicitações. Aguarde um minuto.");
    const input = await body(req);
    const { op, payload = {} } = input;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new PortalError(400, "Dados inválidos.");
    if (!["summary", "begin", "ticket", "complete", "failure"].includes(op))
      throw new PortalError(400, "Operação inválida.");
    if (op === "begin") {
      validateFiles(payload.files);
      if (!validUuid(payload.key)) throw new PortalError(400, "Lote inválido.");
    }
    if (
      (["ticket", "failure"].includes(op) && !validUuid(payload.file_id)) ||
      (op === "complete" && !validUuid(payload.batch_id))
    )
      throw new PortalError(400, "Identificador inválido.");
    if (op === "ticket")
      return response(await signedTicket(hash, payload.file_id));
    const { data, error } = await admin.rpc("aud_portal", {
      h: hash,
      op,
      payload,
    });
    if (error)
      throw new PortalError(
        error.code === "28000" ? 401 : 409,
        error.code === "28000"
          ? "Link revogado ou expirado. Solicite um novo link à RBK."
          : error.code === "23505"
            ? "Arquivo já cadastrado nesta auditoria. Remova a cópia da seleção ou retome o lote anterior."
            : "Operação recusada. Confira a coleta, os limites e se todos os arquivos terminaram de enviar.",
      );
    return response(data);
  } catch (e) {
    return failure(e);
  }
}
