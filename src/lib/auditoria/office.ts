import { managerApi } from "./client";
import { MAX_FILE, OFFICE_MIME } from "./domain";
import { contentHash, sendFile } from "./upload";
export async function uploadOffice(
  auditId: string,
  file: File,
  progress: (n: number) => void,
) {
  const mime = validateOffice(file);
  const manifest = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    mime,
    fingerprint: await contentHash(file),
  };
  const ticket = await managerApi(`/${auditId}/office_begin`, "POST", {
    file: manifest,
  });
  if (!ticket.exists) await sendFile(file, ticket, progress);
  else progress(file.size);
  await managerApi(`/${auditId}/office_complete`, "POST", {
    file_id: ticket.id,
  });
}

export function validateOffice(file: File) {
  const mime = OFFICE_MIME[file.name.split(".").pop()?.toLowerCase() || ""];
  if (!mime || file.size < 1 || file.size > MAX_FILE)
    throw new Error("Ofício: use PDF, HTML, JPG, PNG ou TIFF de até 100 MB.");
  return mime;
}
