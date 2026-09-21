export const BUCKET = "auditoria-private";
export const MAX_FILE = 100 * 1024 * 1024;
export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
};
export const OFFICE_MIME: Record<string, string> = { ...MIME, html: "text/html", htm: "text/html" };
export type ManifestFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  fingerprint: string;
};
export type AuditFile = {
  id: string;
  filename: string;
  size: number;
  received_at: string | null;
  scan?: string;
};
export type Batch = {
  id: string;
  number: number;
  started_at: string;
  completed_at: string | null;
  protocol: string | null;
  files: AuditFile[];
};
export type Summary = {
  can_delete?: boolean;
  audit: {
    id: string;
    farm_id?: string;
    pharmacy: string;
    cnpj: string;
    reference: string;
    requested?: number;
    confirmed_at?: string | null;
    contact_email?: string;
    contact_phone?: string;
    deadline: string | null;
    notes?: string;
    collection: "open" | "closed";
    created_at?: string;
  };
  total_files: number;
  total_bytes: number;
  last_received: string | null;
  batches: Batch[];
  link?: { expires_at: string; revoked_at: string | null };
  offices?: (AuditFile & { created_at: string })[];
  events?: { id: number; event: string; created_at: string }[];
};
export function bytes(n: number) {
  const divisor = n >= 1_000_000 ? 1_000_000 : n >= 1_000 ? 1_000 : 1;
  const unit = divisor === 1_000_000 ? "MB" : divisor === 1_000 ? "KB" : "bytes";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n / divisor) + " " + unit;
}
export function date(s: string | null | undefined) {
  return s
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(s))
    : "—";
}
