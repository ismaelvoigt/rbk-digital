import { Upload } from "tus-js-client";
import { BUCKET } from "./domain";
export type Ticket = {
  endpoint: string;
  path: string;
  token: string;
  mime: string;
  exists?: boolean;
};
export function sendFile(
  file: File,
  ticket: Ticket,
  progress: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    const upload = new Upload(file, {
      endpoint: ticket.endpoint,
      headers: {
        "x-signature": ticket.token,
        ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
          : {}),
      },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: false,
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
      fingerprint: async () => `rbk-audit:${ticket.path}`,
      metadata: {
        bucketName: BUCKET,
        objectName: ticket.path,
        contentType: ticket.mime,
        cacheControl: "0",
      },
      onProgress: (sent) => progress(sent),
      onSuccess: () => {
        cleanup();
        resolve();
      },
      onError: () => {
        cleanup();
        reject(new Error("Falha no envio. Use Retomar para tentar novamente."));
      },
    });
    const cancel = () => {
      void upload.abort(false);
      cleanup();
      reject(new Error("Envio pausado. Você pode retomar neste navegador."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    void upload
      .findPreviousUploads()
      .then((previous) => {
        if (signal?.aborted) return;
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => {
        cleanup();
        reject(new Error("Não foi possível preparar o envio."));
      });
  });
}
export async function contentHash(file: Blob) {
  const raw = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(raw), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
