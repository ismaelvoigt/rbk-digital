import { after } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { processarProximo } from "../../../../lib/cupons/worker";
import { validarRevisao } from "../../../../lib/cupons/parser";
import {
  ativado,
  autorizar,
  corpo,
  CupomError,
  falha,
  resposta,
  uuid,
} from "../../../../lib/cupons/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(req: Request) {
  try {
    ativado();
    const b = await corpo(req);
    if (
      !uuid(b.documentoId) ||
      !["processar", "repetir", "confirmar"].includes(String(b.op))
    )
      throw new CupomError(400, "Operação inválida.");
    const { user } = await autorizar(req, b.documentoId);
    const admin = createAdminClient();
    if (b.op === "confirmar") {
      if (!uuid(b.versao) || typeof b.substituir !== "boolean")
        throw new CupomError(400, "Confira a versão da extração.");
      let itens;
      try {
        itens = validarRevisao(b.itens);
      } catch (e) {
        throw new CupomError(
          400,
          e instanceof Error ? e.message : "Itens inválidos.",
        );
      }
      const r = await admin.rpc("cupom_confirmar", {
        p_documento: b.documentoId,
        p_versao: b.versao,
        p_actor: user.id,
        p_itens: itens,
        p_substituir: b.substituir,
      });
      if (r.error)
        throw new CupomError(
          409,
          "Não foi possível confirmar: confira sua permissão, atualize a extração e autorize a substituição se já houver itens.",
        );
      return resposta({
        mensagem: "Itens confirmados e disponíveis em Vendas e Indicadores.",
      });
    }
    const r = await admin.rpc("cupom_solicitar", {
      p_documento: b.documentoId,
      p_retry: b.op === "repetir",
    });
    if (r.error)
      throw new CupomError(
        503,
        "Cupom salvo, mas a fila de extração não está disponível.",
      );
    const id = b.documentoId;
    after(async () => {
      try {
        await processarProximo(admin, id);
      } catch {
        console.error(
          "Worker de cupons interrompido; fila preservada para recuperação.",
        );
      }
    });
    return resposta(
      {
        mensagem:
          "Cupom registrado para leitura. Acompanhe a conferência nesta autorização.",
      },
      202,
    );
  } catch (e) {
    return falha(e);
  }
}
