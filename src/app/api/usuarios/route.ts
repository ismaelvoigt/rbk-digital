import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../../lib/supabase/admin";

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
    } = await admin.auth.admin.inviteUserByEmail(email);

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
