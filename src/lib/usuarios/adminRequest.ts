import "server-only";
import { createAdminClient } from "../supabase/admin";
export const usuarioReply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export const userUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function autorizarGestaoUsuarios(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return { response: usuarioReply({ error: "Origem não permitida." }, 403) };
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token)
    return { response: usuarioReply({ error: "Sessão inválida." }, 401) };
  const admin = createAdminClient();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user)
    return { response: usuarioReply({ error: "Sessão inválida." }, 401) };
  const [role, profile] = await Promise.all([
    admin
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle(),
    admin.from("users").select("status").eq("id", user.id).maybeSingle(),
  ]);
  if (role.error || profile.error)
    return {
      response: usuarioReply(
        { error: "Não foi possível validar suas permissões." },
        503,
      ),
    };
  if (!role.data || profile.data?.status !== "active")
    return {
      response: usuarioReply(
        { error: "Acesso restrito à administração RBK." },
        403,
      ),
    };
  return { admin, actor: user.id };
}
