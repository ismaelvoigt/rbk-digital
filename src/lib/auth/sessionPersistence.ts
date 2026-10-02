import {
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from "@supabase/ssr";

// This cookie controls storage lifetime only, never authorization. The proxy
// corrects it using users/rbk_admins; an unknown profile defaults to session-only.
export const PERSISTENCE_COOKIE = "rbk-session-persistence";
const PERSISTENT_MAX_AGE = 400 * 24 * 60 * 60;

export function isAuthSessionCookie(name: string) {
  return /^sb-.+-auth-token(?:\.\d+)?$/.test(name);
}

export function sessionCookieOptions(persistent: boolean, options: CookieOptions = {}): CookieOptions {
  if (options.maxAge === 0) return options;
  return {
    path: "/",
    sameSite: "lax",
    ...options,
    maxAge: persistent ? PERSISTENT_MAX_AGE : undefined,
    expires: undefined,
  };
}

function readCookies() {
  return typeof document === "undefined" ? [] : parseCookieHeader(document.cookie);
}

export const browserSessionCookies = {
  getAll: readCookies,
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
    if (typeof document === "undefined") return;
    const persistent = readCookies().some(c => c.name === PERSISTENCE_COOKIE && c.value === "farmacia");
    for (const { name, value, options } of cookies) {
      document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(persistent, options));
    }
    if (cookies.some(c => isAuthSessionCookie(c.name)) && !readCookies().some(c => isAuthSessionCookie(c.name))) {
      document.cookie = serializeCookieHeader(PERSISTENCE_COOKIE, "", { path: "/", maxAge: 0 });
    }
  },
};

export function setSessionPersistence(perfil: string | null) {
  if (typeof document === "undefined") return;
  const persistent = perfil === "farmacia";
  document.cookie = serializeCookieHeader(PERSISTENCE_COOKIE, persistent ? "farmacia" : "session", sessionCookieOptions(persistent));
  for (const { name, value } of readCookies().filter(c => isAuthSessionCookie(c.name))) {
    document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(persistent));
  }
}
