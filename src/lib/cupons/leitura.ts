import "server-only";
import { Worker } from "node:worker_threads";
import path from "node:path";
import type { PaginaCupom } from "./parser";
export async function lerCupom(bytes: Buffer): Promise<PaginaCupom[]> {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("Use um cupom de até 10 MB.");
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(process.cwd(), "scripts/cupom-reader.cjs"),
      { workerData: bytes, resourceLimits: { maxOldGenerationSizeMb: 256 } },
    );
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(
        new Error(
          "Leitura excedeu 90 segundos. Use uma imagem menor e legível.",
        ),
      );
    }, 90000);
    let terminou = false;
    const finalizar = () => {
      terminou = true;
      clearTimeout(timer);
      void worker.terminate();
    };
    worker.once("message", (r: { paginas?: PaginaCupom[]; erro?: string }) => {
      finalizar();
      if (r.erro || !r.paginas)
        reject(new Error(r.erro || "Leitura incompleta."));
      else resolve(r.paginas);
    });
    worker.once("error", () => {
      finalizar();
      reject(
        new Error(
          "Não foi possível ler o cupom. Confira o arquivo e tente novamente.",
        ),
      );
    });
    worker.once("exit", () => {
      if (!terminou) {
        clearTimeout(timer);
        reject(new Error("Leitura interrompida. Tente novamente."));
      }
    });
  });
}
