/** CNPJ has 14 positions; the final two are numeric check digits. */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function formatCnpj(value: string): string {
  const raw = normalizeCnpj(value).slice(0, 14);
  return raw.replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{6})(.)/, "$1.$2")
    .replace(/^(.{10})(.)/, "$1/$2")
    .replace(/^(.{15})(.)/, "$1-$2");
}
