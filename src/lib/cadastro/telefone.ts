/** Brazilian national phone: DDD followed by 8 or 9 digits. */
export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const number = digits.slice(2);
  const split = number.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ''}`;
}

/** Validation never truncates incoming data; empty phones remain optional. */
export function normalizeTelefone(value: string): string | null {
  const input = value.trim();
  if (!input) return '';
  if (!/^[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (!/^[1-9]{2}\d{8,9}$/.test(digits)) return null;
  return formatTelefone(digits);
}
