import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAccessDecision } from "../auth/accessPolicy";
import { createAdminClient } from "./admin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  /*
   * O Supabase recomenda getClaims() para validar a sessão
   * no lado servidor.
   */
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;

  /*
   * Rotas públicas.
   */
  if (
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return supabaseResponse;
  }

  /*
   * Sem sessão válida.
   */
  if (!claims?.sub) {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  /*
   * Recupera o perfil do usuário.
   *
   * A consulta usa o Admin Client somente no servidor.
   * A SERVICE_ROLE_KEY nunca é enviada ao navegador.
   */
  const admin = createAdminClient();

  const { data: usuario, error } = await admin
    .from("users")
    .select("id, perfil, status")
    .eq("id", claims.sub)
    .maybeSingle();

  if (error) {
    console.error("Erro ao consultar perfil do usuário:", error);

    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  /*
   * Usuário autenticado no Supabase, mas sem registro
   * válido na tabela de usuários do RBK Digital.
   */
  if (!usuario || usuario.status === "inativo") {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  /*
   * Aplica a política centralizada.
   */
  const decision = getAccessDecision({
    authenticated: true,
    perfil: usuario.perfil,
    pathname,
  });

  if (!decision.allowed) {
    const url = request.nextUrl.clone();
    url.pathname = decision.redirectTo;

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
