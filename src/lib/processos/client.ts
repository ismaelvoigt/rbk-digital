import { createClient } from "../supabase/client";
import type { Analysis, Ficha } from "./domain";
export type Process = {
  id: string;
  ficha: Ficha;
  revision: number;
  formed_revision: number | null;
  created_by: string;
  updated_at: string;
};
export type Version = {
  id: string;
  process_id: string;
  kind: string;
  filename: string;
  created_at: string;
  uploaded_by: string;
};
export type Review = {
  id: string;
  process_id: string;
  version_id: string;
  decision: string;
  observation: string;
  decided_by: string;
  created_at: string;
};
export type Run = {
  id: string;
  process_id: string;
  revision: number;
  result: Analysis;
  created_at: string;
};
export type Event = {
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
  detail: Record<string, unknown>;
};
export type Detail = {
  process: Process;
  versions: Version[];
  reviews: Review[];
  analyses: Run[];
  events: Event[];
};
export type Portfolio = {
  processes: Process[];
  versions: Version[];
  reviews: Review[];
  analyses: Run[];
};
export async function api(
  path = "",
  method = "GET",
  body?: unknown,
  binary = false,
) {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session) throw new Error("Entre novamente no RBK Digital.");
  const multipart = body instanceof FormData;
  const response = await fetch(`/api/processos${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: "Falha ao carregar." }));
    throw new Error(data.error);
  }
  return binary ? response.blob() : response.json();
}
export async function download(
  path: string,
  name: string,
  method = "GET",
  body?: unknown,
) {
  const blob = await api(path, method, body, true);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
