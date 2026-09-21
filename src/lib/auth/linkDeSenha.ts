type ResultadoSessao = {
  data: { session: unknown };
  error: unknown;
};
type AuthDeSenha = {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<ResultadoSessao>;
  exchangeCodeForSession(code: string): Promise<ResultadoSessao>;
  getSession(): Promise<ResultadoSessao>;
};

// Convites administrativos usam tokens no fragmento, inclusive em outro dispositivo.
// Recuperações iniciadas neste navegador podem usar código PKCE.
export async function validarLinkDeSenha(auth: AuthDeSenha, endereco: string): Promise<boolean> {
  const url = new URL(endereco);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has("error") || hash.has("error_code") || url.searchParams.has("error")) return false;

  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  const code = url.searchParams.get("code");
  let resultado: ResultadoSessao;
  if (access_token || refresh_token) {
    if (!access_token || !refresh_token || !["invite", "recovery"].includes(hash.get("type") ?? "")) return false;
    resultado = await auth.setSession({ access_token, refresh_token });
  } else if (code) {
    resultado = await auth.exchangeCodeForSession(code);
  } else {
    resultado = await auth.getSession();
  }
  return !resultado.error && Boolean(resultado.data.session);
}
