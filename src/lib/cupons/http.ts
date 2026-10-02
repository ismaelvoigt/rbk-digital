import "server-only";
import { createClient } from "@supabase/supabase-js";
import { resolveRole } from "../auth/rbac";
export class CupomError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const resposta = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const falha = (error: unknown) =>
  resposta(
    {
      error:
        error instanceof CupomError
          ? error.message
          : "Não foi possível concluir a extração. Tente novamente.",
    },
    error instanceof CupomError ? error.status : 500,
  );
export function ativado() {
  if (process.env.CUPONS_EXTRACAO_ENABLED !== "true")
    throw new CupomError(
      503,
      "Cupom salvo. A extração automática ainda não está ativada neste ambiente.",
    );
}
export async function corpo(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new CupomError(415, "Envie JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new CupomError(400, "Requisição inválida.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 500000) {
      await reader.cancel();
      throw new CupomError(413, "Revise até 500 itens por vez.");
    }
    chunks.push(part.value);
  }
  try {
    const b = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
    return b as Record<string, unknown>;
  } catch {
    throw new CupomError(400, "Requisição inválida.");
  }
}
export const uuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
export async function autorizar(req: Request, documentoId: string) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new CupomError(403, "Origem não permitida.");
  const bearer = req.headers.get("authorization");
  if (!bearer?.startsWith("Bearer "))
    throw new CupomError(401, "Entre novamente no RBK Digital.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const auth = await client.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user)
    throw new CupomError(401, "Sessão expirada.");
  const [perfil, admin, doc] = await Promise.all([
    client
      .from("users")
      .select("perfil,status")
      .eq("id", auth.data.user.id)
      .maybeSingle(),
    client
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", auth.data.user.id)
      .eq("ativo", true)
      .maybeSingle(),
    client
      .from("documentos")
      .select("id,autorizacao_id,categoria,caminho_arquivo,status")
      .eq("id", documentoId)
      .single(),
  ]);
  if (
    perfil.error ||
    admin.error ||
    perfil.data?.status !== "active" ||
    !resolveRole(perfil.data.perfil, Boolean(admin.data))
  )
    throw new CupomError(403, "Perfil sem acesso.");
  if (
    doc.error ||
    !doc.data ||
    !["cupom_fiscal", "cupom_vinculado"].includes(doc.data.categoria) ||
    doc.data.status !== "recebido"
  )
    throw new CupomError(404, "Cupom indisponível.");
  return { user: auth.data.user, documento: doc.data };
}
