import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (["/pdf-viewer/pdf.mjs", "/pdf-viewer/pdf.worker.mjs"].includes(request.nextUrl.pathname)) return NextResponse.next();
  if (process.env.AUDIT_STAGING_ONLY === "true") {
    const path = request.nextUrl.pathname;
    if (path === "/processos") return NextResponse.redirect(new URL("/processos/auditorias", request.url));
    const allowed = ["/portal/credenciamento", "/processos/credenciamento/convites", "/api/credenciamento", "/dashboard", "/", "/redefinir-senha", "/manifest.webmanifest", "/portal/auditoria", "/processos/auditorias", "/api/portal-auditoria", "/api/auditorias"].includes(path) || path.startsWith("/api/auditorias/") || path.startsWith("/_next/");
    if (!allowed) return new NextResponse("Página indisponível nesta homologação.", {status:404,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
