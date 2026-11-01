import {
  autorizarGestaoUsuarios,
  usuarioReply as reply,
  userUuid,
} from "../../../../lib/usuarios/adminRequest";
async function handle(request: Request, deleting: boolean) {
  try {
    const auth = await autorizarGestaoUsuarios(request);
    if (auth.response) return auth.response;
    const body = deleting ? await request.json().catch(() => null) : null;
    const id = deleting
      ? body?.id
      : new URL(request.url).searchParams.get("id");
    if (!userUuid(id)) return reply({ error: "Usuário inválido." }, 400);
    if (deleting && (typeof body?.email !== "string" || !body.email.trim()))
      return reply({ error: "Digite o e-mail para confirmar." }, 400);
    const result = await auth.admin!.rpc("usuario_sem_uso_excluir", {
      p_actor: auth.actor,
      p_id: id,
      p_action: deleting ? "delete" : "preview",
      p_email: deleting ? body.email : null,
    });
    if (result.error)
      return reply(
        {
          error:
            result.error.code === "P0001"
              ? result.error.message
              : "Não foi possível verificar a exclusão. Nenhum registro foi removido.",
        },
        result.error.code === "P0001" ? 409 : 503,
      );
    return reply(result.data);
  } catch {
    return reply(
      {
        error:
          "Não foi possível concluir. Atualize a lista para conferir o resultado antes de tentar novamente.",
      },
      503,
    );
  }
}
export async function GET(request: Request) {
  return handle(request, false);
}
export async function DELETE(request: Request) {
  return handle(request, true);
}
