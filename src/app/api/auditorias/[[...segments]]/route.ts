import {
  body,
  validateFiles,
  signUpload,
  failure,
  managerClient,
  newToken,
  PortalError,
  response,
  tokenHash,
  validUuid,
} from "../../../../lib/auditoria/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { BUCKET } from "../../../../lib/auditoria/domain";
export const runtime = "nodejs";
async function handle(
  req: Request,
  ctx: { params: Promise<{ segments?: string[] }> },
) {
  try {
    const client = await managerClient(req);
    const { segments = [] } = await ctx.params;
    const [id, action] = segments;
    if (
      segments.length > 2 ||
      (id && !["farms", "usage"].includes(id) && !validUuid(id))
    )
      throw new PortalError(404, "Rota indisponível.");
    const input =
      req.method === "POST"
        ? await body(req)
        : {
            cnpj: new URL(req.url).searchParams.get("cnpj") || "",
            offset:
              Math.min(
                2000,
                Math.max(
                  0,
                  Number(new URL(req.url).searchParams.get("page")) || 0,
                ),
              ) * 50,
          };
    let op: string;
    if (req.method === "GET")
      op =
        id === "farms"
          ? "farms"
          : id === "usage"
            ? "usage"
            : id
              ? "detail"
              : "list";
    else op = !id ? "create" : action || "";
    if (
      ![
        "list",
        "usage",
        "detail",
        "farms",
        "create",
        "link",
        "revoke",
        "close",
        "reopen",
        "delete_empty",
        "download",
        "contact",
        "confirm",
        "office_begin",
        "office_complete",
      ].includes(op) ||
      (req.method === "GET" && action)
    )
      throw new PortalError(404, "Rota indisponível.");
    if (op === "office_begin") validateFiles([input.file], true);
    let token: string | undefined;
    if (op === "link" || op === "confirm") {
      input.days = 40;
      token = newToken();
      input.hash = tokenHash(token);
    }
    const { data, error } = op === "confirm"
      ? await client.rpc("aud_confirm", { aid: id, hash: input.hash })
      : op === "contact"
      ? await client.rpc("aud_contact", { aid: id, payload: input })
      : op === "create" && input.new_farm
      ? await client.rpc("aud_register_pharmacy", { payload: input })
      : await client.rpc("aud_manager", {
      op,
      aid: validUuid(id) ? id : null,
      payload: input,
    });
    if (error)
      throw new PortalError(
        error.code === "42501" ? 403 : 400,
        error.code === "22023" && (op === "delete_empty" || op === "confirm" || op === "contact" || (op === "create" && input.new_farm))
          ? error.message
          : error.code === "42501" && op === "create" && input.new_farm
            ? "Cadastro indisponível para esta operação. Solicite à RBK a conferência do vínculo."
          : error.code === "42501"
          ? "Você não tem acesso a esta auditoria."
          : op === "download"
            ? "Arquivo aguardando verificação de segurança."
            : "Operação recusada. Confira os dados e suas permissões.",
      );
    if (op === "office_begin")
      return response({ id: data.id, ...(await signUpload(data)) });
    if (op === "download") {
      const { data: signed, error: se } = await createAdminClient()
        .storage.from(BUCKET)
        .createSignedUrl(data.path, 60, { download: data.filename });
      if (se) throw new PortalError(403, "Download não autorizado.");
      return response({ url: signed?.signedUrl });
    }
    return response(
      token && (op !== "confirm" || data.created)
        ? {
            ...data,
            url: `${new URL(req.url).origin}/portal/auditoria#${token}`,
          }
        : data,
    );
  } catch (e) {
    return failure(e);
  }
}
export const GET = handle;
export const POST = handle;
