import {
  autorizarGestaoUsuarios,
  usuarioReply as reply,
  userUuid,
} from "../../../../lib/usuarios/adminRequest";
export async function PATCH(request: Request) {
  try {
    const auth = await autorizarGestaoUsuarios(request);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => null);
    if (
      !userUuid(body?.id) ||
      !["promover", "plano"].includes(body?.acao) ||
      (body.acao === "plano" &&
        !["armazenamento", "completo"].includes(body.plano))
    )
      return reply({ error: "Dados de acesso inválidos." }, 400);
    const result = await auth.admin!.rpc("farmacia_acesso_alterar", {
      p_actor: auth.actor,
      p_id: body.id,
      p_acao: body.acao,
      p_plano: body.acao === "plano" ? body.plano : null,
    });
    if (result.error)
      return reply(
        {
          error:
            result.error.code === "P0001"
              ? result.error.message
              : "Não foi possível alterar o acesso.",
        },
        result.error.code === "P0001" ? 409 : 503,
      );
    return reply(result.data);
  } catch {
    return reply(
      {
        error:
          "Não foi possível alterar o acesso. Atualize a página e tente novamente.",
      },
      503,
    );
  }
}
