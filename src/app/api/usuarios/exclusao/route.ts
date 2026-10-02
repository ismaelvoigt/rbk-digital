import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ObjectRef = { bucket: string; name: string };
type Result = { objects?: ObjectRef[]; completed?: boolean; pending?: boolean; [key: string]: unknown };
function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
async function handle(request: Request, deleting: boolean) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply({ error: "Sessão inválida." }, 401);
    const admin = createAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return reply({ error: "Sessão inválida." }, 401);
    const { data: role, error: roleError } = await admin.from("rbk_admins").select("user_id").eq("user_id", user.id).eq("ativo", true).maybeSingle();
    if (roleError) return reply({ error: "Não foi possível validar suas permissões." }, 503);
    if (!role) return reply({ error: "Acesso restrito aos administradores do RBK Digital." }, 403);
    let farm: unknown; let cnpj: unknown;
    if (deleting) {
      const body = await request.json().catch(() => null);
      farm = body?.farm_id; cnpj = body?.cnpj;
      if (typeof cnpj !== "string" || cnpj.replace(/\D/g, "").length !== 14) return reply({ error: "Digite o CNPJ completo para confirmar." }, 400);
    } else farm = new URL(request.url).searchParams.get("farm_id");
    if (typeof farm !== "string" || !UUID.test(farm)) return reply({ error: "Farmácia inválida." }, 400);
    const args = { p_actor: user.id, p_farm: farm, p_cnpj: deleting ? cnpj : null };
    const initial = await admin.rpc("farmacia_exclusao", { ...args, p_action: deleting ? "prepare" : "preview" });
    if (initial.error) return reply({ error: initial.error.code === "P0001" ? initial.error.message : "Não foi possível verificar a exclusão. Tente novamente." }, initial.error.code === "P0001" ? 409 : 503);
    const result = initial.data as Result;
    if (!deleting || result.completed) {
      const { objects: _objects, ...summary } = result;
      void _objects;
      return reply(summary);
    }
    // A bounded batch allows retry after a network failure or server timeout.
    // Paths come exclusively from the frozen server-side manifest, never the browser.
    const byBucket = new Map<string, string[]>();
    for (const obj of result.objects ?? []) byBucket.set(obj.bucket, [...(byBucket.get(obj.bucket) ?? []), obj.name]);
    for (const [bucket, paths] of byBucket) {
      const removed = await admin.storage.from(bucket).remove(paths);
      if (removed.error) return reply({ error: "A exclusão foi iniciada, mas alguns arquivos não puderam ser removidos. A farmácia está bloqueada. Clique em Retomar exclusão para concluir.", pending: true }, 503);
    }
    const finished = await admin.rpc("farmacia_exclusao", { ...args, p_action: "finish" });
    if (finished.error) return reply({ error: "A exclusão permanece pendente. Clique em Retomar exclusão para concluir.", pending: true }, 503);
    const { objects: _objects, ...summary } = finished.data as Result;
    void _objects;
    return reply(summary, summary.completed ? 200 : 202);
  } catch {
    return reply({ error: "Não foi possível concluir a operação. Consulte a situação e tente novamente." }, 503);
  }
}
export async function GET(request: Request) { return handle(request, false); }
export async function DELETE(request: Request) { return handle(request, true); }
