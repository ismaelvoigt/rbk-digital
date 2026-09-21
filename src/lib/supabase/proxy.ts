import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAccessDecision } from "../auth/accessPolicy";
import { resolveRole } from "../auth/rbac";
import { createAdminClient } from "./admin";

export async function updateSession(request: NextRequest) {
  // These exact routes authorize independently; portal capability never grants a session.
  const auditPath = request.nextUrl.pathname;
  if (auditPath === '/portal/credenciamento' || auditPath === '/api/credenciamento' || auditPath === '/portal/auditoria' || auditPath === '/api/portal-auditoria' || auditPath === '/api/auditorias' || auditPath.startsWith('/api/auditorias/')) {
    const response = NextResponse.next({request});
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Frame-Options', auditPath === '/portal/credenciamento' ? 'SAMEORIGIN' : 'DENY');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
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
    pathname === "/redefinir-senha" ||
    pathname === "/manifest.webmanifest" ||
    // A rota administrativa valida seu próprio Authorization Bearer.
    pathname === "/api/usuarios" ||
    pathname === "/api/processos" || pathname.startsWith("/api/processos/") ||
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
  if (!usuario || usuario.status !== "active") {
    const url = request.nextUrl.clone();
    url.pathname = "/";

    return NextResponse.redirect(url);
  }

  // Usa a mesma fonte de permissão administrativa da tela de login,
  // sem dispensar a verificação de status active acima.
  const { data: administrador, error: adminError } = await admin
    .from("rbk_admins")
    .select("user_id")
    .eq("user_id", claims.sub)
    .eq("ativo", true)
    .maybeSingle();

  if (adminError) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  /*
   * Aplica a política centralizada.
   */
  const decision = getAccessDecision({
    authenticated: true,
    perfil: resolveRole(usuario.perfil, Boolean(administrador)),
    pathname,
  });

  if (!decision.allowed) {
    const url = request.nextUrl.clone();
    url.pathname = decision.redirectTo;

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
