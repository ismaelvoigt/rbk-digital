export type FinalidadeSenha = 'invite' | 'recovery';
type Sessao = {access_token: string; expires_at?: number; user: {id: string}};
type Resultado = {data: {session: Sessao | null; redirectType?: string | null}; error: unknown};
type AuthDeSenha = {
 getClaims(jwt?: string): Promise<{data: {claims: {amr?: (string | {method: string})[]; exp?: number}} | null; error: unknown}>;
 setSession(tokens: {access_token: string; refresh_token: string}): Promise<Resultado>;
 exchangeCodeForSession(code: string): Promise<Resultado>;
 verifyOtp(params: {token_hash: string; type: FinalidadeSenha}): Promise<Resultado>;
 getUser(jwt?: string): Promise<{data: {user: {id: string} | null}; error: unknown}>;
};

// Nunca usa uma sessão prévia como substituto de um link de uso único.
export async function validarLinkDeSenha(auth: AuthDeSenha, endereco: string, finalidade: FinalidadeSenha): Promise<boolean> {
 try {
  const url = new URL(endereco), hash = new URLSearchParams(url.hash.slice(1)), query = url.searchParams;
  for (const params of [hash, query]) {
   if (['error','error_code','error_description'].some(key=>params.has(key))) return false;
   if (['type','code','token_hash','access_token','refresh_token'].some(key=>params.getAll(key).length>1)) return false;
  }
  const access_token=hash.get('access_token'), refresh_token=hash.get('refresh_token');
  const code=query.get('code'), token_hash=query.get('token_hash');
  const tipos=[hash.get('type'),query.get('type')].filter(Boolean);
  if (tipos.some(type=>type!==finalidade)) return false;
  if ([Boolean(access_token || refresh_token),Boolean(code),Boolean(token_hash)].filter(Boolean).length!==1) return false;
  let result: Resultado;
  if (access_token || refresh_token) {
   // Um fragmento OTP não prova que foi emitido por convite. Primeiro acesso
   // exige token_hash e verifyOtp(type: invite), nunca uma sessão rotulada na URL.
   if (finalidade==='invite') return false;
   if (!access_token || !refresh_token || hash.get('type')!==finalidade) return false;
   // getUser valida o token no servidor ANTES de setSession poder renová-lo.
   const user=await auth.getUser(access_token);
   if (user.error || !user.data.user) return false;
   const verified=await auth.getClaims(access_token);
   if (verified.error || !verified.data?.claims.amr?.some(entry=>typeof entry==='object' && entry.method==='otp') ||
       (verified.data.claims.exp ?? 0)<=Date.now()/1000) return false;
   result=await auth.setSession({access_token,refresh_token});
   if (result.data.session?.user.id!==user.data.user.id) return false;
  } else if (token_hash) {
   if (query.get('type')!==finalidade) return false;
   result=await auth.verifyOtp({token_hash,type:finalidade});
  } else {
   // Convites administrativos não usam PKCE. O SDK vincula recovery ao verificador.
   if (finalidade!=='recovery' || !code) return false;
   result=await auth.exchangeCodeForSession(code);
   if (result.data.redirectType!=='recovery') return false;
  }
  return !result.error && Boolean(result.data.session?.user.id) &&
   (result.data.session?.expires_at ?? 0)>Date.now()/1000;
 } catch { return false; }
}

export function destinoLinkAntigo(endereco: string): string | null {
 const url=new URL(endereco), hash=new URLSearchParams(url.hash.slice(1));
 // Convites antigos chegam à tela correta, mas precisam ser renovados: seu
 // fragmento de sessão não permite comprovar a finalidade no servidor.
 if (url.pathname==='/redefinir-senha' && (hash.get('type')==='invite' || url.searchParams.get('type')==='invite'))
  return '/primeiro-acesso'+url.search+url.hash;
 return null;
}
