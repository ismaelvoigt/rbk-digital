import { createClient } from "../supabase/client";
export async function managerApi(path = "", method = "GET", payload?: unknown) {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) throw new Error("Entre no RBK Digital para continuar.");
  return request(
    `/api/auditorias${path}`,
    method,
    { Authorization: `Bearer ${session.access_token}` },
    payload,
  );
}
export async function portalApi(
  token: string,
  op: string,
  payload: unknown = {},
) {
  return request(
    "/api/portal-auditoria",
    "POST",
    { "x-audit-token": token },
    { op, payload },
  );
}
async function request(
  url: string,
  method: string,
  headers: Record<string, string>,
  payload?: unknown,
) {
  const res = await fetch(url, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res
    .json()
    .catch(() => ({ error: "Falha de conexão. Tente novamente." }));
  if (!res.ok) throw new Error(data.error || "Falha de conexão.");
  return data;
}
