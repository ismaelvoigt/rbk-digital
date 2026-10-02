import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { processarProximo } from "../../../../lib/cupons/worker";
import {
  ativado,
  CupomError,
  falha,
  resposta,
} from "../../../../lib/cupons/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(req: Request) {
  try {
    ativado();
    const secret = process.env.CUPONS_WORKER_SECRET;
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (
      !secret ||
      secret.length < 32 ||
      !token ||
      Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    )
      throw new CupomError(401, "Acesso não autorizado.");
    return resposta(await processarProximo(createAdminClient()));
  } catch (e) {
    return falha(e);
  }
}
export const POST = GET;
