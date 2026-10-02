import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerCupom } from "./leitura";
import { extrairItens } from "./parser";
type Job = {
  documento_id: string;
  versao: string;
  lease_token: string;
  caminho_arquivo: string;
  autorizacao_id: string;
};
export async function processarProximo(
  client: SupabaseClient,
  documentoId: string | null = null,
) {
  const claimed = await client.rpc("cupom_claim", { p_documento: documentoId });
  if (claimed.error) throw new Error("Fila de extração indisponível.");
  const job = claimed.data as Job | null;
  if (!job) return { processado: false };
  let estado = "revisao",
    resultado: Record<string, unknown> = {},
    sha: string | null = null,
    erro = "";
  try {
    const authorization = await client
      .from("autorizacoes")
      .select("user_id")
      .eq("id", job.autorizacao_id)
      .single();
    if (
      authorization.error ||
      !origemPermitida(
        job.caminho_arquivo,
        authorization.data?.user_id,
        job.autorizacao_id,
      )
    )
      throw new Error(
        "Arquivo fora da origem permitida para esta autorização.",
      );
    const bucket = client.storage.from("documentos");
    const info = await bucket.info(job.caminho_arquivo);
    const size = Number(info.data?.metadata?.size);
    if (info.error || !Number.isFinite(size) || size < 1)
      throw new Error("Arquivo indisponível para leitura.");
    if (size > 10 * 1024 * 1024) throw new Error("Use um cupom de até 10 MB.");
    const download = await bucket.download(job.caminho_arquivo);
    if (download.error || !download.data)
      throw new Error("Não foi possível acessar o arquivo do cupom.");
    if (download.data.size > 10 * 1024 * 1024)
      throw new Error("Use um cupom de até 10 MB.");
    const bytes = Buffer.from(await download.data.arrayBuffer());
    sha = createHash("sha256").update(bytes).digest("hex");
    const paginas = await lerCupom(bytes);
    resultado = { ...extrairItens(paginas), paginas, leitor: "rbk-local-v1" };
  } catch (e) {
    estado = "erro";
    erro = e instanceof Error ? e.message : "Falha na leitura do cupom.";
  }
  const done = await client.rpc("cupom_concluir", {
    p_documento: job.documento_id,
    p_versao: job.versao,
    p_token: job.lease_token,
    p_estado: estado,
    p_resultado: resultado,
    p_sha: sha,
    p_erro: erro,
  });
  if (done.error)
    throw new Error("Não foi possível registrar o resultado da leitura.");
  return { processado: true, aplicado: done.data === true, estado };
}

export function origemPermitida(
  path: string,
  owner: unknown,
  authorization: string,
) {
  const parts = path.split("/");
  return (
    typeof owner === "string" &&
    parts.length === 3 &&
    parts[0] === owner &&
    parts[1] === authorization &&
    !!parts[2] &&
    !parts.some((p) => p === "." || p === ".." || /[\\%\x00-\x1f]/.test(p))
  );
}
