import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { canUseProcessos } from "./domain";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorize(request: Request) {
  if (process.env.PFPB_ENABLED !== "true")
    throw new HttpError(
      503,
      "Módulo aguardando configuração do ambiente de homologação.",
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const staging = process.env.PFPB_STAGING_PROJECT_REF;
  if (
    process.env.VERCEL_ENV === "production" ||
    !staging ||
    staging === "sqamrlckyuesfmibxizy" ||
    !url.includes(`://${staging}.supabase.co`)
  )
    throw new HttpError(
      503,
      "Este módulo está restrito ao banco de homologação validado.",
    );
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer "))
    throw new HttpError(401, "Entre novamente.");
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(auth.slice(7));
  if (error || !user) throw new HttpError(401, "Sessão inválida.");
  const admin = createAdminClient();
  const [{ data: profile, error: pe }, { data: legacy, error: le }] =
    await Promise.all([
      admin
        .from("users")
        .select("perfil,status")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("rbk_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle(),
    ]);
  if (
    pe ||
    le ||
    !profile ||
    !canUseProcessos(profile.perfil, profile.status, Boolean(legacy))
  )
    throw new HttpError(
      403,
      "Acesso exclusivo ao Gestor RBK/Superadmin ativo.",
    );
  return { client, user };
}
export function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "Identificador inválido.");
  return value;
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
