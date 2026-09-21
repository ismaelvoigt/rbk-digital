import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../../lib/supabase/admin";


export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sessão inválida." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const {
      data: administrador,
      error: adminError,
    } = await admin
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Erro ao verificar administrador:",
        adminError
      );

      return NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 500 }
      );
    }

    if (!administrador) {
      return NextResponse.json(
        {
          error:
            "Acesso restrito aos administradores do RBK Digital.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cnpj = (searchParams.get("cnpj") ?? "")
      .replace(/\D/g, "");
    const id = (searchParams.get("id") ?? "").trim();

    let query = admin
      .from("users")
      .select(`
        id,
        farm_id,
        nome,
        email,
        perfil,
        status,
        created_at,
        last_access_at,
        farms (
          razao_social,
          nome_fantasia,
          cnpj,
          telefone,
          cidade,
          estado,
          status
        )
      `)
      .eq("perfil", "farmacia")
      .order("created_at", { ascending: false });

    if (id) {
      query = query.eq("id", id);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Erro ao consultar farmácias:",
        error
      );

      return NextResponse.json(
        { error: "Não foi possível consultar as farmácias." },
        { status: 500 }
      );
    }

    const usuarios = (data ?? []).filter((usuario) => {
      if (!cnpj) return true;

      const farm = Array.isArray(usuario.farms)
        ? usuario.farms[0]
        : usuario.farms;

      return (
        typeof farm?.cnpj === "string" &&
        farm.cnpj.replace(/\D/g, "") === cnpj
      );
    });

    return NextResponse.json(
      {
        usuarios,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao consultar farmácias:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno ao consultar as farmácias." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sessão inválida." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    /*
     * 1. Confirma que o usuário logado é administrador.
     */
    const {
      data: administrador,
      error: adminError,
    } = await admin
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Erro ao verificar administrador:",
        adminError
      );

      return NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 500 }
      );
    }

    if (!administrador) {
      return NextResponse.json(
        {
          error:
            "Acesso restrito aos administradores do RBK Digital.",
        },
        { status: 403 }
      );
    }

    /*
     * 2. Lê e valida os dados enviados pelo formulário.
     */
    const body = await request.json();

    const razaoSocial = String(
      body.razao_social ?? ""
    ).trim();

    const nomeFantasia = String(
      body.nome_fantasia ?? ""
    ).trim();

    const cnpj = String(
      body.cnpj ?? ""
    ).replace(/\D/g, "");

    const email = String(
      body.email ?? ""
    ).trim()
      .toLowerCase();

    const telefone = String(
      body.telefone ?? ""
    ).trim();

    const cidade = String(
      body.cidade ?? ""
    ).trim();

    const estado = String(
      body.estado ?? ""
    ).trim()
      .toUpperCase();

    if (!razaoSocial || !cnpj || !email) {
      return NextResponse.json(
        {
          error:
            "Razão Social, CNPJ e e-mail são obrigatórios.",
        },
        { status: 400 }
      );
    }

    if (cnpj.length !== 14) {
      return NextResponse.json(
        {
          error: "O CNPJ deve conter 14 dígitos.",
        },
        { status: 400 }
      );
    }

    /*
     * 3. Verifica se o CNPJ já está cadastrado.
     */
    const {
      data: farmExistente,
      error: farmBuscaError,
    } = await admin
      .from("farms")
      .select("id, razao_social")
      .eq("cnpj", cnpj)
      .maybeSingle();

    if (farmBuscaError) {
      console.error(
        "Erro ao verificar CNPJ:",
        farmBuscaError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível verificar o CNPJ.",
        },
        { status: 500 }
      );
    }

    if (farmExistente) {
      return NextResponse.json(
        {
          error:
            "Já existe uma farmácia cadastrada com este CNPJ.",
        },
        { status: 409 }
      );
    }

    /*
     * 4. Procura o e-mail no Supabase Auth.
     *
     * O Supabase não deve receber um novo convite
     * quando o e-mail já possui uma conta.
     */
    let usuarioAuthExistente: {
      id: string;
      email?: string;
    } | null = null;

    let pagina = 1;
    const porPagina = 1000;

    while (true) {
      const {
        data: usuariosAuth,
        error: usuariosAuthError,
      } = await admin.auth.admin.listUsers({
        page: pagina,
        perPage: porPagina,
      });

      if (usuariosAuthError) {
        console.error(
          "Erro ao consultar usuários Auth:",
          usuariosAuthError
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível verificar o e-mail de acesso.",
          },
          { status: 500 }
        );
      }

      const encontrado = usuariosAuth.users.find(
        (usuario) =>
          usuario.email?.toLowerCase() === email
      );

      if (encontrado) {
        usuarioAuthExistente = {
          id: encontrado.id,
          email: encontrado.email,
        };
        break;
      }

      if (
        usuariosAuth.users.length < porPagina
      ) {
        break;
      }

      pagina += 1;
    }

    /*
     * 5. Se o e-mail já existe no Auth, verifica se ele
     * já está vinculado a uma farmácia no RBK Digital.
     */
    if (usuarioAuthExistente) {
      const {
        data: usuarioExistente,
        error: usuarioBuscaError,
      } = await admin
        .from("users")
        .select(
          "id, farm_id, nome, email, perfil, status"
        )
        .eq("id", usuarioAuthExistente.id)
        .maybeSingle();

      if (usuarioBuscaError) {
        console.error(
          "Erro ao consultar usuário RBK:",
          usuarioBuscaError
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível verificar o vínculo do usuário.",
          },
          { status: 500 }
        );
      }

      /*
       * Se já existe registro em users, esse acesso já
       * pertence a alguma estrutura do RBK Digital.
       */
      if (usuarioExistente) {
        return NextResponse.json(
          {
            error:
              "Este e-mail já possui um acesso cadastrado no RBK Digital. Utilize outro e-mail para o responsável desta farmácia.",
          },
          { status: 409 }
        );
      }

      /*
       * 6. O usuário Auth existe, mas ainda não possui
       * registro em users.
       *
       * Nesse caso podemos aproveitar a conta existente,
       * sem enviar um novo convite.
       */

      const {
        data: farm,
        error: farmError,
      } = await admin
        .from("farms")
        .insert({
          telefone: telefone || null,
          cidade: cidade || null,
          estado: estado || null,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia || null,
          cnpj,
          status: "active",
        })
        .select(
          "id, razao_social, nome_fantasia, cnpj, status, created_at"
        )
        .single();

      if (farmError || !farm) {
        console.error(
          "Erro ao criar farmácia:",
          farmError
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível cadastrar a farmácia.",
          },
          { status: 500 }
        );
      }

      const {
        data: usuario,
        error: usuarioError,
      } = await admin
        .from("users")
        .insert({
          id: usuarioAuthExistente.id,
          farm_id: farm.id,
          nome: razaoSocial,
          email,
          perfil: "farmacia",
          status: "active",
        })
        .select(
          "id, farm_id, nome, email, perfil, status, created_at, last_access_at"
        )
        .single();

      if (usuarioError || !usuario) {
        console.error(
          "Erro ao vincular usuário existente:",
          usuarioError
        );

        await admin
          .from("farms")
          .delete()
          .eq("id", farm.id);

        return NextResponse.json(
          {
            error:
              "A farmácia foi criada, mas não foi possível vincular o acesso existente.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          tipo_acesso: "existente",
          mensagem:
            "Farmácia cadastrada e vinculada ao acesso existente.",
          farm,
          usuario,
        },
        { status: 201 }
      );
    }

    /*
     * 7. E-mail novo:
     * cria a farmácia primeiro.
     */
    const {
      data: farm,
      error: farmError,
    } = await admin
      .from("farms")
      .insert({
        telefone: telefone || null,
        cidade: cidade || null,
        estado: estado || null,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia || null,
        cnpj,
        status: "active",
      })
      .select(
        "id, razao_social, nome_fantasia, cnpj, status, created_at"
      )
      .single();

    if (farmError || !farm) {
      console.error(
        "Erro ao criar farmácia:",
        farmError
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível cadastrar a farmácia.",
        },
        { status: 500 }
      );
    }

    /*
     * 8. Envia o convite para um e-mail novo.
     */
    const {
      data: convite,
      error: conviteError,
    } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://rbk-digital.vercel.app/redefinir-senha",
    });

    if (conviteError || !convite.user) {
      console.error(
        "Erro ao enviar convite:",
        conviteError
      );

      await admin
        .from("farms")
        .delete()
        .eq("id", farm.id);

      return NextResponse.json(
        {
          error:
            "Não foi possível enviar o convite de acesso. A farmácia não foi cadastrada.",
        },
        { status: 400 }
      );
    }

    /*
     * 9. Cria o registro do usuário vinculado à farmácia.
     */
    const {
      data: usuario,
      error: usuarioError,
    } = await admin
      .from("users")
      .insert({
        id: convite.user.id,
        farm_id: farm.id,
        nome: razaoSocial,
        email,
        perfil: "farmacia",
        status: "active",
      })
      .select(
        "id, farm_id, nome, email, perfil, status, created_at, last_access_at"
      )
      .single();

    if (usuarioError || !usuario) {
      console.error(
        "Erro ao criar usuário:",
        usuarioError
      );

      await admin.auth.admin.deleteUser(
        convite.user.id
      );

      await admin
        .from("farms")
        .delete()
        .eq("id", farm.id);

      return NextResponse.json(
        {
          error:
            "Não foi possível concluir o cadastro do usuário.",
        },
        { status: 500 }
      );
    }

    /*
     * 10. Sucesso.
     */
    return NextResponse.json(
      {
        success: true,
        tipo_acesso: "convite",
        mensagem:
          "Farmácia cadastrada e convite enviado com sucesso.",
        farm,
        usuario,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao cadastrar farmácia:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao cadastrar a farmácia.",
      },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/usuarios
 *
 * Atualiza o cadastro de uma farmácia/usuário pelo ID do registro
 * em public.users.
 *
 * Regras:
 * - acesso somente administrativo;
 * - CNPJ é somente leitura;
 * - razão social, nome fantasia, e-mail, telefone, cidade e UF podem
 *   ser alterados;
 * - status active/inactive controla imediatamente o acesso;
 * - histórico da farmácia não é excluído.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sessão inválida." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const {
      data: administrador,
      error: adminError,
    } = await admin
      .from("rbk_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Erro ao verificar administrador:",
        adminError
      );

      return NextResponse.json(
        { error: "Não foi possível validar as permissões." },
        { status: 500 }
      );
    }

    if (!administrador) {
      return NextResponse.json(
        {
          error:
            "Acesso restrito aos administradores do RBK Digital.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "O ID do usuário é obrigatório." },
        { status: 400 }
      );
    }

    /*
     * Alteração exclusiva de status.
     *
     * Usada pela ação "Excluir farmácia", que realiza inativação lógica.
     * Não altera os demais dados cadastrais e não remove histórico.
     */
    const chavesBody = Object.keys(body).filter(
      (chave) => body[chave] !== undefined
    );

    const alteracaoSomenteStatus =
      chavesBody.every((chave) =>
        ["id", "status"].includes(chave)
      ) &&
      chavesBody.includes("status");

    if (alteracaoSomenteStatus) {
      const statusRecebido = String(
        body.status ?? ""
      ).trim().toLowerCase();

      const status =
        statusRecebido === "inactive" ||
        statusRecebido === "inativo"
          ? "inactive"
          : statusRecebido === "active" ||
              statusRecebido === "ativo"
            ? "active"
            : null;

      if (!status) {
        return NextResponse.json(
          { error: "Status inválido." },
          { status: 400 }
        );
      }

      const {
        data: usuarioAtual,
        error: usuarioBuscaError,
      } = await admin
        .from("users")
        .select("id, farm_id, perfil, status")
        .eq("id", id)
        .maybeSingle();

      if (usuarioBuscaError) {
        console.error(
          "Erro ao consultar usuário para alteração de status:",
          usuarioBuscaError
        );

        return NextResponse.json(
          { error: "Não foi possível localizar o usuário." },
          { status: 500 }
        );
      }

      if (!usuarioAtual) {
        return NextResponse.json(
          { error: "Usuário não encontrado." },
          { status: 404 }
        );
      }

      if (usuarioAtual.perfil !== "farmacia") {
        return NextResponse.json(
          { error: "O usuário informado não pertence a uma farmácia." },
          { status: 400 }
        );
      }

      const { error: farmUpdateError } = await admin
        .from("farms")
        .update({ status })
        .eq("id", usuarioAtual.farm_id);

      if (farmUpdateError) {
        console.error(
          "Erro ao atualizar status da farmácia:",
          farmUpdateError
        );

        return NextResponse.json(
          { error: "Não foi possível alterar o status da farmácia." },
          { status: 500 }
        );
      }

      const { error: userUpdateError } = await admin
        .from("users")
        .update({ status })
        .eq("id", id);

      if (userUpdateError) {
        console.error(
          "Erro ao atualizar status do usuário:",
          userUpdateError
        );

        /*
         * Tenta restaurar o status da farmácia para evitar divergência
         * entre users e farms caso a segunda atualização falhe.
         */
        await admin
          .from("farms")
          .update({ status: usuarioAtual.status })
          .eq("id", usuarioAtual.farm_id);

        return NextResponse.json(
          { error: "Não foi possível alterar o status do usuário." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        id,
        status,
        exclusao_logica: status === "inactive",
      });
    }

    /*
     * O CNPJ recebido pelo cliente é deliberadamente ignorado.
     *
     * CNPJ é somente leitura no perfil do gestor.
     * Não fazemos update de farms.cnpj.
     */
    const razaoSocial = String(
      body.razao_social ?? ""
    ).trim();

    const nomeFantasia = String(
      body.nome_fantasia ?? ""
    ).trim();

    const email = String(
      body.email ?? ""
    ).trim().toLowerCase();

    const telefone = String(
      body.telefone ?? ""
    ).trim();

    const cidade = String(
      body.cidade ?? body.cidade ?? ""
    ).trim();

    const estado = String(
      body.estado ?? body.uf ?? ""
    ).trim().toUpperCase();

    const statusRecebido = String(
      body.status ?? ""
    ).trim().toLowerCase();

    const status =
      statusRecebido === "inactive" ||
      statusRecebido === "inativo"
        ? "inactive"
        : "active";

    if (!razaoSocial) {
      return NextResponse.json(
        { error: "A Razão Social é obrigatória." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "O e-mail é obrigatório." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Informe um e-mail válido." },
        { status: 400 }
      );
    }

    if (estado && estado.length !== 2) {
      return NextResponse.json(
        { error: "O Estado/UF deve conter 2 letras." },
        { status: 400 }
      );
    }

    const {
      data: usuarioAtual,
      error: usuarioBuscaError,
    } = await admin
      .from("users")
      .select(
        "id, farm_id, nome, email, perfil, status"
      )
      .eq("id", id)
      .maybeSingle();

    if (usuarioBuscaError) {
      console.error(
        "Erro ao consultar usuário:",
        usuarioBuscaError
      );

      return NextResponse.json(
        { error: "Não foi possível localizar o usuário." },
        { status: 500 }
      );
    }

    if (!usuarioAtual) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    if (usuarioAtual.perfil !== "farmacia") {
      return NextResponse.json(
        {
          error:
            "Este cadastro não corresponde a um acesso de farmácia.",
        },
        { status: 400 }
      );
    }

    const {
      data: farmAtual,
      error: farmBuscaError,
    } = await admin
      .from("farms")
      .select(
        "id, razao_social, nome_fantasia, cnpj, cidade, estado, telefone, status"
      )
      .eq("id", usuarioAtual.farm_id)
      .maybeSingle();

    if (farmBuscaError) {
      console.error(
        "Erro ao consultar farmácia:",
        farmBuscaError
      );

      return NextResponse.json(
        { error: "Não foi possível localizar a farmácia." },
        { status: 500 }
      );
    }

    if (!farmAtual) {
      return NextResponse.json(
        { error: "Farmácia não encontrada." },
        { status: 404 }
      );
    }

    /*
     * Nunca altera farms.cnpj.
     *
     * A presença deste comentário e a ausência de cnpj no objeto
     * de update são intencionais: o CNPJ é somente leitura.
     */
    const dadosFarmacia = {
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia || null,
      telefone: telefone || null,
      cidade: cidade || null,
      estado: estado || null,
      status,
    };

    const {
      error: farmUpdateError,
    } = await admin
      .from("farms")
      .update(dadosFarmacia)
      .eq("id", farmAtual.id);

    if (farmUpdateError) {
      console.error(
        "Erro ao atualizar farmácia:",
        farmUpdateError
      );

      return NextResponse.json(
        { error: "Não foi possível atualizar a farmácia." },
        { status: 500 }
      );
    }

    /*
     * Atualiza o registro do RBK Digital.
     *
     * O status é mantido sincronizado para que o controle de acesso
     * existente possa bloquear imediatamente uma farmácia inativa.
     */
    const {
      error: usuarioUpdateError,
    } = await admin
      .from("users")
      .update({
        nome: razaoSocial,
        email,
        status,
      })
      .eq("id", usuarioAtual.id);

    if (usuarioUpdateError) {
      console.error(
        "Erro ao atualizar usuário:",
        usuarioUpdateError
      );

      /*
       * Tentativa de restauração dos dados da farmácia caso a segunda
       * etapa falhe.
       */
      await admin
        .from("farms")
        .update({
          razao_social: farmAtual.razao_social,
          nome_fantasia: farmAtual.nome_fantasia,
          telefone: farmAtual.telefone,
          cidade: farmAtual.cidade,
          estado: farmAtual.estado,
          status: farmAtual.status,
        })
        .eq("id", farmAtual.id);

      return NextResponse.json(
        {
          error:
            "Não foi possível atualizar o acesso da farmácia. Os dados da farmácia foram restaurados.",
        },
        { status: 500 }
      );
    }

    /*
     * Sincroniza o e-mail do usuário no Supabase Auth.
     *
     * Só executa se o e-mail realmente mudou.
     */
    if (
      usuarioAtual.email?.toLowerCase() !== email
    ) {
      const {
        error: authUpdateError,
      } = await admin.auth.admin.updateUserById(
        usuarioAtual.id,
        {
          email,
        }
      );

      if (authUpdateError) {
        console.error(
          "Erro ao atualizar e-mail no Supabase Auth:",
          authUpdateError
        );

        /*
         * Restaura os dados de aplicação se a sincronização do Auth
         * falhar.
         */
        await admin
          .from("users")
          .update({
            nome: usuarioAtual.nome,
            email: usuarioAtual.email,
            status: usuarioAtual.status,
          })
          .eq("id", usuarioAtual.id);

        await admin
          .from("farms")
          .update({
            razao_social: farmAtual.razao_social,
            nome_fantasia: farmAtual.nome_fantasia,
            telefone: farmAtual.telefone,
            cidade: farmAtual.cidade,
            estado: farmAtual.estado,
            status: farmAtual.status,
          })
          .eq("id", farmAtual.id);

        return NextResponse.json(
          {
            error:
              "Os dados não foram alterados porque não foi possível sincronizar o novo e-mail de acesso.",
          },
          { status: 400 }
        );
      }
    }

    const {
      data: farmAtualizada,
      error: farmFinalError,
    } = await admin
      .from("farms")
      .select(
        "id, razao_social, nome_fantasia, cnpj, telefone, cidade, estado, status, created_at"
      )
      .eq("id", farmAtual.id)
      .single();

    if (farmFinalError) {
      console.error(
        "Erro ao consultar farmácia atualizada:",
        farmFinalError
      );
    }

    const {
      data: usuarioAtualizado,
    } = await admin
      .from("users")
      .select(
        "id, farm_id, nome, email, perfil, status, created_at, last_access_at"
      )
      .eq("id", usuarioAtual.id)
      .single();

    return NextResponse.json(
      {
        success: true,
        mensagem: "Cadastro da farmácia atualizado com sucesso.",
        farm: farmAtualizada ?? null,
        usuario: usuarioAtualizado ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao atualizar farmácia:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao atualizar o cadastro da farmácia.",
      },
      { status: 500 }
    );
  }
}
