import {
  autorizarGestaoUsuarios,
  usuarioReply as reply,
  userUuid,
} from "../../../../lib/usuarios/adminRequest";
import { preparePharmacyInvitation } from "../../../../lib/cadastro/invitation";
import { publicOrigin } from "../../../../lib/config/ambiente";
const normal = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
export async function POST(request: Request) {
  try {
    const auth = await autorizarGestaoUsuarios(request);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => null);
    if (
      !userUuid(body?.id) ||
      !normal(body?.email) ||
      normal(body.email).length > 254
    )
      return reply({ error: "Usuário e e-mail inválidos." }, 400);
    if (body.id === auth.actor)
      return reply(
        { error: "Utilize a recuperação de senha para sua própria conta." },
        403,
      );
    const admin = auth.admin!;
    const [profile, rbk] = await Promise.all([
      admin
        .from("users")
        .select(
          "id,farm_id,nome,email,perfil,status,tipo_convite,convite_enviado_em",
        )
        .eq("id", body.id)
        .maybeSingle(),
      admin
        .from("rbk_admins")
        .select("user_id")
        .eq("user_id", body.id)
        .maybeSingle(),
    ]);
    if (profile.error || rbk.error)
      return reply({ error: "Não foi possível consultar o acesso." }, 503);
    if (rbk.data)
      return reply(
        { error: "Esta ação é exclusiva para responsáveis de farmácia." },
        403,
      );
    const u = profile.data;
    if (
      !u ||
      u.status !== "active" ||
      !u.farm_id ||
      !["farmacia", "operador", "administrador_farmacia"].includes(u.perfil) ||
      (u.perfil !== "farmacia" && u.tipo_convite !== "farmacia")
    )
      return reply(
        {
          error:
            "Ative o responsável e confira o vínculo da farmácia antes de reenviar.",
        },
        409,
      );
    const email = normal(u.email);
    if (email !== normal(body.email) || !/^\S+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply(
        {
          error: "Salve o novo e-mail e atualize o cadastro antes de reenviar.",
        },
        409,
      );
    const [farm, account] = await Promise.all([
      admin
        .from("farms")
        .select("id,status,nome_fantasia,razao_social")
        .eq("id", u.farm_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(u.id),
    ]);
    if (farm.error || account.error)
      return reply(
        { error: "Não foi possível verificar o cadastro e o acesso." },
        503,
      );
    if (farm.data?.status !== "active")
      return reply({ error: "Ative a farmácia antes de reenviar." }, 409);
    if (
      account.data.user?.id !== u.id ||
      normal(account.data.user.email) !== email
    )
      return reply(
        {
          error:
            "O e-mail de acesso ainda não corresponde ao cadastro. Salve e confira a sincronização antes de reenviar.",
        },
        409,
      );
    const latest = Math.max(
      0,
      ...[u.convite_enviado_em, account.data.user.recovery_sent_at]
        .map((value) => Date.parse(value ?? ""))
        .filter(Number.isFinite),
    );
    if (Date.now() - latest < 60000)
      return reply(
        { error: "Aguarde um minuto antes de reenviar novamente." },
        429,
      );
    let send: Awaited<ReturnType<typeof preparePharmacyInvitation>>;
    try {
      send = await preparePharmacyInvitation({
        tipo_convite: "acesso",
        nome: u.nome,
        perfil: u.perfil,
      });
    } catch {
      return reply(
        {
          error:
            "O envio de convites está indisponível. Tente novamente mais tarde.",
        },
        503,
      );
    }
    // Recovery renews an existing identity, including a pending invite, without creating another account.
    const origin = publicOrigin();
    const generated = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/redefinir-senha` },
    });
    if (
      generated.error ||
      generated.data.user?.id !== u.id ||
      normal(generated.data.user.email) !== email ||
      !generated.data.properties?.hashed_token
    )
      return reply(
        {
          error:
            "Não foi possível renovar o acesso da mesma conta. Atualize o cadastro e tente novamente.",
        },
        409,
      );
    const current = await admin
      .from("users")
      .select("email,status,farm_id")
      .eq("id", u.id)
      .maybeSingle();
    if (
      current.error ||
      current.data?.status !== "active" ||
      normal(current.data.email) !== email ||
      current.data.farm_id !== u.farm_id
    )
      return reply(
        {
          error:
            "O cadastro mudou durante a operação. Atualize a página antes de reenviar.",
        },
        409,
      );
    const link = new URL(`${origin}/redefinir-senha`);
    link.searchParams.set("type", "recovery");
    link.searchParams.set("token_hash", generated.data.properties.hashed_token);
    try {
      await send(
        email,
        farm.data.nome_fantasia || farm.data.razao_social || u.nome,
        link.toString(),
      );
    } catch {
      return reply(
        {
          error:
            "Não foi possível confirmar o envio. Aguarde um minuto e tente novamente.",
        },
        502,
      );
    }
    // The message is already accepted: a history failure must not encourage a duplicate send.
    let historyFailed = false;
    try {
      const stamp = await admin
        .from("users")
        .update({ convite_enviado_em: new Date().toISOString() })
        .eq("id", u.id)
        .eq("email", u.email)
        .select("id")
        .maybeSingle();
      const audit = await admin
        .from("audit_logs")
        .insert({
          farm_id: u.farm_id,
          user_id: auth.actor,
          action: "invite_resend",
          entity_type: "usuario",
          entity_id: u.id,
          metadata: { tipo: "recovery" },
        });
      historyFailed = !!stamp.error || !stamp.data || !!audit.error;
    } catch {
      historyFailed = true;
    }
    return reply({
      success: true,
      mensagem: `Convite reenviado para ${email}. O cliente poderá definir a senha de acesso.`,
      ...(historyFailed
        ? {
            aviso:
              "O envio foi aceito, mas o histórico não pôde ser atualizado. Não é necessário reenviar.",
          }
        : {}),
    });
  } catch {
    return reply(
      {
        error:
          "Não foi possível concluir o reenvio. Tente novamente mais tarde.",
      },
      503,
    );
  }
}
