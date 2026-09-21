// Run only on an isolated staging worker with ClamAV installed and fresh signatures.
// No document data, tokens or filenames are logged. No automatic deletion in Storage.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { scannerPreflight } from "./auditoria-scan-preflight.mjs";
const ref = process.env.AUDIT_STAGING_PROJECT_REF;
if (
  process.env.AUDIT_PORTAL_ENABLED !== "true" ||
  process.env.VERCEL_ENV === "production" ||
  !ref ||
  ref === "sqamrlckyuesfmibxizy" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`
)
  throw Error("Validated staging configuration required");
const scanner = process.env.AUDIT_CLAMSCAN_PATH || "clamscan";
const database = process.env.AUDIT_CLAMAV_DATABASE;
// Fail closed before reading the queue; outages never consume file attempts.
try { console.log(JSON.stringify({event:"scanner_ready", ...await scannerPreflight(scanner,database)})); }
catch { throw Error("Antivírus indisponível ou desatualizado. Nenhum arquivo processado."); }
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data: files, error } = await client
  .from("aud_files")
  .select("id,storage_path,size,mime,fingerprint,source")
  .not("received_at", "is", null)
  .in("scan", ["pending", "error"])
  .lt("scan_attempts", 3)
  .lte("next_scan_at", new Date().toISOString())
  .order("scanned_at", { ascending: true, nullsFirst: true })
  .limit(20);
if (error) throw Error("Cannot load scan queue");
for (const f of files) {
  const dir = await mkdtemp(join(tmpdir(), "rbk-scan-"));
  const file = join(dir, "document");
  let result = "error",
    sha = "0".repeat(64);
  try {
    const { data, error } = await client.storage
      .from("auditoria-private")
      .createSignedUrl(f.storage_path, 60);
    if (error) throw Error("storage");
    const res = await fetch(data.signedUrl, {
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok || !res.body) throw Error("download");
    let received = 0;
    const hash = createHash("sha256");
    const bounded = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > f.size || received > 104857600)
          return callback(Error("size"));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(res.body),
      bounded,
      createWriteStream(file, { flags: "wx", mode: 0o600 }),
    );
    sha = hash.digest("hex");
    if ((await stat(file)).size !== f.size || sha !== f.fingerprint)
      throw Object.assign(Error("integrity"), { terminal: true });
    const content = await readFile(file);
    const head = content.subarray(0, 8);
    const matches =
      f.mime === "application/pdf"
        ? head.subarray(0, 5).toString() === "%PDF-"
        : f.mime === "image/jpeg"
          ? head.subarray(0, 3).toString("hex") === "ffd8ff"
          : f.mime === "image/png"
            ? head.toString("hex") === "89504e470d0a1a0a"
            : f.mime === "image/tiff"
              ? ["49492a00", "4d4d002a"].includes(
                  head.subarray(0, 4).toString("hex"),
                )
              : f.mime === "text/html" && f.source === "office"
                ? !content.includes(0) && /<(?:!doctype\s+html|html|head|body)(?:\s|>)/i.test(content.subarray(0, 4096).toString("utf8"))
                : false;
    if (!matches) throw Object.assign(Error("signature"), { terminal: true });
    const code = await new Promise((resolve, reject) => {
      const child = spawn(
        scanner,
        [
          "--no-summary",
          ...(database ? [`--database=${database}`] : []),
          "--alert-encrypted=yes",
          "--alert-exceeds-max=yes",
          "--max-filesize=100M",
          "--max-scansize=200M",
          "--max-recursion=10",
          "--max-files=1000",
          "--",
          file,
        ],
        { stdio: "ignore", timeout: 180000 },
      );
      child.on("error", reject);
      child.on("close", resolve);
    });
    result = code === 0 ? "clean" : code === 1 ? "infected" : "error";
  } catch (e) {
    result = e?.terminal ? "rejected" : "error";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const saved = await client.rpc("aud_scan_result", { fid: f.id, result, sha });
  if (saved.error) throw Error("Cannot save scan result");
  console.log(
    JSON.stringify({ event: "scan_completed", fileId: f.id, result }),
  );
}
