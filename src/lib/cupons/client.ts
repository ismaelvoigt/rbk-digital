"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
export const ehCupom = (categoria: string) =>
  categoria === "cupom_fiscal" || categoria === "cupom_vinculado";
export async function comandoCupom(
  client: SupabaseClient,
  body: Record<string, unknown>,
) {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  const response = await fetch("/api/cupons/processar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível iniciar a leitura.");
  return data.mensagem as string;
}
export async function dispararExtracao(
  client: SupabaseClient,
  documentoId: string,
  categoria: string,
) {
  if (!ehCupom(categoria)) return "";
  try {
    return await comandoCupom(client, { op: "processar", documentoId });
  } catch (e) {
    return e instanceof Error
      ? e.message
      : "Cupom salvo. Tente iniciar a leitura na tela da autorização.";
  }
}
