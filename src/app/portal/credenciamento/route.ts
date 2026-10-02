import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const html = await readFile(
      join(process.cwd(), "src/lib/credenciamento/form.html"),
      "utf8"
    );

    const wildcard = String.fromCharCode(42);
    const supabaseOrigin = "https://" + wildcard + ".supabase.co";

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' " + supabaseOrigin,
      "frame-ancestors 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
    ].join("; ");

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy": csp,
      },
    });
  } catch {
    return new Response("Portal indisponível", { status: 503 });
  }
}
